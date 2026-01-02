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
		add_filter( 'wp_calculate_image_srcset', array( $this, 'filter_virtual_media_srcset' ), 10, 5 );
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

		$result = array(
			'id'                    => $item['name'],
			'title'                 => $title,
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
		);

		$result['icon'] = $item['thumbnail_url'] ?? '';

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
	 * @param int $attachment_id Attachment ID.
	 * @return void
	 */
	public function upload_media_to_frappe_backend( $attachment_id ) {
		// Check if local development environment.
		if ( rtgodam_is_local_environment() ) {
			return;
		}

		// Only if attachment type if image.
		if ( 'image' !== substr( get_post_mime_type( $attachment_id ), 0, 5 ) ) {
			return;
		}

		$api_key = get_option( 'rtgodam-api-key', '' );

		if ( empty( $api_key ) ) {
			return;
		}

		$api_url = RTGODAM_API_BASE . '/api/resource/Transcoder Job';

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

		if ( $attachment_author ) {
			$author_first_name = $attachment_author->first_name;
			$author_last_name  = $attachment_author->last_name;

			// If first and last names are empty, use username as fallback.
			if ( empty( $author_first_name ) && empty( $author_last_name ) ) {
				$author_first_name = $attachment_author->user_login;
			}
		}

		// Request params.
		$params = array(
			'api_token'            => $api_key,
			'job_type'             => 'image',
			'file_origin'          => $attachment_url,
			'orignal_file_name'    => $file_name ?? $file_title,
			'wp_author_email'      => apply_filters( 'godam_author_email_to_send', $attachment_author ? $attachment_author->user_email : '', $attachment_id ),
			'wp_site'              => $site_url,
			'wp_author_first_name' => apply_filters( 'godam_author_first_name_to_send', $author_first_name, $attachment_id ),
			'wp_author_last_name'  => apply_filters( 'godam_author_last_name_to_send', $author_last_name, $attachment_id ),
			'public'               => 1,
		);

		$upload_media = wp_remote_post(
			$api_url,
			array(
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
		if ( ! $is_video && ! $is_audio && ! $is_pdf && ! $is_image ) {
			return $response;
		}

		$transcoded_url     = get_post_meta( $attachment->ID, 'rtgodam_transcoded_url', true );
		$transcoding_status = get_post_meta( $attachment->ID, 'rtgodam_transcoding_status', true );

		if ( ! empty( $transcoded_url ) ) {
			$response['transcoded_url'] = $transcoded_url;
		} else {
			$response['transcoded_url'] = false;
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
			$icon_url          = wp_mime_type_icon( $attachment->ID, '.svg' );
			$response['image'] = array();
			if ( empty( $icon_url ) ) {
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
		if ( ! $attachment_id || ! filter_var( $file_url, FILTER_VALIDATE_URL ) || ! wp_http_validate_url( $file_url ) ) {
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

		$godam_original_id = get_post_meta( $post_id, '_godam_original_id', true );

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
	 * Filter srcset calculation for virtual media to use full URLs.
	 *
	 * @param array|false $sources       Array of image sources for srcset or false.
	 * @param array       $size_array    Array of width and height values.
	 * @param string      $image_src     The 'src' of the image.
	 * @param array       $image_meta    The image meta data.
	 * @param int         $attachment_id The image attachment ID.
	 *
	 * @since n.e.x.t
	 *
	 * @return array|false Filtered sources array or false.
	 */
	public function filter_virtual_media_srcset( $sources, $size_array, $image_src, $image_meta, $attachment_id ) {
		$godam_original_id = get_post_meta( $attachment_id, '_godam_original_id', true );

		if ( empty( $godam_original_id ) ) {
			return $sources;
		}

		// Check if image attachment.
		$attachment_mime_type = get_post_mime_type( $attachment_id );
		if ( 'image' !== substr( $attachment_mime_type, 0, 5 ) ) {
			return $sources;
		}

		if ( empty( $image_meta['sizes'] ) || ! is_array( $image_meta['sizes'] ) ) {
			return $sources;
		}

		// Use the current image URL as the base for all subsizes.
		$base_url = trailingslashit( untrailingslashit( dirname( $image_src ) ) );

		// Skip srcset entirely when the requested size is the thumbnail variant.
		if ( ! empty( $image_meta['sizes']['thumbnail'] ) ) {
			$thumb_meta = $image_meta['sizes']['thumbnail'];
			$is_thumb   = false;

			if ( isset( $size_array[0], $size_array[1], $thumb_meta['width'], $thumb_meta['height'] )
				&& (int) $size_array[0] === (int) $thumb_meta['width']
				&& (int) $size_array[1] === (int) $thumb_meta['height']
			) {
				$is_thumb = true;
			} elseif ( isset( $thumb_meta['file'] ) ) {
				$thumb_file = $thumb_meta['file'];
				$thumb_url  = filter_var( $thumb_file, FILTER_VALIDATE_URL ) ? $thumb_file : $base_url . ltrim( $thumb_file, '/' );
				if ( ! empty( $image_src ) && $thumb_url === $image_src ) {
					$is_thumb = true;
				}
			}

			if ( $is_thumb ) {
				return false;
			}
		}

		foreach ( $image_meta['sizes'] as $size_data ) {
			if ( empty( $size_data['file'] ) || empty( $size_data['width'] ) ) {
				continue;
			}

			$width  = (int) $size_data['width'];
			$height = isset( $size_data['height'] ) ? (int) $size_data['height'] : 0;

			$file = $size_data['file'];

			// If the file already is a URL, use it. Otherwise append it to the base URL.
			if ( filter_var( $file, FILTER_VALIDATE_URL ) ) {
				// Get last string after the last slash in the file url.
				$file_basename = basename( $file );
				// Rebuild the full URL using the base URL and the file basename.
				$url = $base_url . ltrim( $file_basename, '/' );
			} else {
				$url = $base_url . ltrim( $file, '/' );
			}

			// Override or set the source keyed by width.
			$sources[ $width ] = array(
				'url'        => esc_url_raw( $url ),
				'descriptor' => 'w',
				'value'      => $width,
			);
		}

		ksort( $sources );

		return $sources;
	}
}
