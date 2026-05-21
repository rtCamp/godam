<?php
/**
 * Class to handle Media Folders.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Media_Library
 */
class Media_Library_Ajax {

	use Singleton;

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
		add_filter( 'ajax_query_attachments_args', array( $this, 'filter_media_library_by_taxonomy' ) );
		add_action( 'pre_get_posts', array( $this, 'pre_get_post_filter' ) );

		add_action( 'restrict_manage_posts', array( $this, 'restrict_manage_media_filter' ) );
		add_action( 'add_attachment', array( $this, 'add_media_library_taxonomy_on_media_upload' ), 10, 1 );
		add_action( 'add_attachment', array( $this, 'upload_media_to_frappe_backend' ), 10, 1 );
		add_filter( 'wp_prepare_attachment_for_js', array( $this, 'add_media_transcoding_status_js' ), 10, 2 );

		add_action( 'pre_delete_term', array( $this, 'delete_child_media_folder' ), 10, 2 );

		add_action( 'admin_notices', array( $this, 'media_library_offer_banner' ) );
		add_action( 'wp_ajax_godam_dismiss_offer_banner', array( $this, 'dismiss_offer_banner' ) );

		add_action( 'rtgodam_handle_callback_finished', array( $this, 'download_transcoded_mp4_source' ), 10, 4 );

		add_filter( 'wp_get_attachment_url', array( $this, 'filter_attachment_url_for_virtual_media' ), 10, 2 );

		// Add filters for virtual media srcset support.
		add_filter( 'wp_calculate_image_srcset_meta', array( $this, 'filter_image_srcset_meta' ), 10, 4 );
		add_filter( 'wp_calculate_image_srcset', array( $this, 'filter_virtual_media_srcset' ), 10, 5 );

		// Add admin notice for HTTP auth and AJAX handler to save HTTP auth status.
		add_action( 'admin_notices', array( $this, 'http_auth_warning_notice' ) );
		add_action( 'wp_ajax_godam_save_http_auth_status', array( $this, 'save_http_auth_status' ) );

		add_action( 'wp_ajax_godam_get_media_versions', array( $this, 'get_media_versions' ) );
		add_action( 'wp_ajax_godam_switch_active_version', array( $this, 'switch_active_version' ) );
		add_action( 'wp_ajax_godam_delete_version', array( $this, 'delete_version' ) );
		add_action( 'wp_ajax_godam_replace_media_version', array( $this, 'replace_media_version' ) );
		add_action( 'wp_ajax_godam_finalize_media_version_replace', array( $this, 'finalize_media_version_replace' ) );
		add_action( 'rtgodam_handle_callback_finished', array( $this, 'replace_media_urls_after_version_callback' ), 20, 4 );

