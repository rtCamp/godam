<?php
/**
 * The transcoder-specific functionality of the plugin.
 *
 * @since   1.0.0
 *
 * @package GoDAM
 * @subpackage GoDAM/TranscoderHandler
 */

defined( 'ABSPATH' ) || exit;

/**
 * Handle request/response with trancoder api.
 *
 * @since   1.0.0
 *
 * @package GoDAM
 * @subpackage GoDAM/TranscoderHandler
 */
class RTGODAM_Transcoder_Handler {

	/**
	 * The transcoder API URL.
	 *
	 * @since    1.0.0
	 * @access   protected
	 * @var      string    $transcoding_api_url    The URL of the api.
	 */
	public $transcoding_api_url = RTGODAM_API_BASE . '/api/';

	/**
	 * The URL of the EDD store.
	 *
	 * @since    1.0.0
	 * @access   protected
	 * @var      string    $store_url    The URL of the transcoder api.
	 */
	protected $store_url = RTGODAM_API_BASE . '/api/';

	/**
	 * Contain uploaded media information.
	 *
	 * @since    1.0.0
	 * @access   public
	 * @var      array    $uploaded   Contain uploaded media information.
	 */
	public $uploaded = array();

	/**
	 * The api key of transcoding service subscription.
	 *
	 * @since    1.0.0
	 * @access   public
	 * @var      string    $api_key    The api key of transcoding service subscription.
	 */
	public $api_key = false;

	/**
	 * Video extensions with comma separated.
	 *
	 * @since    1.0.0
	 * @access   public
	 * @var      string    $video_extensions    Video extensions with comma separated.
	 */
	public $video_extensions = ',mov,m4v,m2v,avi,mpg,flv,wmv,mkv,webm,ogv,mxf,asf,vob,mts,qt,mpeg,x-msvideo,3gp,mpd';

	/**
	 * Audio extensions with comma separated.
	 *
	 * @since    1.0.0
	 * @access   public
	 * @var      string    $audio_extensions    Audio extensions with comma separated.
	 */
	public $audio_extensions = ',wma,ogg,wav,m4a';

	/**
	 * Other extensions with comma separated.
	 *
	 * @since    1.5
	 * @access   public
	 * @var      string    $other_extensions    Other extensions with comma separated.
	 */
	public $other_extensions = ',pdf';

	/**
	 * Allowed mimetypes.
	 *
	 * @since    1.5
	 * @access   public
	 * @var      array    $allowed_mimetypes    Allowed mimetypes other than audio and video.
	 */
	public $allowed_mimetypes = array(
		'application/ogg',
		'application/pdf',
	);

	/**
	 * Store EasyDAM settings.
	 *
	 * @since 1.0.0
	 * @access public
	 * @var array $easydam_settings Contains user-specified settings for EasyDAM.
	 */
	public $easydam_settings = array();

	/**
	 * Initialize the class and set its properties.
	 *
	 * @since    1.0.0
	 *
	 * @param bool $no_init  If true then do nothing else continue.
	 */
	public function __construct( $no_init = false ) {

		$this->api_key          = get_option( 'rtgodam-api-key' );
		$this->easydam_settings = get_option( 'rtgodam-settings', array() );

		$default_settings = array(
			'video' => array(
				'adaptive_bitrate'     => false,
				'watermark'            => false,
				'watermark_text'       => '',
				'watermark_url'        => '',
				'video_thumbnails'     => 5,
				'overwrite_thumbnails' => false,
			),
		);

		$this->easydam_settings = wp_parse_args(
			get_option( 'rtgodam-settings', array() ),
			$default_settings
		);

		// Temporarily inclduing godam-retranscode-admin.php file here.
		include_once RTGODAM_PATH . 'admin/class-rtgodam-retranscodemedia.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant

		/**
		 * Allow other plugin and wp-config to overwrite API URL.
		 */
		if ( defined( 'RTGODAM_TRANSCODER_API_URL' ) && ! empty( RTGODAM_TRANSCODER_API_URL ) ) {
			$this->transcoding_api_url = RTGODAM_TRANSCODER_API_URL;
		}

		$this->transcoding_api_url = apply_filters( 'rtgodam_transcoding_api_url', $this->transcoding_api_url );

		if ( $no_init ) {
			return;
		}

		if ( $this->api_key ) {
			$usage_info = get_option( 'rtgodam-usage' );

			if ( isset( $usage_info ) && is_array( $usage_info ) && array_key_exists( $this->api_key, $usage_info ) ) {
				if ( is_object( $usage_info[ $this->api_key ] ) && isset( $usage_info[ $this->api_key ]->status ) && 'Active' === $usage_info[ $this->api_key ]->status ) {

					// Enable re-transcoding.
					include_once RTGODAM_PATH . 'admin/class-rtgodam-retranscodemedia.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant

					add_action( 'add_attachment', array( $this, 'send_transcoding_request' ), 21, 1 );
				}
			}
		}
	}

