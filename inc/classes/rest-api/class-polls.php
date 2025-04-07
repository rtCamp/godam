<?php
/**
 * Register REST API endpoints for any Assets file endpoints.
 *
 * @package transcoder
 */

namespace RTGODAM\Inc\REST_API;

/**
 * Class Polls
 */
class Polls extends Base {

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/polls',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_polls' ),
						'permission_callback' => '__return_true',
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/poll/(?P<id>\d+)',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_poll' ),
						'permission_callback' => '__return_true',
						'args'                => 
							array(
								'id' => array(
									'description'       => 'The ID of the Poll.',
									'type'              => 'integer',
									'required'          => true,
									'sanitize_callback' => 'absint',
								),
							),
					),
				),
			),
		);
	}

	/**
	 * Get all Polls.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_polls() {
		global $wpdb;
	
		if ( ! $this->is_poll_plugin_active() ) {
			return new \WP_Error( 'poll_plugin_not_active', 'Poll plugin is not active.', array( 'status' => 404 ) );
		}
	
		$cache_key   = 'polls_lists';
		$cache_group = 'godam_polls';
	
		// Try to get polls from cache.
		$polls = wp_cache_get( $cache_key, $cache_group );
	
		if ( false === $polls ) {
			// Not cached — run the query.
			$polls = $wpdb->get_results( "SELECT * FROM $wpdb->pollsq ORDER BY pollq_timestamp DESC" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- direct query is needed because custom table.
	
			// Cache the results for 10 minutes.
			wp_cache_set( $cache_key, $polls, $cache_group, 10 * MINUTE_IN_SECONDS );
		}
	
		return rest_ensure_response( $polls );
	}

	/**
	 * Get a single Poll.
	 *
	 * @param \WP_REST_Request $request The request object.
	 * @return \WP_REST_Response
	 */
	public function get_poll( $request ) {
		if ( ! $this->is_poll_plugin_active() ) {
			return new \WP_Error( 'poll_plugin_not_active', 'Poll plugin is not active.', array( 'status' => 404 ) );
		}

		$poll_id = $request->get_param( 'id' );

		if ( empty( $poll_id ) ) {
			return new \WP_Error( 'invalid_poll_id', 'Invalid poll ID.', array( 'status' => 404 ) );
		}

		$poll_html = get_poll( $poll_id, false );

		$return_object = array(
			'id'   => $poll_id,
			'html' => $poll_html,
		);

		return rest_ensure_response( $return_object );
	}

	/**
	 * Check if the Poll plugin is active.
	 *
	 * @return bool
	 */
	private function is_poll_plugin_active() {
		if ( ! function_exists( 'get_poll' ) ) {
			return false;
		}

		return true;
	}
}
