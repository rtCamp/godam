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
		// Folder/date filtering and the list-view filter UI are part of GoDAM's media-library
		// takeover. Skip them in additive mode so the WordPress media library stays native
		// server-side (no GoDAM folder dropdown or orphaned date inputs on upload.php).
		if ( rtgodam_is_media_library_ui_enabled() ) {
			add_filter( 'ajax_query_attachments_args', array( $this, 'filter_media_library_by_taxonomy' ) );
			add_action( 'pre_get_posts', array( $this, 'pre_get_post_filter' ) );
			add_action( 'restrict_manage_posts', array( $this, 'restrict_manage_media_filter' ) );
		}

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

		// Resolve single named/array size lookups for GoDAM-managed images. Without this,
		// image_downsize() builds a CDN sub-size URL that was never offloaded (e.g. Site
		// Icon / favicon sizes) and 404s. See issue #2009.
		add_filter( 'image_downsize', array( $this, 'filter_image_downsize_for_virtual_media' ), 10, 3 );

		// Add admin notice for HTTP auth and AJAX handler to save HTTP auth status.
		add_action( 'admin_notices', array( $this, 'http_auth_warning_notice' ) );
		add_action( 'wp_ajax_godam_save_http_auth_status', array( $this, 'save_http_auth_status' ) );

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
		$computed_mime = $this->get_mime_type_for_job_type( $job_type, $api_mime_type, $item['orignal_file_name'] ?? '' );
		$title         = isset( $item['title'] ) ? $item['title'] : ( isset( $item['orignal_file_name'] ) ? pathinfo( $item['orignal_file_name'], PATHINFO_FILENAME ) : $item['name'] );
		// trim the extension from title if present.
		$title = preg_replace( '/\.[^.]+$/', '', $title );

		// GoDAM stores the human-readable summary in `ai_content_summary`; the
		// `description` field is usually empty. Fall back to it so the description
		// shown in the GoDAM dashboard also appears in WordPress.
		$description = ! empty( $item['description'] ) ? $item['description'] : ( $item['ai_content_summary'] ?? '' );

		// Get video duration in seconds.
		$video_duration = isset( $item['playtime'] ) ? $item['playtime'] : 0;
		// Round video duration to integer seconds.
		$video_duration = is_numeric( $video_duration ) ? (int) round( $video_duration ) : 0;

		// Normalize chapters (mainly for audio). GoDAM Central stores them as a
		// JSON string, but tolerate an already-decoded array/object too. Each
		// chapter is reduced to the fields the audio block and its render
		// template consume (`startTime`/`text`), keeping `id`/`originalTime`
		// so the customization editor can round-trip them.
		$chapters = array();
		if ( ! empty( $item['chapters'] ) ) {
			$raw_chapters = $item['chapters'];
			if ( is_string( $raw_chapters ) ) {
				$decoded      = json_decode( $raw_chapters, true );
				$raw_chapters = is_array( $decoded ) ? $decoded : array();
			}
			foreach ( (array) $raw_chapters as $chapter ) {
				$chapter    = (array) $chapter;
				$chapters[] = array(
					'id'           => isset( $chapter['id'] ) ? (string) $chapter['id'] : '',
					'text'         => isset( $chapter['text'] ) ? (string) $chapter['text'] : '',
					'originalTime' => isset( $chapter['originalTime'] ) ? (string) $chapter['originalTime'] : '',
					'startTime'    => isset( $chapter['startTime'] ) ? (string) $chapter['startTime'] : '0',
				);
			}
		}

		$result = array(
			'id'                    => $item['name'],
			'title'                 => $title,
			'description'           => $description,
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
			'width'                 => $item['width'] ?? 0,
			'height'                => $item['height'] ?? 0,
			'chapters'              => $chapters,

			/*
			 * The preview PDF for a document. Distinct from `mpd_url` above, which for a
			 * `document` job is the ORIGINAL .docx/.xlsx and cannot be rendered. Empty for a
			 * password-protected document, which has no preview by design.
			 */
			'preview_pdf_url'       => $item['preview_pdf_url'] ?? '',
		);

		// Set icon with fallback to default mime type icon for audio and documents.
		$result['icon'] = $item['thumbnail_url'] ?? '';

		// If no thumbnail URL, use WordPress default icons for audio and documents. Keyed off
		// the job type rather than the MIME type: Central does not always send a MIME, and the
		// document types span too many vendor prefixes to test individually here.
		if ( empty( $result['icon'] ) ) {
			if ( 'audio' === $job_type ) {
				$result['icon'] = includes_url( 'images/media/audio.png' );
			} elseif ( in_array( $job_type, array( 'pdf', 'document' ), true ) || 'application/pdf' === $api_mime_type ) {
				$result['icon'] = includes_url( 'images/media/document.png' );
			}
		}

		if ( 'stream' === $job_type ) {
			$result['type'] = 'video';
		}

		return $result;
	}

	/**
	 * Get appropriate MIME type based on job type.
	 *
	 * @param string $job_type  Job type from GoDAM API.
	 * @param string $mime_type Original MIME type from API.
	 * @param string $filename  Original file name from API, used to infer a missing MIME type.
	 * @return string Appropriate MIME type.
	 */
	private function get_mime_type_for_job_type( $job_type, $mime_type, $filename = '' ) {
		switch ( $job_type ) {
			case 'stream':
				return 'application/dash+xml';
			case 'audio':
				return ! empty( $mime_type ) ? $mime_type : 'audio/mpeg';
			case 'image':
				return ! empty( $mime_type ) ? $mime_type : 'image/jpeg';
			case 'pdf':
			case 'document':
				/*
				 * Documents used to fall through to the default below, which meant a job with
				 * no MIME type was labelled application/dash+xml — then rejected outright by
				 * create_media_entry()'s allowlist, so the item could not be imported at all.
				 *
				 * When Central sends no MIME type, the original file name is asked next rather
				 * than defaulting straight to PDF. Labelling a converted document
				 * application/pdf is not harmless: rtgodam_get_document_preview_url() trusts
				 * rtgodam_transcoded_url for a PDF, and for a `document` that key holds the
				 * ORIGINAL .docx — so a document with no preview (a password-protected one, say)
				 * would hand the .docx itself to pdf.js. PDF remains the last resort, which is
				 * exact for job type 'pdf' and keeps unnamed items importable.
				 */
				if ( ! empty( $mime_type ) ) {
					return $mime_type;
				}

				$extension = rtgodam_get_extension_from_path( $filename );

				if ( ! empty( $extension ) ) {
					$mime_for_extension = array_search(
						$extension,
						rtgodam_get_supported_document_types(),
						true
					);

					if ( ! empty( $mime_for_extension ) ) {
						return $mime_for_extension;
					}
				}

				return 'application/pdf';
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

		// Captured before the switch below, so this is always the site this
		// upload belongs to (the one currently active), not the media site.
		$site_url = get_site_url();

		/**
		 * Fires before reading this attachment's transcoding/virtual-media
		 * meta, so integrations that centralize media on another site can
		 * switch context first. Hooked to `add_attachment`, which can fire
		 * synchronously from inside an already-open bracket (e.g.
		 * create_virtual_attachment()).
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$transcoding_job_id = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );

		// Check virtual media status for transcoding requests.
		$godam_original_id = get_post_meta( $attachment_id, '_godam_original_id', true );
		$is_virtual_media  = ! empty( $godam_original_id );

		// Skip transcoding for virtual media.
		if ( $is_virtual_media ) {
			do_action( 'rtgodam_after_attachment_lookup' );
			return;
		}

		// Only if attachment type is image.
		$mime_type = get_post_mime_type( $attachment_id );
		if ( 'image' !== substr( $mime_type, 0, 5 ) ) {
			do_action( 'rtgodam_after_attachment_lookup' );
			return;
		}
		do_action( 'rtgodam_after_attachment_lookup' );

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
			do_action( 'rtgodam_before_attachment_lookup' );
			update_post_meta( $attachment_id, 'rtgodam_transcoding_status', 'failed' );
			update_post_meta( $attachment_id, 'rtgodam_transcoding_error_msg', __( 'HTTP authentication is enabled on your site, preventing transcoding.', 'godam' ) );
			update_post_meta( $attachment_id, 'rtgodam_transcoding_error_code', 'http_auth_enabled' );
			do_action( 'rtgodam_after_attachment_lookup' );

			return;
		}

		$api_key = get_option( 'rtgodam-api-key', '' );

		if ( empty( $api_key ) ) {
			return;
		}

		$api_url = RTGODAM_API_BASE . '/api/resource/Transcoder Job' . ( empty( $transcoding_job_id ) ? '' : '/' . $transcoding_job_id );

		/**
		 * Fires before reading this attachment's URL/title/author/content,
		 * so integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$attachment_url = wp_get_attachment_url( $attachment_id );

		$file_title = get_the_title( $attachment_id );
		$file_name  = pathinfo( $attachment_url, PATHINFO_FILENAME ) . '.' . pathinfo( $attachment_url, PATHINFO_EXTENSION );

		// Get attachment author information.
		$attachment_author_id = get_post_field( 'post_author', $attachment_id );
		$attachment_author    = get_user_by( 'id', $attachment_author_id );

		// Get attachment content, used as the transcoding request description below.
		$attachment_content = get_post_field( 'post_content', $attachment_id );

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
		do_action( 'rtgodam_after_attachment_lookup' );

		include_once RTGODAM_PATH . 'admin/class-rtgodam-transcoder-rest-routes.php';
		$callback_url        = \RTGODAM_Transcoder_Rest_Routes::get_callback_url();
		$status_callback_url = \RTGODAM_Transcoder_Rest_Routes::get_callback_url( 'status' );

		// Request params.
		$params = array(
			'retranscode'          => empty( $transcoding_job_id ) ? 0 : 1,
			'api_token'            => $api_key,
			'job_type'             => 'image',
			'job_for'              => 'wp-media',
			'file_origin'          => $attachment_url,
			'orignal_file_name'    => $file_name ?? $file_title,
			'mime_type'            => $mime_type,
			'title'                => sanitize_text_field( $file_title ),
			'description'          => sanitize_textarea_field( (string) $attachment_content ),
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
		// Check if attachment type is video, audio, document, or image.
		$mime_type = $attachment->post_mime_type;
		$is_video  = 'video' === substr( $mime_type, 0, 5 );
		$is_audio  = 'audio' === substr( $mime_type, 0, 5 );
		// Every convertible document type, not just PDF, so an Office upload also reports its
		// transcoding progress in the media library grid. Tested against the attachment rather
		// than its MIME type alone: text/plain covers .srt/.asc/.c/.cc/.h as well as .txt, and
		// those are never transcoded, so a MIME-only test gave every subtitle and source file
		// in the library a transcoding spinner that never resolved.
		//
		// Fires its own before/after pair, separate from the one further below: this call
		// happens ahead of the early "supported type" return, so it cannot share that later
		// bracket without extending it across the return too.
		do_action( 'rtgodam_before_attachment_lookup' );
		$is_pdf = rtgodam_is_supported_document_attachment( $attachment->ID );
		do_action( 'rtgodam_after_attachment_lookup' );
		$is_image = 'image' === substr( $mime_type, 0, 5 );

		// Only process supported attachment types.
		if ( ! ( $is_video || $is_audio || $is_pdf || $is_image ) ) {
			return $response;
		}

		/**
		 * Fires before resolving/reading this attachment's transcoding,
		 * virtual-media, and CDN image-size meta for the media library JS
		 * response, so integrations that centralize media on another site
		 * can switch context first. This reads and (re)writes several
		 * rtgodam_* postmeta keys plus the _godam_original_id marker, all
		 * keyed on $attachment->ID.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );

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

		do_action( 'rtgodam_after_attachment_lookup' );

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

		if ( isset( $_REQUEST['query']['rtgodam_media_category'] ) ) {
			$media_category = sanitize_text_field( wp_unslash( $_REQUEST['query']['rtgodam_media_category'] ) );

			if ( ! isset( $query_args['tax_query'] ) ) {
				$query_args['tax_query'] = array(); // phpcs:ignore -- tax_query is required here to filter by taxonomy.
			}

			if ( 'uncategorized' === $media_category ) {
				$query_args['tax_query'][] = array(
					'taxonomy' => 'rtgodam_media_category',
					'field'    => 'term_id',
					'operator' => 'NOT EXISTS',
				);
			} elseif ( 'all' !== $media_category && '' !== $media_category ) {
				$query_args['tax_query'][] = array(
					'taxonomy' => 'rtgodam_media_category',
					'field'    => 'slug',
					'terms'    => $media_category,
				);
			}
		}

		if ( isset( $_REQUEST['query']['rtgodam_media_tag'] ) && '' !== $_REQUEST['query']['rtgodam_media_tag'] ) {
			$media_tag = sanitize_text_field( wp_unslash( $_REQUEST['query']['rtgodam_media_tag'] ) );

			if ( ! isset( $query_args['tax_query'] ) ) {
				$query_args['tax_query'] = array(); // phpcs:ignore -- tax_query is required here to filter by taxonomy.
			}

			$query_args['tax_query'][] = array(
				'taxonomy' => 'rtgodam_media_tag',
				'field'    => 'slug',
				'terms'    => $media_tag,
			);
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

		/**
		 * Fires before validating that $attachment_id resolves to a real
		 * attachment post, and stays open through every subsequent read
		 * and write on that same attachment below -- update_attached_file(),
		 * wp_update_post()'s MIME-type update, and the final
		 * wp_update_attachment_metadata() -- so integrations that centralize
		 * media on another site can switch context once for this whole
		 * read-modify-write sequence instead of losing it between separate
		 * brackets. Wrapped in try/finally because this method returns
		 * early from several points (invalid attachment, missing
		 * filesystem, failed download, failed move).
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		try {
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
		} finally {
			do_action( 'rtgodam_after_attachment_lookup' );
		}

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

		/**
		 * Fires before reading/mutating this attachment's data, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * 'rtgodam_handle_callback_finished' is a public, third-party-
		 * triggerable extension point (see its docblock in
		 * class-rtgodam-transcoder-rest-routes.php) — and even for its own
		 * built-in caller, handle_callback()'s before/after bracket around
		 * the 'wp-media' branch has already closed by the time this fires,
		 * several lines later in that method. Wrapped here defensively, in
		 * a try/finally since this method returns early from several
		 * points, rather than relying on an already-open bracket from
		 * whichever caller triggered the hook.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		try {
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
		} finally {
			do_action( 'rtgodam_after_attachment_lookup' );
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
		/**
		 * Fires before reading this attachment's mime type, GoDAM CDN
		 * image-size map, transcoded-URL meta, and (for virtual media) its
		 * post row/guid, so integrations that centralize media on another
		 * site can switch context first. Wrapped in try/finally because
		 * this method returns from several points once it determines which
		 * URL to use.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		try {
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
		} finally {
			do_action( 'rtgodam_after_attachment_lookup' );
		}
	}

	/**
	 * Resolve single-size image lookups for GoDAM-managed (CDN-offloaded) images.
	 *
	 * GoDAM rewrites the full-size attachment URL to the CDN (a `.webp`), but only the
	 * full-size file and the sizes listed in `rtgodam_image_sizes` actually exist on the
	 * CDN. Core's `image_downsize()` resolves a single named/array size by taking that
	 * rewritten full URL and swapping in a locally-derived sub-size filename — producing
	 * a CDN URL that was never uploaded and 404s. The most visible casualty is the Site
	 * Icon / favicon (`get_site_icon_url()` → `wp_get_attachment_image_url()`), but any
	 * `wp_get_attachment_image_src( $id, $size )` caller is affected. See issue #2009.
	 *
	 * Resolution order for a requested size:
	 *  1. Virtual media (GoDAM-tab picks, `_godam_original_id` set) has no local file, so
	 *     defer to core — its basename-swap on the rewritten CDN full URL yields the correct
	 *     CDN sub-size URL. (A "local" URL here would 404 and would corrupt the srcset.)
	 *  2. A named size present in `rtgodam_image_sizes` uses that authoritative CDN URL.
	 *  3. For real uploads, let core pick the sub-size it would serve (honouring its
	 *     aspect-ratio tolerance for named and [w, h] requests); serve that size's offloaded
	 *     CDN copy if it exists, otherwise the local file — which does exist on disk. This
	 *     covers sizes that were never offloaded, e.g. the Site Icon sub-sizes.
	 *  4. If none matches, defer to core (which serves the full-size CDN image).
	 *
	 * @since 2.2.1
	 *
	 * @param array|false  $downsize      Short-circuit value (false unless already set).
	 * @param int          $attachment_id Attachment ID.
	 * @param string|int[] $size          Requested size (name or [width, height]).
	 *
	 * @return array|false [url, width, height, is_intermediate] or the original $downsize.
	 */
	public function filter_image_downsize_for_virtual_media( $downsize, $attachment_id, $size ) {
		// Respect any earlier short-circuit from another plugin.
		if ( false !== $downsize ) {
			return $downsize;
		}

		// Full size is handled correctly by the wp_get_attachment_url rewrite.
		if ( 'full' === $size ) {
			return $downsize;
		}

		/**
		 * Fires before reading this attachment's MIME type and GoDAM CDN image-size /
		 * transcoded-URL meta, so integrations that centralize media on another site can
		 * switch context first. Wrapped in try/finally because this method returns from
		 * several points while resolving the requested size.
		 *
		 * @since 2.2.1
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		try {
			if ( 'image' !== substr( (string) get_post_mime_type( $attachment_id ), 0, 5 ) ) {
				return $downsize;
			}

			$rtgodam_transcoded_url = get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );
			$rtgodam_image_sizes    = $this->get_rtgodam_image_sizes( $attachment_id );
			$godam_original_id      = get_post_meta( $attachment_id, '_godam_original_id', true );

			// Only intervene when the full URL is actually rewritten to the CDN; otherwise
			// core's default (local) resolution is already correct.
			$is_godam_managed = ( ! empty( $rtgodam_image_sizes ) || ! empty( $godam_original_id ) );
			if ( ! $is_godam_managed || empty( $rtgodam_transcoded_url ) ) {
				return $downsize;
			}

			// 1. Virtual media (GoDAM-tab picks, `_godam_original_id` set) have NO local file:
			// their attachment metadata stores CDN sub-size basenames, not on-disk files.
			// Defer to core — its basename-swap on the rewritten CDN full URL yields the
			// correct CDN sub-size URL. (Building a "local" URL here would 404, and would
			// also corrupt the legacy virtual-media srcset, which is rebuilt from this src.)
			if ( ! empty( $godam_original_id ) ) {
				return $downsize;
			}

			// 2. Named size present in the authoritative CDN size map → that CDN URL.
			if ( is_string( $size ) && ! empty( $rtgodam_image_sizes[ $size ]['url'] ) ) {
				$cdn_size = $rtgodam_image_sizes[ $size ];
				$width    = isset( $cdn_size['width'] ) ? (int) $cdn_size['width'] : 0;
				$height   = isset( $cdn_size['height'] ) ? (int) $cdn_size['height'] : 0;

				if ( $width > 0 && $height > 0 ) {
					return array( esc_url( $cdn_size['url'] ), $width, $height, true );
				}
				// A map entry without valid dimensions is treated as unusable; fall through
				// to the local file below rather than emit a CDN URL with no size info.
			}

			// 3. Real uploads offloaded to the CDN. Let core pick the sub-size it would serve
			// (this honours core's aspect-ratio tolerance for named and [w, h] requests),
			// then prefer that size's offloaded CDN copy when it exists, otherwise serve
			// the local file — which is still on disk (the plugin does not delete local
			// files after offload; a future "delete after offload" option would need this
			// branch to fall back to the CDN/full image instead).
			$meta = wp_get_attachment_metadata( $attachment_id );
			if ( empty( $meta['file'] ) || empty( $meta['sizes'] ) || ! is_array( $meta['sizes'] ) ) {
				return $downsize;
			}

			$intermediate = image_get_intermediate_size( $attachment_id, $size );
			if ( empty( $intermediate['file'] ) ) {
				return $downsize;
			}

			$width  = (int) $intermediate['width'];
			$height = (int) $intermediate['height'];

			// Keep CDN delivery when this exact size was offloaded (covers array/[w, h]
			// requests for offloaded sizes, which would otherwise silently drop to local).
			$cdn_url = $this->find_cdn_size_url( $rtgodam_image_sizes, $width, $height );
			if ( $cdn_url ) {
				return array( esc_url( $cdn_url ), $width, $height, true );
			}

			$uploads = wp_get_upload_dir();
			if ( ! empty( $uploads['error'] ) ) {
				return $downsize;
			}

			// Derive the sub-directory from the *relative* attached path. `_wp_attached_file`
			// can hold an absolute path on migrated/imported sites, so mirror core and use
			// _wp_get_attachment_relative_path() (which also won't strip leading dots from a
			// legitimate directory name the way a manual ltrim would).
			$relative_dir = _wp_get_attachment_relative_path( $meta['file'] );
			$base_url     = trailingslashit( $uploads['baseurl'] . ( '' !== $relative_dir ? '/' . $relative_dir : '' ) );
			$local_url    = $base_url . $intermediate['file'];

			return array( esc_url( $local_url ), $width, $height, true );
		} finally {
			do_action( 'rtgodam_after_attachment_lookup' );
		}
	}

	/**
	 * Find the offloaded CDN URL for an exact image size in the GoDAM CDN size map.
	 *
	 * Used to keep CDN delivery for a size once core has picked which sub-size to serve
	 * (by name or by matching a `[ width, height ]` request). Only an exact dimension match
	 * counts, so a small array request is never upscaled onto a larger CDN image.
	 *
	 * @since 2.2.1
	 *
	 * @param array $rtgodam_image_sizes CDN size map keyed by size name.
	 * @param int   $width               Target width in pixels.
	 * @param int   $height              Target height in pixels.
	 *
	 * @return string|null The CDN URL for that size, or null if it was not offloaded.
	 */
	private function find_cdn_size_url( $rtgodam_image_sizes, $width, $height ) {
		if ( empty( $rtgodam_image_sizes ) || ! is_array( $rtgodam_image_sizes ) || $width <= 0 || $height <= 0 ) {
			return null;
		}

		foreach ( $rtgodam_image_sizes as $entry ) {
			if ( ! is_array( $entry ) || empty( $entry['url'] ) ) {
				continue;
			}

			if ( (int) ( $entry['width'] ?? 0 ) === $width && (int) ( $entry['height'] ?? 0 ) === $height ) {
				return $entry['url'];
			}
		}

		return null;
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

		/**
		 * Fires before reading this attachment's GoDAM CDN image-size map
		 * and transcoded-URL meta, so integrations that centralize media
		 * on another site can switch context first. Wrapped in try/finally
		 * because this method returns early once it determines no CDN data
		 * exists for the attachment.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		try {
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
		} finally {
			do_action( 'rtgodam_after_attachment_lookup' );
		}
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
		/**
		 * Fires before reading this attachment's MIME type, virtual-media
		 * original-ID, and GoDAM CDN image-size meta, so integrations that
		 * centralize media on another site can switch context first.
		 * Wrapped in try/finally because this method returns early from
		 * several points while deciding whether/how to rebuild the srcset.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		try {
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
		} finally {
			do_action( 'rtgodam_after_attachment_lookup' );
		}
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
		$logo_url = plugins_url( 'assets/src/images/godam-logo.svg', dirname( __DIR__ ) );

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

		/**
		 * Fires before reading this attachment's MIME type, virtual-media
		 * original-ID, and GoDAM CDN image-size/transcoded-URL meta, so
		 * integrations that centralize media on another site can switch
		 * context first. Wrapped in try/finally because this method
		 * returns from several points while deciding whether to rewrite
		 * the rendered <img> src.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		try {
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
		} finally {
			do_action( 'rtgodam_after_attachment_lookup' );
		}
	}
}