	/**
	 * Send transcoding request for uploaded media in WordPress media library.
	 *
	 * @since 1.4.2
	 *
	 * @param int $attachment_id    ID of attachment.
	 */
	public function send_transcoding_request( $attachment_id ) {
		$metadata = wp_get_attachment_metadata( $attachment_id );

		$mime_type = get_post_mime_type( $attachment_id );

		if ( empty( $metadata ) ) {
			$metadata = array( 'mime_type' => $mime_type );
		} elseif ( empty( $metadata['mime_type'] ) ) {
			$metadata['mime_type'] = $mime_type;
		}

		// Send the transcoding request.
		$this->wp_media_transcoding( $metadata, $attachment_id );
	}

	/**
	 * Send transcoding request and save transcoding job id get in response for uploaded media in WordPress media library.
	 *
	 * @since 1.0.0
	 *
	 * @param array  $wp_metadata          Metadata of the attachment.
	 * @param int    $attachment_id     ID of attachment.
	 * @param string $autoformat        If true then generating thumbs only else trancode video.
	 * @param bool   $retranscode       If its retranscoding request or not.
	 */
	public function wp_media_transcoding( $wp_metadata, $attachment_id, $autoformat = true, $retranscode = false ) {

		if ( empty( $wp_metadata['mime_type'] ) ) {
			return $wp_metadata;
		}

		$transcoding_job_id = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );

		// Log virtual media status for transcoding requests.
		$godam_original_id = get_post_meta( $attachment_id, '_godam_original_id', true );
		$is_virtual_media  = ! empty( $godam_original_id );

		// Skip transcoding for virtual media.
		if ( $is_virtual_media ) {
			return $wp_metadata;
		}

		$path = get_attached_file( $attachment_id );
		$url  = wp_get_attachment_url( $attachment_id );

		/**
		 * FIX WordPress 3.6 METADATA
		 */
		require_once ABSPATH . 'wp-admin/includes/media.php';

		$metadata = $wp_metadata;

		$type_arry        = explode( '.', $url );
		$type             = strtolower( $type_arry[ count( $type_arry ) - 1 ] );
		$extension        = pathinfo( $path, PATHINFO_EXTENSION );
		$not_allowed_type = array();
		preg_match( '/video|audio/i', $metadata['mime_type'], $type_array );