		add_filter( 'wp_content_img_tag', array( $this, 'filter_rtgodam_content_img_tag' ), 10, 3 );
	}

	/**
	 * Validate if a URL is valid.
	 * Ref: https://cmljnelson.blog/2018/08/31/url-validation-in-wordpress
	 *
	 * @since 1.5.0
	 *
	 * @param string $url The URL to validate.
	 * @return bool True if valid, false otherwise.
	 */
	public function is_valid_url( $url ) {
		return esc_url_raw( $url ) === $url;
	}

	/**
	 * Prepare a single Godam media item to match WordPress media format.
	 *
	 * @param array $item The media item data from the API.
	 * @return array
	 */
	public function prepare_godam_media_item( $item ) {
		// Ensure $item is an array.
		$item = (array) $item;

		if ( empty( $item['name'] ) || empty( $item['file_origin'] ) ) {
			return array();
		}

		$job_type      = $item['job_type'] ?? '';
		$api_mime_type = $item['mime_type'] ?? '';
		$computed_mime = $this->get_mime_type_for_job_type( $job_type, $api_mime_type );
		$title         = isset( $item['title'] ) ? $item['title'] : ( isset( $item['orignal_file_name'] ) ? pathinfo( $item['orignal_file_name'], PATHINFO_FILENAME ) : $item['name'] );
		// trim the extension from title if present.
		$title = preg_replace( '/\.[^.]+$/', '', $title );

		// Get video duration in seconds.
		$video_duration = isset( $item['playtime'] ) ? $item['playtime'] : 0;
		// Round video duration to integer seconds.
		$video_duration = is_numeric( $video_duration ) ? (int) round( $video_duration ) : 0;

		$result = array(
			'id'                    => $item['name'],
			'title'                 => $title,
			'description'           => $item['description'] ?? '',
			'filename'              => $item['orignal_file_name'] ?? $item['name'],
			'url'                   => isset( $item['transcoded_mp4_url'] ) ? $item['transcoded_mp4_url'] : ( isset( $item['transcoded_file_path'] ) ? $item['transcoded_file_path'] : '' ),
			'mime'                  => isset( $item['transcoded_mp4_url'] ) ? 'video/mp4' : $computed_mime,
			'type'                  => $item['job_type'] ?? '',
			'subtype'               => ( isset( $item['mime_type'] ) && strpos( $item['mime_type'], '/' ) !== false ) ? explode( '/', $item['mime_type'] )[1] : 'jpg',
			'status'                => $item['status'] ?? '',
			'date'                  => isset( $item['creation'] ) ? strtotime( $item['creation'] ) * 1000 : 0,
			'modified'              => isset( $item['modified'] ) ? strtotime( $item['modified'] ) * 1000 : 0,
			'filesizeInBytes'       => $item['file_size'] ?? 0,
			'filesizeHumanReadable' => isset( $item['file_size'] ) ? size_format( $item['file_size'] ) : '',
			'owner'                 => $item['owner'] ?? '',
			'label'                 => $item['file_label'] ?? '',
			'origin'                => 'godam',
			'thumbnail_url'         => $item['thumbnail_url'] ?? '',
			'duration'              => $item['playtime'] ?? '',
			'hls_url'               => $item['transcoded_hls_path'] ?? '',
			'mpd_url'               => $item['transcoded_file_path'] ?? '',
			'video_duration'        => $video_duration ?? 0,
		);

		// Set icon with fallback to default mime type icon for audio and PDF.
		$result['icon'] = $item['thumbnail_url'] ?? '';

		// If no thumbnail URL, use WordPress default icons for audio and PDF.
		if ( empty( $result['icon'] ) ) {
			if ( 'audio' === $item['job_type'] ) {
				$result['icon'] = includes_url( 'images/media/audio.png' );
			} elseif ( 'application/pdf' === $item['mime_type'] ) {
				$result['icon'] = includes_url( 'images/media/document.png' );
			}
		}

		if ( 'stream' === $item['job_type'] ) {
			$result['type'] = 'video';
		}

		return $result;
	}

	/**
	 * Get appropriate MIME type based on job type.
	 *
	 * @param string $job_type Job type from GoDAM API.
	 * @param string $mime_type Original MIME type from API.
	 * @return string Appropriate MIME type.
	 */
	private function get_mime_type_for_job_type( $job_type, $mime_type ) {
		switch ( $job_type ) {
			case 'stream':
				return 'application/dash+xml';
			case 'audio':
				return ! empty( $mime_type ) ? $mime_type : 'audio/mpeg';
			case 'image':
				return ! empty( $mime_type ) ? $mime_type : 'image/jpeg';
			default:
				return ! empty( $mime_type ) ? $mime_type : 'application/dash+xml';
		}
	}

	/**
	 * Upload media to the Frappe backend.
	 *
	 * @param int  $attachment_id Attachment ID.
	 * @param bool $manual_retranscode Whether this is a retranscode request.
	 * @return void
	 */
	public function upload_media_to_frappe_backend( $attachment_id, $manual_retranscode = false ) {
		// Check if local development environment.
		if ( rtgodam_is_local_environment() ) {
			return;
		}

		/**
		 * Filter to allow external developers to disable automatic transcoding on upload.
		 * This allows users to have manual control over when media files get transcoded.
		 *
		 * Note: This filter only applies to automatic uploads. Manual retranscoding requests
		 * (via bulk actions, tools page, etc.) will always proceed regardless of this setting.
		 * Form integrations will also use this filter to disable transcoding for form uploads.
		 *
		 * Example usage:
		 * add_filter( 'godam_auto_transcode_on_upload', '__return_false' ); // Disable globally
		 *
		 * @since 1.5.0
		 *
		 * @param bool $auto_transcode_on_upload Whether to automatically transcode on upload. Default true.
		 */
		if ( ! $manual_retranscode ) {
			$auto_transcode_on_upload = apply_filters( 'godam_auto_transcode_on_upload', true );

			if ( ! $auto_transcode_on_upload ) {
				return;
			}
		}

		$transcoding_job_id = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );

		// Check virtual media status for transcoding requests.
		$godam_original_id = get_post_meta( $attachment_id, '_godam_original_id', true );
		$is_virtual_media  = ! empty( $godam_original_id );

		// Skip transcoding for virtual media.
		if ( $is_virtual_media ) {
			return;
		}

		// Only if attachment type is image.
		$mime_type = get_post_mime_type( $attachment_id );
		if ( 'image' !== substr( $mime_type, 0, 5 ) ) {
			return;
		}

		// Check if HTTP auth is enabled.
		if ( rtgodam_has_http_auth() ) {
			if ( $manual_retranscode ) {
				// Store in failed transcoding list for retry later.
				$failed_transcoding_attachments                   = get_option( 'rtgodam-failed-transcoding-attachments', array() );
				$failed_transcoding_attachments[ $attachment_id ] = array(
					'wp_metadata'   => array( 'mime_type' => $mime_type ),
					'attachment_id' => $attachment_id,
					'autoformat'    => true,
				);
				update_option( 'rtgodam-failed-transcoding-attachments', $failed_transcoding_attachments );
			}

			// Update status to failed.
			update_post_meta( $attachment_id, 'rtgodam_transcoding_status', 'failed' );
			update_post_meta( $attachment_id, 'rtgodam_transcoding_error_msg', __( 'HTTP authentication is enabled on your site, preventing transcoding.', 'godam' ) );
			update_post_meta( $attachment_id, 'rtgodam_transcoding_error_code', 'http_auth_enabled' );

			return;
		}

		$api_key = get_option( 'rtgodam-api-key', '' );

		if ( empty( $api_key ) ) {
			return;
		}

		$api_url = RTGODAM_API_BASE . '/api/resource/Transcoder Job' . ( empty( $transcoding_job_id ) ? '' : '/' . $transcoding_job_id );

		$attachment_url = wp_get_attachment_url( $attachment_id );

		$file_title = get_the_title( $attachment_id );
		$file_name  = pathinfo( $attachment_url, PATHINFO_FILENAME ) . '.' . pathinfo( $attachment_url, PATHINFO_EXTENSION );

		// Get attachment author information.
		$attachment_author_id = get_post_field( 'post_author', $attachment_id );
		$attachment_author    = get_user_by( 'id', $attachment_author_id );
		$site_url             = get_site_url();

		// Get author name with fallback to username.
		$author_first_name = '';
		$author_last_name  = '';
		$author_email      = '';

		if ( $attachment_author ) {
			$author_first_name = $attachment_author->first_name ?? '';
			$author_last_name  = $attachment_author->last_name ?? '';
			$author_email      = $attachment_author->user_email ?? '';

			// If first and last names are empty, use username as fallback.
			if ( empty( $author_first_name ) && empty( $author_last_name ) ) {
				$author_first_name = $attachment_author->user_login ?? '';
			}
		}

		if ( ! defined( 'RTGODAM_TRANSCODER_CALLBACK_URL' ) ) {
			include_once RTGODAM_PATH . 'admin/class-rtgodam-transcoder-rest-routes.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
			define( 'RTGODAM_TRANSCODER_CALLBACK_URL', \RTGODAM_Transcoder_Rest_Routes::get_callback_url() );
		}

		$callback_url = RTGODAM_TRANSCODER_CALLBACK_URL;

		/**
		 * Manually setting the rest api endpoint, we can refactor that later to use similar functionality as callback_url.
		 */
		$status_callback_url = get_rest_url( get_current_blog_id(), '/godam/v1/transcoding/transcoding-status' );

		// Request params.
		$params = array(
			'retranscode'          => empty( $transcoding_job_id ) ? 0 : 1,
			'api_token'            => $api_key,
			'job_type'             => 'image',
			'job_for'              => 'wp-media',
			'file_origin'          => $attachment_url,
			'orignal_file_name'    => $file_name ?? $file_title,
			'mime_type'            => $mime_type,
			'callback_url'         => rawurlencode( $callback_url ),
			'status_callback'      => rawurlencode( $status_callback_url ),
			'wp_author_email'      => apply_filters( 'godam_author_email_to_send', $author_email, $attachment_id ),
			'wp_site'              => $site_url,
			'wp_author_first_name' => apply_filters( 'godam_author_first_name_to_send', $author_first_name, $attachment_id ),
			'wp_author_last_name'  => apply_filters( 'godam_author_last_name_to_send', $author_last_name, $attachment_id ),
			'public'               => 1,
		);

		$upload_media = wp_remote_request(
			$api_url,
			array(
				'method'  => empty( $transcoding_job_id ) ? 'POST' : 'PUT',
				'body'    => wp_json_encode( $params ),
				'headers' => array(
					'Content-Type' => 'application/json',
				),
			)
		);

		if ( ! is_wp_error( $upload_media ) &&
			(
				isset( $upload_media['response']['code'] ) &&
				200 === intval( $upload_media['response']['code'] )
			)
		) {
			$upload_info = json_decode( $upload_media['body'] );

			if ( isset( $upload_info->data ) && isset( $upload_info->data->name ) ) {
				$job_id = $upload_info->data->name;
				update_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', $job_id );
			}
		}

		// Note: For now media is only uploaded to the GoDAM and we are storing the transcoding job ID in the attachment meta.
		// Todo: In future we can add more logic to handle the transcoded image URLs to provide image CDN feature.
	}

	/**
	 * Add the media library taxonomy to the uploaded media.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return void
	 */
	public function add_media_library_taxonomy_on_media_upload( $attachment_id ) {

		if ( ! isset( $_REQUEST['media-folder'] ) || empty( $_REQUEST['media-folder'] ) || $_REQUEST['media-folder'] <= 0 ) {
			return;
		}

		if ( ! isset( $_REQUEST['_wpnonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_REQUEST['_wpnonce'] ) ), 'media-form' ) ) {
			return;
		}

		// Get the media folder.
		$media_folder = intval( $_REQUEST['media-folder'] ); // Ensure it's an integer.

		// Check if the term exists.
		$term = get_term( $media_folder, 'media-folder' );

		if ( is_wp_error( $term ) || ! $term || $term->term_id !== $media_folder ) {
			return;
		}

		// Assign the existing term.
		wp_set_object_terms( $attachment_id, (int) $media_folder, 'media-folder' );
	}

	/**
	 * Recursively delete child media folders.
	 *
	 * @param int    $term     Term ID.
	 * @param string $taxonomy Taxonomy.
	 *
	 * @return void
	 */
	public function delete_child_media_folder( $term, $taxonomy ) {
		if ( 'media-folder' !== $taxonomy ) {
			return;
		}

		$children = get_terms(
			array(
				'taxonomy'   => $taxonomy,
				'parent'     => $term,
				'hide_empty' => false,
			)
		);

		/**
		 * As we use the wp_delete_term and hook get's called again,
		 * hence we can safely delete that and child of child will also be deleted.
		 */
		foreach ( $children as $child ) {
			wp_delete_term( $child->term_id, $taxonomy );
		}
	}

	/**
	 * Add transcoding URL, virtual status to the media JS Object.
	 *
	 * @param array   $response Attachment response.
	 * @param WP_Post $attachment Attachment object.
	 * @return array $response Attachment response.
	 */
	public function add_media_transcoding_status_js( $response, $attachment ) {
		// Check if attachment type is video, audio, PDF, or image.
		$mime_type = $attachment->post_mime_type;
		$is_video  = 'video' === substr( $mime_type, 0, 5 );
		$is_audio  = 'audio' === substr( $mime_type, 0, 5 );
		$is_pdf    = 'application/pdf' === $mime_type;
		$is_image  = 'image' === substr( $mime_type, 0, 5 );

		// Only process supported attachment types.
		if ( ! ( $is_video || $is_audio || $is_pdf || $is_image ) ) {
			return $response;
		}

		$transcoded_url     = get_post_meta( $attachment->ID, 'rtgodam_transcoded_url', true );
		$transcoding_status = get_post_meta( $attachment->ID, 'rtgodam_transcoding_status', true );

		if ( ! empty( $transcoded_url ) ) {
			$response['transcoded_url'] = $transcoded_url;
		} else {
			$response['transcoded_url'] = false;
		}

		// For GoDAM-managed images, use rtgodam_image_sizes for media library thumbnails/sizes.
		if ( $is_image ) {
			$rtgodam_image_sizes = $this->get_rtgodam_image_sizes( $attachment->ID );

			if ( ! empty( $rtgodam_image_sizes ) ) {
				$mapped_sizes = array();

				foreach ( $rtgodam_image_sizes as $size_name => $size_data ) {
					$width  = isset( $size_data['width'] ) ? (int) $size_data['width'] : 0;
					$height = isset( $size_data['height'] ) ? (int) $size_data['height'] : 0;
					$url    = isset( $size_data['url'] ) ? esc_url( $size_data['url'] ) : '';

					if ( empty( $url ) || $width <= 0 || $height <= 0 ) {
						continue;
					}

					$mapped_sizes[ $size_name ] = array(
						'url'         => $url,
						'width'       => $width,
						'height'      => $height,
						'orientation' => ( $width > $height ) ? 'landscape' : 'portrait',
					);
				}

				if ( ! empty( $mapped_sizes ) ) {
					$response['sizes'] = array_merge(
						isset( $response['sizes'] ) && is_array( $response['sizes'] ) ? $response['sizes'] : array(),
						$mapped_sizes
					);

					$preview_size = isset( $mapped_sizes['thumbnail'] ) ? $mapped_sizes['thumbnail'] : reset( $mapped_sizes );

					if ( ! empty( $preview_size['url'] ) ) {
						$response['icon']  = $preview_size['url'];
						$response['image'] = array(
							'src'    => $preview_size['url'],
							'width'  => $preview_size['width'],
							'height' => $preview_size['height'],
						);
					}

					if ( ! empty( $transcoded_url ) ) {
						$response['url'] = esc_url( $transcoded_url );
					}
				}
			}
		}

		// Check if item failed due to HTTP auth but auth is now disabled - change to not_started.
		if ( 'failed' === strtolower( $transcoding_status ) ) {
			$error_code = get_post_meta( $attachment->ID, 'rtgodam_transcoding_error_code', true );

			// If failed due to HTTP auth but auth is now disabled, reset status.
			if ( 'http_auth_enabled' === $error_code && ! rtgodam_has_http_auth() ) {
				$transcoding_status = 'not_started';
				update_post_meta( $attachment->ID, 'rtgodam_transcoding_status', 'not_started' );
				delete_post_meta( $attachment->ID, 'rtgodam_transcoding_error_msg' );
				delete_post_meta( $attachment->ID, 'rtgodam_transcoding_error_code' );
			}
		}

		// Check if item is blocked but limits are no longer exceeded - change to not_started.
		if ( 'blocked' === strtolower( $transcoding_status ) ) {
			// Use cached usage data to avoid external API calls.
			$user_data = rtgodam_get_user_data();
			if ( ! empty( $user_data ) && isset( $user_data['bandwidth_used'], $user_data['total_bandwidth'], $user_data['storage_used'], $user_data['total_storage'] ) ) {
				$storage_exceeded = $user_data['storage_used'] > $user_data['total_storage'];

				// If storage limit is no longer exceeded, change status to not_started.
				// (Bandwidth exceeded doesn't block transcoding, so don't reset based on bandwidth).
				if ( ! $storage_exceeded ) {
					$transcoding_status = 'not_started';
					// Update the stored status so it persists.
					update_post_meta( $attachment->ID, 'rtgodam_transcoding_status', 'not_started' );
					// Clear the error message since it's no longer blocked.
					delete_post_meta( $attachment->ID, 'rtgodam_transcoding_error_msg' );
					delete_post_meta( $attachment->ID, 'rtgodam_transcoding_error_code' );
				}
			}
		}

		// Add transcoding status to response.
		$response['transcoding_status'] = $transcoding_status ? strtolower( $transcoding_status ) : 'not_started';

		$godam_original_id = get_post_meta( $attachment->ID, '_godam_original_id', true );

		// If a GoDAM original ID exists, mark this attachment as virtual.
		if ( ! empty( $godam_original_id ) ) {
			// Indicate that this is a virtual attachment.
			$response['virtual'] = true;

			// Set the icon to be used for the virtual media preview.
			// Populate the image field used by the media library to show previews.
			$icon_url = wp_mime_type_icon( $attachment->ID );

			// For audio and PDF, ensure we use the default icons.
			if ( empty( $icon_url ) || strpos( $icon_url, '.svg' ) !== false ) {
				if ( $is_audio ) {
					$icon_url = includes_url( 'images/media/audio.png' );
				} elseif ( $is_pdf ) {
					$icon_url = includes_url( 'images/media/document.png' );
				}
			}

			$response['image'] = array();

			if ( ! empty( $icon_url ) ) {
				$response['icon']         = $icon_url;
				$response['image']['src'] = $icon_url;
			}
		}

		return $response;
	}

	/**
	 * Filter the media library arguments to include folders.
	 *
	 * @param array $query_args Query arguments.
	 *
	 * @return array
	 */
	public function filter_media_library_by_taxonomy( $query_args ) {

		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- Hooking into default WP hooks.

		if ( isset( $_REQUEST['query']['media-folder'] ) ) {
			$media_folder_id = sanitize_text_field( wp_unslash( $_REQUEST['query']['media-folder'] ) );

			if ( 'uncategorized' === $media_folder_id ) {
				$media_folder_id = 0;
			} elseif ( 'all' === $media_folder_id ) {
				$media_folder_id = -1;
			} else {
				$media_folder_id = intval( $media_folder_id );
			}

			// Handle uncategorized folder (media-folder ID = 0).
			if ( 0 === $media_folder_id ) {
				$uncategorized_ids = get_terms(
					array(
						'taxonomy'   => 'media-folder',
						'fields'     => 'ids',
						'hide_empty' => false,
					)
				);

				$query_args['tax_query'] = array( // phpcs:ignore -- tax_query is required here to filter by taxonomy.
					array(
						'taxonomy'         => 'media-folder',
						'field'            => 'term_id',
						'terms'            => $uncategorized_ids,
						'operator'         => 'NOT IN',
						'include_children' => false,
					),
				);
			} elseif ( -1 !== $media_folder_id && ! empty( $media_folder_id ) ) {
				$query_args['tax_query'] = array( // phpcs:ignore -- tax_query is required here to filter by taxonomy.
					array(
						'taxonomy'         => 'media-folder',
						'field'            => 'term_id',
						'terms'            => $media_folder_id,
						'include_children' => false,
					),
				);
			}

			// Unset the 'media-folder' query arg regardless of the case.
			unset( $query_args['media-folder'] );
		}

		if ( isset( $_REQUEST['query']['date_query'] ) && is_array( $_REQUEST['query']['date_query'] ) ) {
			$query_args['date_query'] = $this->sanitize_date_query( $_REQUEST['query']['date_query'] ); // phpcs:ignore -- date_query is getting sanitized by custom function.
		}

		return $query_args;

		// phpcs:enable WordPress.Security.NonceVerification.Recommended
	}

	/**
	 * Filter the media library by folder.
	 *
	 * @param Object $query Query object.
	 * @return void
	 */
	public function pre_get_post_filter( $query ) {

		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- Hooking into default WP hooks.

		if ( is_admin() && $query->is_main_query() && $query->get( 'post_type' ) === 'attachment' ) {
			$media_folder = isset( $_GET['media-folder'] ) ? sanitize_text_field( wp_unslash( $_GET['media-folder'] ) ) : null;

			if ( $media_folder && 'uncategorized' === $media_folder ) {
				$query->set(
					'tax_query',
					array(
						array(
							'taxonomy' => 'media-folder',
							'field'    => 'term_id',
							'operator' => 'NOT IN',
							'terms'    => get_terms(
								array(
									'taxonomy'   => 'media-folder',
									'fields'     => 'ids',
									'hide_empty' => false,
								)
							),
						),
					)
				);
			} elseif ( $media_folder && 'all' !== $media_folder ) {
				$query->set( // phpcs:ignore
					'tax_query',
					array(
						array(
							'taxonomy'         => 'media-folder',
							'field'            => 'term_id',
							'terms'            => (int) $media_folder,
							'include_children' => false,
						),
					)
				);
			}

			unset( $query->query_vars['media-folder'] );

			if ( isset( $_GET['date-start'] ) && isset( $_GET['date-end'] ) ) {
				$query->set(
					'date_query',
					array(
						'inclusive' => true,
						'after'     => sanitize_text_field( wp_unslash( $_GET['date-start'] ) ),
						'before'    => sanitize_text_field( wp_unslash( $_GET['date-end'] ) ),
					)
				);
			}
		}

		// phpcs:enable WordPress.Security.NonceVerification.Recommended
	}

	/**
	 * Add a dropdown filter to the media library.
	 *
	 * @return void
	 */
	public function restrict_manage_media_filter() {
		$screen = get_current_screen();

		if ( 'upload' === $screen->id ) {
			// Get the current folder filter value from the URL.
			$media_folder = isset( $_GET['media-folder'] ) ? sanitize_text_field( wp_unslash( $_GET['media-folder'] ) ) : 'all'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Just echoing the value without any usage.

			// Get all terms from the 'media-folder' taxonomy.
			$terms = get_terms(
				array(
					'taxonomy'   => 'media-folder',
					'hide_empty' => false,
				)
			);

			// Define default options.
			$folders = array(
				(object) array(
					'id'   => 'uncategorized',
					'name' => __( 'Uncategorized', 'godam' ),
				),
				(object) array(
					'id'   => 'all',
					'name' => __( 'All collections', 'godam' ),
				),
			);

			// Add taxonomy terms to the folder list.
			foreach ( $terms as $term ) {
				$folders[] = (object) array(
					'id'   => $term->term_id,
					'name' => $term->name,
				);
			}

			// Render the dropdown.
			echo '<select id="media-folder-filter" name="media-folder" class="attachment-filters">';
			foreach ( $folders as $folder ) {
				printf(
					'<option value="%1$s" %3$s>%2$s</option>',
					esc_attr( $folder->id ),
					esc_html( $folder->name ),
					selected( $media_folder, $folder->id, false )
				);
			}
			echo '</select>';

			// Render the date range filter.
			echo '<input id="media-date-range-filter" />';
			echo '<input id="media-date-range-filter-start" name="date-start" />';
			echo '<input id="media-date-range-filter-end" name="date-end" />';
		}
	}

	/**
	 * Sanitize the date query.
	 *
	 * Filter the date_query to only allow specific date formats and the valid relation.
	 *
	 * @param array $date_query Date query.
	 *
	 * @return array $date_query sanitized date query.
	 */
	private function sanitize_date_query( $date_query ) {
		if ( ! is_array( $date_query ) ) {
			return array();
		}

		$allowed_keys    = array( 'inclusive', 'after', 'before' );
		$sanitized_query = array();

		foreach ( $allowed_keys as $key ) {
			if ( isset( $date_query[ $key ] ) ) {
				switch ( $key ) {
					case 'inclusive':
						$sanitized_query['inclusive'] = filter_var( $date_query['inclusive'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE );
						break;
					case 'after':
					case 'before':
						$sanitized_query[ $key ] = sanitize_text_field( $date_query[ $key ] );
						if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $sanitized_query[ $key ] ) ) {
							unset( $sanitized_query[ $key ] );
						}
						break;
				}
			}
		}

		return $sanitized_query;
	}

	/**
	 * Dismiss the offer banner by updating the option in the database.
	 *
	 * @return void
	 */
	public function dismiss_offer_banner() {
		check_ajax_referer( 'godam-dismiss-offer-banner-nonce', 'nonce' );

		if ( get_option( 'rtgodam-offer-banner' ) === false ) {
			add_option( 'rtgodam-offer-banner', 0 );
		} else {
			update_option( 'rtgodam-offer-banner', 0 );
		}

		wp_send_json_success( array( 'message' => __( 'Offer banner dismissed successfully.', 'godam' ) ) );
	}

	/**
	 * Renders an offer banner on the media library page for non-premium users.
	 *
	 * @return void
	 */
	public function media_library_offer_banner() {
		$screen = get_current_screen();

		$show_offer_banner = get_option( 'rtgodam-offer-banner', 1 );

		$timezone     = wp_timezone();
		$current_time = new \DateTime( 'now', $timezone );
		$end_time     = new \DateTime( '2026-01-20 23:59:59', $timezone );

		// Only show on the Media Library page.
		if ( $current_time <= $end_time && $screen && 'upload' === $screen->base && $show_offer_banner ) {
			$host = wp_parse_url( home_url(), PHP_URL_HOST );

			$banner_image = RTGODAM_URL . 'assets/src/images/new-year-sale-2026.webp';

			$banner_html = sprintf(
				'<div class="notice annual-plan-offer-banner">
					<a
						href="%1$s"
						class="annual-plan-offer-banner__link"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="%2$s"
					>
						<img
							src="%3$s"
							class="annual-plan-offer-banner__image"
							alt="%4$s"
							loading="lazy"
						/>
					</a>
					<button
						type="button"
						class="annual-plan-offer-banner__dismiss"
						aria-label="%5$s"
					>
						&times;
					</button>
				</div>',
				esc_url( RTGODAM_IO_API_BASE . '/pricing?utm_campaign=new-year-sale-2026&utm_source=' . $host . '&utm_medium=plugin&utm_content=media-library-banner' ),
				esc_attr__( 'Claim the GoDAM New Year Sale 2026 offer', 'godam' ),
				esc_url( $banner_image ),
				esc_attr__( 'New Year Sale 2026 offer from GoDAM', 'godam' ),
				esc_html__( 'Dismiss banner', 'godam' )
			);

			echo wp_kses(
				$banner_html,
				array(
					'div'    => array( 'class' => array() ),
					'a'      => array(
						'href'       => array(),
						'class'      => array(),
						'target'     => array(),
						'rel'        => array(),
						'aria-label' => array(),
					),
					'img'    => array(
						'src'     => array(),
						'alt'     => array(),
						'class'   => array(),
						'loading' => array(),
					),
					'button' => array(
						'type'       => array(),
						'class'      => array(),
						'aria-label' => array(),
					),
				)
			);
		}
	}

	/**
	 * Replace an existing WordPress media attachment with a file from an external URL,
	 * using the WordPress Filesystem API.
	 *
	 * @since 1.4.2
	 *
	 * @param int    $attachment_id The ID of the existing media attachment.
	 * @param string $file_url      The external file URL.
	 *
	 * @return int|WP_Error Attachment ID on success, WP_Error on failure.
	 */
	private function godam_replace_attachment_with_external_file( $attachment_id, $file_url = '' ) {
		if ( ! $attachment_id || ! $this->is_valid_url( $file_url ) ) {
			return new \WP_Error( 'invalid_input', __( 'Invalid attachment ID or URL.', 'godam' ) );
		}

		// Validate the attachment.
		$attachment = get_post( $attachment_id );
		if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
			return new \WP_Error( 'invalid_attachment', __( 'Invalid attachment ID.', 'godam' ) );
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		global $wp_filesystem;

		WP_Filesystem();

		if ( ! $wp_filesystem ) {
			return new \WP_Error( 'fs_unavailable', __( 'Could not initialize WordPress filesystem.', 'godam' ) );
		}

		// Download file to temporary location.
		$temp_file = download_url( $file_url );

		if ( is_wp_error( $temp_file ) ) {
			return $temp_file;
		}

		// Prepare new file path in uploads.
		$upload_dir   = wp_upload_dir();
		$new_filename = wp_basename( wp_parse_url( $file_url, PHP_URL_PATH ) );
		$new_filepath = trailingslashit( $upload_dir['path'] ) . $new_filename;

		// Move temp file into uploads with WP_Filesystem.
		$moved = $wp_filesystem->move( $temp_file, $new_filepath, true );

		if ( ! $moved ) {
			$wp_filesystem->delete( $temp_file );
			return new \WP_Error( 'file_move_failed', __( 'Could not move file into uploads directory.', 'godam' ) );
		}

		// Update attachment file info.
		update_attached_file( $attachment_id, $new_filepath );

		// update mime type.
		$filetype = wp_check_filetype( $new_filename, null );
		if ( $filetype['type'] ) {
			wp_update_post(
				array(
					'ID'             => $attachment_id,
					'post_mime_type' => $filetype['type'],
				)
			);
		}

		// Regenerate metadata.
		$metadata = wp_generate_attachment_metadata( $attachment_id, $new_filepath );
		wp_update_attachment_metadata( $attachment_id, $metadata );

		return $attachment_id;
	}

	/**
	 * Download the transcoded MP4 source and replace the existing attachment file.
	 *
	 * @param int             $attachment_id Attachment ID.
	 * @param string          $job_id        Job ID.
	 * @param string          $job_for       Job for (e.g., 'wp-media').
	 * @param WP_REST_Request $request    Request data containing transcoded file info.
	 *
	 * @return void
	 */
	public function download_transcoded_mp4_source( $attachment_id, $job_id, $job_for, $request ) {
		if ( isset( $job_for ) && ( 'wp-media' !== $job_for ) ) {
			return;
		}

		// Check if video attachment.
		$attachment_mime_type = get_post_mime_type( $attachment_id );

		if ( 'video' !== substr( $attachment_mime_type, 0, 5 ) ) {
			return;
		}

		// Check if mp4_url is provided in the request.
		$transcoded_mp4_url = esc_url( $request->get_param( 'mp4_url' ) );

		if ( empty( $transcoded_mp4_url ) ) {
			return;
		}

		// Replace the existing attachment file with the transcoded MP4.
		$attachment_id = $this->godam_replace_attachment_with_external_file( $attachment_id, $transcoded_mp4_url );

		if ( is_wp_error( $attachment_id ) ) {
			// Log the error for debugging purposes.
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				error_log( 'MP4 video replacement failed: ' . $attachment_id->get_error_message() ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Logging for debugging.
			}
		}
	}

	/**
	 * Filter attachment URL for virtual media.
	 *
	 * @param string $url    The original attachment URL.
	 * @param int    $post_id The attachment post ID.
	 *
	 * @since 1.4.7
	 *
	 * @return string The filtered attachment URL.
	 */
	public function filter_attachment_url_for_virtual_media( $url, $post_id ) {
		$attachment_mime_type = get_post_mime_type( $post_id );
		$godam_original_id    = get_post_meta( $post_id, '_godam_original_id', true );

		// For WordPress-uploaded images, use CDN URL only when GoDAM sizes map exists.
		// Otherwise WP may build thumbnail URLs using local metadata + CDN base path,
		// which breaks old images (dimension mismatch like 350x263 vs 350x262).
		if ( 'image' === substr( $attachment_mime_type, 0, 5 ) ) {
			$rtgodam_image_sizes    = $this->get_rtgodam_image_sizes( $post_id );
			$rtgodam_transcoded_url = get_post_meta( $post_id, 'rtgodam_transcoded_url', true );
			$can_use_cdn_src        = ( ! empty( $godam_original_id ) || ! empty( $rtgodam_image_sizes ) );

			if ( $can_use_cdn_src && ! empty( $rtgodam_transcoded_url ) ) {
				return esc_url( $rtgodam_transcoded_url );
			}
		}

		if ( ! empty( $godam_original_id ) ) {
			$attachment         = get_post( $post_id );
			$transcoded_mp4_url = $attachment->guid; // For virtual media, we store the transcoded MP4 URL in the guid.

			if ( ! empty( $transcoded_mp4_url ) ) {
				return esc_url( $transcoded_mp4_url );
			}
		}

		return $url;
	}

	/**
	 * Read GoDAM CDN image size data for an attachment.
	 *
	 * @since 1.5.0
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return array
	 */
	private function get_rtgodam_image_sizes( $attachment_id ) {
		$rtgodam_image_sizes = get_post_meta( $attachment_id, 'rtgodam_image_sizes', true );
		return is_array( $rtgodam_image_sizes ) ? $rtgodam_image_sizes : array();
	}

	/**
	 * Pre-filter image meta so WordPress can match a CDN image src during srcset build.
	 *
	 * WordPress determines whether the current image src is a known size by checking
	 * if `$image_src` contains `$dirname . $size_file` (e.g. `2026/03/image-300x200.jpg`).
	 * When the stored src is already a CDN URL the date sub-directory is absent, so the
	 * check always fails and WordPress returns `false` for srcset – discarding any CDN
	 * sources our `wp_calculate_image_srcset` filter would inject.
	 *
	 * Stripping the upload sub-directory from `file` makes `$dirname` empty, so
	 * WordPress can match by basename alone and proceeds with srcset computation.
	 * The `wp_calculate_image_srcset` filter then replaces the locally-built source
	 * URLs with the authoritative CDN URLs from `rtgodam_image_sizes`.
	 *
	 * @since 1.7.2
	 *
	 * @param array  $image_meta    The image meta data as returned by wp_get_attachment_metadata().
	 * @param int[]  $size_array    The requested size as [width, height].
	 * @param string $image_src     The current image source URL.
	 * @param int    $attachment_id The image attachment ID or 0.
	 *
	 * @return array Modified (or unchanged) image meta.
	 */
	public function filter_image_srcset_meta( $image_meta, $size_array, $image_src, $attachment_id ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- Filter signature requires these params.
		if ( empty( $attachment_id ) || ! is_array( $image_meta ) || empty( $image_meta['file'] ) ) {
			return $image_meta;
		}

		$rtgodam_image_sizes = $this->get_rtgodam_image_sizes( $attachment_id );
		if ( empty( $rtgodam_image_sizes ) ) {
			return $image_meta;
		}

		$cdn_src = get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );
		if ( empty( $cdn_src ) ) {
			return $image_meta;
		}

		$cdn_host = wp_parse_url( $cdn_src, PHP_URL_HOST );
		$src_host = wp_parse_url( $image_src, PHP_URL_HOST );

		// Only act when the src is already served from the CDN and the file path
		// still carries a sub-directory prefix (i.e. hasn't been stripped yet).
		if ( $cdn_host && $src_host && $cdn_host === $src_host && wp_basename( $image_meta['file'] ) !== $image_meta['file'] ) {
			$image_meta['file'] = wp_basename( $image_meta['file'] );
		}

		return $image_meta;
	}

	/**
	 * Filter srcset calculation for virtual media to use full URLs.
	 *
	 * @since 1.5.0
	 *
	 * @param array|false $sources       Array of image sources for srcset or false.
	 * @param array       $size_array    Array of width and height values.
	 * @param string      $image_src     The 'src' of the image.
	 * @param array       $image_meta    The image meta data.
	 * @param int         $attachment_id The image attachment ID.
	 *
	 * @return array|false Filtered sources array or false.
	 */
	public function filter_virtual_media_srcset( $sources, $size_array, $image_src, $image_meta, $attachment_id ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- Filter signature requires these params.
		$attachment_mime_type = get_post_mime_type( $attachment_id );
		if ( 'image' !== substr( $attachment_mime_type, 0, 5 ) ) {
			return $sources;
		}

		// Rebuild sources array for virtual media.
		if ( empty( $sources ) || ! is_array( $sources ) ) {
			return $sources;
		}

		// Check if virtual media or if rtgodam_image_sizes meta exists (indicating GoDAM-managed image).
		$godam_original_id   = get_post_meta( $attachment_id, '_godam_original_id', true );
		$rtgodam_image_sizes = $this->get_rtgodam_image_sizes( $attachment_id );

		if ( empty( $godam_original_id ) && empty( $rtgodam_image_sizes ) ) {
			return $sources;
		}

		// If rtgodam_image_sizes meta exists, use it to build the srcset.
		// This is the case for GoDAM-managed images which may not be virtual but still need correct srcset URLs.
		if ( ! empty( $rtgodam_image_sizes ) ) {

			// Prepare new sources array based on rtgodam_image_sizes meta.
			// Keyed by width to deduplicate and match WordPress's expected format.
			$new_sources = array();
			foreach ( $rtgodam_image_sizes as $image_size ) {
				// Skip entries that do not have a valid URL or width to avoid invalid srcset entries.
				if ( empty( $image_size['url'] ) || empty( $image_size['width'] ) ) {
					continue;
				}

				$width                 = intval( $image_size['width'] );
				$new_sources[ $width ] = array(
					'url'        => esc_url( $image_size['url'] ),
					'descriptor' => 'w',
					'value'      => $width,
				);
			}

			$sources = $new_sources;
		} elseif ( ! empty( $godam_original_id ) ) {
			// Compatibility handling for virtual media created before GoDAM image sizes meta was implemented.
			// In this case, we will reconstruct the URLs based on the original image URL and the file names in the sources array.

			// Use the current image URL as the base for all subsizes.
			$base_url = trailingslashit( untrailingslashit( dirname( $image_src ) ) );

			// Rebuild sources array for virtual media.
			foreach ( $sources as &$source ) {

				// Get last string after the last slash in the file url.
				$file_basename = basename( $source['url'] );

				// Rebuild the full URL using the base URL and the file basename.
				$url = $base_url . ltrim( $file_basename, '/' );

				$source['url'] = esc_url( $url );
			}
			unset( $source ); // Break the reference.
		}

		return $sources;
	}

	/**
	 * AJAX handler to save HTTP auth detection result.
	 *
	 * @since 1.7.1
	 *
	 * @return void
	 */
	public function save_http_auth_status() {
		check_ajax_referer( 'godam-http-auth-detector', 'nonce' );

		if ( ! current_user_can( 'upload_files' ) ) {
			wp_send_json_error( array( 'message' => __( 'Insufficient permissions.', 'godam' ) ) );
		}

		$has_http_auth_raw = isset( $_POST['has_http_auth'] ) ? sanitize_text_field( wp_unslash( $_POST['has_http_auth'] ) ) : '';
		$has_http_auth     = ( '1' === $has_http_auth_raw );

		// Save status.
		update_option(
			'rtgodam_http_auth_status',
			array(
				'enabled'   => $has_http_auth,
				'timestamp' => time(),
			)
		);

		wp_send_json_success(
			array(
				'message'       => __( 'HTTP auth status saved.', 'godam' ),
				'has_http_auth' => $has_http_auth,
			)
		);
	}

	/**
	 * Fetch media versions from GoDAM API for a given attachment.
	 *
	 * @return void
	 */
	public function get_media_versions() {
		check_ajax_referer( 'easydam_media_library', 'nonce' );

		if ( ! current_user_can( 'upload_files' ) ) {
			wp_send_json_error( array( 'message' => __( 'Insufficient permissions.', 'godam' ) ), 403 );
		}

		$attachment_id = isset( $_POST['attachment_id'] ) ? absint( wp_unslash( $_POST['attachment_id'] ) ) : 0;

		if ( empty( $attachment_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Attachment ID is required.', 'godam' ) ), 400 );
		}

		$job_name = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );

		if ( empty( $job_name ) ) {
			wp_send_json_error( array( 'message' => __( 'Job name not found for this attachment.', 'godam' ) ), 400 );
		}

		$api_key = get_option( 'rtgodam-api-key', '' );

		if ( empty( $api_key ) ) {
			wp_send_json_error( array( 'message' => __( 'GoDAM API key is missing.', 'godam' ) ), 400 );
		}

		$decoded = $this->fetch_media_versions_payload( $job_name, $api_key );

		if ( is_wp_error( $decoded ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Failed to fetch media versions from GoDAM.', 'godam' ),
					'error'   => $decoded->get_error_message(),
				),
				500
			);
		}

		wp_send_json_success(
			array(
				'job_name' => $job_name,
				'response' => $decoded,
			)
		);
	}

	/**
	 * Switch active media version in GoDAM.
	 *
	 * @return void
	 */
	public function switch_active_version() {
		check_ajax_referer( 'easydam_media_library', 'nonce' );

		if ( ! current_user_can( 'upload_files' ) ) {
			wp_send_json_error( array( 'message' => __( 'Insufficient permissions.', 'godam' ) ), 403 );
		}

		$attachment_id = isset( $_POST['attachment_id'] ) ? absint( wp_unslash( $_POST['attachment_id'] ) ) : 0;
		if ( empty( $attachment_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Attachment ID is required.', 'godam' ) ), 400 );
		}

		$version_number = isset( $_POST['version_number'] ) ? absint( wp_unslash( $_POST['version_number'] ) ) : 0;
		if ( $version_number < 1 ) {
			wp_send_json_error( array( 'message' => __( 'Version number must be greater than 0.', 'godam' ) ), 400 );
		}

		$job_name = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
		if ( empty( $job_name ) ) {
			wp_send_json_error( array( 'message' => __( 'Job name not found for this attachment.', 'godam' ) ), 400 );
		}

		$this->maybe_store_attachment_url( $attachment_id );

		$api_key = get_option( 'rtgodam-api-key', '' );
		if ( empty( $api_key ) ) {
			wp_send_json_error( array( 'message' => __( 'GoDAM API key is missing.', 'godam' ) ), 400 );
		}

		$max_versions = isset( $_POST['max_versions'] ) ? absint( wp_unslash( $_POST['max_versions'] ) ) : 25;
		if ( $max_versions < 1 ) {
			$max_versions = 25;
		}

		if ( $version_number > $max_versions ) {
			// translators: %d is the maximum number of versions allowed.
			wp_send_json_error( array( 'message' => sprintf( __( 'Version number must be between 1 and %d.', 'godam' ), $max_versions ) ), 400 );
		}

		$source_url         = '';
		$source_thumbnail   = '';
		$target_url         = '';
		$target_thumbnail   = '';
		$target_version_row = array();
		$versions_payload   = $this->fetch_media_versions_payload( $job_name, $api_key );

		if ( ! is_wp_error( $versions_payload ) ) {
			$versions           = $this->extract_media_versions_from_payload( $versions_payload );
			$current_active_row = $this->get_active_media_version_row( $versions );
			$target_version_row = $this->get_media_version_row_by_number( $versions, $version_number );
			$source_url         = $this->get_version_media_source_url( $current_active_row, $attachment_id );
			$source_thumbnail   = $this->get_version_thumbnail_url( $current_active_row );
			$target_url         = $this->get_version_media_source_url( $target_version_row, $attachment_id );
			$target_thumbnail   = $this->get_version_thumbnail_url( $target_version_row );
		}

		$endpoint = trailingslashit( RTGODAM_API_BASE ) . 'api/method/godam_core.api.media.switch_active_version';
		$url      = add_query_arg(
			array(
				'job_name'       => $job_name,
				'api_key'        => $api_key,
				'version_number' => $version_number,
			),
			$endpoint
		);

		$response = wp_remote_post(
			$url,
			array(
				'timeout' => 5,  // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
			)
		);

		if ( is_wp_error( $response ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Failed to switch active version.', 'godam' ),
					'error'   => $response->get_error_message(),
				),
				500
			);
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		$body        = wp_remote_retrieve_body( $response );
		$decoded     = json_decode( $body, true );

		if ( 200 !== $status_code ) {
			wp_send_json_error(
				array(
					'message'  => __( 'GoDAM API returned an error while switching version.', 'godam' ),
					'status'   => $status_code,
					'response' => is_array( $decoded ) ? $decoded : $body,
				),
				$status_code
			);
		}

		$this->replace_media_url_across_site( $attachment_id, $source_url, $target_url, $target_version_row, $source_thumbnail, $target_thumbnail );
		$this->maybe_request_image_subsizes_refresh( $attachment_id, $job_name );

		wp_send_json_success(
			array(
				'job_name'       => $job_name,
				'version_number' => $version_number,
				'response'       => is_array( $decoded ) ? $decoded : $body,
			)
		);
	}

	/**
	 * Delete a media version in GoDAM.
	 *
	 * @return void
	 */
	public function delete_version() {
		check_ajax_referer( 'easydam_media_library', 'nonce' );

		if ( ! current_user_can( 'upload_files' ) ) {
			wp_send_json_error( array( 'message' => __( 'Insufficient permissions.', 'godam' ) ), 403 );
		}

		$attachment_id = isset( $_POST['attachment_id'] ) ? absint( wp_unslash( $_POST['attachment_id'] ) ) : 0;
		if ( empty( $attachment_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Attachment ID is required.', 'godam' ) ), 400 );
		}

		$version_number = isset( $_POST['version_number'] ) ? absint( wp_unslash( $_POST['version_number'] ) ) : 0;
		if ( $version_number < 2 ) {
			wp_send_json_error( array( 'message' => __( 'Cannot delete this version.', 'godam' ) ), 400 );
		}

		$job_name = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
		if ( empty( $job_name ) ) {
			wp_send_json_error( array( 'message' => __( 'Job name not found for this attachment.', 'godam' ) ), 400 );
		}

		$api_key = get_option( 'rtgodam-api-key', '' );
		if ( empty( $api_key ) ) {
			wp_send_json_error( array( 'message' => __( 'GoDAM API key is missing.', 'godam' ) ), 400 );
		}

		$endpoint = trailingslashit( RTGODAM_API_BASE ) . 'api/method/godam_core.api.media.delete_version';
		$url      = add_query_arg(
			array(
				'job_name'       => $job_name,
				'api_key'        => $api_key,
				'version_number' => $version_number,
			),
			$endpoint
		);

		$response = wp_remote_post(
			$url,
			array(
				'timeout' => 5,  // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
			)
		);

		if ( is_wp_error( $response ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Failed to delete version.', 'godam' ),
					'error'   => $response->get_error_message(),
				),
				500
			);
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		$body        = wp_remote_retrieve_body( $response );
		$decoded     = json_decode( $body, true );

		if ( 200 !== $status_code ) {
			wp_send_json_error(
				array(
					'message'  => __( 'GoDAM API returned an error while deleting version.', 'godam' ),
					'status'   => $status_code,
					'response' => is_array( $decoded ) ? $decoded : $body,
				),
				$status_code
			);
		}

		wp_send_json_success(
			array(
				'job_name'        => $job_name,
				'deleted_version' => $version_number,
				'response'        => is_array( $decoded ) ? $decoded : $body,
			)
		);
	}

	/**
	 * Replaces source media and starts new version creation in GoDAM.
	 *
	 * @return void
	 */
	public function replace_media_version() {
		check_ajax_referer( 'easydam_media_library', 'nonce' );

		if ( ! current_user_can( 'upload_files' ) ) {
			wp_send_json_error( array( 'message' => __( 'Insufficient permissions.', 'godam' ) ), 403 );
		}

		$attachment_id = isset( $_POST['attachment_id'] ) ? absint( wp_unslash( $_POST['attachment_id'] ) ) : 0;
		if ( empty( $attachment_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Attachment ID is required.', 'godam' ) ), 400 );
		}

		$version_attachment_id = isset( $_POST['version_attachment_id'] ) ? sanitize_text_field( wp_unslash( $_POST['version_attachment_id'] ) ) : '';
		$file_origin           = '';

		if ( empty( $version_attachment_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Please select a valid media file.', 'godam' ) ), 400 );
		}

		if ( is_numeric( $version_attachment_id ) ) {
			$version_attachment = get_post( $version_attachment_id );
			if ( ! $version_attachment || 'attachment' !== $version_attachment->post_type ) {
				wp_send_json_error( array( 'message' => __( 'Selected media is invalid.', 'godam' ) ), 400 );
			}

			$uploaded_mime = sanitize_mime_type( get_post_mime_type( $version_attachment_id ) );
			if ( ! $this->is_compatible_version_upload_mime( $attachment_id, $uploaded_mime ) ) {
				wp_send_json_error( array( 'message' => __( 'Please upload a similar media type for a new version.', 'godam' ) ), 400 );
			}

			$file_origin = wp_get_attachment_url( $version_attachment_id );
			if ( empty( $file_origin ) ) {
				wp_send_json_error( array( 'message' => __( 'Unable to read selected media URL.', 'godam' ) ), 400 );
			}
		} else {
			$version_attachment_url = isset( $_POST['version_attachment_url'] ) ? esc_url_raw( wp_unslash( $_POST['version_attachment_url'] ) ) : '';
			$file_origin            = $version_attachment_url;
		}

		$job_name = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
		if ( empty( $job_name ) ) {
			wp_send_json_error( array( 'message' => __( 'Job name not found for this attachment.', 'godam' ) ), 400 );
		}

		$this->maybe_store_attachment_url( $attachment_id );

		$api_key = get_option( 'rtgodam-api-key', '' );
		if ( empty( $api_key ) ) {
			wp_send_json_error( array( 'message' => __( 'GoDAM API key is missing.', 'godam' ) ), 400 );
		}

		delete_post_meta( $attachment_id, 'rtgodam_pending_version_source_url' );
		delete_post_meta( $attachment_id, 'rtgodam_pending_version_source_thumbnail_url' );

		$versions_payload = $this->fetch_media_versions_payload( $job_name, $api_key );
		if ( ! is_wp_error( $versions_payload ) ) {
			$active_version = $this->get_active_media_version_row( $this->extract_media_versions_from_payload( $versions_payload ) );
			$source_url     = $this->get_version_media_source_url( $active_version, $attachment_id );
			$source_thumb   = $this->get_version_thumbnail_url( $active_version );
			if ( ! empty( $source_url ) ) {
				update_post_meta( $attachment_id, 'rtgodam_pending_version_source_url', $source_url );
			}
			if ( ! empty( $source_thumb ) ) {
				update_post_meta( $attachment_id, 'rtgodam_pending_version_source_thumbnail_url', $source_thumb );
			}
		}

		$endpoint = trailingslashit( RTGODAM_API_BASE ) . 'api/method/godam_core.api.retranscode.replace_media';

		$response = wp_remote_post(
			$endpoint,
			array(
				'timeout' => 5,  // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
				'body'    => array(
					'job_id'      => $job_name,
					'file_origin' => rawurlencode( $file_origin ),
					'api_key'     => $api_key,
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Failed to replace media version.', 'godam' ),
					'error'   => $response->get_error_message(),
				),
				500
			);
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		$body        = wp_remote_retrieve_body( $response );
		$decoded     = json_decode( $body, true );

		if ( 200 !== $status_code ) {
			wp_send_json_error(
				array(
					'message'  => __( 'GoDAM API returned an error while adding a new version.', 'godam' ),
					'status'   => $status_code,
					'response' => is_array( $decoded ) ? $decoded : $body,
				),
				$status_code
			);
		}

		wp_send_json_success(
			array(
				'job_name' => $job_name,
				'response' => $decoded,
			)
		);
	}

	/**
	 * Finalize pending media URL replacement after polling detects a new version.
	 *
	 * @return void
	 */
	public function finalize_media_version_replace() {
		check_ajax_referer( 'easydam_media_library', 'nonce' );

		if ( ! current_user_can( 'upload_files' ) ) {
			wp_send_json_error( array( 'message' => __( 'Insufficient permissions.', 'godam' ) ), 403 );
		}

		$attachment_id = isset( $_POST['attachment_id'] ) ? absint( wp_unslash( $_POST['attachment_id'] ) ) : 0;
		if ( empty( $attachment_id ) ) {
			wp_send_json_error( array( 'message' => __( 'Attachment ID is required.', 'godam' ) ), 400 );
		}

		$job_name = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
		if ( empty( $job_name ) ) {
			wp_send_json_error( array( 'message' => __( 'Job name not found for this attachment.', 'godam' ) ), 400 );
		}

		$api_key = get_option( 'rtgodam-api-key', '' );
		if ( empty( $api_key ) ) {
			wp_send_json_error( array( 'message' => __( 'GoDAM API key is missing.', 'godam' ) ), 400 );
		}

		$target_url         = '';
		$target_version_row = array();
		$versions_payload   = $this->fetch_media_versions_payload( $job_name, $api_key );

		if ( ! is_wp_error( $versions_payload ) ) {
			$target_version_row = $this->get_active_media_version_row( $this->extract_media_versions_from_payload( $versions_payload ) );
			$target_url         = $this->get_version_media_source_url( $target_version_row, $attachment_id );
		}

		wp_send_json_success( $this->complete_pending_media_version_replace( $attachment_id, $target_url, $target_version_row ) );
	}

	/**
	 * Replace media URL references when a callback finishes for wp-media jobs.
	 *
	 * @param int              $attachment_id Attachment ID.
	 * @param string           $job_id        GoDAM job ID.
	 * @param string           $job_for       Job target.
	 * @param \WP_REST_Request $request      Callback request.
	 * @return void
	 */
	public function replace_media_urls_after_version_callback( $attachment_id, $job_id, $job_for, $request ) {
		if ( 'wp-media' !== $job_for || empty( $attachment_id ) || ! ( $request instanceof \WP_REST_Request ) ) {
			return;
		}

		$target_url         = $this->get_target_url_from_callback_request( $attachment_id, $request );
		$target_version_row = array(
			'thumbnail_url'        => (string) $request->get_param( 'thumbnail_url' ),
			'transcoded_file_path' => (string) $request->get_param( 'download_url' ),
			'transcoded_hls_path'  => (string) $request->get_param( 'hls_path' ),
			'transcript_path'      => '',
			'transcoded_mp4_url'   => (string) $request->get_param( 'mp4_url' ),
		);

		if ( empty( $target_url ) ) {
			$api_key = get_option( 'rtgodam-api-key', '' );
			if ( ! empty( $api_key ) && ! empty( $job_id ) ) {
				$versions_payload = $this->fetch_media_versions_payload( $job_id, $api_key );
				if ( ! is_wp_error( $versions_payload ) ) {
					$target_version_row = $this->get_active_media_version_row( $this->extract_media_versions_from_payload( $versions_payload ) );
					$target_url         = $this->get_version_media_source_url( $target_version_row, $attachment_id );
				}
			}
		}

		$this->complete_pending_media_version_replace( $attachment_id, $target_url, $target_version_row );
	}

	/**
	 * Complete pending media URL replacement when both source and target URLs are known.
	 *
	 * @param int    $attachment_id      Attachment ID.
	 * @param string $target_url         New active source URL.
	 * @param array  $target_version_row Target version row.
	 * @return array
	 */
	private function complete_pending_media_version_replace( $attachment_id, $target_url, $target_version_row = array() ) {
		$source_url           = (string) get_post_meta( $attachment_id, 'rtgodam_pending_version_source_url', true );
		$source_thumbnail_url = (string) get_post_meta( $attachment_id, 'rtgodam_pending_version_source_thumbnail_url', true );
		$target_thumbnail_url = $this->get_version_thumbnail_url( $target_version_row );

		if ( empty( $source_url ) ) {
			return array(
				'completed' => false,
				'reason'    => 'missing_source_url',
			);
		}

		if ( empty( $target_url ) ) {
			return array(
				'completed' => false,
				'reason'    => 'missing_target_url',
			);
		}

		if ( $source_url === $target_url ) {
			return array(
				'completed' => false,
				'reason'    => 'target_matches_source',
				'sourceUrl' => $source_url,
				'targetUrl' => $target_url,
			);
		}

		$this->replace_media_url_across_site( $attachment_id, $source_url, $target_url, $target_version_row, $source_thumbnail_url, $target_thumbnail_url );

		$job_name = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
		$this->maybe_request_image_subsizes_refresh( $attachment_id, $job_name );

		delete_post_meta( $attachment_id, 'rtgodam_pending_version_source_url' );
		delete_post_meta( $attachment_id, 'rtgodam_pending_version_source_thumbnail_url' );

		return array(
			'completed' => true,
			'sourceUrl' => $source_url,
			'targetUrl' => $target_url,
		);
	}

	/**
	 * Request image sub-sizes refresh for image attachments after version changes.
	 *
	 * @param int    $attachment_id Attachment ID.
	 * @param string $job_name      GoDAM job ID.
	 * @return void
	 */
	private function maybe_request_image_subsizes_refresh( $attachment_id, $job_name ) {
		$attachment_mime_type = (string) get_post_mime_type( $attachment_id );
		if ( 'image' !== substr( $attachment_mime_type, 0, 5 ) ) {
			return;
		}

		if ( empty( $job_name ) ) {
			return;
		}

		$subsize_result = \RTGODAM\Inc\REST_API\Media_Library::get_instance()->request_image_subsizes_for_attachment( $job_name, $attachment_id );

		if ( ( is_wp_error( $subsize_result ) || empty( $subsize_result ) ) && defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Debug log for troubleshooting metadata refresh.
				sprintf( 'GoDAM: Failed to request image sub-sizes refresh for attachment ID %d after version update.', (int) $attachment_id )
			);
		}
	}

	/**
	 * Fetch all versions payload from GoDAM API.
	 *
	 * @param string $job_name GoDAM job name.
	 * @param string $api_key  API key.
	 * @return array|\WP_Error
	 */
	private function fetch_media_versions_payload( $job_name, $api_key ) {
		$endpoint = trailingslashit( RTGODAM_API_BASE ) . 'api/method/godam_core.api.media.list_all_versions';
		$url      = add_query_arg(
			array(
				'job_name' => $job_name,
				'api_key'  => $api_key,
			),
			$endpoint
		);

		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 5, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		$body        = wp_remote_retrieve_body( $response );
		$decoded     = json_decode( $body, true );

		if ( 200 !== $status_code || ! is_array( $decoded ) ) {
			return new \WP_Error( 'godam_versions_fetch_failed', __( 'Failed to fetch media versions from GoDAM.', 'godam' ) );
		}

		return $decoded;
	}

	/**
	 * Extract versions array from GoDAM list versions payload.
	 *
	 * @param array $payload API payload.
	 * @return array
	 */
	private function extract_media_versions_from_payload( $payload ) {
		if ( ! is_array( $payload ) || empty( $payload['message']['versions'] ) || ! is_array( $payload['message']['versions'] ) ) {
			return array();
		}

		return $payload['message']['versions'];
	}

	/**
	 * Get active version row from versions list.
	 *
	 * @param array $versions Versions list.
	 * @return array
	 */
	private function get_active_media_version_row( $versions ) {
		if ( empty( $versions ) || ! is_array( $versions ) ) {
			return array();
		}

		foreach ( $versions as $version ) {
			if ( ! empty( $version['is_active'] ) ) {
				return is_array( $version ) ? $version : array();
			}
		}

		return array();
	}

	/**
	 * Get version row by version number.
	 *
	 * @param array $versions       Versions list.
	 * @param int   $version_number Version number.
	 * @return array
	 */
	private function get_media_version_row_by_number( $versions, $version_number ) {
		if ( empty( $versions ) || ! is_array( $versions ) ) {
			return array();
		}

		foreach ( $versions as $version ) {
			if ( isset( $version['version'] ) && absint( $version['version'] ) === absint( $version_number ) ) {
				return is_array( $version ) ? $version : array();
			}
		}

		return array();
	}

	/**
	 * Resolve media source URL for a version row by attachment type.
	 *
	 * @param array $version_row   Version row.
	 * @param int   $attachment_id Attachment ID.
	 * @return string
	 */
	private function get_version_media_source_url( $version_row, $attachment_id ) {
		if ( empty( $version_row ) || ! is_array( $version_row ) ) {
			return '';
		}

		$is_video = ( 'video' === substr( (string) get_post_mime_type( $attachment_id ), 0, 5 ) );

		if ( $is_video ) {
			$url = isset( $version_row['transcoded_mp4_url'] ) ? (string) $version_row['transcoded_mp4_url'] : '';
			if ( empty( $url ) ) {
				$url = isset( $version_row['transcoded_file_path'] ) ? (string) $version_row['transcoded_file_path'] : '';
			}

			return $url;
		}

		return isset( $version_row['transcoded_file_path'] ) ? (string) $version_row['transcoded_file_path'] : '';
	}

	/**
	 * Resolve thumbnail URL for a version row.
	 *
	 * @param array $version_row Version row.
	 * @return string
	 */
	private function get_version_thumbnail_url( $version_row ) {
		if ( empty( $version_row ) || ! is_array( $version_row ) ) {
			return '';
		}

		return isset( $version_row['thumbnail_url'] ) ? (string) $version_row['thumbnail_url'] : '';
	}

	/**
	 * Get target URL from callback request as fallback.
	 *
	 * @param int              $attachment_id Attachment ID.
	 * @param \WP_REST_Request $request      Callback request.
	 * @return string
	 */
	private function get_target_url_from_callback_request( $attachment_id, $request ) {
		$is_video = ( 'video' === substr( (string) get_post_mime_type( $attachment_id ), 0, 5 ) );

		if ( $is_video ) {
			$mp4_url = (string) $request->get_param( 'mp4_url' );
			if ( ! empty( $mp4_url ) ) {
				return $mp4_url;
			}
		}

		return (string) $request->get_param( 'download_url' );
	}

	/**
	 * Replace source URL with target URL in post content, attachment guid and related meta.
	 *
	 * @param int    $attachment_id      Attachment ID.
	 * @param string $source_url         Previous active source URL.
	 * @param string $target_url         New active source URL.
	 * @param array  $target_version_row Target version row.
	 * @param string $source_thumbnail_url Previous active thumbnail URL.
	 * @param string $target_thumbnail_url New active thumbnail URL.
	 * @return void
	 */
	private function replace_media_url_across_site( $attachment_id, $source_url, $target_url, $target_version_row = array(), $source_thumbnail_url = '', $target_thumbnail_url = '' ) {
		if ( empty( $attachment_id ) || empty( $source_url ) || empty( $target_url ) || $source_url === $target_url ) {
			return;
		}

		// Build the list of source URLs to search-replace: always include the CDN URL, and also
		// include the non-CDN (default WP) URL when stored, so both existing variants in post
		// content and guid are replaced by the new target URL.
		$saved_attachment_url = get_post_meta( $attachment_id, 'rtgodam_pending_default_attachment_url', true );

		$search_source_urls = array( $source_url );
		if ( ! empty( $saved_attachment_url ) && 'completed' !== $saved_attachment_url && $saved_attachment_url !== $source_url ) {
			$search_source_urls[] = $saved_attachment_url;
		}

		global $wpdb;

		$public_post_types = array_diff(
			get_post_types( array( 'public' => true ), 'names' ),
			array( 'attachment' )
		);
		$public_post_types = array_values( $public_post_types );

		$updated_post_ids = array();

		// Replace URL within the post content area of all public post types.
		foreach ( $search_source_urls as $search_source_url ) {
			$like_source = '%' . $wpdb->esc_like( $search_source_url ) . '%';

			if ( ! empty( $public_post_types ) ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Required for efficient targeted cache cleanup of changed posts.
				$found_post_ids = $wpdb->get_col(
					$wpdb->prepare(
						"SELECT ID FROM {$wpdb->posts} WHERE post_type IN (" . implode( ', ', array_fill( 0, count( $public_post_types ), '%s' ) ) . ') AND post_content LIKE %s',
						...array_merge( $public_post_types, array( $like_source ) )
					)
				);

				// Update only the identified posts using their IDs.
				if ( ! empty( $found_post_ids ) ) {
					$found_post_ids   = array_values( array_filter( array_map( 'absint', $found_post_ids ) ) );
					$updated_post_ids = array_values( array_unique( array_merge( $updated_post_ids, $found_post_ids ) ) );

					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Direct update is required for high-volume URL replacement.
					$wpdb->query(
						// phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- Dynamic IN placeholders are generated to match sanitized post IDs.
						$wpdb->prepare(
							"UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, %s, %s) WHERE ID IN (" . implode( ', ', array_fill( 0, count( $found_post_ids ), '%d' ) ) . ')',
							$search_source_url,
							$target_url,
							...$found_post_ids
						)
					);
				}
			}
		}

		// Update the attachment guid directly once, since we already know the attachment ID.
		// This avoids repeating a search-replace pass over the attachment row for each source URL.
		$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$wpdb->prepare(
				"UPDATE {$wpdb->posts} SET guid = %s WHERE ID = %d",
				$target_url,
				$attachment_id
			)
		);

		// For video attachments, also replace thumbnail URLs in post content if the thumbnail URL has changed, to ensure embedded video players show the updated thumbnail.
		if ( ! empty( $source_thumbnail_url ) && ! empty( $target_thumbnail_url ) && $source_thumbnail_url !== $target_thumbnail_url ) {
			$like_source_thumbnail = '%' . $wpdb->esc_like( $source_thumbnail_url ) . '%';

			if ( ! empty( $public_post_types ) ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Required for efficient targeted cache cleanup of changed posts.
				$thumbnail_post_ids = $wpdb->get_col(
					$wpdb->prepare(
						"SELECT ID FROM {$wpdb->posts} WHERE post_type IN (" . implode( ', ', array_fill( 0, count( $public_post_types ), '%s' ) ) . ') AND post_content LIKE %s',
						...array_merge( $public_post_types, array( $like_source_thumbnail ) )
					)
				);

				if ( ! empty( $thumbnail_post_ids ) ) {
					$thumbnail_post_ids = array_values( array_filter( array_map( 'absint', $thumbnail_post_ids ) ) );
					$updated_post_ids   = array_values( array_unique( array_merge( $updated_post_ids, $thumbnail_post_ids ) ) );

					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Direct update is required for high-volume poster URL replacement.
					$wpdb->query(
						// phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- Dynamic IN placeholders are generated to match sanitized post IDs.
						$wpdb->prepare(
							"UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, %s, %s) WHERE ID IN (" . implode( ', ', array_fill( 0, count( $thumbnail_post_ids ), '%d' ) ) . ')',
							$source_thumbnail_url,
							$target_thumbnail_url,
							...$thumbnail_post_ids
						)
					);
				}
			}
		}

		// Finally, update attachment meta with new active version info.
		if ( is_array( $target_version_row ) ) {
			if ( array_key_exists( 'thumbnail_url', $target_version_row ) && ! empty( $target_version_row['thumbnail_url'] ) ) {
				update_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', (string) $target_version_row['thumbnail_url'] );
			}

			if ( array_key_exists( 'thumbnails', $target_version_row ) && ! empty( $target_version_row['thumbnails'] ) ) {
				$thumbnails = array();
				foreach ( $target_version_row['thumbnails'] as $key => $thumbnail ) {
					$thumbnails[] = $thumbnail['thumbnail_url'];
				}
				if ( ! empty( $thumbnails ) ) {
					update_post_meta( $attachment_id, 'rtgodam_media_thumbnails', $thumbnails );
				}
			}

			if ( array_key_exists( 'transcoded_file_path', $target_version_row ) && ! empty( $target_version_row['transcoded_file_path'] ) ) {
				update_post_meta( $attachment_id, 'rtgodam_transcoded_url', (string) $target_version_row['transcoded_file_path'] );
			}

			if ( array_key_exists( 'transcoded_hls_path', $target_version_row ) && ! empty( $target_version_row['transcoded_hls_path'] ) ) {
				update_post_meta( $attachment_id, 'rtgodam_hls_transcoded_url', (string) $target_version_row['transcoded_hls_path'] );
			}

			if ( array_key_exists( 'transcript_path', $target_version_row ) && ! empty( $target_version_row['transcript_path'] ) ) {
				update_post_meta( $attachment_id, 'rtgodam_transcript_path', (string) $target_version_row['transcript_path'] );
			}
		}

		$this->clean_updated_posts_cache( $updated_post_ids );
		clean_post_cache( $attachment_id );
		wp_cache_delete( $attachment_id, 'post_meta' );
		// Mark the pending default attachment URL as completed to break the loop.
		update_post_meta( $attachment_id, 'rtgodam_pending_default_attachment_url', 'completed' );
	}

	/**
	 * Clean post cache for updated post IDs.
	 *
	 * @param array $post_ids Updated post IDs.
	 * @return void
	 */
	private function clean_updated_posts_cache( $post_ids ) {
		if ( empty( $post_ids ) || ! is_array( $post_ids ) ) {
			return;
		}

		foreach ( array_unique( array_map( 'absint', $post_ids ) ) as $post_id ) {
			if ( $post_id > 0 ) {
				clean_post_cache( $post_id );
			}
		}
	}

	/**
	 * Validates if uploaded file mime is compatible with existing attachment.
	 *
	 * @param int    $attachment_id Attachment ID.
	 * @param string $uploaded_mime Uploaded file mime.
	 * @return bool True if compatible.
	 */
	private function is_compatible_version_upload_mime( $attachment_id, $uploaded_mime ) {
		$current_mime = sanitize_mime_type( get_post_mime_type( $attachment_id ) );
		if ( empty( $current_mime ) || empty( $uploaded_mime ) ) {
			return false;
		}

		if ( $current_mime === $uploaded_mime ) {
			return true;
		}

		$current_primary  = strtok( $current_mime, '/' );
		$uploaded_primary = strtok( $uploaded_mime, '/' );

		return ( ! empty( $current_primary ) && $current_primary === $uploaded_primary );
	}

	/**
	 * Store the current attachment URL in post meta before replacement for later reference.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return void
	 */
	private function maybe_store_attachment_url( $attachment_id ) {
		if ( empty( $attachment_id ) ) {
			return;
		}

		// If we have already stored the original attachment URL and marked as completed, we can skip storing again.
		if ( get_post_meta( $attachment_id, 'rtgodam_pending_default_attachment_url', true ) === 'completed' ) {
			return;
		}

		remove_filter( 'wp_get_attachment_url', array( $this, 'filter_attachment_url_for_virtual_media' ), 10 );
		$current_attachment_url = wp_get_attachment_url( $attachment_id );
		add_filter( 'wp_get_attachment_url', array( $this, 'filter_attachment_url_for_virtual_media' ), 10, 2 );

		if ( ! empty( $current_attachment_url ) ) {
			update_post_meta( $attachment_id, 'rtgodam_pending_default_attachment_url', esc_url_raw( $current_attachment_url ) );
		}
	}

	/**
	 * Display HTTP authentication warning notice.
	 *
	 * @since 1.7.1
	 *
	 * @return void
	 */
	public function http_auth_warning_notice() {
		// Only show on media library page.
		$screen = get_current_screen();
		if ( ! $screen || 'upload' !== $screen->id ) {
			return;
		}

		// Check if HTTP auth is enabled.
		if ( ! rtgodam_has_http_auth() ) {
			return;
		}

		// Get the GoDAM logo URL.
		$logo_url = plugins_url( 'assets/src/images/godam-logo.png', dirname( __DIR__ ) );

		?>
		<div class="notice notice-error godam-http-auth-notice">
			<div class="godam-notice-header">
				<img src="<?php echo esc_url( $logo_url ); ?>" alt="<?php esc_attr_e( 'GoDAM Logo', 'godam' ); ?>" class="godam-logo">
				<div>
					<p><strong><?php esc_html_e( 'GoDAM Transcoding Blocked', 'godam' ); ?></strong></p>
					<p>
						<?php
						esc_html_e( 'HTTP authentication is enabled on your site, which prevents GoDAM from accessing media files for transcoding. Please disable HTTP authentication to enable transcoding.', 'godam' );
						?>
					</p>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Replace final rendered content <img> src with CDN URL when available.
	 *
	 * @since 1.7.0
	 *
	 * @param string $filtered_image Full <img> tag.
	 * @param string $context        Render context.
	 * @param int    $attachment_id  Attachment ID.
	 * @return string
	 */
	public function filter_rtgodam_content_img_tag( $filtered_image, $context, $attachment_id ) {
		if ( empty( $attachment_id ) || empty( $filtered_image ) ) {
			return $filtered_image;
		}

		$mime_type = get_post_mime_type( $attachment_id );
		if ( 'image' !== substr( $mime_type, 0, 5 ) ) {
			return $filtered_image;
		}

		// Don't change the image src for virtual media as well.
		$godam_original_id = get_post_meta( $attachment_id, '_godam_original_id', true );
		if ( ! empty( $godam_original_id ) ) {
			return $filtered_image;
		}

		// If rtgodam_image_sizes meta exists, it indicates this is a GoDAM-managed image and we should attempt to replace the src with the CDN URL if available.
		$rtgodam_image_sizes = $this->get_rtgodam_image_sizes( $attachment_id );
		if ( empty( $rtgodam_image_sizes ) ) {
			return $filtered_image;
		}

		$cdn_src = get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );
		if ( empty( $cdn_src ) ) {
			return $filtered_image;
		}

		// If the current src is already on the same CDN host, it is already a correctly-sized
		// CDN URL (e.g. a subsize chosen via the Image block). Don't overwrite it with the
		// full-size CDN URL.
		if ( preg_match( '/\bsrc="([^"]*)"/', $filtered_image, $src_match ) ) {
			$cdn_host     = wp_parse_url( $cdn_src, PHP_URL_HOST );
			$current_host = wp_parse_url( $src_match[1], PHP_URL_HOST );
			if ( $cdn_host && $current_host && $cdn_host === $current_host ) {
				return $filtered_image;
			}
		}

		$updated_image = preg_replace(
			'/\bsrc="[^"]*"/',
			' src="' . esc_url( $cdn_src ) . '"',
			$filtered_image,
			1
		);

		return is_string( $updated_image ) ? $updated_image : $filtered_image;
	}
}
