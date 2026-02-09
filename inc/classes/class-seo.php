<?php
/**
 * Class to handle the SEO functionality for the GoDAM block.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Seo
 */
class Seo {

	use Singleton;

	const VIDEO_SEO_SCHEMA_META_KEY         = 'godam_video_seo_schema';
	const VIDEO_SEO_SCHEMA_UPDATED_META_KEY = 'godam_video_seo_schema_updated';
	const ATTACHMENT_POSTS_MAP_META_KEY     = 'godam_posts_using_attachment';
	const POST_ATTACHMENTS_META_KEY         = '_godam_seo_attachments';

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

		// Hook to update SEO when attachment is edited.
		add_action( 'edit_attachment', array( $this, 'schedule_seo_sync_for_attachment' ) );
		add_action( 'godam_sync_attachment_seo', array( $this, 'sync_seo_for_attachment_posts' ) );
	}

	/**
	 * Save SEO schema data from 'godam/video' blocks as post meta.
	 *
	 * This function parses the Gutenberg block content of the post and extracts
	 * any `seo` attribute from blocks of type `godam/video`. The extracted data is
	 * then saved in the post meta under the key `godam_video_seo_schema`, along with
	 * a timestamp in `godam_video_seo_schema_updated`.
	 *
	 * Also handles WPBakery shortcodes in the same post.
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

		// Skip if this is an Elementor post (handled separately).
		$is_elementor = 'builder' === get_post_meta( $post_ID, '_elementor_edit_mode', true );
		if ( $is_elementor ) {
			return;
		}

		$content = $post->post_content;

		$video_seo_schema = array();
		$attachments_used = array();

		// Parse Gutenberg blocks if content contains them.
		if ( ! empty( $content ) && strpos( $content, '<!-- wp:godam/video' ) !== false ) {
			$blocks = parse_blocks( $content );

			foreach ( $blocks as $block ) {
				$result           = $this->extract_video_seo_schema_from_block( $block, true );
				$video_seo_schema = array_merge( $video_seo_schema, $result['schemas'] );
				$attachments_used = array_merge( $attachments_used, $result['attachments'] );
			}
		}

		// Parse WPBakery shortcodes if they exist.
		if ( ! empty( $content ) && has_shortcode( $content, 'godam_video' ) ) {
			$result           = $this->godam_get_video_seo_data_from_wpbakery( $content, true );
			$video_seo_schema = array_merge( $video_seo_schema, $result['schemas'] );
			$attachments_used = array_merge( $attachments_used, $result['attachments'] );
		}

		if ( ! empty( $video_seo_schema ) ) {
			update_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY, $video_seo_schema );
			update_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY, time() );
			$this->update_attachment_post_mapping( $post_ID, array_unique( $attachments_used ) );
		} else {
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY );
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY );
			$this->update_attachment_post_mapping( $post_ID, array() );
		}
	}

	/**
	 * Extract SEO schema from a block.
	 *
	 * If the block has seoOverride set to false or not set, it will fetch SEO from the media library.
	 * Otherwise, it will use the SEO data from the block attributes.
	 *
	 * @param array $block             Block data.
	 * @param bool  $track_attachments Whether to track attachments used.
	 * @return array Contains 'schemas' and 'attachments' arrays when tracking, otherwise just schemas.
	 */
	private function extract_video_seo_schema_from_block( $block, $track_attachments = false ) {
		$schemas     = array();
		$attachments = array();

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
					if ( $track_attachments ) {
						$attachments[] = $attachment_id;
					}
				}
			} elseif ( isset( $block['attrs']['seo'] ) && ! empty( $block['attrs']['seo'] ) ) {
				// Fallback to block SEO if no attachment ID.
				$schemas[] = $block['attrs']['seo'];
			}
		}

		if ( ! empty( $block['innerBlocks'] ) ) {
			foreach ( $block['innerBlocks'] as $inner_block ) {
				$result = $this->extract_video_seo_schema_from_block( $inner_block, $track_attachments );
				if ( $track_attachments ) {
					$schemas     = array_merge( $schemas, $result['schemas'] );
					$attachments = array_merge( $attachments, $result['attachments'] );
				} else {
					$schemas = array_merge( $schemas, $result );
				}
			}
		}

		if ( $track_attachments ) {
			return array(
				'schemas'     => $schemas,
				'attachments' => $attachments,
			);
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
	 * This function reads cached SEO data from post meta for optimal performance.
	 * The SEO data is cached when the post is saved (in save_seo_data_as_postmeta).
	 *
	 * The schema includes properties like name, description, content URL,
	 * thumbnail, upload date, duration, and family-friendly status.
	 *
	 * Only executes on singular pages and if valid cached SEO data exists.
	 *
	 * @return void
	 */
	public function add_video_seo_schema() {
		if ( ! is_singular() ) {
			return;
		}

		$post_id = get_queried_object_id();
		if ( ! $post_id ) {
			return;
		}

		// Read cached SEO schema from post meta (fast!).
		$cached_schemas = get_post_meta( $post_id, self::VIDEO_SEO_SCHEMA_META_KEY, true );

		if ( empty( $cached_schemas ) || ! is_array( $cached_schemas ) ) {
			return;
		}

		$schemas = array();

		foreach ( $cached_schemas as $video ) {
			if ( ! is_array( $video ) || empty( $video['headline'] ) ) {
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
	 * @param int  $post_id           The ID of the post.
	 * @param bool $track_attachments Whether to track attachments used.
	 * @return array Contains 'schemas' and 'attachments' arrays when tracking, otherwise just schemas.
	 */
	public function godam_get_video_seo_data_from_elementor( $post_id, $track_attachments = false ) {
		$empty_result = $track_attachments ? array(
			'schemas'     => array(),
			'attachments' => array(),
		) : array();

		// Bail if not built with Elementor.
		if ( ! did_action( 'elementor/loaded' ) ) {
			return $empty_result;
		}

		if ( null !== \Elementor\Plugin::$instance->documents && ! \Elementor\Plugin::$instance->documents->get( $post_id )->is_built_with_elementor() ) {
			return $empty_result;
		}

		// Get the raw Elementor data.
		$data = get_post_meta( $post_id, '_elementor_data', true );
		if ( empty( $data ) ) {
			return $empty_result;
		}

		$widgets = json_decode( $data, true );
		if ( ! is_array( $widgets ) ) {
			return $empty_result;
		}

		$seo_data    = array();
		$attachments = array();
		$seo_obj     = $this;

		$extractor = function ( $elements ) use ( &$seo_data, &$attachments, &$extractor, $seo_obj, $track_attachments ) {
			foreach ( $elements as $element ) {
				$_seo_data = array();
				if (
					isset( $element['widgetType'] ) &&
					'godam-video' === $element['widgetType']
				) {
					$settings     = $element['settings'];
					$seo_override = isset( $settings['seo_override'] ) && 'yes' === $settings['seo_override'];

					// If seo_override is false, try to fetch SEO from the media attachment.
					if ( ! $seo_override ) {
						// Get attachment ID from video-file setting.
						$attachment_id = 0;
						if ( isset( $settings['video-file']['id'] ) && is_numeric( $settings['video-file']['id'] ) ) {
							$attachment_id = absint( $settings['video-file']['id'] );
						}

						if ( $attachment_id > 0 ) {
							$media_seo = $seo_obj->get_seo_from_attachment( $attachment_id );
							if ( ! empty( $media_seo ) && ! empty( $media_seo['headline'] ) ) {
								$seo_data[] = $media_seo;
								if ( $track_attachments ) {
									$attachments[] = $attachment_id;
								}
								continue;
							}
						}
					}

					// Use widget settings if seo_override is true or no attachment data available.
					if (
						isset( $settings['seo_content_headline'] ) &&
						! empty( $settings['seo_content_headline'] )
					) {
						$_seo_data['contentUrl']       = isset( $settings['seo_content_url'] ) ? $settings['seo_content_url'] : '';
						$_seo_data['headline']         = isset( $settings['seo_content_headline'] ) ? $settings['seo_content_headline'] : '';
						$_seo_data['description']      = isset( $settings['seo_content_description'] ) ? $settings['seo_content_description'] : '';
						$_seo_data['uploadDate']       = isset( $settings['seo_content_upload_date'] ) ? $settings['seo_content_upload_date'] : '';
						$_seo_data['thumbnailUrl']     = isset( $settings['seo_content_video_thumbnail_url'] ) ? $settings['seo_content_video_thumbnail_url'] : '';
						$_seo_data['isFamilyFriendly'] = isset( $settings['seo_content_family_friendly'] ) ? 'yes' === $settings['seo_content_family_friendly'] : true;
						$_seo_data['duration']         = isset( $settings['seo_content_duration'] ) ? $settings['seo_content_duration'] : '';

						$seo_data[] = $_seo_data;
					}
				}

				if ( isset( $element['elements'] ) && is_array( $element['elements'] ) ) {
					$extractor( $element['elements'] ); // Recurse into inner elements.
				}
			}
		};

		$extractor( $widgets );

		if ( $track_attachments ) {
			return array(
				'schemas'     => $seo_data,
				'attachments' => $attachments,
			);
		}

		return $seo_data;
	}

	/**
	 * Stores the SEO data for elementor.
	 *
	 * @param int $post_ID Post ID.
	 * @return void
	 */
	public function elementor_save_seo_data_as_postmeta( $post_ID ) {
		// Check if Elementor is active and this post uses Elementor.
		if ( ! did_action( 'elementor/loaded' ) ) {
			return;
		}

		$edit_mode = get_post_meta( $post_ID, '_elementor_edit_mode', true );
		if ( 'builder' !== $edit_mode ) {
			return;
		}

		$result           = $this->godam_get_video_seo_data_from_elementor( $post_ID, true );
		$video_seo_schema = $result['schemas'];
		$attachments_used = $result['attachments'];

		if ( ! empty( $video_seo_schema ) ) {
			update_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY, $video_seo_schema );
			update_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY, time() );
			$this->update_attachment_post_mapping( $post_ID, array_unique( $attachments_used ) );
		} else {
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY );
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY );
			$this->update_attachment_post_mapping( $post_ID, array() );
		}
	}

	/**
	 * Extract SEO data from WPBakery godam_video shortcodes.
	 *
	 * @param string $content           The post content containing shortcodes.
	 * @param bool   $track_attachments Whether to track attachments used.
	 * @return array Contains 'schemas' and 'attachments' arrays when tracking, otherwise just schemas.
	 */
	public function godam_get_video_seo_data_from_wpbakery( $content, $track_attachments = false ) {
		$seo_data    = array();
		$attachments = array();

		if ( empty( $content ) ) {
			return $track_attachments ? array(
				'schemas'     => $seo_data,
				'attachments' => $attachments,
			) : $seo_data;
		}

		// Match all godam_video shortcodes.
		$pattern = get_shortcode_regex( array( 'godam_video' ) );

		if ( preg_match_all( '/' . $pattern . '/s', $content, $matches, PREG_SET_ORDER ) ) {
			foreach ( $matches as $match ) {
				$atts = shortcode_parse_atts( $match[3] );

				if ( empty( $atts ) || ! is_array( $atts ) ) {
					continue;
				}

				$seo_override = isset( $atts['seo_override'] ) && '1' === $atts['seo_override'];

				// If seo_override is false, try to fetch SEO from the media attachment.
				if ( ! $seo_override ) {
					$attachment_id = isset( $atts['id'] ) ? absint( $atts['id'] ) : 0;

					if ( $attachment_id > 0 ) {
						$media_seo = $this->get_seo_from_attachment( $attachment_id );
						if ( ! empty( $media_seo ) && ! empty( $media_seo['headline'] ) ) {
							$seo_data[] = $media_seo;
							if ( $track_attachments ) {
								$attachments[] = $attachment_id;
							}
							continue;
						}
					}
				}

				// Use shortcode attributes if seo_override is true or no attachment data available.
				if ( ! empty( $atts['seo_headline'] ) ) {
					$video_seo = array(
						'contentUrl'       => isset( $atts['seo_content_url'] ) ? $atts['seo_content_url'] : '',
						'headline'         => isset( $atts['seo_headline'] ) ? $atts['seo_headline'] : '',
						'description'      => isset( $atts['seo_description'] ) ? $atts['seo_description'] : '',
						'uploadDate'       => isset( $atts['seo_upload_date'] ) ? $atts['seo_upload_date'] : '',
						'thumbnailUrl'     => isset( $atts['seo_thumbnail_url'] ) ? $atts['seo_thumbnail_url'] : '',
						'isFamilyFriendly' => isset( $atts['seo_family_friendly'] ) ? '1' === $atts['seo_family_friendly'] : true,
						'duration'         => isset( $atts['seo_duration'] ) ? $atts['seo_duration'] : '',
					);

					$seo_data[] = $video_seo;
				}
			}
		}

		if ( $track_attachments ) {
			return array(
				'schemas'     => $seo_data,
				'attachments' => $attachments,
			);
		}

		return $seo_data;
	}

	/**
	 * Update the mapping of which posts use a specific attachment (non-override only).
	 *
	 * @param int   $post_id     The post ID.
	 * @param array $attachments Array of attachment IDs used in the post.
	 */
	private function update_attachment_post_mapping( $post_id, $attachments ) {
		// Get current attachments this post was using.
		$previous_attachments = get_post_meta( $post_id, self::POST_ATTACHMENTS_META_KEY, true );
		$previous_attachments = is_array( $previous_attachments ) ? $previous_attachments : array();

		// Remove post from old attachments' mapping.
		$removed_attachments = array_diff( $previous_attachments, $attachments );
		foreach ( $removed_attachments as $attachment_id ) {
			$posts_using = get_post_meta( $attachment_id, self::ATTACHMENT_POSTS_MAP_META_KEY, true );
			$posts_using = is_array( $posts_using ) ? $posts_using : array();
			$posts_using = array_diff( $posts_using, array( $post_id ) );
			if ( ! empty( $posts_using ) ) {
				update_post_meta( $attachment_id, self::ATTACHMENT_POSTS_MAP_META_KEY, array_values( $posts_using ) );
			} else {
				delete_post_meta( $attachment_id, self::ATTACHMENT_POSTS_MAP_META_KEY );
			}
		}

		// Add post to new attachments' mapping.
		$new_attachments = array_diff( $attachments, $previous_attachments );
		foreach ( $new_attachments as $attachment_id ) {
			$posts_using = get_post_meta( $attachment_id, self::ATTACHMENT_POSTS_MAP_META_KEY, true );
			$posts_using = is_array( $posts_using ) ? $posts_using : array();
			if ( ! in_array( $post_id, $posts_using, true ) ) {
				$posts_using[] = $post_id;
				update_post_meta( $attachment_id, self::ATTACHMENT_POSTS_MAP_META_KEY, $posts_using );
			}
		}

		// Update post's attachment list.
		if ( ! empty( $attachments ) ) {
			update_post_meta( $post_id, self::POST_ATTACHMENTS_META_KEY, $attachments );
		} else {
			delete_post_meta( $post_id, self::POST_ATTACHMENTS_META_KEY );
		}
	}

	/**
	 * Schedule a background job to sync SEO for all posts using an attachment.
	 *
	 * @param int $attachment_id The attachment ID.
	 */
	public function schedule_seo_sync_for_attachment( $attachment_id ) {
		$attachment = get_post( $attachment_id );

		// Only process video attachments.
		if ( ! $attachment || strpos( $attachment->post_mime_type, 'video/' ) !== 0 ) {
			return;
		}

		// Check if any posts are using this attachment.
		$posts_using = get_post_meta( $attachment_id, self::ATTACHMENT_POSTS_MAP_META_KEY, true );
		if ( empty( $posts_using ) || ! is_array( $posts_using ) ) {
			return;
		}

		// Schedule the sync to run in the background.
		if ( ! wp_next_scheduled( 'godam_sync_attachment_seo', array( $attachment_id ) ) ) {
			wp_schedule_single_event( time(), 'godam_sync_attachment_seo', array( $attachment_id ) );
		}
	}

	/**
	 * Sync SEO for all posts using a specific attachment.
	 * This runs as a background task when an attachment is updated.
	 *
	 * @param int $attachment_id The attachment ID.
	 */
	public function sync_seo_for_attachment_posts( $attachment_id ) {
		$posts_using = get_post_meta( $attachment_id, self::ATTACHMENT_POSTS_MAP_META_KEY, true );

		if ( empty( $posts_using ) || ! is_array( $posts_using ) ) {
			return;
		}

		foreach ( $posts_using as $post_id ) {
			$post = get_post( $post_id );
			if ( ! $post ) {
				continue;
			}

			// Check if it's an Elementor post.
			$is_elementor = 'builder' === get_post_meta( $post_id, '_elementor_edit_mode', true );

			if ( $is_elementor ) {
				$this->elementor_save_seo_data_as_postmeta( $post_id );
			} else {
				$this->save_seo_data_as_postmeta( $post_id, $post );
			}
		}
	}
}