		if ( (
				preg_match( '/video|audio/i', $metadata['mime_type'], $type_array ) ||
				in_array( $metadata['mime_type'], $this->allowed_mimetypes, true )
			) &&
			! in_array( $type, $not_allowed_type, true )
		) {

			$options_video_thumb = $this->get_thumbnails_required( $attachment_id );

			if ( empty( $options_video_thumb ) ) {
				$options_video_thumb = 5;
			}

			$job_type = 'stream';

			if ( ( ! empty( $type_array ) && 'audio' === $type_array[0] ) || in_array( $extension, explode( ',', $this->audio_extensions ), true ) ) {
				$job_type = 'audio';
			} elseif ( in_array( $extension, explode( ',', $this->other_extensions ), true ) ) {
				$job_type            = $extension;
				$autoformat          = $extension;
				$options_video_thumb = 0;
			}

			/** Figure out who is requesting this job */
			$job_for = 'wp-media';

			// Media settings.
			$rtgodam_watermark              = $this->easydam_settings['video']['watermark'];
			$rtgodam_use_watermark_image    = $this->easydam_settings['video']['use_watermark_image'] ?? false;
			$rtgodam_watermark_text         = sanitize_text_field( $this->easydam_settings['video']['watermark_text'] );
			$rtgodam_watermark_url          = esc_url( $this->easydam_settings['video']['watermark_url'] );
			$rtgodam_video_compress_quality = $this->easydam_settings['video']['video_compress_quality'] ?? 80;

			$watermark_to_use = array();

			// Include watermark settings only if watermark is enabled.
			if ( $rtgodam_watermark ) {
				if ( $rtgodam_use_watermark_image && ! empty( $rtgodam_watermark_url ) ) {
					$watermark_to_use['watermark_url'] = $rtgodam_watermark_url;
				} elseif ( ! $rtgodam_use_watermark_image && ! empty( $rtgodam_watermark_text ) ) {
					$watermark_to_use['watermark_text'] = $rtgodam_watermark_text;
				}
			}

			if ( ! defined( 'RTGODAM_TRANSCODER_CALLBACK_URL' ) || empty( RTGODAM_TRANSCODER_CALLBACK_URL ) ) {
				include_once RTGODAM_PATH . 'admin/class-rtgodam-transcoder-rest-routes.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
				define( 'RTGODAM_TRANSCODER_CALLBACK_URL', RTGODAM_Transcoder_Rest_Routes::get_callback_url() );
			}

			$callback_url = RTGODAM_TRANSCODER_CALLBACK_URL;

			/**
			 * Manually setting the rest api endpoint, we can refactor that later to use similar functionality as callback_url.
			 */
			$status_callback_url = get_rest_url( get_current_blog_id(), '/godam/v1/transcoding/transcoding-status' );

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

			$args = array(
				'method'    => empty( $transcoding_job_id ) ? 'POST' : 'PUT',
				'sslverify' => false,
				'timeout'   => 60, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
				'body'      => array_merge(
					array(
						'retranscode'          => empty( $transcoding_job_id ) ? 0 : 1,
						'api_token'            => $this->api_key,
						'job_type'             => $job_type,
						'job_for'              => $job_for,
						'file_origin'          => rawurlencode( $url ),
						'callback_url'         => rawurlencode( $callback_url ),
						'status_callback'      => rawurlencode( $status_callback_url ),
						'force'                => 0,
						'formats'              => ( true === $autoformat ) ? ( ( ( isset( $type_array[0] ) ) && 'video' === $type_array[0] ) ? 'mp4' : 'mp3' ) : $autoformat,
						'thumbnail_count'      => $options_video_thumb,
						'stream'               => true,
						'watermark'            => boolval( $rtgodam_watermark ),
						'resolutions'          => array( 'auto' ),
						'video_quality'        => $rtgodam_video_compress_quality,
						'wp_author_email'      => $attachment_author ? $attachment_author->user_email : '',
						'wp_site'              => $site_url,
						'wp_author_first_name' => $author_first_name,
						'wp_author_last_name'  => $author_last_name,
						'public'               => 1,
					),
					$watermark_to_use
				),
			);

			$transcoding_url = $this->transcoding_api_url . 'resource/Transcoder Job' . ( empty( $transcoding_job_id ) ? '' : '/' . $transcoding_job_id );

			// Block if blacklisted ip address.
			$remote_address_key = 'REMOTE_ADDR';
			$client_ip          = isset( $_SERVER[ $remote_address_key ] ) ? filter_var( $_SERVER[ $remote_address_key ], FILTER_VALIDATE_IP ) : '';
			if ( ! empty( $client_ip ) && in_array( $client_ip, rtgodam_get_blacklist_ip_addresses(), true ) ) {
				return $metadata;
			}

			$upload_page = wp_remote_request( $transcoding_url, $args );

			if ( ! is_wp_error( $upload_page ) &&
				(
					isset( $upload_page['response']['code'] ) &&
					200 === intval( $upload_page['response']['code'] )
				)
			) {
				$upload_info = json_decode( $upload_page['body'] );

				if ( isset( $upload_info->data ) && isset( $upload_info->data->name ) ) {
					$job_id = $upload_info->data->name;
					update_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', $job_id );

					if ( $retranscode ) {
						$failed_transcoding_attachments = get_option( 'rtgodam-failed-transcoding-attachments', array() );

						if ( isset( $failed_transcoding_attachments[ $attachment_id ] ) ) {
							unset( $failed_transcoding_attachments[ $attachment_id ] );
							update_option( 'rtgodam-failed-transcoding-attachments', $failed_transcoding_attachments );
						}
					}
				}
			}


			if ( is_wp_error( $upload_page ) || 500 <= intval( $upload_page['response']['code'] ) ) {
				$failed_transcoding_attachments = get_option( 'rtgodam-failed-transcoding-attachments', array() );

				$failed_transcoding_attachments[ $attachment_id ] = array(
					'wp_metadata'   => $wp_metadata,
					'attachment_id' => $attachment_id,
					'autoformat'    => $autoformat,
				);

				update_option( 'rtgodam-failed-transcoding-attachments', $failed_transcoding_attachments );

				// display notice to user for next 5 minutes.
				$timestamp = time();
				update_option( 'rtgodam-transcoding-failed-notice-timestamp', $timestamp );
			}
		}

