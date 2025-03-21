<?php
/**
 * Class Transcoder_Rest_Routes
 *
 * @package transcoder
 */

defined( 'ABSPATH' ) || exit;


/**
 * Handle REST Routes for Transcoder.
 */
class Transcoder_Rest_Routes extends WP_REST_Controller {

	/**
	 * Version of REST route.
	 *
	 * @var int
	 */
	public $version = 1;

	/**
	 * Prefix for API endpoint namespace.
	 *
	 * @var string
	 */
	public $namespace_prefix = 'transcoder/v';

	/**
	 * RT Transcoder Handler object.
	 *
	 * @var RT_Transcoder_Handler
	 */
	public $rtgodam_transcoder_handler;

	/**
	 * Constructor
	 *
	 * @since   1.0.0
	 *
	 * @access public
	 * @return void
	 */
	public function __construct() {
		$this->rtgodam_transcoder_handler = new RT_Transcoder_Handler( true );

		if ( ! defined( 'RT_TRANSCODER_CALLBACK_URL' ) ) {
			define( 'RT_TRANSCODER_CALLBACK_URL', $this->get_callback_url() );
		}
	}

	/**
	 * Function to register routes.
	 */
	public function register_routes() {

		// Register `amp-media` route to get media poster info.
		register_rest_route(
			$this->namespace_prefix . $this->version,
			'/amp-media/(?P<id>\d+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_media_data' ),
				'permission_callback' => '__return_true',
			)
		);

		// Register `amp-rtmedia` route to get media poster info related to rtMedia.
		register_rest_route(
			$this->namespace_prefix . $this->version,
			'/amp-rtmedia',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_rtmedia_data' ),
				'permission_callback' => '__return_true',
			)
		);

		// Register `transcoder-callback` route to handle callback request by the FFMPEG transcoding server.
		register_rest_route(
			$this->namespace_prefix . $this->version,
			'/transcoder-callback',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'handle_callback' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'job_id'           => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'job_type'         => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'job_for'          => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'format'           => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'download_url'     => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'esc_url_raw',
					),
					'file_name'        => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'thumb_count'      => array(
						'required'          => false,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					),
					'status'           => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'file_status'      => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'files'            => array(
						'required'          => false,
						'type'              => 'array',
						'sanitize_callback' => array( $this, 'sanitize_array_of_urls' ),
					),
					'thumbnail'        => array(
						'required'          => false,
						'type'              => 'array',
						'sanitize_callback' => array( $this, 'sanitize_array_of_urls' ),
					),
					'error_msg'        => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'job_manager_form' => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);
	}

	/**
	 * Sanitizes a single URL or an array of URLs.
	 *
	 * @param mixed           $value The incoming data (can be a single URL or an array of URLs).
	 * @param WP_REST_Request $request Full details about the request.
	 * @param string          $param The parameter name (e.g., 'files' or 'thumbnail').
	 *
	 * @return mixed Returns a sanitized URL, array of sanitized URLs, or WP_Error on failure.
	 */
	public function sanitize_array_of_urls( $value, $request, $param ) {
		// If the value is not an array, treat it as a single URL.
		if ( ! is_array( $value ) ) {
			if ( is_string( $value ) ) {
				return esc_url_raw( $value );
			}
			// translators: Return an error if the value is neither a string nor an array.
			return new WP_Error( 'invalid_param', sprintf( __( '%s must be a valid URL or an array of URLs.', 'godam' ), $param ) );
		}

		// Initialize the sanitized array.
		$sanitized = array();

		// Handle `files` case: multiple file types like `mp4`, `mp3`, `mpd`.
		if ( 'files' === $param ) {
			foreach ( array( 'mp4', 'mp3', 'mpd' ) as $file_type ) {
				if ( isset( $value[ $file_type ] ) && is_array( $value[ $file_type ] ) ) {
					$sanitized[ $file_type ] = array_map( 'esc_url_raw', $value[ $file_type ] );
				}
			}
			return $sanitized;
		}

		// Else just sanitize the array values.
		return array_map( 'esc_url_raw', $value );
	}

	/**
	 * Return the callback URL for the transcoder.
	 *
	 * @return string
	 */
	public function get_callback_url() {
		return rest_url( $this->namespace_prefix . $this->version . '/transcoder-callback' );
	}

	/**
	 * Return poster url for requested media if exists.
	 *
	 * @param WP_REST_Request $request Object of WP_REST_Request.
	 *
	 * @return array|bool REST API response.
	 */
	public function get_media_data( WP_REST_Request $request ) {
		$media_id = $request->get_param( 'id' );

		return $this->get_media_data_by_id( $media_id );
	}

	/**
	 * Return poster url for requested media related to rtMedia if exists.
	 *
	 * @param WP_REST_Request $request Object of WP_REST_Request.
	 *
	 * @return array|bool REST API response.
	 */
	public function get_rtmedia_data( WP_REST_Request $request ) {
		if ( ! function_exists( 'rtmedia_media_id' ) || empty( $request['media_ids'] ) ) {
			return false;
		}
		$media_ids = explode( ',', $request['media_ids'] );

		$response = array();
		foreach ( $media_ids as $media_id ) {
			// Convert rtMedia ID to post ID.
			$attachment_id = rtmedia_media_id( $media_id );
			if ( empty( $attachment_id ) ) {
				$response[ $media_id ] = 'invalid';
				continue;
			}

			// Check if media is eligible to be transcoded.
			$rtgodam_transcoding_job_id = get_post_meta( $attachment_id, '_rt_transcoding_job_id', true );
			if ( empty( $rtgodam_transcoding_job_id ) ) {
				$response[ $media_id ] = 'invalid';
				continue;
			}

			$res = $this->get_media_data_by_id( $attachment_id );
			if ( false !== $res ) {
				$response[ $media_id ] = $res;
				continue;
			}

			// Get transcoding status to detect if the site doesn't have HTTP auth or some other restrictions.
			$status = json_decode( rtgodam_get_transcoding_status( $attachment_id ), true );
			if ( ! empty( $status['message'] ) && false !== strpos( $status['message'], 'Transcoder failed to transcode this file' ) ) {
				$response[ $media_id ] = 'invalid';
			}
		}

		return ( ! empty( $response ) ) ? $response : false;
	}

	/**
	 * Return poster URL of a media from media_id.
	 *
	 * @param int $media_id Media ID.
	 *
	 * @return array|bool Poster URL and transcoded media URL or False.
	 */
	private function get_media_data_by_id( $media_id ) {
		// Check media id.
		if ( empty( $media_id ) ) {
			return false;
		}

		// Check if thumbnail and transcoded file exist for the passed attachment.
		$thumbnail_id   = get_post_thumbnail_id( $media_id );
		$transcoded_url = get_post_meta( $media_id, '_rt_media_transcoded_files', true );

		if ( empty( $thumbnail_id ) || empty( $transcoded_url ) ) {
			return false;
		}

		// Get transcoded video path.
		$transcoded_url = empty( $transcoded_url['mp4'][0] ) ? '' : $transcoded_url['mp4'][0];
		$uploads        = wp_get_upload_dir();

		// Get URL for the transcoded video.
		if ( 0 === strpos( $transcoded_url, $uploads['baseurl'] ) ) {
			$final_file_url = $transcoded_url;
		} else {
			$final_file_url = trailingslashit( $uploads['baseurl'] ) . $transcoded_url;
		}

		if ( true !== (bool) get_post_meta( $thumbnail_id, 'amp_is_poster', true ) || empty( $final_file_url ) ) {
			return false;
		}

		return array(
			'poster'          => get_the_post_thumbnail_url( $media_id ),
			'transcodedMedia' => $final_file_url,
		);
	}

	/**
	 * Function to handle the callback request by the FFMPEG transcoding server.
	 *
	 * @param WP_REST_Request $request Object of WP_REST_Request.
	 *
	 * @return WP_Error|WP_REST_Response REST API response.
	 */
	public function handle_callback( WP_REST_Request $request ) {

		$job_id      = $request->get_param( 'job_id' );
		$file_status = $request->get_param( 'file_status' );
		$error_msg   = $request->get_param( 'error_msg' );
		$job_for     = $request->get_param( 'job_for' );
		$thumbnail   = $request->get_param( 'thumbnail' );
		$format      = $request->get_param( 'format' );

		if ( ! empty( $job_id ) && ! empty( $file_status ) && ( 'error' === $file_status ) ) {
			$this->rtgodam_transcoder_handler->nofity_transcoding_failed( $job_id, $error_msg );
			return new WP_Error( 'transcoder_error', 'Something went wrong. Invalid post request.', array( 'status' => 400 ) );
		}

		$mail = defined( 'GODAM_NO_MAIL' ) ? false : true;

		$attachment_id = '';

		if ( isset( $job_for ) && ( 'wp-media' === $job_for ) ) {
			if ( isset( $job_id ) ) {
				$has_thumbs = isset( $thumbnail ) ? true : false;
				$flag       = false;

				$id = $this->rtgodam_transcoder_handler->get_post_id_by_meta_key_and_value( '_rt_transcoding_job_id', $job_id );

				if ( ! empty( $id ) && is_numeric( $id ) ) {
					$attachment_id         = $id;
					$post_array            = $request->get_params();
					$post_array['post_id'] = $attachment_id;

					if ( $has_thumbs && ! empty( $post_array['thumbnail'] ) ) {
						$thumbnail = $this->rtgodam_transcoder_handler->add_media_thumbnails( $post_array );
					}

					if ( isset( $format ) && 'thumbnail' === $format ) {
						return new WP_REST_Response( esc_html_e( 'Thumbnail created successfully.', 'godam' ), 200 );
					}

					if ( ! empty( $post_array['files'] ) ) {
						if ( ! empty( $post_array['files']['mpd'] ) ) {
							update_post_meta( $attachment_id, '_rt_transcoded_url', $post_array['download_url'] );
						} else {
							$this->rtgodam_transcoder_handler->add_transcoded_files( $post_array['files'], $attachment_id, $job_for );
						}
					}
				} else {
					$flag = 'Something went wrong. The required attachment id does not exists. It must have been deleted.';
				}

				$this->rtgodam_transcoder_handler->update_usage( $this->rtgodam_transcoder_handler->api_key );

				if ( $flag && $mail ) {
					$subject = 'Transcoding: Download Failed';
					$message = '<p><a href="' . esc_url( rtgodam_get_edit_post_link( $attachment_id ) ) . '">' . esc_html__( 'Media', 'godam' ) . '</a> ' . esc_html__( ' was successfully encoded but there was an error while downloading:', 'godam' ) . '</p><p><code>' . esc_html( $flag ) . '</code></p>';
					$users   = get_users( array( 'role' => 'administrator' ) );
					if ( $users ) {
						$admin_email_ids = array();
						foreach ( $users as $user ) {
							$admin_email_ids[] = $user->user_email;
						}
						add_filter( 'wp_mail_content_type', array( $this->rtgodam_transcoder_handler, 'wp_mail_content_type' ) );
						wp_mail( $admin_email_ids, $subject, $message ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.wp_mail_wp_mail
						remove_filter( 'wp_mail_content_type', array( $this->rtgodam_transcoder_handler, 'wp_mail_content_type' ) );
					}
					return new WP_Error( 'transcoder_error', $flag, array( 'status' => 500 ) );
				} else {
					return new WP_REST_Response( esc_html_e( 'Media transcoded successfully.', 'godam' ), 200 );
				}
			}
		} else {

			// To check if request is sumitted from the WP Job Manager plugin ( https://wordpress.org/plugins/wp-job-manager/ ).
			$job_manager_form = sanitize_text_field( wp_unslash( $request->get_param( 'job_manager_form' ) ) );

			if ( isset( $job_id ) && ! empty( $job_id ) && class_exists( 'RTDBModel' ) && empty( $job_manager_form ) ) {

				$has_thumbs = isset( $thumbnail ) ? true : false;
				$flag       = false;
				$model      = new RTDBModel( 'rtm_media_meta', false, 10, true );

				$meta_details = $model->get(
					array(
						'meta_value' => $job_id, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
						'meta_key'   => 'rtmedia-transcoding-job-id', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
					)
				);

				if ( ! isset( $meta_details[0] ) ) {
					$id = $this->rtgodam_transcoder_handler->get_post_id_by_meta_key_and_value( '_rt_transcoding_job_id', $job_id );
				} else {
					$id = $meta_details[0]->media_id;
				}

				if ( isset( $id ) && is_numeric( $id ) ) {
					$model              = new RTMediaModel();
					$media              = $model->get_media( array( 'media_id' => $id ), 0, 1 );
					$this->media_author = $media[0]->media_author;
					$attachment_id      = $media[0]->media_id;

					$post_array            = $request->get_params();
					$post_array['post_id'] = $attachment_id;

					if ( $has_thumbs ) {
						$this->rtgodam_transcoder_handler->add_media_thumbnails( $post_array );
					}

					if ( isset( $format ) && 'thumbnail' === $format ) {
						return new WP_REST_Response( esc_html_e( 'Thumbnail created successfully.', 'godam' ), 200 );
					}

					if ( ! empty( $post_array['files'] ) ) {
						$this->rtgodam_transcoder_handler->add_transcoded_files( $post_array['files'], $attachment_id, $job_for );
					}
				} else {
					$flag = 'Something went wrong. The required attachment id does not exists. It must have been deleted.';
				}

				$this->rtgodam_transcoder_handler->update_usage( $this->rtgodam_transcoder_handler->api_key );

				if ( $flag && $mail ) {
					$subject = 'Transcoding: Download Failed';
					$message = '<p><a href="' . esc_url( rtgodam_get_edit_post_link( $attachment_id ) ) . '">' . esc_html__( 'Media', 'godam' ) . '</a> ' . esc_html__( ' was successfully transcoded but there was an error while downloading:', 'godam' ) . '</p><p><code>' . esc_html( $flag ) . '</code></p><p>';
					$users   = get_users( array( 'role' => 'administrator' ) );
					if ( $users ) {
						$admin_email_ids = array();
						foreach ( $users as $user ) {
							$admin_email_ids[] = $user->user_email;
						}
						add_filter( 'wp_mail_content_type', array( $this->rtgodam_transcoder_handler, 'wp_mail_content_type' ) );
						wp_mail( $admin_email_ids, $subject, $message ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.wp_mail_wp_mail
						remove_filter( 'wp_mail_content_type', array( $this->rtgodam_transcoder_handler, 'wp_mail_content_type' ) );
					}
					return new WP_Error( 'transcoder_error', $flag, array( 'status' => 500 ) );

				} else {
					return new WP_REST_Response( esc_html_e( 'Media transcoded successfully.', 'godam' ), 200 );
				}
			}
		}

		/**
		 * Allow users/plugins to perform action after response received from the transcoder is
		 * processed
		 *
		 * @since 1.0.9
		 *
		 * @param number    $attachment_id  Attachment ID for which the callback has sent from the transcoder
		 * @param number    $job_id         The transcoding job ID
		 */
		do_action( 'rtgodam_handle_callback_finished', $attachment_id, $job_id );
	}
}
