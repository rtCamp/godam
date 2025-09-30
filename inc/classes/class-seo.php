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
	 * @param array $block Block data.
	 * @return array Extracted SEO schema.
	 */
	private function extract_video_seo_schema_from_block( $block ) {
		$schemas = array();

		if ( isset( $block['blockName'] ) && 'godam/video' === $block['blockName'] ) {
			if ( isset( $block['attrs']['seo'] ) && ! empty( $block['attrs']['seo'] ) ) {
				$schemas[] = $block['attrs']['seo'];
			} elseif ( isset( $block['attrs']['id'] ) && is_numeric( $block['attrs']['id'] ) ) {
				// Fetch default SEO from attachment metadata.
				$attachment_id = intval( $block['attrs']['id'] );

				$attachment_title = get_the_title( $attachment_id );
				$attachment_desc  = get_post_field( 'post_content', $attachment_id );
				$attachment_url   = wp_get_attachment_url( $attachment_id );
				$attachment_date  = get_the_date( 'c', $attachment_id );
				$attachment_thumb = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );
				$attachment_meta  = wp_get_attachment_metadata( $attachment_id );
				$duration         = '';
				if ( ! empty( $attachment_meta['length'] ) && is_numeric( $attachment_meta['length'] ) ) {
					$duration_seconds = (int) $attachment_meta['length'];

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

					$duration = $iso_duration;
				}

				if ( empty( $attachment_thumb ) ) {
					$attachment_thumb = get_the_post_thumbnail_url( $attachment_id, 'full' );
				}

				$schemas[] = array(
					'contentUrl'       => esc_url_raw( $attachment_url ),
					'headline'         => sanitize_text_field( $attachment_title ),
					'description'      => wp_strip_all_tags( $attachment_desc ),
					'uploadDate'       => sanitize_text_field( $attachment_date ),
					'isFamilyFriendly' => false, // Default to false for attachments.
				);

				if ( ! empty( $attachment_thumb ) ) {
					$schema['thumbnailUrl'] = esc_url_raw( $attachment_thumb );
				}

				if ( ! empty( $duration ) ) {
					$schema['duration'] = sanitize_text_field( $duration );
				}           
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
	 * This function retrieves custom video SEO metadata from the current post
	 * and generates a single JSON-LD script tag containing one or more
	 * VideoObject schemas. This improves SEO and video visibility in search engines.
	 *
	 * The schema includes properties like name, description, embed URL, content URL,
	 * thumbnail, upload date, duration, and family-friendly status.
	 *
	 * Only executes on singular pages and if valid video metadata exists.
	 *
	 * @return void
	 */
	public function add_video_seo_schema() {
		if ( ! is_singular() ) {
			return;
		}

		global $post;

		$raw = get_post_meta( $post->ID, self::VIDEO_SEO_SCHEMA_META_KEY, true );

		// Normalize and validate raw data.
		if ( empty( $raw ) ) {
			return;
		}

		if ( ! is_array( $raw ) ) {
			$raw = maybe_unserialize( $raw );
		}

		if ( ! is_array( $raw ) || empty( $raw ) ) {
			return;
		}

		$schemas = array();

		foreach ( $raw as $video ) {
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
