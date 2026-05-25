<?php
/**
 * REST API class for the GoDAM Dashboard — Reel Pops summary proxy.
 *
 * Proxies the godam-analytics `/reel-pops/summary` endpoint, injecting the
 * site's API key + account token server-side so the browser never sees them.
 * Enriches each row with the WordPress post title / thumbnail / edit URL so the
 * React table can render a click-through to the Reel Pop editor.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Class Dashboard.
 */
class Dashboard extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'dashboard';

	/**
	 * Cache TTL for the upstream response (seconds).
	 *
	 * @var int
	 */
	const CACHE_TTL = 60;

	/**
	 * Register custom REST API routes for the Dashboard.
	 *
	 * @return array Array of registered REST API routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/reel-pops-summary',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_reel_pops_summary' ),
					'permission_callback' => array( $this, 'permission_check' ),
					'args'                => array(
						'from' => array(
							'required'          => false,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'to'   => array(
							'required'          => false,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			),
		);
	}

	/**
	 * Permission check — only site admins may view the cross-Reel-Pop summary.
	 *
	 * @return bool
	 */
	public function permission_check() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Fetch the cumulative Reel Pops summary from the godam-analytics
	 * microservice and enrich each row with WP post metadata.
	 *
	 * @param WP_REST_Request $request REST API request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_reel_pops_summary( WP_REST_Request $request ) {
		$endpoint      = defined( 'RTGODAM_ANALYTICS_BASE' ) ? RTGODAM_ANALYTICS_BASE : 'https://analytics.godam.io';
		$api_key       = get_option( 'rtgodam-api-key', '' );
		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		$site_url      = home_url();
		$from          = $request->get_param( 'from' );
		$to            = $request->get_param( 'to' );

		if ( empty( $api_key ) || empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_Error(
				'godam_unconfigured',
				__( 'GoDAM API key not configured.', 'godam' ),
				array( 'status' => 500 )
			);
		}

		$cache_key = 'godam_rp_dashboard_summary_' . md5( $account_token . '|' . (string) $from . '|' . (string) $to );
		$cached    = get_transient( $cache_key );
		if ( false !== $cached ) {
			return rest_ensure_response( $cached );
		}

		$query_args = array_filter(
			array(
				'account_token' => $account_token,
				'site_url'      => $site_url,
				'from'          => $from,
				'to'            => $to,
			)
		);

		$url = add_query_arg(
			$query_args,
			trailingslashit( $endpoint ) . 'reel-pops/summary'
		);

		$response = wp_remote_get(
			$url,
			array(
				'headers' => array( 'X-API-Key' => $api_key ),
				'timeout' => 5,
			)
		);

		if ( is_wp_error( $response ) ) {
			return new WP_Error(
				'godam_upstream',
				$response->get_error_message(),
				array( 'status' => 502 )
			);
		}

		$status = wp_remote_retrieve_response_code( $response );
		$body   = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $status >= 400 || ! is_array( $body ) ) {
			return new WP_Error(
				'godam_upstream',
				__( 'Failed to fetch Reel Pops summary.', 'godam' ),
				array( 'status' => 502 )
			);
		}

		// Enrich each row with WP post title / thumbnail / edit URL so the React
		// table can render a click-through. Drop rows whose post no longer exists
		// or isn't published — ghost rows would just confuse the admin.
		$enriched = array();
		$rows     = isset( $body['reel_pops'] ) && is_array( $body['reel_pops'] ) ? $body['reel_pops'] : array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$reel_pop_id = isset( $row['reel_pop_id'] ) ? (int) $row['reel_pop_id'] : 0;
			if ( $reel_pop_id <= 0 ) {
				continue;
			}
			$post = get_post( $reel_pop_id );
			if ( ! $post || 'publish' !== $post->post_status ) {
				continue;
			}
			$thumbnail        = get_the_post_thumbnail_url( $reel_pop_id, 'thumbnail' );
			$row['title']     = get_the_title( $post );
			$row['thumbnail'] = $thumbnail ? $thumbnail : '';
			$row['edit_url']  = admin_url( 'post.php?post=' . $reel_pop_id . '&action=edit' );
			$enriched[]       = $row;
		}

		$body['reel_pops'] = $enriched;

		set_transient( $cache_key, $body, self::CACHE_TTL );

		return rest_ensure_response( $body );
	}
}