		return $wp_metadata;
	}

	/**
	 * Get number of thumbnails required to generate for video.
	 *
	 * @since 1.0.0
	 *
	 * @param int $attachment_id    ID of attachment.
	 *
	 * @return int $thumb_count
	 */
	public function get_thumbnails_required( $attachment_id = '' ) {

		$thumb_count = $this->easydam_settings['video']['video_thumbnails'];

		/**
		 * Allow user to filter number of thumbnails required to generate for video.
		 *
		 * @since 1.0.0
		 *
		 * @param int $thumb_count    Number of thumbnails set in setting.
		 * @param int $attachment_id  ID of attachment.
		 */
		$thumb_count = apply_filters( 'rtgodam_media_total_video_thumbnails', $thumb_count, $attachment_id );

		return $thumb_count > 10 ? 10 : $thumb_count;
	}

	/**
	 * Check api key is valid or not.
	 *
	 * @since   1.0.0
	 *
	 * @param string $key    Api Key.
	 *
	 * @return boolean $status  If true then key is valid else key is not valid.
	 */
	public function is_valid_key( $key ) {
		$validate_url = trailingslashit( $this->store_url ) . '/resource/api_key/' . $key;
		if ( function_exists( 'vip_safe_wp_remote_get' ) ) {
			$validation_page = vip_safe_wp_remote_get( $validate_url, '', 3, 3 );
		} else {
			$validation_page = wp_safe_remote_get( $validate_url ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.wp_remote_get_wp_remote_get
		}
		if ( ! is_wp_error( $validation_page ) ) {
			$validation_info = json_decode( $validation_page['body'] );
			if ( isset( $validation_info->data->status ) && 'Active' === $validation_info->data->status ) {
				$status = true;
			}
		} else {
			$status = false;
		}

		return $status;
	}

	/**
	 * Save usage information.
	 *
	 * @since   1.0.0
	 *
	 * @param string $key  Api key.
	 *
	 * @return array $usage_info  An array containing usage information.
	 */
	public function update_usage( $key ) {

		$response = rtgodam_verify_api_key( $key );

		// Check if response is WP_Error before accessing array elements.
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		update_option( 'rtgodam-usage', array( $key => (object) $response['data'] ) );

		return $response;
	}

	/**
	 * Display message when user subscribed successfully.
	 *
	 * @since 1.0.0
	 */
	public function successfully_subscribed_notice() {
		?>
		<div class="updated">
			<p>
				<?php
				$api_key_updated = rtgodam_filter_input( INPUT_GET, 'api-key-updated', FILTER_SANITIZE_FULL_SPECIAL_CHARS );
				printf(
					wp_kses(
						__( 'You have successfully subscribed.', 'godam' ),
						array(
							'strong' => array(),
						)
					),
					esc_html( sanitize_text_field( wp_unslash( $api_key_updated ) ) )
				);
				?>
			</p>
		</div>
		<?php
	}

	/**
	 * Display message when API key is not valid.
	 *
	 * @since 1.0.0
	 */
	public function invalid_api_key_notice() {
		?>
		<div class="error">
			<p>
				<?php esc_html_e( 'This API key is invalid.', 'godam' ); ?>
			</p>
		</div>
		<?php
	}

	/**
	 * Display message when user tries to activate API key on localhost.
	 *
	 * @since 1.0.6
	 */
	public function public_host_needed_notice() {
		?>
		<div class="error">
			<p>
				<?php esc_html_e( 'Transcoding service can not be activated on the localhost', 'godam' ); ?>
			</p>
		</div>
		<?php
	}

	/**
	 * Save thumbnails for transcoded video.
	 *
	 * @since 1.0.0
	 *
	 * @param array $post_array  Attachment data.
	 *
	 * @return string
	 */
	public function add_media_thumbnails( $post_array ) {
		$defaults = array(
			'post_id' => '',
			'job_for' => '',
		);

		// Parse incoming $post_array into an array and merge it with $defaults.
		$post_array = wp_parse_args( $post_array, $defaults );

		do_action( 'rtgodam_before_thumbnail_store', $post_array['post_id'], $post_array );

		$post_id           = $post_array['post_id'];
		$post_thumbs       = $post_array;
		$post_thumbs_array = maybe_unserialize( $post_thumbs );

		$thumbnail_urls      = array();
		$first_thumbnail_url = false;

		foreach ( $post_thumbs_array['thumbnail'] as $thumbnail_url ) {
				$sanitized_url = esc_url_raw( $thumbnail_url );
			if ( empty( $sanitized_url ) ) {
				continue;
			}

				$thumbnail_urls[] = $sanitized_url;
		}

		if ( ! empty( $thumbnail_urls ) ) {
			$first_thumbnail_url = $thumbnail_urls[0];
		}

		if ( class_exists( 'RTMediaModel' ) ) {
			$model    = new RTMediaModel();
			$media    = $model->get( array( 'media_id' => $post_id ) );
			$media_id = $media[0]->id;

			$this->media_author             = $media[0]->media_author;
			$this->uploaded['context']      = $media[0]->context;
			$this->uploaded['context_id']   = $media[0]->context_id;
			$this->uploaded['media_author'] = $media[0]->media_author;
		}

		// rtMedia support.
		update_post_meta( $post_id, '_rt_media_source', $post_thumbs_array['job_for'] );
		update_post_meta( $post_id, '_rt_media_thumbnails', $thumbnail_urls );

		update_post_meta( $post_id, 'rtgodam_media_source', $post_thumbs_array['job_for'] );
		update_post_meta( $post_id, 'rtgodam_media_thumbnails', $thumbnail_urls );

		do_action( 'rtgodam_transcoded_thumbnails_added', $post_id );

		if ( $first_thumbnail_url ) {

			$is_retranscoding_job = get_post_meta( $post_id, 'rtgodam_retranscoding_sent', true );

			if ( ! $is_retranscoding_job || rtgodam_is_override_thumbnail() ) {
				// rtMedia support.
				update_post_meta( $post_id, '_rt_media_video_thumbnail', $first_thumbnail_url );

				if ( class_exists( 'RTMediaModel' ) ) {
					$model->update( array( 'cover_art' => $first_thumbnail_url ), array( 'media_id' => $post_id ) );
					update_activity_after_thumb_set( $media_id );
				}

				update_post_meta( $post_id, 'rtgodam_media_video_thumbnail', $first_thumbnail_url );
			}

			/**
			 * Allow users/plugins to access the thumbnail file which is got stored as a thumbnail
			 *
			 * @since 1.0.7
			 *
			 * @param string    $largest_thumb  Absolute URL of the thumbnail
			 * @param int       $post_id        Attachment ID of the video for which thumbnail has been set
			 */
			do_action( 'rtgodam_transcoded_thumb_added', $first_thumbnail_url, $post_id );
		}

		return $first_thumbnail_url;
	}

	/**
	 * Save transcoded media files.
	 *
	 * @since 1.0.0
	 *
	 * @param array  $file_post_array   Transcoded files.
	 * @param int    $attachment_id     ID of attachment.
	 * @param string $job_for           Whether media uploaded through rtmedia plugin or WordPress media.
	 */
	public function add_transcoded_files( $file_post_array, $attachment_id, $job_for = '' ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		$transcoded_files = false;
		global $wpdb;

		do_action( 'rtgodam_before_transcoded_media_store', $attachment_id, $file_post_array );

		if ( isset( $file_post_array ) && is_array( $file_post_array ) && ( count( $file_post_array ) > 0 ) ) {
			foreach ( $file_post_array as $key => $format ) {
				if ( is_array( $format ) && ( count( $format ) > 0 ) ) {
					foreach ( $format as $file ) {
						if ( isset( $file ) ) {

							$download_url                  = urldecode( urldecode( $file ) );
							$new_wp_attached_file_pathinfo = pathinfo( $download_url );
							$post_mime_type                = 'mp4' === $new_wp_attached_file_pathinfo['extension'] ? 'video/mp4' : 'audio/mp3';
							$attachemnt_url                = wp_get_attachment_url( $attachment_id );

							$timeout = 5;

							if ( 'video/mp4' === $post_mime_type ) {
								$timeout = 120;
							}

							try {
								$response = function_exists( 'vip_safe_wp_remote_get' ) ? vip_safe_wp_remote_get( $download_url, '', 3, 3 ) : wp_remote_get( $download_url, array( 'timeout' => $timeout ) ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.wp_remote_get_wp_remote_get
							} catch ( Exception $e ) {
								return;
							}

							$file_content = wp_remote_retrieve_body( $response );

							if ( ! empty( $file_content ) ) {

								/**
								 * Allows users/plugins to filter the transcoded file Name
								 *
								 * @since 1.3.2
								 *
								 * @param string $new_wp_attached_file_pathinfo['basename']  Contains the file public name
								 */
								$file_name = apply_filters( 'rtgodam_transcoded_video_filename', $new_wp_attached_file_pathinfo['basename'] );

								// Verify Extension.
								if ( empty( pathinfo( $file_name, PATHINFO_EXTENSION ) ) ) {
									$file_name .= '.' . $new_wp_attached_file_pathinfo['extension'];
								}

								$upload_info = wp_upload_bits( $file_name, null, $file_content );

								/**
								 * Allow users to filter/perform action on uploaded transcoded file.
								 *
								 * @since 1.0.5
								 *
								 * @param array $upload_info    Array contains the uploaded file url and Path
								 *                              i.e $upload_info['url'] contains the file URL
								 *                              and $upload_info['file'] contains the file physical path
								 * @param int  $attachment_id   Contains the attachment ID for which transcoded file is uploaded
								 */
								$upload_info = apply_filters( 'rtgodam_transcoded_file_stored', $upload_info, $attachment_id );

								$uploaded_file = _wp_relative_upload_path( $upload_info['file'] );
								if ( ! empty( $uploaded_file ) ) {
									$transcoded_files[ $key ][] = $uploaded_file;
									update_post_meta( $attachment_id, '_wp_attached_file', $uploaded_file );
									update_post_meta( $attachment_id, 'rtgodam_transcoded_url', $download_url );

									$mime_type = get_post_mime_type( $attachment_id );

									if ( strpos( $mime_type, 'audio' ) !== false ) {
										wp_update_post(
											array(
												'ID' => $attachment_id,
												'post_mime_type' => 'audio/mp3',
											)
										);
									} else {
										wp_update_post(
											array(
												'ID' => $attachment_id,
												'post_mime_type' => 'video/mp4',
											)
										);
									}
								}
							}
						}
					}
				}
			}
		}
		if ( ! empty( $transcoded_files ) ) {
			update_post_meta( $attachment_id, 'rtgodam_media_transcoded_files', $transcoded_files );
			do_action( 'rtgodam_transcoded_media_added', $attachment_id );
		}
	}

	/**
	 * Get post id from meta key and value.
	 *
	 * @since 1.0.0
	 *
	 * @param string $key   Meta key.
	 * @param mixed  $value Meta value.
	 *
	 * @return int|bool     Return post id if found else false.
	 */
	public function get_post_id_by_meta_key_and_value( $key, $value ) {
		global $wpdb;
		$cache_key = md5( 'meta_key_' . $key . '_meta_value_' . $value );

		$meta = wp_cache_get( $cache_key, 'godam' );
		if ( empty( $meta ) ) {
			$meta = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value = %s", $key, $value ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			wp_cache_set( $cache_key, $meta, 'godam', 3600 );
		}

		if ( is_array( $meta ) && ! empty( $meta ) && isset( $meta[0] ) ) {
			$meta = $meta[0];
		}
		if ( is_object( $meta ) ) {
			return $meta->post_id;
		} else {
			return false;
		}
	}
}
