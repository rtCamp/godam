<?php
/**
 * REST API class for the AI transcript feature in the video editor.
 *
 * Provides same-origin proxies the React editor can call (with a WP nonce) so
 * the GoDAM SaaS licence key never reaches the browser. The transcript itself
 * is stored on the attachment as the `rtgodam_transcript_path` meta.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class Transcription
 */
class Transcription extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'transcription';

	/**
	 * Meta key holding the last known SaaS transcription status, used so the
	 * editor can poll between "Transcribing" and "Transcribed".
	 *
	 * @var string
	 */
	const STATUS_META = 'rtgodam_transcript_status';

	/**
	 * Meta flag set when the user deletes the transcript. While set, the GET
	 * endpoint will NOT auto-resurrect the transcript from the SaaS (otherwise
	 * `godam_get_transcript_path()` re-caches it and the delete is undone). It
	 * is cleared on generate / upload so a fresh transcript can replace it.
	 *
	 * @var string
	 */
	const DELETED_META = 'rtgodam_transcript_deleted';

	/**
	 * Register custom REST API.
	 *
	 * @return array Array of registered REST API routes.
	 */
	public function get_rest_routes() {
		$attachment_arg = array(
			'attachment_id' => array(
				'required'          => true,
				'type'              => 'integer',
				'description'       => __( 'The video attachment ID.', 'godam' ),
				'sanitize_callback' => 'absint',
			),
		);

		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base,
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_transcription' ),
						'permission_callback' => array( $this, 'edit_permission' ),
						'args'                => $attachment_arg,
					),
					array(
						'methods'             => \WP_REST_Server::DELETABLE,
						'callback'            => array( $this, 'delete_transcription' ),
						'permission_callback' => array( $this, 'edit_permission' ),
						'args'                => $attachment_arg,
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/generate',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'generate_transcription' ),
					'permission_callback' => array( $this, 'edit_permission' ),
					'args'                => $attachment_arg,
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/upload',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'upload_transcription' ),
					'permission_callback' => array( $this, 'edit_permission' ),
					'args'                => array_merge(
						$attachment_arg,
						array(
							'url' => array(
								'required'          => true,
								'type'              => 'string',
								'description'       => __( 'URL of the uploaded .vtt / .srt caption file.', 'godam' ),
								'sanitize_callback' => 'esc_url_raw',
							),
						)
					),
				),
			),
		);
	}

	/**
	 * Permission: the caller must be able to edit the target attachment.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return bool Whether the request is allowed.
	 */
	public function edit_permission( \WP_REST_Request $request ) {
		$attachment_id = absint( $request->get_param( 'attachment_id' ) );
		if ( empty( $attachment_id ) ) {
			return current_user_can( 'upload_files' );
		}

		/**
		 * Fires before this attachment-specific capability check, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 1.8.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$can_edit = current_user_can( 'edit_post', $attachment_id );
		do_action( 'rtgodam_after_attachment_lookup' );

		return $can_edit;
	}

	/**
	 * Return the current transcript path + status for an attachment.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return \WP_REST_Response
	 */
	public function get_transcription( \WP_REST_Request $request ) {
		$attachment_id = absint( $request->get_param( 'attachment_id' ) );

		/**
		 * Fires before reading this attachment's transcript meta, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 1.8.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );

		// Locally-stored transcript takes precedence.
		$path = get_post_meta( $attachment_id, 'rtgodam_transcript_path', true );

		// Auto-discover from the SaaS only when the user has NOT deleted the
		// transcript. Otherwise `godam_get_transcript_path()` would re-cache it
		// and silently undo the delete.
		if ( empty( $path ) && ! get_post_meta( $attachment_id, self::DELETED_META, true ) ) {
			$path = godam_get_transcript_path( $attachment_id );
		}

		$status = $path ? 'Transcribed' : (string) get_post_meta( $attachment_id, self::STATUS_META, true );

		do_action( 'rtgodam_after_attachment_lookup' );

		return rest_ensure_response( $this->shape( $path, $status ) );
	}

	/**
	 * Start (or re-run) AI transcription via the SaaS `process_transcription`
	 * endpoint.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function generate_transcription( \WP_REST_Request $request ) {
		$attachment_id = absint( $request->get_param( 'attachment_id' ) );

		/**
		 * Fires before reading this attachment's job-ID meta, so integrations
		 * that centralize media on another site can switch context first.
		 * Closed immediately after (not held open across the SaaS HTTP call
		 * below) — see the second, separate pair around the meta writes
		 * further down.
		 *
		 * @since 1.8.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$job_id = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
		if ( empty( $job_id ) ) {
			$job_id = get_post_meta( $attachment_id, '_godam_original_id', true );
		}
		do_action( 'rtgodam_after_attachment_lookup' );

		if ( empty( $job_id ) ) {
			return new \WP_Error(
				'rtgodam_no_job',
				__( 'This video has not been transcoded yet, so it cannot be transcribed.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		$api_key = get_option( 'rtgodam-api-key', '' );
		if ( empty( $api_key ) ) {
			return new \WP_Error(
				'rtgodam_no_api_key',
				__( 'Connect your GoDAM account to generate transcriptions.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		$response = wp_remote_post(
			RTGODAM_API_BASE . '/api/method/godam_core.api.process.process_transcription',
			array(
				'timeout' => 15, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
				'body'    => array(
					'job_name' => sanitize_text_field( $job_id ),
					'api_key'  => sanitize_text_field( $api_key ),
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return new \WP_Error(
				'rtgodam_request_failed',
				__( 'Could not reach the transcription service. Please try again.', 'godam' ),
				array( 'status' => 502 )
			);
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		// Frappe wraps `@frappe.whitelist` method results in a `message` key.
		$payload = ( is_array( $data ) && isset( $data['message'] ) ) ? $data['message'] : $data;
		$payload = is_array( $payload ) ? $payload : array();

		$path           = isset( $payload['transcript_path'] ) ? esc_url_raw( $payload['transcript_path'] ) : '';
		$status         = isset( $payload['status'] ) ? sanitize_text_field( $payload['status'] ) : '';
		$current_status = isset( $payload['current_status'] ) ? sanitize_text_field( $payload['current_status'] ) : '';

		/**
		 * Fires before writing this attachment's transcript/status meta, so
		 * integrations that centralize media on another site can switch
		 * context first — a second, separate pair from the one above, so
		 * the switch isn't held open across the SaaS HTTP call in between.
		 *
		 * @since 1.8.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		if ( ! empty( $path ) ) {
			// A (re)generated transcript supersedes any prior delete.
			delete_post_meta( $attachment_id, self::DELETED_META );
			update_post_meta( $attachment_id, 'rtgodam_transcript_path', $path );
			update_post_meta( $attachment_id, self::STATUS_META, 'Transcribed' );
		} elseif ( '' !== $current_status || '' !== $status ) {
			// A job is genuinely in progress — clear the delete marker and
			// remember the in-flight status so the editor keeps polling. On a
			// hard error we leave the delete marker intact.
			delete_post_meta( $attachment_id, self::DELETED_META );
			$track = $current_status ? $current_status : $status;
			update_post_meta( $attachment_id, self::STATUS_META, $track );
		}
		do_action( 'rtgodam_after_attachment_lookup' );

		return rest_ensure_response(
			array(
				'success'         => ! empty( $payload['success'] ),
				'status'          => $status,
				'current_status'  => $current_status,
				'transcript_path' => $path,
				'error'           => isset( $payload['error'] ) ? sanitize_text_field( $payload['error'] ) : '',
				'message'         => isset( $payload['message'] ) ? sanitize_text_field( $payload['message'] ) : '',
			)
		);
	}

	/**
	 * Attach an uploaded caption file as the transcript.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function upload_transcription( \WP_REST_Request $request ) {
		$attachment_id = absint( $request->get_param( 'attachment_id' ) );
		$url           = esc_url_raw( $request->get_param( 'url' ) );

		$ext = strtolower( pathinfo( wp_parse_url( $url, PHP_URL_PATH ), PATHINFO_EXTENSION ) );
		if ( ! in_array( $ext, array( 'vtt', 'srt' ), true ) ) {
			return new \WP_Error(
				'rtgodam_bad_file',
				__( 'Only .vtt or .srt caption files are supported.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		/**
		 * Fires before writing this attachment's transcript meta, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 1.8.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		// An uploaded transcript supersedes any prior delete.
		delete_post_meta( $attachment_id, self::DELETED_META );
		update_post_meta( $attachment_id, 'rtgodam_transcript_path', $url );
		update_post_meta( $attachment_id, self::STATUS_META, 'Transcribed' );
		do_action( 'rtgodam_after_attachment_lookup' );

		return rest_ensure_response( $this->shape( $url, 'Transcribed' ) );
	}

	/**
	 * Remove the transcript from an attachment.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 * @return \WP_REST_Response
	 */
	public function delete_transcription( \WP_REST_Request $request ) {
		$attachment_id = absint( $request->get_param( 'attachment_id' ) );

		/**
		 * Fires before deleting/writing this attachment's transcript meta,
		 * so integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 1.8.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		delete_post_meta( $attachment_id, 'rtgodam_transcript_path' );
		delete_post_meta( $attachment_id, self::STATUS_META );
		// Mark as deleted so GET won't auto-resurrect it from the SaaS.
		update_post_meta( $attachment_id, self::DELETED_META, '1' );
		do_action( 'rtgodam_after_attachment_lookup' );

		return rest_ensure_response( $this->shape( '', '' ) );
	}

	/**
	 * Build the response shape the editor consumes.
	 *
	 * @param string $path   Transcript URL (may be empty).
	 * @param string $status Transcription status.
	 * @return array Response body.
	 */
	private function shape( $path, $status ) {
		return array(
			'transcript_path' => $path,
			'status'          => $status,
			'file_name'       => $path ? basename( wp_parse_url( $path, PHP_URL_PATH ) ) : '',
		);
	}
}
