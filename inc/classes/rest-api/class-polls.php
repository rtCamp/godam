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
									'description'       => __( 'The ID of the Poll.', 'godam' ),
									'type'              => 'integer',
									'required'          => true,
									'sanitize_callback' => 'absint',
								),
							),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/poll/(?P<id>\d+)/results',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_poll_results' ),
						// Analytics read, so it is gated to users who can open the
						// analytics dashboard (authors and above, matching the menu's
						// `upload_files` capability). Vote tallies are aggregate
						// reporting data, not public page content.
						'permission_callback' => function () {
							return current_user_can( 'upload_files' );
						},
						'args'                =>
							array(
								'id' => array(
									'description'       => __( 'The ID of the Poll.', 'godam' ),
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
			return new \WP_Error( 'poll_plugin_not_active', __( 'Poll plugin is not active.', 'godam' ), array( 'status' => 404 ) );
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
			return new \WP_Error( 'poll_plugin_not_active', __( 'Poll plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$poll_id = $request->get_param( 'id' );

		if ( empty( $poll_id ) ) {
			return new \WP_Error( 'invalid_poll_id', __( 'Invalid poll ID.', 'godam' ), array( 'status' => 404 ) );
		}

		$poll_html = get_poll( $poll_id, false );

		$return_object = array(
			'id'   => $poll_id,
			'html' => $poll_html,
		);

		return rest_ensure_response( $return_object );
	}

	/**
	 * Get one poll's answer distribution, for the Poll layer analytics panel.
	 *
	 * The tallies belong to the WP Polls plugin, which stores them per poll in
	 * its own tables. They are therefore poll-wide: every vote on this poll from
	 * anywhere on the site, with no way to attribute a vote to a video or a date
	 * range. GoDAM's own `voted` analytics event records that a vote happened but
	 * not which answer was chosen, so this is the only source available. The UI
	 * states the limitation next to the chart.
	 *
	 * Answers are returned in the plugin's own display order (`polla_aid`), so
	 * the chart matches what a visitor sees in the poll itself.
	 *
	 * @since n.e.x.t
	 *
	 * @param \WP_REST_Request $request The request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_poll_results( $request ) {
		global $wpdb;

		if ( ! $this->is_poll_plugin_active() ) {
			return new \WP_Error( 'poll_plugin_not_active', __( 'Poll plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$poll_id = absint( $request->get_param( 'id' ) );

		if ( empty( $poll_id ) ) {
			return new \WP_Error( 'invalid_poll_id', __( 'Invalid poll ID.', 'godam' ), array( 'status' => 404 ) );
		}

		$cache_key   = 'poll_results_' . $poll_id;
		$cache_group = 'godam_polls';

		$results = wp_cache_get( $cache_key, $cache_group );

		if ( false === $results ) {
			// Direct query: wp-polls keeps answers in its own custom tables, so
			// there is no WP API for this. `$wpdb->pollsa` is registered by the
			// plugin; guard on it in case a future version drops the alias.
			$answers_table  = isset( $wpdb->pollsa ) ? $wpdb->pollsa : '';
			$question_table = isset( $wpdb->pollsq ) ? $wpdb->pollsq : '';

			if ( empty( $answers_table ) ) {
				return new \WP_Error( 'poll_tables_missing', __( 'Poll data is unavailable.', 'godam' ), array( 'status' => 404 ) );
			}

			$rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- direct query is needed because custom table.
				$wpdb->prepare(
					// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name comes from $wpdb, not from input.
					"SELECT polla_aid, polla_answers, polla_votes FROM {$answers_table} WHERE polla_qid = %d ORDER BY polla_aid ASC",
					$poll_id
				)
			);

			$question = '';
			if ( ! empty( $question_table ) ) {
				$question = (string) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- direct query is needed because custom table.
					$wpdb->prepare(
						// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name comes from $wpdb, not from input.
						"SELECT pollq_question FROM {$question_table} WHERE pollq_id = %d",
						$poll_id
					)
				);
			}

			$shaped = self::shape_poll_answers( $rows );

			$results = array(
				'id'          => $poll_id,
				'question'    => wp_strip_all_tags( $question ),
				'answers'     => $shaped['answers'],
				'total_votes' => $shaped['total_votes'],
			);

			wp_cache_set( $cache_key, $results, $cache_group, 5 * MINUTE_IN_SECONDS );
		}

		return rest_ensure_response( $results );
	}

	/**
	 * Shape raw wp-polls answer rows into the API's answer list plus a total.
	 *
	 * Split out from the route so the tallying is unit-testable without a
	 * WordPress install. Every field is coerced rather than trusted: wp-polls
	 * stores answers as the poll author entered them, including any markup, and
	 * a third-party table can hold anything at all.
	 *
	 * Rows with no usable answer text are dropped, since a nameless bar is not
	 * renderable, but their votes still count toward the total so the caption
	 * does not under-report the poll.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $rows Rows from the wp-polls answers table.
	 * @return array{answers:array,total_votes:int} Shaped answers and their total.
	 */
	public static function shape_poll_answers( $rows ) {
		$answers     = array();
		$total_votes = 0;

		foreach ( (array) $rows as $row ) {
			$row = is_array( $row ) ? (object) $row : $row;
			if ( ! is_object( $row ) ) {
				continue;
			}

			$votes        = isset( $row->polla_votes ) ? absint( $row->polla_votes ) : 0;
			$total_votes += $votes;

			$answer = isset( $row->polla_answers ) ? wp_strip_all_tags( (string) $row->polla_answers ) : '';
			if ( '' === $answer ) {
				continue;
			}

			$answers[] = array(
				'id'     => isset( $row->polla_aid ) ? absint( $row->polla_aid ) : 0,
				'answer' => $answer,
				'votes'  => $votes,
			);
		}

		return array(
			'answers'     => $answers,
			'total_votes' => $total_votes,
		);
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
