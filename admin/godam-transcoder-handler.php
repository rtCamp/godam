<?php
/**
 * The transcoder-specific functionality of the plugin.
 *
 * @since   1.0.0
 *
 * @package    Transcoder
 * @subpackage Transcoder/TranscoderHandler
 */

defined( 'ABSPATH' ) || exit;

/**
 * Handle request/response with trancoder api.
 *
 * @since   1.0.0
 *
 * @package    Transcoder
 * @subpackage Transcoder/TranscoderHandler
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

		$this->api_key          = get_site_option( 'rtgodam-api-key' );
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
		include_once RTGODAM_PATH . 'admin/godam-retranscode-admin.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant

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
			$usage_info = get_site_option( 'rtgodam-usage' );

			if ( isset( $usage_info ) && is_array( $usage_info ) && array_key_exists( $this->api_key, $usage_info ) ) {
				if ( is_object( $usage_info[ $this->api_key ] ) && isset( $usage_info[ $this->api_key ]->status ) && 'Active' === $usage_info[ $this->api_key ]->status ) {

					// Enable re-transcoding.
					include_once RTGODAM_PATH . 'admin/godam-retranscode-admin.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant

					add_filter( 'wp_generate_attachment_metadata', array( $this, 'wp_media_transcoding' ), 21, 2 );
				}
			}
		}
	}

	/**
	 * Send transcoding request and save transcoding job id get in response for uploaded media in WordPress media library.
	 *
	 * @since 1.0.0
	 *
	 * @param array  $wp_metadata          Metadata of the attachment.
	 * @param int    $attachment_id     ID of attachment.
	 * @param string $autoformat        If true then generating thumbs only else trancode video.
	 */
	public function wp_media_transcoding( $wp_metadata, $attachment_id, $autoformat = true ) {

		if ( empty( $wp_metadata['mime_type'] ) ) {
			return $wp_metadata;
		}

		$already_sent = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
		if ( ! empty( $already_sent ) ) {
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
			! in_array( $metadata['mime_type'], array( 'audio/mp3' ), true ) &&
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
			$job_for     = 'wp-media';
			$post_parent = wp_get_post_parent_id( $attachment_id );
			if ( 0 !== $post_parent ) {
				$post_type = get_post_type( $post_parent );
				if ( class_exists( 'RTMediaModel' ) && function_exists( 'rtmedia_id' ) ) {
					if ( 'rtmedia_album' === $post_type ) {
						$job_for = 'rtmedia';
					}
				}
			}

			// Media settings.
			$rtgodam_adaptive_bitrate_streaming = $this->easydam_settings['video']['adaptive_bitrate'];
			$rtgodam_watermark                  = $this->easydam_settings['video']['watermark'];
			$rtgodam_use_watermark_image        = $this->easydam_settings['video']['use_watermark_image'];
			$rtgodam_watermark_text             = sanitize_text_field( $this->easydam_settings['video']['watermark_text'] );
			$rtgodam_watermark_url              = esc_url( $this->easydam_settings['video']['watermark_url'] );
			$rtgodam_abs_resolutions            = $this->easydam_settings['video']['video_quality'] ?? array();
			$rtgodam_abs_resolutions            = wp_json_encode( $rtgodam_abs_resolutions );

			$watermark_to_use = array();

			// Include watermark settings only if watermark is enabled.
			if ( $rtgodam_watermark ) {
				if ( $rtgodam_use_watermark_image && ! empty( $rtgodam_watermark_url ) ) {
					$watermark_to_use['watermark_url'] = $rtgodam_watermark_url;
				} elseif ( ! $rtgodam_use_watermark_image && ! empty( $rtgodam_watermark_text ) ) {
					$watermark_to_use['watermark_text'] = $rtgodam_watermark_text;
				}
			}

			$callback_url = RTGODAM_TRANSCODER_CALLBACK_URL;

			if ( ! defined( 'RTGODAM_TRANSCODER_CALLBACK_URL' ) || empty( RTGODAM_TRANSCODER_CALLBACK_URL ) ) {
				return $wp_metadata;
			}

			/**
			 * Manually setting the rest api endpoint, we can refactor that later to use similar functionality as callback_url.
			 */
			$status_callback_url = get_rest_url( get_current_blog_id(), '/godam/v1/transcoding/transcoding-status' );

			$args = array(
				'method'    => 'POST',
				'sslverify' => false,
				'timeout'   => 60, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
				'body'      => array_merge(
					array(
						'api_token'       => $this->api_key,
						'job_type'        => $job_type,
						'job_for'         => $job_for,
						'file_origin'     => rawurlencode( $url ),
						'callback_url'    => rawurlencode( $callback_url ),
						'status_callback' => rawurlencode( $status_callback_url ),
						'force'           => 0,
						'formats'         => ( true === $autoformat ) ? ( ( 'video' === $type_array[0] ) ? 'mp4' : 'mp3' ) : $autoformat,
						'thumbnail_count' => $options_video_thumb,
						'stream'          => true,
						'watermark'       => boolval( $rtgodam_watermark ),
						'resolutions'     => $rtgodam_abs_resolutions,
					),
					$watermark_to_use
				),
			);

			$transcoding_url = $this->transcoding_api_url . 'resource/Transcoder Job';

			$upload_page = wp_remote_post( $transcoding_url, $args );

			if ( ! is_wp_error( $upload_page ) &&
				(
					isset( $upload_page['response']['code'] ) &&
					200 === intval( $upload_page['response']['code'] )
				)
			) {
				$upload_info = json_decode( $upload_page['body'] );
				error_log( json_encode( $upload_info ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log, WordPress.WP.AlternativeFunctions.json_encode_json_encode
				if ( isset( $upload_info->data ) && isset( $upload_info->data->name ) ) {
					$job_id = $upload_info->data->name;
					update_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', $job_id );
				}
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
		$validate_url = trailingslashit( $this->store_url ) . '/resource/License/' . $key;
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

		$response = rtgodam_verify_license( $key );
		update_site_option( 'rtgodam-usage', array( $key => (object) $response['data'] ) );

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
	 * Display message when license key is not valid.
	 *
	 * @since 1.0.0
	 */
	public function invalid_license_notice() {
		?>
		<div class="error">
			<p>
				<?php esc_html_e( 'This license key is invalid.', 'godam' ); ?>
			</p>
		</div>
		<?php
	}

	/**
	 * Display message when user tries to activate license key on localhost.
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

		$post_id            = $post_array['post_id'];
		$post_thumbs        = $post_array;
		$post_thumbs_array  = maybe_unserialize( $post_thumbs );
		$largest_thumb_size = 0;

		if ( 'rtmedia' === $post_thumbs_array['job_for'] && class_exists( 'RTMediaModel' ) ) {
			$model    = new RTMediaModel();
			$media    = $model->get( array( 'media_id' => $post_id ) );
			$media_id = $media[0]->id;

			$this->media_author             = $media[0]->media_author;
			$this->uploaded['context']      = $media[0]->context;
			$this->uploaded['context_id']   = $media[0]->context_id;
			$this->uploaded['media_author'] = $media[0]->media_author;
		}

		$largest_thumb          = false;
		$largest_thumb_url      = false;
		$upload_thumbnail_array = array();
		$failed_thumbnails      = false;

		foreach ( $post_thumbs_array['thumbnail'] as $thumbnail ) {
			$thumbresource         = function_exists( 'vip_safe_wp_remote_get' ) ? vip_safe_wp_remote_get( $thumbnail, '', 3, 3 ) : wp_remote_get( $thumbnail, array( 'timeout' => 120 ) );  // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.wp_remote_get_wp_remote_get, WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
			$thumbinfo             = pathinfo( $thumbnail );
			$temp_name             = $thumbinfo['basename'];
			$temp_name             = urldecode( $temp_name );
			$temp_name_array       = explode( '/', $temp_name );
			$thumbinfo['basename'] = $temp_name_array[ count( $temp_name_array ) - 1 ];

			/**
			 * Filter: 'rtgodam_transcoded_temp_filename' - Allows changes for the thumbnail name.
			 *
			 * @deprecated 1.3.2. Use the {@see 'rtgodam_transcoded_thumb_filename'} filter instead.
			 */
			$thumbinfo['basename'] = apply_filters_deprecated( 'rtgodam_transcoded_temp_filename', array( $thumbinfo['basename'] ), '1.3.2', 'rtgodam_transcoded_thumb_filename', __( 'Use rtgodam_transcoded_thumb_filename filter to modify video thumbnail name and rtgodam_transcoded_video_filename filter to modify video file name.', 'godam' ) );

			/**
			 * Allows users/plugins to filter the thumbnail Name
			 *
			 * @since 1.3.2
			 *
			 * @param string $temp_name Contains the thumbnail public name
			 */
			$thumbinfo['basename'] = apply_filters( 'rtgodam_transcoded_thumb_filename', $thumbinfo['basename'] );

			// Verify Extension.
			if ( empty( pathinfo( $thumbinfo['basename'], PATHINFO_EXTENSION ) ) ) {
				$thumbinfo['basename'] .= '.' . $thumbinfo['extension'];
			}

			if ( 'wp-media' !== $post_thumbs_array['job_for'] ) {
				add_filter( 'upload_dir', array( $this, 'upload_dir' ) );
			}

			// Create a file in the upload folder with given content.
			$thumb_upload_info = wp_upload_bits( $thumbinfo['basename'], null, $thumbresource['body'] );

			// Check error.
			if ( ! empty( $thumb_upload_info['error'] ) ) {
				$failed_thumbnails = $thumb_upload_info;
			}

			/**
			 * Allow users to filter/perform action on uploaded transcoded file.
			 *
			 * @since 1.0.5
			 *
			 * @param array $thumb_upload_info  Array contains the uploaded file url and Path
			 *                                  i.e $thumb_upload_info['url'] contains the file URL
			 *                                  and $thumb_upload_info['file'] contains the file physical path
			 * @param int  $post_id             Contains the attachment ID for which transcoded file is uploaded
			 */
			$thumb_upload_info = apply_filters( 'rtgodam_transcoded_file_stored', $thumb_upload_info, $post_id );

			if ( 'wp-media' !== $post_thumbs_array['job_for'] ) {
				remove_filter( 'upload_dir', array( $this, 'upload_dir' ) );
			}

			$file = _wp_relative_upload_path( $thumb_upload_info['file'] );

			/**
			 * Allows users/plugins to filter the file URL
			 *
			 * @since 1.0.5
			 *
			 * @param string $thumb_upload_info['url']  Contains the file public URL
			 * @param int $post_id                      Contains the attachment ID for which transcoded file has been uploaded
			 */
			$thumb_upload_info['url'] = apply_filters( 'rtgodam_transcoded_file_url', $thumb_upload_info['url'], $post_id );

			if ( $file ) {
				$upload_thumbnail_array[] = $file;
			}

			$current_thumb_size = filesize( $thumb_upload_info['file'] );

			if ( $current_thumb_size >= $largest_thumb_size ) {
				$largest_thumb_size = $current_thumb_size;
				$largest_thumb      = $thumb_upload_info['url'];            // Absolute URL of the thumb.
				$largest_thumb_url  = $file ? $file : '';                   // Relative URL of the thumb.
			}
		}

		if ( false !== $failed_thumbnails && ! empty( $failed_thumbnails['error'] ) ) {
			$this->nofity_transcoding_failed( $post_array['job_id'], sprintf( 'Failed saving of Thumbnail for %1$s.', $post_array['file_name'] ) );
		}

		update_post_meta( $post_id, 'rtgodam_media_source', $post_thumbs_array['job_for'] );
		update_post_meta( $post_id, 'rtgodam_media_thumbnails', $upload_thumbnail_array );

		do_action( 'rtgodam_transcoded_thumbnails_added', $post_id );

		if ( $largest_thumb ) {

			$is_retranscoding_job = get_post_meta( $post_id, 'rtgodam_retranscoding_sent', true );

			if ( ! $is_retranscoding_job || rtgodam_is_override_thumbnail() ) {

				update_post_meta( $post_id, 'rtgodam_media_video_thumbnail', $largest_thumb );

				if ( 'rtmedia' === $post_thumbs_array['job_for'] && class_exists( 'RTMediaModel' ) ) {

						$model->update( array( 'cover_art' => $largest_thumb ), array( 'media_id' => $post_id ) );
						update_activity_after_thumb_set( $media_id );
				}
			}

			/**
			 * Allow users/plugins to access the thumbnail file which is got stored as a thumbnail
			 *
			 * @since 1.0.7
			 *
			 * @param string    $largest_thumb  Absolute URL of the thumbnail
			 * @param int       $post_id        Attachment ID of the video for which thumbnail has been set
			 */
			do_action( 'rtgodam_transcoded_thumb_added', $largest_thumb, $post_id );
		}

		return $largest_thumb_url;
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
	public function add_transcoded_files( $file_post_array, $attachment_id, $job_for = '' ) {
		$transcoded_files = false;
		$mail             = true;
		if ( defined( 'RTGODAM_NO_MAIL' ) ) {
			$mail = false;
		}
		global $wpdb;

		do_action( 'rtgodam_before_transcoded_media_store', $attachment_id, $file_post_array );

		if ( isset( $file_post_array ) && is_array( $file_post_array ) && ( count( $file_post_array ) > 0 ) ) {
			foreach ( $file_post_array as $key => $format ) {
				if ( is_array( $format ) && ( count( $format ) > 0 ) ) {
					foreach ( $format as $file ) {
						$flag = false;
						if ( isset( $file ) ) {

							if ( 'rtmedia' === $job_for ) {
								$model                          = new RTMediaModel();
								$media                          = $model->get_media( array( 'media_id' => $attachment_id ), 0, 1 );
								$this->media_author             = $media[0]->media_author;
								$this->uploaded['context']      = $media[0]->context;
								$this->uploaded['context_id']   = $media[0]->context_id;
								$this->uploaded['media_author'] = $media[0]->media_author;
							}
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
								$flag = $e->getMessage();
							}

							$file_content = wp_remote_retrieve_body( $response );

							if ( ! empty( $file_content ) ) {

								if ( 'wp-media' !== $job_for ) {
									add_filter( 'upload_dir', array( $this, 'upload_dir' ) );
								}

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

								if ( 'wp-media' !== $job_for ) {
									remove_filter( 'upload_dir', array( $this, 'upload_dir' ) );
								}

								$uploaded_file = _wp_relative_upload_path( $upload_info['file'] );
								if ( ! empty( $uploaded_file ) ) {
									$transcoded_files[ $key ][] = $uploaded_file;
									update_post_meta( $attachment_id, '_wp_attached_file', $uploaded_file );
									update_post_meta( $attachment_id, 'rtgodam_transcoded_url', $download_url );

									wp_update_post(
										array(
											'ID' => $attachment_id,
											'post_mime_type' => 'video/mp4',
										)
									);

								}
							} else {
								$flag = esc_html__( 'Could not read file.', 'godam' );

								if ( $flag && $mail ) {
									$download_link = esc_url(
										add_query_arg(
											array(
												'job_id'  => rtgodam_get_job_id_by_attachment_id( $attachment_id ),
												'job_for' => $job_for,
												'files[' . $key . '][0]' => esc_url( $download_url ),
											),
											home_url()
										)
									);
									$subject       = esc_html__( 'Transcoding: Download Failed', 'godam' );
									$message       = '<p><a href="' . esc_url( rtgodam_get_edit_post_link( $attachment_id ) ) . '">' . esc_html__( 'Media', 'godam' ) . '</a> ' . esc_html__( ' was successfully encoded but there was an error while downloading:', 'godam' ) . '</p><p><code>' . esc_html( $flag ) . '</code></p><p>' . esc_html__( 'You can ', 'godam' ) . '<a href="' . esc_url( $download_link ) . '">' . esc_html__( 'retry the download', 'godam' ) . '</a>.</p>';
									$users         = get_users( array( 'role' => 'administrator' ) );
									if ( $users ) {
										$admin_email_ids = array();
										foreach ( $users as $user ) {
											$admin_email_ids[] = $user->user_email;
										}
										add_filter( 'wp_mail_content_type', array( $this, 'wp_mail_content_type' ) );
										wp_mail( $admin_email_ids, $subject, $message ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.wp_mail_wp_mail
										remove_filter( 'wp_mail_content_type', array( $this, 'wp_mail_content_type' ) );
									}
									echo esc_html( $flag );
								} else {
									esc_html_e( 'Done', 'godam' );
								}
							}
						}
					}
					if ( 'rtmedia' === $job_for ) {
						$activity_id = $media[0]->activity_id;
						if ( $activity_id ) {
							$content = wp_cache_get( 'activity_' . $activity_id, 'godam' );
							if ( empty( $content ) ) {
								$content = $wpdb->get_var( $wpdb->prepare( "SELECT content FROM {$wpdb->base_prefix}bp_activity WHERE id = %d", $activity_id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
								wp_cache_set( 'activity_' . $activity_id, $content, 'godam', 3600 );
							}

							/* for WordPress backward compatibility */
							if ( function_exists( 'wp_get_upload_dir' ) ) {
								$uploads = wp_get_upload_dir();
							} else {
								$uploads = wp_upload_dir();
							}

							if ( 'video/mp4' === $post_mime_type ) {
								$media_type = 'mp4';
							} elseif ( 'audio/mp3' === $post_mime_type ) {
								$media_type = 'mp3';
							}

							$transcoded_file_url = $uploads['baseurl'] . '/' . $transcoded_files[ $media_type ][0];
							/**
							 * Allows users/plugins to filter the file URL
							 *
							 * @since 1.0.5
							 *
							 * @param string $transcoded_file_url   Contains the file public URL
							 * @param int $attachment_id            Contains the attachment ID for which transcoded file has been uploaded
							 */
							$transcoded_file_url = apply_filters( 'rtgodam_transcoded_file_url', $transcoded_file_url, $attachment_id );

							$activity_content = str_replace( $attachemnt_url, $transcoded_file_url, $content );
							$wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.DirectQuery
								$wpdb->base_prefix . 'bp_activity',
								array( 'content' => $activity_content ),
								array( 'id' => $activity_id )
							);
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

	/**
	 * Return upload path of media uploaded through rtMedia plugin.
	 *
	 * @since 1.0.0
	 *
	 * @global mixed $rtmedia_interaction
	 *
	 * @param array $upload_dir  Upload directory information.
	 *
	 * @return array $upload_dir
	 */
	public function upload_dir( $upload_dir ) {
		global $rtmedia_interaction;
		if ( isset( $this->uploaded['context'] ) && isset( $this->uploaded['context_id'] ) ) {
			if ( 'group' !== $this->uploaded['context'] ) {
				$rtmedia_upload_prefix = 'users/';
				$id                    = $this->uploaded['media_author'];
			} else {
				$rtmedia_upload_prefix = 'groups/';
				$id                    = $this->uploaded['context_id'];
			}
		} elseif ( 'group' !== $rtmedia_interaction->context->type ) {
				$rtmedia_upload_prefix = 'users/';
				$id                    = $this->uploaded['media_author'];
		} else {
			$rtmedia_upload_prefix = 'groups/';
			$id                    = $rtmedia_interaction->context->id;
		}

		if ( ! $id ) {
			$id = $this->media_author;
		}

		$rtmedia_folder_name = apply_filters( 'rtmedia_upload_folder_name', 'rtMedia' );

		$upload_dir['path'] = trailingslashit( str_replace( $upload_dir['subdir'], '', $upload_dir['path'] ) ) . $rtmedia_folder_name . '/' . $rtmedia_upload_prefix . $id . $upload_dir['subdir'];
		$upload_dir['url']  = trailingslashit( str_replace( $upload_dir['subdir'], '', $upload_dir['url'] ) ) . $rtmedia_folder_name . '/' . $rtmedia_upload_prefix . $id . $upload_dir['subdir'];

		$upload_dir = apply_filters( 'rtmedia_filter_upload_dir', $upload_dir, $this->uploaded );

		return $upload_dir;
	}

	/**
	 * Send's the email. It's the wrapper function for wp_mail
	 *
	 * @since 1.0.0
	 *
	 * @param  array   $email_ids       Email id's to send an email.
	 * @param  string  $subject         Email subject.
	 * @param  string  $message         Email message.
	 * @param  boolean $include_admin   If true then send an email to admin also else not.
	 */
	public function send_notification( $email_ids, $subject, $message, $include_admin = true ) {
		if ( defined( 'RTGODAM_NO_MAIL' ) ) {
			return;
		}

		if ( ! is_array( $email_ids ) ) {
			$email_ids = array();
		}

		if ( empty( $subject ) || empty( $message ) ) {
			return true;
		}

		/**
		 * Filter to disable the notification sent to the admins/users
		 *
		 * @param boolean       By default it is true. If false is passed the email wont
		 *                      get sent to the any user
		 */
		$send_notification = apply_filters( 'rtgodam_send_notification', true );

		if ( false === $send_notification ) {
			return true;
		}

		if ( $include_admin ) {
			$users = get_users( array( 'role' => 'administrator' ) );
			if ( $users ) {
				foreach ( $users as $user ) {
					$email_ids[] = $user->user_email;
				}
			}
		}

		add_filter( 'wp_mail_content_type', array( $this, 'wp_mail_content_type' ) );
		wp_mail( $email_ids, $subject, $message ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.wp_mail_wp_mail
		remove_filter( 'wp_mail_content_type', array( $this, 'wp_mail_content_type' ) );
	}

	/**
	 * Sets the content type of mail to text/html
	 *
	 * @since  1.0.0
	 *
	 * @return string
	 */
	public function wp_mail_content_type() {
		return 'text/html';
	}

	/**
	 * Send notification about failed transcoding job
	 *
	 * @since 1.0.0
	 *
	 * @param  string $job_id       Transcoding job id.
	 * @param  string $error_msg    Error message for why transcoding of media failed.
	 */
	public function nofity_transcoding_failed( $job_id, $error_msg ) {
		if ( empty( $job_id ) ) {
			return false;
		}
		$subject       = esc_html__( 'Transcoding: Something went wrong.', 'godam' );
		$attachment_id = $this->get_post_id_by_meta_key_and_value( 'rtgodam_transcoding_job_id', $job_id );
		if ( ! empty( $error_msg ) ) {
			$message  = '<p>' . esc_html__( ' There was unexpected error occurred while transcoding this following media.', 'godam' ) . '</p>';
			$message .= '<p><a href="' . esc_url( rtgodam_get_edit_post_link( $attachment_id ) ) . '">' . esc_html__( 'Media', 'godam' ) . '</a></p>';
			$message .= '<p>Error message: ' . esc_html( $error_msg ) . '</p>';
		} else {
			$message = '<p><a href="' . esc_url( rtgodam_get_edit_post_link( $attachment_id ) ) . '">' . esc_html__( 'Media', 'godam' ) . '</a> ' .
				esc_html__( ' there was unexpected error occurred while transcoding this media.', 'godam' ) . '</p>';
		}

		$email_ids = array();
		if ( ! empty( $attachment_id ) ) {
			$author_id   = get_post_field( 'post_author', $attachment_id );
			$email_ids[] = get_the_author_meta( 'user_email', $author_id );
		}

		/**
		 * Allows users/plugins to alter the email id of a user
		 *
		 * @param array $email_ids  Email id of the user who owns the media
		 * @param string $job_id    Job ID sent by the transcoder
		 */
		$email_ids = apply_filters( 'rtgodam_nofity_transcoding_failed', $email_ids, $job_id );

		$this->send_notification( $email_ids, $subject, $message, true );
	}
}
