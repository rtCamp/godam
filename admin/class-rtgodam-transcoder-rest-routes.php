<?php

declare(strict_types = 1);

/**
 * Class RTGODAM_Transcoder_Rest_Routes
 *
 * @package GoDAM
 */

defined( 'ABSPATH' ) || exit;


/**
 * Handle REST Routes for Transcoder.
 */
class RTGODAM_Transcoder_Rest_Routes extends WP_REST_Controller {
	/**
	 * Prefix for API endpoint namespace.
	 *
	 * @var string
	 */
	public static $namespace_prefix = 'godam/v1';

	/**
	 * RT Transcoder Handler object.
	 *
	 * @var \RTGODAM_Transcoder_Handler
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
		$this->rtgodam_transcoder_handler = new RTGODAM_Transcoder_Handler( true );

		if ( ! defined( 'RTGODAM_TRANSCODER_CALLBACK_URL' ) ) {
			define( 'RTGODAM_TRANSCODER_CALLBACK_URL', self::get_callback_url() );
		}
	}

	/**
	 * Function to register routes.
	 */
	public function register_routes() {

		// Register `transcoder-callback` route to handle callback request by the FFMPEG transcoding server.
		register_rest_route(
			self::$namespace_prefix,
			'/transcoder-callback',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'handle_callback' ],
				'permission_callback' => '__return_true', // The endpoint must be public; otherwise, GoDAM (https://app.godam.io) won't be able to send a media transcoding callback request.
				'args'                => [
					'job_id'           => [
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					],
					'job_type'         => [
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					],
					'job_for'          => [
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					],
					'format'           => [
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					],
					'download_url'     => [
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'esc_url_raw',
					],
					'file_name'        => [
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					],
					'thumb_count'      => [
						'required'          => false,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					],
					'status'           => [
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					],
					'file_status'      => [
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					],
					'files'            => [
						'required'          => false,
						'type'              => 'array',
						'sanitize_callback' => [ $this, 'sanitize_array_of_urls' ],
					],
					'thumbnail'        => [
						'required'          => false,
						'type'              => 'array',
						'sanitize_callback' => [ $this, 'sanitize_array_of_urls' ],
					],
					'error_msg'        => [
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					],
					'job_manager_form' => [
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					],
				],
			]
		);
	}

	/**
	 * Return the callback URL for the transcoder.
	 *
	 * @return string
	 */
	public static function get_callback_url() {
		return rest_url( self::$namespace_prefix . '/transcoder-callback' );
	}

	/**
	 * Sanitizes a single URL or an array of URLs.
	 *
	 * @param mixed            $value The incoming data (can be a single URL or an array of URLs).
	 * @param \WP_REST_Request $request Full details about the request.
	 * @param string           $param The parameter name (e.g., 'files' or 'thumbnail').
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
		$sanitized = [];

		// Handle `files` case: multiple file types like `mp4`, `mp3`, `mpd`.
		if ( 'files' === $param ) {
			foreach ( [ 'mp4', 'mp3', 'mpd' ] as $file_type ) {
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
	 * Function to handle the callback request by the FFMPEG transcoding server.
	 *
	 * @param \WP_REST_Request $request Object of WP_REST_Request.
	 *
	 * @return \WP_Error|\WP_REST_Response REST API response.
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
			return new WP_Error( 'rtgodam_transcoding_error', 'Something went wrong. Invalid post request.', [ 'status' => 400 ] );
		}

		$attachment_id = '';

		if ( isset( $job_for ) && ( 'wp-media' === $job_for ) ) {
			if ( isset( $job_id ) ) {
				$has_thumbs = isset( $thumbnail ) ? true : false;
				$flag       = false;

				$id = $this->rtgodam_transcoder_handler->get_post_id_by_meta_key_and_value( 'rtgodam_transcoding_job_id', $job_id );

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
							update_post_meta( $attachment_id, 'rtgodam_transcoded_url', $post_array['download_url'] );

							$latest_attachment = get_option( 'rtgodam_new_attachment', false );

							if ( ! empty( $latest_attachment ) && $latest_attachment['attachment_id'] === $attachment_id ) {
								$latest_attachment['transcoding_status'] = 'success';
								update_option( 'rtgodam_new_attachment', $latest_attachment, '', true );
							}
						} else {
							$this->rtgodam_transcoder_handler->add_transcoded_files( $post_array['files'], $attachment_id, $job_for );
						}
					}
				} else {
					$flag = 'Something went wrong. The required attachment id does not exists. It must have been deleted.';
				}

				$this->rtgodam_transcoder_handler->update_usage( $this->rtgodam_transcoder_handler->api_key );

				if ( $flag ) {
					return new WP_Error( 'rtgodam_transcoding_error', $flag, [ 'status' => 500 ] );
				} else {
					return new WP_REST_Response( esc_html_e( 'Media transcoded successfully.', 'godam' ), 200 );
				}
			}
		}

		if ( isset( $job_for ) && ( 'gf-godam-recorder' === $job_for ) ) {
			if ( isset( $job_id ) ) {
				$post_array = $request->get_params();
				$data       = get_option( $job_id );
				if ( ! empty( $data ) ) {
					if ( 'gform_godam_recorder' === $data['source'] ) {
						$entry_id   = $data['entry_id'];
						$post_array = $request->get_params();
						if ( $entry_id && function_exists( 'gform_update_meta' ) ) {
							gform_update_meta( $entry_id, 'rtgodam_transcoded_url_' . $data['field_id'] . '_' . $data['index'], $post_array['download_url'] );
						}
					}
				}
			}
		}

		/**
		 * Allow users/plugins to perform action after response received from the transcoder is
		 * processed
		 *
		 * @since 1.0.9
		 *
		 * @param \number    $attachment_id  Attachment ID for which the callback has sent from the transcoder
		 * @param \number    $job_id         The transcoding job ID
		 */
		do_action( 'rtgodam_handle_callback_finished', $attachment_id, $job_id );
	}
}
