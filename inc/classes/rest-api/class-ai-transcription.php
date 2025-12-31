<?php
/**
 * REST API class for AI Transcription.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class AI_Transcription
 */
class AI_Transcription extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'ai-transcription';

	/**
	 * Register custom REST API.
	 *
	 * @return array Array of registered REST API routes
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/get',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_transcription' ),
					'permission_callback' => array( $this, 'verify_permission' ),
					'args'                => array(
						'attachment_id' => array(
							'required'          => true,
							'validate_callback' => function ( $param ) {
								return is_numeric( $param );
							},
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/process',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'process_transcription' ),
					'permission_callback' => array( $this, 'verify_permission' ),
					'args'                => array(
						'attachment_id' => array(
							'required'          => true,
							'validate_callback' => function ( $param ) {
								return is_numeric( $param );
							},
						),
					),
				),
			),
		);
	}

	/**
	 * Get transcription for an attachment.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_transcription( \WP_REST_Request $request ) {
		$attachment_id = $request->get_param( 'attachment_id' );

		// Check if attachment exists and is a video.
		if ( ! $this->is_valid_video_attachment( $attachment_id ) ) {
			return new \WP_Error(
				'invalid_attachment',
				__( 'Invalid video attachment.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		// Use existing helper function to get transcript path.
		$transcript_path = godam_get_transcript_path( $attachment_id );

		if ( ! empty( $transcript_path ) ) {
			return rest_ensure_response(
				array(
					'success'              => true,
					'transcript_path'      => $transcript_path,
					'transcription_status' => 'Transcribed',
				)
			);
		}

		return rest_ensure_response(
			array(
				'success'              => false,
				'transcription_status' => 'Not Available',
			)
		);
	}

	/**
	 * Process transcription for an attachment.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function process_transcription( \WP_REST_Request $request ) {
		$attachment_id = $request->get_param( 'attachment_id' );

		// Check if attachment exists and is a video.
		if ( ! $this->is_valid_video_attachment( $attachment_id ) ) {
			return new \WP_Error(
				'invalid_attachment',
				__( 'Invalid video attachment.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		// Get job ID using the same logic as godam_get_transcript_path().
		$job_id = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );

		if ( empty( $job_id ) ) {
			$job_id = get_post_meta( $attachment_id, '_godam_original_id', true );
		}

		if ( empty( $job_id ) ) {
			return new \WP_Error(
				'no_job_id',
				__( 'No transcoding job ID found for this video.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		// Get API key.
		$api_key = get_option( 'rtgodam-api-key', '' );

		if ( empty( $api_key ) ) {
			return new \WP_Error(
				'no_api_key',
				__( 'GoDAM API key is not configured.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		// Call Process Transcription API.
		$rest_url = RTGODAM_API_BASE . '/api/method/godam_core.api.process.process_transcription';

		$request_body = array(
			'job_name' => sanitize_text_field( $job_id ),
			'api_key'  => sanitize_text_field( $api_key ),
		);

		$args = array(
			'method'  => 'POST',
			'timeout' => 60, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
			'headers' => array(
				'Content-Type' => 'application/json',
			),
			'body'    => wp_json_encode( $request_body ),
		);

		$response = wp_remote_post( $rest_url, $args );

		if ( is_wp_error( $response ) ) {
			return new \WP_Error(
				'api_error',
				sprintf(
					/* translators: %s: Error message */
					__( 'Failed to connect to GoDAM API: %s', 'godam' ),
					$response->get_error_message()
				),
				array( 'status' => 500 )
			);
		}

		$response_code = wp_remote_retrieve_response_code( $response );
		$body          = wp_remote_retrieve_body( $response );
		$data          = json_decode( $body, true );

		// Handle API errors.
		if ( 200 !== $response_code || empty( $data['message']['success'] ) ) {
			$error_message = $data['message']['error'] ?? __( 'Unknown error occurred.', 'godam' );

			// Parse server messages for more specific errors.
			if ( ! empty( $data['_server_messages'] ) ) {
				$server_messages = json_decode( $data['_server_messages'], true );
				if ( is_array( $server_messages ) && ! empty( $server_messages[0] ) ) {
					$first_message = json_decode( $server_messages[0], true );
					if ( isset( $first_message['message'] ) ) {
						$error_message = $first_message['message'];
					}
				}
			}

			return new \WP_Error(
				'transcription_failed',
				$error_message,
				array( 'status' => 400 )
			);
		}

		// Save transcription data to post meta.
		$transcript_path      = $data['message']['transcript_path'] ?? '';
		$transcription_status = $data['message']['status'] ?? 'Transcribed';

		if ( ! empty( $transcript_path ) ) {
			update_post_meta( $attachment_id, 'rtgodam_transcript_path', esc_url_raw( $transcript_path ) );
			update_post_meta( $attachment_id, 'rtgodam_transcription_status_ai', sanitize_text_field( $transcription_status ) );
		}

		return rest_ensure_response(
			array(
				'success'              => true,
				'transcript_path'      => $transcript_path,
				'transcription_status' => $transcription_status,
			)
		);
	}

	/**
	 * Check if attachment is a valid video.
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return bool
	 */
	private function is_valid_video_attachment( $attachment_id ) {
		$attachment = get_post( $attachment_id );

		if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
			return false;
		}

		$mime_type = get_post_mime_type( $attachment_id );

		return 'video' === substr( $mime_type, 0, 5 );
	}

	/**
	 * Permission callback to verify user can edit attachments.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 *
	 * @return bool
	 */
	public function verify_permission( $request ) {
		$attachment_id = $request->get_param( 'attachment_id' );

		// Check if user can edit this attachment.
		if ( ! current_user_can( 'edit_post', $attachment_id ) ) {
			return false;
		}

		return true;
	}
}
