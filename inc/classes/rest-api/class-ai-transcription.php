<?php
/**
 * REST API class for AI Transcription.
 * 
 * This class handles the REST API endpoints for AI-based transcription of video attachments.
 * 
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class AI_Transcription
 * 
 * @since n.e.x.t
 * 
 * @package GoDAM
 */
class AI_Transcription extends Base {

	/**
	 * REST route base.
	 * 
	 * @since  n.e.x.t
	 * @access protected
	 * @var    string    $rest_base The REST api base.
	 */
	protected $rest_base = 'ai-transcription';

	/**
	 * Register custom REST API.
	 * 
	 * @since  n.e.x.t
	 *
	 * @return array Array of registered REST API routes
	 */
	public function get_rest_routes(): array {
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
							'type'              => 'integer',
							'minimum'           => 1,
							'sanitize_callback' => 'absint',
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
							'type'              => 'integer',
							'minimum'           => 1,
							'sanitize_callback' => 'absint',
						),
					),
				),
			),
		);
	}

	/**
	 * Get transcription for an attachment.
	 * 
	 * @since  n.e.x.t
	 *
	 * @param \WP_REST_Request $request REST request object.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_transcription( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$attachment_id = absint( $request->get_param( 'attachment_id' ) );

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
					'transcription_status' => __( 'Transcribed', 'godam' ),
				)
			);
		}

		return rest_ensure_response(
			array(
				'success'              => false,
				'transcription_status' => __( 'Not Available', 'godam' ),
			)
		);
	}

	/**
	 * Process transcription for an attachment.
	 * 
	 * @since  n.e.x.t
	 *
	 * @param \WP_REST_Request $request REST request object.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function process_transcription( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
		$attachment_id = absint( $request->get_param( 'attachment_id' ) );

		// Get API key.
		$api_key = get_option( 'rtgodam-api-key', '' );

		if ( empty( $api_key ) ) {
			return new \WP_Error(
				'no_api_key',
				__( 'GoDAM API key is not configured.', 'godam' ),
				array( 'status' => 401 )
			);
		}

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

		// Call Process Transcription API.
		$rest_url = RTGODAM_API_BASE . '/api/method/godam_core.api.process.process_transcription';

		$request_body = array(
			'job_name' => sanitize_text_field( $job_id ),
			'api_key'  => $api_key,
		);

		// Increased timeout to 300 seconds since the backend process API is a blocking one. This is a temporary solution and eventually
		// once the backednd API is updated this logic will get updated as well.
		$args = array(
			'method'  => 'POST',
			'timeout' => 300, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
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

		// Handle non-200 response codes.
		if ( 200 !== $response_code ) {
			return new \WP_Error(
				'api_error',
				sprintf(
					/* translators: %d: HTTP response code */
					__( 'GoDAM API returned error code: %d', 'godam' ),
					$response_code
				),
				array( 'status' => 500 )
			);
		}
		
		// Validate response structure.
		if ( ! is_array( $data ) || ! isset( $data['message'] ) || ! is_array( $data['message'] ) ) {
			return new \WP_Error(
				'invalid_response',
				__( 'Invalid response structure from GoDAM API.', 'godam' ),
				array( 'status' => 500 )
			);
		}
		
		// Check for success flag.
		if ( empty( $data['message']['success'] ) ) {
			$error_message = $data['message']['error'] ?? __( 'Unknown error occurred.', 'godam' );

			// Try to parse server messages for more specific errors.
			if ( empty( $data['_server_messages'] ) ) {
				return new \WP_Error(
					'transcription_failed',
					$error_message,
					array( 'status' => 400 )
				);
			}

			$server_messages = json_decode( $data['_server_messages'], true );
			
			// Bail early if JSON decode failed or invalid structure.
			if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $server_messages ) || empty( $server_messages[0] ) ) {
				return new \WP_Error(
					'transcription_failed',
					$error_message,
					array( 'status' => 400 )
				);
			}

			$first_message = json_decode( $server_messages[0], true );
			
			// Bail early if second JSON decode failed or invalid structure.
			if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $first_message ) || ! isset( $first_message['message'] ) ) {
				return new \WP_Error(
					'transcription_failed',
					$error_message,
					array( 'status' => 400 )
				);
			}

			// Use the more specific error message from server.
			return new \WP_Error(
				'transcription_failed',
				$first_message['message'],
				array( 'status' => 400 )
			);
		}

		// Save transcription data to post meta.
		$transcript_path      = $data['message']['transcript_path'] ?? '';
		$transcription_status = $data['message']['status'] ?? __( 'Transcribed', 'godam' );

		if ( ! $this->is_valid_transcript_url( $transcript_path ) ) {
			return new \WP_Error(
				'invalid_transcript_url',
				__( 'Invalid transcript URL received from API.', 'godam' ),
				array( 'status' => 500 )
			);
		}

		update_post_meta(
			$attachment_id,
			'rtgodam_transcript_path',
			esc_url_raw( $transcript_path )
		);

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
	 * @since  n.e.x.t
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return bool True if valid video attachment, false otherwise.
	 */
	private function is_valid_video_attachment( int $attachment_id ): bool {
		$attachment = get_post( $attachment_id );

		if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
			return false;
		}

		$mime_type = get_post_mime_type( $attachment_id );

		if ( ! is_string( $mime_type ) ) {
			return false;
		}

		return str_starts_with( $mime_type, 'video/' );
	}

	/**
	 * Validate transcript URL.
	 * 
	 * @since  n.e.x.t
	 *
	 * @param string $url Transcript URL.
	 *
	 * @return bool True if valid, false otherwise.
	 */
	private function is_valid_transcript_url( string $url ): bool {
		if ( empty( $url ) || ! is_string( $url ) ) {
			return false;
		}

		// Parse URL to get path component.
		$parsed_url = wp_parse_url( $url );
		
		if ( false === $parsed_url || empty( $parsed_url['path'] ) ) {
			return false;
		}

		// Check if path ends with .vtt (case-insensitive).
		return str_ends_with( strtolower( $parsed_url['path'] ), '.vtt' );
	}

	/**
	 * Permission callback to verify user can edit attachments.
	 * 
	 * @since  n.e.x.t
	 *
	 * @param \WP_REST_Request $request REST request object.
	 *
	 * @return bool|\WP_Error True if user has permission, error otherwise.
	 */
	public function verify_permission( \WP_REST_Request $request ): bool|\WP_Error {
		$attachment_id = absint( $request->get_param( 'attachment_id' ) );

		if ( empty( $attachment_id ) || ! is_numeric( $attachment_id ) ) {
			return new \WP_Error(
				'invalid_attachment_id',
				__( 'Invalid attachment ID.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		// Check if user can edit this attachment.
		if ( ! current_user_can( 'edit_post', $attachment_id ) ) {
			return new \WP_Error(
				'forbidden',
				__( 'You do not have permission to edit this attachment.', 'godam' ),
				array( 'status' => 403 )
			);
		}

		return true;
	}
}
