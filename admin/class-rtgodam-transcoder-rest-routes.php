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
					'job_id'                => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'job_type'              => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'job_for'               => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'format'                => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'download_url'          => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'esc_url_raw',
					),
					'file_name'             => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'thumb_count'           => array(
						'required'          => false,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					),
					'status'                => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'file_status'           => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'files'                 => array(
						'required'          => false,
						'type'              => 'array',
						'sanitize_callback' => array( $this, 'sanitize_array_of_urls' ),
					),
					'thumbnail'             => array(
						'required'          => false,
						'type'              => 'array',
						'sanitize_callback' => array( $this, 'sanitize_array_of_urls' ),
					),
					'placeholder_thumbnail' => array(
						'required'          => false,
						'type'              => 'array',
						'sanitize_callback' => array( $this, 'sanitize_array_of_urls' ),
					),
					'error_msg'             => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'job_manager_form'      => array(
						'required'          => false,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'api_key'               => array(
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
	 * REST paths (relative to this namespace, each with a leading slash) that
	 * get_callback_url() ever builds a URL for — keyed by a short,
	 * referenceable name. The one canonical list backing that accessor, so
	 * any other code that needs the *complete* set of callback paths (e.g. an
	 * integration wrapping every centralized-media callback in a site switch)
	 * has one place to read it from, instead of a hand-maintained shadow list
	 * that can silently miss a newly added one.
	 *
	 * @var array<string, string>
	 */
	const CALLBACK_PATHS = array(
		'transcoder' => '/transcoder-callback',
		'status'     => '/transcoding/transcoding-status',
	);

	/**
	 * Return a transcoder callback URL for the *current* site.
	 *
	 * The single, authoritative accessor for every callback URL this class
	 * constructs — call this directly at the point of use rather than caching
	 * the result in a define()'d constant. A constant, once defined, can't be
	 * recomputed if site context (e.g. a multisite switch_to_blog()) changes
	 * later in the same request; this way every caller always gets the URL for
	 * whichever site is current when it actually asks.
	 *
	 * @param string $type One of the keys in self::CALLBACK_PATHS. Defaults to
	 *                      'transcoder', the original/most common callback.
	 * @return string
	 */
	public static function get_callback_url( $type = 'transcoder' ) {
		$path = isset( self::CALLBACK_PATHS[ $type ] ) ? self::CALLBACK_PATHS[ $type ] : self::CALLBACK_PATHS['transcoder'];
		return rest_url( self::$namespace_prefix . $path );
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
		$job_type    = $request->get_param( 'job_type' );

		// GoDAM Central calls back with file_status=error when transcoding fails on its end.
		// Acknowledge the callback with a 200 so Central does not retry, but store the error
		// information in post meta so the site admin can see what went wrong.
		if ( ! empty( $job_id ) && ! empty( $file_status ) && ( 'error' === $file_status ) ) {
			if ( 'wp-media' === $job_for ) {
				/**
				 * Fires before resolving/mutating attachment data for a
				 * failed transcoding job, so integrations that centralize
				 * media on another site can switch context first. The
				 * job-ID lookup itself needs this too — it's a direct
				 * $wpdb->postmeta query, just as site-scoped as
				 * get_post_meta().
				 *
				 * @since 1.8.0
				 */
				do_action( 'rtgodam_before_attachment_lookup' );
				try {
					$failed_id = $this->rtgodam_transcoder_handler->get_post_id_by_meta_key_and_value( 'rtgodam_transcoding_job_id', $job_id );
					if ( ! empty( $failed_id ) && is_numeric( $failed_id ) ) {
						update_post_meta( $failed_id, 'rtgodam_transcoding_status', 'failed' );
						// Use rtgodam_transcoding_error_msg so the REST status endpoint can surface it.
						if ( ! empty( $error_msg ) ) {
							update_post_meta( $failed_id, 'rtgodam_transcoding_error_msg', sanitize_textarea_field( $error_msg ) );
						}
					}
				} finally {
					do_action( 'rtgodam_after_attachment_lookup' );
				}
			}
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => __( 'Transcoding error received and recorded.', 'godam' ),
				),
				200
			);
		}

		$attachment_id = '';

		if ( isset( $job_for ) && ( 'wp-media' === $job_for ) ) {
			if ( isset( $job_id ) ) {
				/**
				 * Fires before resolving/mutating attachment data for this
				 * transcoding callback, so integrations that centralize
				 * media on another site can switch context first. The
				 * job-ID lookup inside handle_wp_media_transcoding_callback()
				 * needs this too — it's a direct $wpdb->postmeta query, just
				 * as site-scoped as get_post_meta(), even though it's
				 * invisible to a checker that only looks for named WP API
				 * calls.
				 *
				 * @since 1.8.0
				 */
				do_action( 'rtgodam_before_attachment_lookup' );
				try {
					$wp_media_result = $this->handle_wp_media_transcoding_callback( $request, $job_id, $job_for, $job_type, $thumbnail, $format );
				} finally {
					do_action( 'rtgodam_after_attachment_lookup' );
				}

				if ( $wp_media_result instanceof WP_REST_Response ) {
					return $wp_media_result;
				}

				$attachment_id = $wp_media_result;
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
					update_post_meta( // godam-coverage-ignore -- handle_callback(): $form_id is a SureForms form ID used as a postmeta key (not an attachment ID) to stash the transcoded URL.
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

		return new WP_REST_Response(
			array(
				'success' => true,
				'message' => __( 'Callback processed successfully.', 'godam' ),
			),
			200
		);
	}

	/**
	 * Does the actual work for handle_callback()'s 'wp-media' job_for branch.
	 * Always runs with the centralized media site active — see the
	 * before/after pair in the caller.
	 *
	 * @since 1.8.0
	 *
	 * @param \WP_REST_Request $request  The incoming request.
	 * @param string           $job_id   The transcoding job ID.
	 * @param string           $job_for  The 'job_for' request param — always 'wp-media' here, passed through unchanged to add_transcoded_files() for parity with the original inline code.
	 * @param string           $job_type The 'job_type' request param (e.g. 'pdf', 'image').
	 * @param mixed            $thumbnail The 'thumbnail' request param.
	 * @param string           $format   The 'format' request param.
	 * @return WP_REST_Response|string|int A response to return immediately, or the resolved attachment ID (possibly empty) for the caller to continue with.
	 */
	private function handle_wp_media_transcoding_callback( \WP_REST_Request $request, $job_id, $job_for, $job_type, $thumbnail, $format ) {
		$attachment_id = '';
		$has_thumbs    = isset( $thumbnail ) ? true : false;

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
				return new WP_REST_Response( __( 'Thumbnail created successfully.', 'godam' ), 200 );
			}

			if ( ! empty( $post_array['files'] ) ) {
				if ( ! empty( $post_array['files']['mpd'] ) ) {
					update_post_meta( $attachment_id, 'rtgodam_transcoded_url', $post_array['download_url'] ); // godam-coverage-ignore -- handle_wp_media_transcoding_callback(): covered transitively — caller (handle_callback) wraps the entire call in try/finally.

					delete_post_meta( $attachment_id, 'rtgodam_retranscoding_sent' ); // godam-coverage-ignore -- handle_wp_media_transcoding_callback(): covered transitively — caller (handle_callback) wraps the entire call in try/finally.

					$latest_attachment = get_option( 'rtgodam_new_attachment', false );

					// Save hls url as well.
					if ( isset( $post_array['hls_path'] ) && ! empty( trim( $post_array['hls_path'] ) ) ) {
						update_post_meta( $attachment_id, 'rtgodam_hls_transcoded_url', sanitize_url( $post_array['hls_path'] ) ); // godam-coverage-ignore -- handle_wp_media_transcoding_callback(): covered transitively — caller (handle_callback) wraps the entire call in try/finally.
					}

					if ( ! empty( $latest_attachment ) && $latest_attachment['attachment_id'] === $attachment_id ) {
						$latest_attachment['transcoding_status'] = 'success';
						update_option( 'rtgodam_new_attachment', $latest_attachment, true );
					}
				} else {
					$this->rtgodam_transcoder_handler->add_transcoded_files( $post_array['files'], $attachment_id, $job_for );
				}
			}

			if ( 'pdf' === $job_type && isset( $post_array['download_url'] ) && ! empty( $post_array['download_url'] ) ) {
				// Setting the transcoded PDF URL.
				update_post_meta( $attachment_id, 'rtgodam_transcoded_url', esc_url_raw( $post_array['download_url'] ) ); // godam-coverage-ignore -- handle_wp_media_transcoding_callback(): covered transitively — caller (handle_callback) wraps the entire call in try/finally.
			}

			if ( 'image' === $job_type && isset( $post_array['download_url'] ) && ! empty( $post_array['download_url'] ) ) {
				// Setting the transcoded Image URL.
				update_post_meta( $attachment_id, 'rtgodam_transcoded_url', esc_url_raw( $post_array['download_url'] ) ); // godam-coverage-ignore -- handle_wp_media_transcoding_callback(): covered transitively — caller (handle_callback) wraps the entire call in try/finally.

				// Request CDN image subsizes and store them in dedicated meta.
				// This is a secondary async operation; a failure here must not cause a 500 response
				// to GoDAM Central, which would mark the already-completed transcoding job as failed.
				$subsize_result = \RTGODAM\Inc\REST_API\Media_Library::get_instance()->request_image_subsizes_for_attachment( $job_id, $attachment_id );

				if ( is_wp_error( $subsize_result ) || empty( $subsize_result ) ) {
					// translators: %s is replaced with the attachment ID for which subsizes generation failed.
					error_log( // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Logging the error for debugging purposes.
						// translators: %s is replaced with the attachment ID for which subsizes generation failed.
						sprintf( __( 'GoDAM: Failed to request image subsizes for attachment ID %s. The transcoded image URL has been saved; subsizes may be retried separately.', 'godam' ), $attachment_id )
					);

					$this->rtgodam_transcoder_handler->update_usage( $this->rtgodam_transcoder_handler->api_key );

					return new WP_REST_Response(
						array(
							'success' => false,
							'message' => __( 'Transcoded image URL saved, but failed to request subsizes.', 'godam' ),
						),
						200
					);
				}
			}
		} else {
			// The attachment no longer exists (deleted between queuing and callback).
			// Log for visibility but return 200 so GoDAM Central does not retry or mark
			// the job as failed due to an error in the callback itself.
			error_log( // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Logging the error for debugging purposes.
				sprintf( 'GoDAM: Transcoder callback received for job %s but the corresponding attachment no longer exists. It may have been deleted.', sanitize_text_field( $job_id ) )
			);
			$this->rtgodam_transcoder_handler->update_usage( $this->rtgodam_transcoder_handler->api_key );
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => __( 'Attachment not found; it may have been deleted.', 'godam' ),
				),
				200
			);
		}

		$this->rtgodam_transcoder_handler->update_usage( $this->rtgodam_transcoder_handler->api_key );

		return $attachment_id;
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

		/**
		 * Fires before resolving/mutating attachment data for this
		 * transcription callback, so integrations that centralize media on
		 * another site can switch context first. The job-ID lookup itself
		 * needs this too — it's a direct $wpdb->postmeta query, just as
		 * site-scoped as get_post_meta().
		 *
		 * @since 1.8.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		try {
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
		} finally {
			do_action( 'rtgodam_after_attachment_lookup' );
		}
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
