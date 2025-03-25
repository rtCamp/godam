<?php
/**
 * REST API class for Transcoding Pages.
 *
 * @package transcoder
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class Transcoding
 */
class Transcoding extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'transcoding';

	/**
	 * Register custom REST API.
	 *
	 * @return array Array of registered REST API routes
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/transcoding-status',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'update_transcoding_status' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'job_id'     => array(
							'required'          => true,
							'type'              => 'string',
							'description'       => 'The jobID of transcoding job.',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'status'     => array(
							'required'          => true,
							'type'              => 'string',
							'description'       => 'The status of the transcoding job.',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'progress'   => array(
							'required'          => false,
							'type'              => 'integer',
							'description'       => 'The progress of the transcoding job.',
							'sanitize_callback' => 'absint',
						),
						'error_msg'  => array(
							'required'          => false,
							'type'              => 'string',
							'description'       => 'The error message of the transcoding job.',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'error_code' => array(
							'required'          => false,
							'type'              => 'string',
							'description'       => 'The error code of the transcoding job.',
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/transcoding-status/',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_transcoding_status' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'ids' => array(
							'required'          => true,
							'type'              => 'array',
							'description'       => 'The array of attachment IDs.',
							'validate_callback' => function ( $param ) {
								return is_array( $param );
							},
						),
					),
				),
			),
		);
	}

	/**
	 * Update transcoding status of a media.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 */
	public function update_transcoding_status( \WP_REST_Request $request ) {

		$job_id     = $request->get_param( 'job_id' );
		$status     = $request->get_param( 'status' );
		$progress   = $request->get_param( 'progress' );
		$error_msg  = $request->get_param( 'error_msg' );
		$error_code = $request->get_param( 'error_code' );

		$attachment_id = $this->get_post_id_by_meta_key_and_value( 'rtgodam_transcoding_job_id', $job_id );

		if ( ! $attachment_id ) {
			wp_send_json_error(
				array(
					'message' => 'Attachment not found.',
				)
			);
		}

		if ( ! empty( $error_msg ) || ! empty( $error_code ) ) {
			
			update_post_meta( $attachment_id, 'rtgodam_transcoding_error_msg', $error_msg );
			update_post_meta( $attachment_id, 'rtgodam_transcoding_error_code', $error_code );

			$progress = 0;
		}

		update_post_meta( $attachment_id, 'rtgodam_transcoding_status', $status );
		update_post_meta( $attachment_id, 'rtgodam_transcoding_progress', $progress );

		wp_send_json_success(
			array(
				'message' => 'Transcoding status updated successfully.',
			)
		);
	}

	/**
	 * Return transcoding status of a media.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_transcoding_status( \WP_REST_Request $request ) {
		
		$attachment_ids = $request->get_param( 'ids' );

		$response_object = array();

		foreach ( $attachment_ids as $attachment_id ) {
			$status_object                     = $this->get_status_object_from_attachment( $attachment_id );
			$response_object[ $attachment_id ] = $status_object;
		}

		return rest_ensure_response( $response_object );
	}

	/**
	 * Get transcoding status of an attachment.
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return string
	 */
	private function get_status_object_from_attachment( int $attachment_id ) {

		// Check if video has a transcoding job ID.
		$job_id = sanitize_text_field( get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true ) );

		if ( empty( $job_id ) ) {
			return array(
				'status' => 'not_transcoding',
				'message' => __( 'Video has not been transcoded.', 'godam' ),
			);
		}

		// Get and sanitize the transcoding status.
		$status = sanitize_text_field( get_post_meta( $attachment_id, 'rtgodam_transcoding_status', true ) );

		if ( empty( $status ) ) {
			return array(
				'status' => 'not_started',
				'message' => __( 'Transcoding has not started.', 'godam' ),
			);
		}

		// Handle failure case with error details.
		if ( 'Failed' === $status ) {
			$error_code = sanitize_text_field( get_post_meta( $attachment_id, 'rtgodam_transcoding_error_code', true ) );
			$error_msg  = sanitize_textarea_field( get_post_meta( $attachment_id, 'rtgodam_transcoding_error_msg', true ) );

			return array(
				'status'     => 'failed',
				'error_code' => $error_code,
				'error_msg'  => $error_msg,
			);
		}

		// Get and sanitize transcoding progress.
		$progress = intval( get_post_meta( $attachment_id, 'rtgodam_transcoding_progress', true ) );

		// Define status messages.
		$status_messages = array(
			'Queued'      => __( 'Video is queued for transcoding.', 'godam' ),
			'Downloading' => __( 'Video is downloading for transcoding.', 'godam' ),
			'Downloaded'  => __( 'Video is downloaded for transcoding.', 'godam' ),
			'Transcoding' => __( 'Video is transcoding.', 'godam' ),
			'Transcoded'  => __( 'Video is transcoded.', 'godam' ),
		);

		// Set default message for unknown status.
		$message = isset( $status_messages[ $status ] ) ? $status_messages[ $status ] : __( 'Unknown transcoding status.', 'godam' );

		return array(
			'status'   => strtolower( $status ),
			'progress' => $progress,
			'message'  => $message,
		);
	}

	/**
	 * Get post id from meta key and value.
	 * 
	 * Taken the function from the rt-transcoder-handler.php file.
	 *
	 * @param string $key   Meta key.
	 * @param mixed  $value Meta value.
	 *
	 * @return int|bool     Return post id if found else false.
	 */
	private function get_post_id_by_meta_key_and_value( $key, $value ) {
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
