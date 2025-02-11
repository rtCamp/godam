<?php
/**
 * REST API class for Transcoding Pages.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\REST_API;

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
				'route'     => '/' . $this->rest_base . '/transcoding-status/(?P<id>\d+)',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_transcoding_status' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'id' => array(
							'required'          => true,
							'type'              => 'integer',
							'description'       => 'The ID of the transcoding job.',
							'validate_callback' => function ( $param ) {
								return is_numeric( $param ) && $param > 0;
							},
							'sanitize_callback' => 'absint',
						),
					),
				),
			),
		);
	}

	/**
	 * Return transcoding status of a media.
	 *
	 * @since 1.2
	 *
	 * @param \WP_REST_Request $request REST request object.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_transcoding_status( \WP_REST_Request $request ) {
		$post_id = (int) $request['id'];

		if ( empty( $post_id ) ) {
			return new \WP_Error(
				'invalid_post_id',
				__( 'Something went wrong. Please try again!', 'godam' ),
				array( 'status' => 400 )
			);
		}

		$job_id = get_post_meta( $post_id, '_rt_transcoding_job_id', true );

		if ( empty( $job_id ) ) {
			return new \WP_Error(
				'invalid job id',
				__( 'Invalid job id', 'godam' ),
				array( 'status' => 400 )
			);
		}

		$license = get_option( 'rt-transcoding-api-key' );

		if ( empty( $license ) ) {
			return new \WP_Error(
				'invalid_license',
				__( 'Invalid license key', 'godam' ),
				array( 'status' => 400 )
			);
		}

		$status_url = add_query_arg(
			array(
				'job_id'  => $job_id,
				'license' => $license,
			),
			GODAM_API_BASE . '/api/method/frappe_transcoder.frappe_transcoder.api.transcoding_progress.get_transcoding_status'
		);

		if ( function_exists( 'vip_safe_wp_remote_get' ) ) {
			$status_page = vip_safe_wp_remote_get( $status_url, '', 3, 3 );
		} else {
			$status_page = wp_safe_remote_get( $status_url, array( 'timeout' => 120 ) ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.wp_remote_get_wp_remote_get, WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
		}

		if ( ! is_wp_error( $status_page ) ) {
			$status_info = json_decode( $status_page['body'] );
		} else {
			$status_info = null;
		}

		$messages = array(
			'null-response' => __( 'Looks like the server is taking too long to respond, Please try again in sometime.', 'godam' ),
			'failed'        => __( 'Unfortunately, Transcoder failed to transcode this file.', 'godam' ),
			'downloading'   => __( 'Your file is getting transcoded. Please refresh after some time.', 'godam' ),
			'downloaded'    => __( 'Your file is downloaded successfully. Please refresh the page.', 'godam' ),
			'transcoding'   => __( 'Your file is getting transcoded. Please refresh after some time.', 'godam' ),
			'transcoded'    => __( 'Your file is transcoded successfully. Please refresh the page.', 'godam' ),
		);

		/**
		 * Filters the transcoding process status messages.
		 *
		 * @since 1.2
		 *
		 * @param array $messages Default transcoding process status messages.
		 */
		$messages = apply_filters( 'rtt_transcoder_status_message', $messages );

		$message  = '';
		$response = array();
		$status   = 'running';
		$progress = 0;

		if ( empty( $status_info ) || ! is_object( $status_info ) || empty( $status_info->message ) ) {
			$response['message']  = esc_html( $messages['null-response'] );
			$response['status']   = 'null-response';
			$response['progress'] = $progress;
	
			return rest_ensure_response( $response );
		}

		$status_info = $status_info->message;

		if ( ! empty( $status_info->error ) || ! empty( $status_info->error_msg ) ) {
			$response['message']  = esc_html( $messages['failed'] );
			$response['status']   = 'failed';
			$response['progress'] = $progress;
	
			return rest_ensure_response( $response );
		}

		$message  = ! empty( $messages[ strtolower( $status_info->status ) ] ) ? $messages[ strtolower( $status_info->status ) ] : '';
		$progress = ! empty( $status_info->progress ) ? floatval( $status_info->progress ) : 0;
		$status   = ! empty( $status_info->status ) ? strtolower( $status_info->status ) : 'running';

		$response['message']  = esc_html( $message );
		$response['status']   = esc_html( $status );
		$response['progress'] = $progress;

		return rest_ensure_response( $response );
	}
}
