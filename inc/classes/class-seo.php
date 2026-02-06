<?php
/**
 * Class to handle teh SEO functionality for the GoDAM block.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Blocks
 */
class Seo {

	use Singleton;

	const VIDEO_SEO_SCHEMA_META_KEY         = 'godam_video_seo_schema';
	const VIDEO_SEO_SCHEMA_UPDATED_META_KEY = 'godam_video_seo_schema_updated';

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	public function setup_hooks() {
		add_action( 'save_post', array( $this, 'save_seo_data_as_postmeta' ), 10, 2 );
		add_action( 'save_post', array( $this, 'elementor_save_seo_data_as_postmeta' ), 10, 1 );
		add_filter( 'rest_prepare_attachment', array( $this, 'add_video_duration_for_video_seo' ), 10, 2 );
		add_action( 'wp_head', array( $this, 'add_video_seo_schema' ) );
	}

	/**
	 * Save SEO schema data from 'godam/video' blocks as post meta.
	 *
	 * This function parses the Gutenberg block content of the post and extracts
	 * any `seo` attribute from blocks of type `godam/video`. The extracted data is
	 * then saved in the post meta under the key `godam_video_seo_schema`, along with
	 * a timestamp in `godam_video_seo_schema_updated`.
	 *
	 * @param int     $post_ID Post ID.
	 * @param WP_Post $post    Post object.
	 */
	public function save_seo_data_as_postmeta( $post_ID, $post ) {
		// Bail if this is an autosave or revision.
		if ( wp_is_post_autosave( $post_ID ) || wp_is_post_revision( $post_ID ) ) {
			return;
		}

		// Ensure we're working with a valid WP_Post object.
		if ( ! $post instanceof \WP_Post ) {
			return;
		}

		$content = $post->post_content;

		// Parse blocks only if content exists and contains blocks.
		if ( empty( $content ) || strpos( $content, '<!-- wp:' ) === false ) {
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY );
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY );
			return;
		}

		$blocks           = parse_blocks( $content );
		$video_seo_schema = array();

		foreach ( $blocks as $block ) {
			// Flatten nested blocks (if any).
			$video_seo_schema = array_merge(
				$video_seo_schema,
				$this->extract_video_seo_schema_from_block( $block )
			);
		}

		if ( ! empty( $video_seo_schema ) ) {
			update_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY, $video_seo_schema );
			update_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY, time() );
		} else {
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY );
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY );
		}
	}

	/**
	 * Extract SEO schema from a block.
	 *
	 * If the block has seoOverride set to false or not set, it will fetch SEO from the media library.
	 * Otherwise, it will use the SEO data from the block attributes.
	 *
	 * @param array $block Block data.
	 * @return array Extracted SEO schema.
	 */
	private function extract_video_seo_schema_from_block( $block ) {
		$schemas = array();

		if ( isset( $block['blockName'] ) && 'godam/video' === $block['blockName'] ) {
			$seo_override  = isset( $block['attrs']['seoOverride'] ) ? $block['attrs']['seoOverride'] : false;
			$attachment_id = isset( $block['attrs']['id'] ) ? (int) $block['attrs']['id'] : 0;

			if ( $seo_override && isset( $block['attrs']['seo'] ) && ! empty( $block['attrs']['seo'] ) ) {
				// Use overridden SEO from block attributes.
				$schemas[] = $block['attrs']['seo'];
			} elseif ( $attachment_id > 0 ) {
				// Fetch SEO from media library attachment.
				$media_seo = $this->get_seo_from_attachment( $attachment_id );
				if ( ! empty( $media_seo ) ) {
					$schemas[] = $media_seo;
				}
			} elseif ( isset( $block['attrs']['seo'] ) && ! empty( $block['attrs']['seo'] ) ) {
				// Fallback to block SEO if no attachment ID.
				$schemas[] = $block['attrs']['seo'];
			}
		}

		if ( ! empty( $block['innerBlocks'] ) ) {
			foreach ( $block['innerBlocks'] as $inner_block ) {
				$schemas = array_merge(
					$schemas,
					$this->extract_video_seo_schema_from_block( $inner_block )
				);
			}
		}

		return $schemas;
	}

	/**
	 * Get SEO data from a media library attachment.
	 * 
	 * @since n.e.x.t
	 *
	 * @param int $attachment_id The attachment ID.
	 * @return array The SEO data from the attachment.
	 */
	public function get_seo_from_attachment( $attachment_id ) {
		$attachment = get_post( $attachment_id );

		if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
			return array();
		}

		$meta = get_post_meta( $attachment_id );

		// Get transcoded URL or fallback to attachment URL.
		$content_url = '';
		if ( ! empty( $meta['rtgodam_transcoded_url'][0] ) ) {
			$content_url = $meta['rtgodam_transcoded_url'][0];
		} else {
			$content_url = wp_get_attachment_url( $attachment_id );
		}

		// Get video duration in ISO 8601 format.
		$duration        = '';
		$attachment_meta = wp_get_attachment_metadata( $attachment_id );
		if ( ! empty( $attachment_meta['length'] ) && is_numeric( $attachment_meta['length'] ) ) {
			$duration = $this->seconds_to_iso8601( (int) $attachment_meta['length'] );
		}

		// Get thumbnail URL.
		$thumbnail_url = '';
		if ( ! empty( $meta['rtgodam_media_video_thumbnail'][0] ) ) {
			$thumbnail_url = $meta['rtgodam_media_video_thumbnail'][0];
		}

		// Get upload date in ISO 8601 format.
		$upload_date = '';
		if ( ! empty( $attachment->post_date_gmt ) && '0000-00-00 00:00:00' !== $attachment->post_date_gmt ) {
			$upload_date = gmdate( 'c', strtotime( $attachment->post_date_gmt ) );
		}

		// Strip HTML from description.
		$description = wp_strip_all_tags( $attachment->post_content );

		return array(
			'contentUrl'       => $content_url,
			'headline'         => $attachment->post_title,
			'description'      => $description,
			'uploadDate'       => $upload_date,
			'duration'         => $duration,
			'thumbnailUrl'     => $thumbnail_url,
			'isFamilyFriendly' => true,
		);
	}

	/**
	 * Convert seconds to ISO 8601 duration format.
	 *
	 * @param int $seconds Duration in seconds.
	 * @return string ISO 8601 duration string.
	 */
	private function seconds_to_iso8601( $seconds ) {
		$hours   = floor( $seconds / 3600 );
		$minutes = floor( ( $seconds % 3600 ) / 60 );
		$secs    = $seconds % 60;

		$iso_duration = 'PT';
		if ( $hours > 0 ) {
			$iso_duration .= $hours . 'H';
		}
		if ( $minutes > 0 ) {
			$iso_duration .= $minutes . 'M';
		}
		if ( $secs > 0 || 'PT' === $iso_duration ) {
			$iso_duration .= $secs . 'S';
		}

		return $iso_duration;
	}

	/**
	 * Add ISO 8601 video duration to REST API response for video attachments.
	 *
	 * @param WP_REST_Response $response  The response object.
	 * @param WP_Post          $post      The attachment post object.
	 * @return WP_REST_Response
	 */
	public function add_video_duration_for_video_seo( $response, $post ) {
		if ( 'video' === $post->post_mime_type || str_starts_with( $post->post_mime_type, 'video/' ) ) {
			$meta = wp_get_attachment_metadata( $post->ID );

			if ( ! empty( $meta['length'] ) && is_numeric( $meta['length'] ) ) {
				$duration_seconds = (int) $meta['length'];

				$hours   = floor( $duration_seconds / 3600 );
				$minutes = floor( ( $duration_seconds % 3600 ) / 60 );
				$seconds = $duration_seconds % 60;

				$iso_duration = 'PT';
				if ( $hours > 0 ) {
					$iso_duration .= $hours . 'H';
				}
				if ( $minutes > 0 ) {
					$iso_duration .= $minutes . 'M';
				}
				if ( $seconds > 0 || 'PT' === $iso_duration ) {
					$iso_duration .= $seconds . 'S';
				}

				$response->data['video_duration_iso8601'] = $iso_duration;
			}
		}

		return $response;
	}

	/**
	 * Outputs structured data for VideoObject schema on singular pages.
	 *
	 * This function parses the post content to extract video SEO data dynamically.
	 * For blocks with seoOverride=false, it fetches the latest SEO data from the
	 * media library attachment, ensuring it's always up-to-date.
	 * For blocks with seoOverride=true, it uses the overridden SEO data from the block.
	 *
	 * The schema includes properties like name, description, content URL,
	 * thumbnail, upload date, duration, and family-friendly status.
	 *
	 * Only executes on singular pages and if valid video blocks exist.
	 *
	 * @return void
	 */
	public function add_video_seo_schema() {
		if ( ! is_singular() ) {
			return;
		}

		global $post;

		if ( ! $post || empty( $post->post_content ) ) {
			return;
		}

		// Check if content contains godam/video blocks.
		if ( strpos( $post->post_content, '<!-- wp:godam/video' ) === false ) {
			return;
		}

		// Parse blocks and extract SEO data dynamically.
		// This ensures we always get the latest data from media library for non-overridden blocks.
		$blocks  = parse_blocks( $post->post_content );
		$schemas = array();

		foreach ( $blocks as $block ) {
			$block_schemas = $this->extract_video_seo_schema_from_block( $block );
			foreach ( $block_schemas as $video ) {
				if ( ! is_array( $video ) ) {
					continue;
				}

				$schema = array(
					'@context'         => 'https://schema.org',
					'@type'            => 'VideoObject',
					'name'             => sanitize_text_field( $video['headline'] ?? '' ),
					'description'      => wp_strip_all_tags( $video['description'] ?? '' ),
					'contentUrl'       => esc_url_raw( $video['contentUrl'] ?? '' ),
					'uploadDate'       => sanitize_text_field( $video['uploadDate'] ?? '' ),
					'isFamilyFriendly' => isset( $video['isFamilyFriendly'] ) ? (bool) $video['isFamilyFriendly'] : true,
				);

				if ( ! empty( $video['thumbnailUrl'] ) ) {
					$schema['thumbnailUrl'] = esc_url_raw( $video['thumbnailUrl'] );
				}

				if ( ! empty( $video['duration'] ) ) {
					$schema['duration'] = sanitize_text_field( $video['duration'] );
				}

				$schemas[] = $schema;
			}
		}

		if ( empty( $schemas ) ) {
			return;
		}

		// Output a single <script> with all VideoObject schemas.
		echo '<script type="application/ld+json">' . wp_json_encode(
			count( $schemas ) === 1 ? $schemas[0] : $schemas,
			JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
		) . '</script>';
	}

	/**
	 * Extract SEO data from Elementor godam_video widget for a given post.
	 *
	 * @param int $post_id The ID of the post.
	 * @return array Extracted SEO data array.
	 */
	public function godam_get_video_seo_data_from_elementor( $post_id ) {
		// Bail if not built with Elementor.
		if ( ! did_action( 'elementor/loaded' ) ) {
			return array();
		}

		if ( null !== \Elementor\Plugin::$instance->documents && ! \Elementor\Plugin::$instance->documents->get( $post_id )->is_built_with_elementor() ) {
			return array();
		}

		// Get the raw Elementor data.
		$data = get_post_meta( $post_id, '_elementor_data', true );
		if ( empty( $data ) ) {
			return array();
		}

		$widgets = json_decode( $data, true );
		if ( ! is_array( $widgets ) ) {
			return array();
		}

		$seo_data = array();

		$extractor = function ( $elements ) use ( &$seo_data, &$extractor ) {
			foreach ( $elements as $element ) {
				$_seo_data = array();
				if (
					isset( $element['widgetType'] ) &&
					'godam-video' === $element['widgetType']
				) {
					if (
						isset( $element['settings']['seo_content_headline'] ) &&
						! empty( $element['settings']['seo_content_headline'] )
					) {
						$_seo_data['contentUrl']       = isset( $element['settings']['seo_content_url'] ) ? $element['settings']['seo_content_url'] : '';
						$_seo_data['headline']         = isset( $element['settings']['seo_content_headline'] ) ? $element['settings']['seo_content_headline'] : '';
						$_seo_data['description']      = isset( $element['settings']['seo_content_description'] ) ? $element['settings']['seo_content_description'] : '';
						$_seo_data['uploadDate']       = isset( $element['settings']['seo_content_upload_date'] ) ? $element['settings']['seo_content_upload_date'] : '';
						$_seo_data['thumbnailUrl']     = isset( $element['settings']['seo_content_video_thumbnail_url'] ) ? $element['settings']['seo_content_video_thumbnail_url'] : '';
						$_seo_data['isFamilyFriendly'] = isset( $element['settings']['seo_content_family_friendly'] ) ? 'yes' === $element['settings']['seo_content_family_friendly'] : true;
						$_seo_data['duration']         = isset( $element['settings']['seo_content_duration'] ) ? $element['settings']['seo_content_duration'] : '';

						array_push( $seo_data, $_seo_data );
					}
				}

				if ( isset( $element['elements'] ) && is_array( $element['elements'] ) ) {
					$extractor( $element['elements'] ); // Recurse into inner elements.
				}
			}
		};

		$extractor( $widgets );

		return $seo_data;
	}

	/**
	 * Stores the SEO data for elementor.
	 *
	 * @param int $post_ID Post ID.
	 * @return void
	 */
	public function elementor_save_seo_data_as_postmeta( $post_ID ) {
		$video_seo_schema = $this->godam_get_video_seo_data_from_elementor( $post_ID );

		if ( ! empty( $video_seo_schema ) ) {
			update_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY, $video_seo_schema );
			update_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY, time() );
		}
	}
}
