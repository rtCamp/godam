<?php
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
	 * @var RTGODAM_Transcoder_Handler
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
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'handle_callback' ),
				'permission_callback' => array( $this, 'verify_callback_permission' ),
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
					'api_key'          => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		// Register `transcription-callback` route to handle transcription completion notifications.
		register_rest_route(
			self::$namespace_prefix,
			'/transcription-callback',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'handle_transcription_callback' ),
				'permission_callback' => array( $this, 'verify_callback_permission' ),
				'args'                => array(
					'transcription_status' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'transcript_path'      => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'esc_url_raw',
					),
					'job_id'               => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'api_key'              => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
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
			return new WP_Error( 'rtgodam_transcoding_error', 'Something went wrong. Invalid post request.', array( 'status' => 400 ) );
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

					// If thumbnail array is empty but thumbnail_url is provided, use it.
					if ( empty( $post_array['thumbnail'] ) && ! empty( $post_array['thumbnail_url'] ) ) {
						$post_array['thumbnail'] = array(
							$post_array['thumbnail_url'],
						);
						$has_thumbs              = true;
					}

					if ( $has_thumbs && ! empty( $post_array['thumbnail'] ) ) {
						$thumbnail = $this->rtgodam_transcoder_handler->add_media_thumbnails( $post_array );
					}

					if ( isset( $format ) && 'thumbnail' === $format ) {
						return new WP_REST_Response( esc_html_e( 'Thumbnail created successfully.', 'godam' ), 200 );
					}

					if ( ! empty( $post_array['files'] ) ) {
						if ( ! empty( $post_array['files']['mpd'] ) ) {
							update_post_meta( $attachment_id, 'rtgodam_transcoded_url', $post_array['download_url'] );

							delete_post_meta( $attachment_id, 'rtgodam_retranscoding_sent' );

							$latest_attachment = get_option( 'rtgodam_new_attachment', false );

							// Save hls url as well.
							if ( isset( $post_array['hls_path'] ) && ! empty( trim( $post_array['hls_path'] ) ) ) {
								update_post_meta( $attachment_id, 'rtgodam_hls_transcoded_url', sanitize_url( $post_array['hls_path'] ) );
							}

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
					return new WP_Error( 'rtgodam_transcoding_error', $flag, array( 'status' => 500 ) );
				}
			}
		}

		if ( isset( $job_for ) && ( 'gf-godam-recorder' === $job_for ) ) {
			if ( isset( $job_id ) ) {
				$post_array = $request->get_params();
				$data       = get_option( $job_id );
				if ( ! empty( $data ) ) {
					if ( 'gf_godam_recorder' === $data['source'] || 'gform_godam_recorder' === $data['source'] ) {
						$entry_id   = $data['entry_id'];
						$post_array = $request->get_params();
						if ( $entry_id && function_exists( 'gform_update_meta' ) ) {
							gform_update_meta( $entry_id, 'rtgodam_transcoded_url_' . $data['field_id'] . '_' . $data['index'], $post_array['download_url'] );
						}
					}
				}
			}
		}

		if ( ! empty( $job_for ) && 'sureforms-godam-recorder' === $job_for && ! empty( $job_id ) ) {
			$post_array = $request->get_params();

			/**
			 * Get data stored in options based on job id.
			 */
			$data = get_option( $job_id );

			/**
			 * If we have data in options, proceed.
			 */
			if ( ! empty( $data ) && 'sureforms_godam_recorder' === $data['source'] && class_exists( 'SRFM\Inc\Database\Tables\Entries' ) ) {
				$entry_id   = $data['entry_id'];
				$entry_data = \SRFM\Inc\Database\Tables\Entries::get( $entry_id );

				if ( ! empty( $entry_data ) && ! empty( $entry_data['form_id'] ) ) {
					$form_id = $entry_data['form_id'];
					update_post_meta(
						$form_id,
						'rtgodam_transcoded_url_sureforms_' . $form_id . '_' . $entry_id,
						$post_array['download_url']
					);
				}
			}
		}

		if ( ! empty( $job_for ) && 'fluentforms-godam-recorder' === $job_for && ! empty( $job_id ) ) {
			$post_array = $request->get_params();

			/**
			 * Get data stored in options based on job id.
			 */
			$data = get_option( $job_id );

			/**
			 * If we have data in options, proceed.
			 */
			if ( ! empty( $data ) && 'fluentforms_godam_recorder' === $data['source'] && function_exists( 'wpFluent' ) ) {
				$entry_id   = $data['entry_id'];
				$entry_data = wpFluent()->table( 'fluentform_submissions' )->find( $entry_id );

				if ( ! empty( $entry_data ) && ! empty( $entry_data->form_id ) ) {
					$form_id = $entry_data->form_id;

					/**
					 * Add to entry meta.
					 */
					wpFluent()->table( 'fluentform_submission_meta' )->insert(
						array(
							'response_id' => $entry_id,
							'form_id'     => $form_id,
							// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Required for storing transcoded URL metadata.
							'meta_key'    => 'rtgodam_transcoded_url_fluentforms_' . $form_id . '_' . $entry_id,
							'value'       => $post_array['download_url'],
							'status'      => 'success',
							'name'        => 'rtgodam_transcoded_url_fluentforms_' . $form_id . '_' . $entry_id,
						)
					);
				}
			}
		}

		/**
		 * Allow users/plugins to perform action after response received from the transcoder is
		 * processed
		 *
		 * @since 1.3.0 Added $job_for and $request parameter.
		 * @since 1.0.9
		 *
		 * @param number    $attachment_id  Attachment ID for which the callback has sent from the transcoder.
		 * @param number    $job_id         The transcoding job ID.
		 * @param string    $job_for        Job for.
		 * @param \WP_Request $request      WP_Request instance.
		 */
		do_action( 'rtgodam_handle_callback_finished', $attachment_id, $job_id, $job_for, $request );
	}

	/**
	 * Function to handle the transcription callback request.
	 *
	 * @param WP_REST_Request $request Object of WP_REST_Request.
	 *
	 * @return WP_Error|WP_REST_Response REST API response.
	 */
	public function handle_transcription_callback( WP_REST_Request $request ) {
		$transcription_status = $request->get_param( 'transcription_status' );
		$transcript_path      = $request->get_param( 'transcript_path' );
		$job_id               = $request->get_param( 'job_id' );

		// API key verification is handled by the permission callback.

		// Validate required parameters.
		if ( empty( $job_id ) ) {
			return new WP_Error( 'rtgodam_transcription_error', __( 'Job ID is required.', 'godam' ), array( 'status' => 400 ) );
		}

		if ( empty( $transcription_status ) ) {
			return new WP_Error( 'rtgodam_transcription_error', __( 'Transcription status is required.', 'godam' ), array( 'status' => 400 ) );
		}

		if ( empty( $transcript_path ) ) {
			return new WP_Error( 'rtgodam_transcription_error', __( 'Transcript path is required.', 'godam' ), array( 'status' => 400 ) );
		}

		// Find video attachment by job ID.
		$attachment_id = $this->rtgodam_transcoder_handler->get_post_id_by_meta_key_and_value( 'rtgodam_transcoding_job_id', $job_id );

		if ( empty( $attachment_id ) || ! is_numeric( $attachment_id ) ) {
			return new WP_Error( 'rtgodam_transcription_error', __( 'Video attachment not found for the provided job ID.', 'godam' ), array( 'status' => 404 ) );
		}

		// If status is "Transcribed", save the transcript path.
		if ( 'Transcribed' === $transcription_status ) {
			// Save transcript path as post meta.
			// The transcript_path parameter is already sanitized by the REST API framework via esc_url_raw sanitize_callback.
			update_post_meta( $attachment_id, 'rtgodam_transcript_path', $transcript_path );

			return new WP_REST_Response(
				array(
					'success' => true,
					'message' => __( 'Transcript path saved successfully.', 'godam' ),
				),
				200
			);
		}

		// Return success response even if status is not "Transcribed" (e.g., "Processing", "Failed", etc.).
		return new WP_REST_Response(
			array(
				'success' => true,
				'message' => __( 'Transcription callback received.', 'godam' ),
			),
			200
		);
	}

	/**
	 * Verify callback permission by checking API key.
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return bool|WP_Error True if permission granted, WP_Error otherwise.
	 */
	public function verify_callback_permission( $request ) {
		$provided_api_key = $request->get_param( 'api_key' );
		$stored_api_key   = get_option( 'rtgodam-api-key' );

		// Validate API Key.
		if ( empty( $provided_api_key ) ) {
			return new WP_Error( 'forbidden', __( 'API key is required.', 'godam' ), array( 'status' => 403 ) );
		}

		if ( empty( $stored_api_key ) ) {
			return new WP_Error( 'forbidden', __( 'API key not configured on the site.', 'godam' ), array( 'status' => 403 ) );
		}

		if ( $provided_api_key !== $stored_api_key ) {
			return new WP_Error( 'forbidden', __( 'Invalid API key.', 'godam' ), array( 'status' => 403 ) );
		}

		return true;
	}
}
