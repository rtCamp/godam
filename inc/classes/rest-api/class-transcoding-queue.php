<?php
/**
 * REST endpoints for background retranscoding queue.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class Transcoding_Queue
 */
class Transcoding_Queue extends Base {

	/**
	 * Register the REST routes handled by this controller.
	 *
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/transcoding/retranscode-queue',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'start_queue' ),
					'permission_callback' => array( $this, 'can_manage_media' ),
					'args'                => array(
						'ids' => array(
							'required'          => true,
							'type'              => 'array',
							'description'       => __( 'Array of attachment IDs to retranscode.', 'godam' ),
							'validate_callback' => function ( $param ) {
								return is_array( $param );
							},
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/transcoding/retranscode-queue/status',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_status' ),
					'permission_callback' => array( $this, 'can_manage_media' ),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/transcoding/retranscode-queue/abort',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'abort_queue' ),
					'permission_callback' => array( $this, 'can_manage_media' ),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/transcoding/retranscode-queue/reset',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'reset_queue' ),
					'permission_callback' => array( $this, 'can_manage_media' ),
				),
			),
		);
	}

	/**
	 * Permission check. Reuse the same capability used elsewhere in the plugin.
	 *
	 * @since n.e.x.t
	 */
	public function can_manage_media() {
		return current_user_can( 'edit_others_posts' );
	}

	/**
	 * Start a new retranscoding queue.
	 *
	 * This endpoint accepts an array of attachment IDs to be retranscoded.
	 *
	 * @since n.e.x.t
	 *
	 * @param \WP_REST_Request $request The REST request.
	 * @return \WP_REST_Response
	 */
	public function start_queue( \WP_REST_Request $request ) {

		$ids = $request->get_param( 'ids' );

		if ( empty( $ids ) || ! is_array( $ids ) ) {
			return new \WP_REST_Response(
				array( 'message' => __( 'No attachment IDs provided.', 'godam' ) ),
				400
			);
		}

		$ids = array_values( array_unique( array_map( 'absint', $ids ) ) );

		// Check existing state to avoid duplicate/chaotic starts from other tabs/devices.
		$current        = get_option( 'rtgodam_retranscode_progress', array( 'status' => 'idle' ) );
		$current_status = isset( $current['status'] ) ? $current['status'] : 'idle';

		// If a run is already in progress OR a previous run finished/aborted but not reset, block and instruct client.
		if ( in_array( $current_status, array( 'running', 'done', 'aborted' ), true ) ) {
			$message = __( 'A retranscoding session is already in progress or has finished but has not been reset. Please use the Reset action before starting a new session.', 'godam' );
			if ( 'running' === $current_status ) {
				$message = __( 'Retranscoding is already running. This request did not start a new session. The UI should display current progress.', 'godam' );
			}
			$response = array(
				'message'   => $message,
				'status'    => $current_status,
				'total'     => isset( $current['total'] ) ? (int) $current['total'] : 0,
				'processed' => isset( $current['processed'] ) ? (int) $current['processed'] : 0,
				'success'   => isset( $current['success'] ) ? (int) $current['success'] : 0,
				'failure'   => isset( $current['failure'] ) ? (int) $current['failure'] : 0,
				'logs'      => isset( $current['logs'] ) && is_array( $current['logs'] ) ? $current['logs'] : array(),
			);
			return new \WP_REST_Response( $response, 409 );
		}

		update_option( 'rtgodam_retranscode_queue', $ids );

		$progress = array(
			'total'      => count( $ids ),
			'processed'  => 0,
			'success'    => 0,
			'failure'    => 0,
			'logs'       => array(),
			'status'     => 'running',
			'started_at' => time(),
		);

		update_option( 'rtgodam_retranscode_progress', $progress );

		return new \WP_REST_Response( $progress, 200 );
	}

	/**
	 * Return the current queue progress.
	 *
	 * @since n.e.x.t
	 *
	 * @return \WP_REST_Response
	 */
	public function get_status() {
		$progress = get_option( 'rtgodam_retranscode_progress', array( 'status' => 'idle' ) );
		return new \WP_REST_Response( $progress, 200 );
	}

	/**
	 * Abort the retranscoding queue.
	 *
	 * @since n.e.x.t
	 *
	 * @return \WP_REST_Response
	 */
	public function abort_queue() {
		$progress           = get_option( 'rtgodam_retranscode_progress', array() );
		$progress['status'] = 'aborted';

		update_option( 'rtgodam_retranscode_queue', array() );
		update_option( 'rtgodam_retranscode_progress', $progress );

		return new \WP_REST_Response( $progress, 200 );
	}

	/**
	 * Completely reset the retranscoding queue and progress to a pristine state.
	 *
	 * @since n.e.x.t
	 *
	 * @return \WP_REST_Response
	 */
	public function reset_queue() {
		// Clear queue and set progress to idle.
		update_option( 'rtgodam_retranscode_queue', array() );
		update_option( 'rtgodam_retranscode_progress', array( 'status' => 'idle' ) );

		return new \WP_REST_Response( array( 'status' => 'idle' ), 200 );
	}
} 
