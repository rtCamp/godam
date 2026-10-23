<?php
/**
 * REST API for the HubSpot integration tab.
 *
 * Admin-only `GET godam/v1/hubspot/status` that proxies GoDAM Central's
 * WordPress MAP API (`godam_core.api.map_wordpress.get_status`). GoDAM Central
 * is the source of truth for a Central HubSpot connection; this route lets a
 * WordPress admin read its status without ever handling Central's stored HubSpot
 * credentials.
 *
 * Unlike Marketo, HubSpot cannot be connected from the plugin: connecting is an
 * OAuth flow done on Central. So there are no connect/test routes here — the tab
 * links out to Central to connect, and polls `get_status` until it reports the
 * connection. The editor's form list (for either source) is served separately by
 * {@see Hubspot_Forms}.
 *
 * The browser never calls Central directly: the WP→Central leg is server to
 * server, authenticated by the licence key (`X-API-KEY`) alone — the same
 * credential the plugin already uses for `verify_api_key` and `track`.
 *
 * @since n.e.x.t
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Hubspot;
use RTGODAM\Inc\Traits\Central_Client;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class Hubspot_Integration
 *
 * @since n.e.x.t
 */
class Hubspot_Integration extends Base {

	use Central_Client;

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'hubspot';

	/**
	 * Register the HubSpot integration routes.
	 *
	 * @return array
	 */
	public function get_rest_routes() {
		$manage = function () {
			return current_user_can( 'manage_options' );
		};

		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/status',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_status' ),
					'permission_callback' => $manage,
				),
			),
		);
	}

	/**
	 * GET /hubspot/status — the HubSpot connection state and account details.
	 *
	 * Normally Central's live `get_status`, so it carries the per-tool `state`,
	 * `reason`, tracking flags and `settings_url`, with `live: true`. If Central
	 * cannot answer (unreachable, or the WordPress MAP API is not available on
	 * that GoDAM yet) it falls back to the account details cached in the licence's
	 * `map` block, with `live: false` and the error, so the tab still shows what
	 * it can and links out to Central.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function get_status( WP_REST_Request $request ) {
		$result = $this->call_central( 'godam_core.api.map_wordpress.get_status' );

		if ( is_wp_error( $result ) ) {
			$fallback          = $this->fallback_status();
			$fallback['error'] = $result->get_error_message();
			return new WP_REST_Response( $this->with_source_context( $fallback ), 200 );
		}

		$result['live'] = true;

		// The editor, the form picker and the player read the portal ID from the
		// cached verify reply (`map.hubspot`), which the hourly refresh updates.
		// HubSpot has no connect route to force that refresh after an OAuth connect
		// on Central, so do it here when Central's live answer differs from the
		// cache (newly connected, disconnected, or a different portal). Central
		// clears its own `map` cache on any connection change, so one verify picks
		// up the new portal, and it only costs a call when something changed.
		$live_portal = (string) ( $result['hubspot']['portal_id'] ?? '' );
		if ( Hubspot::get_central_portal_id() !== $live_portal && function_exists( 'rtgodam_get_user_data' ) ) {
			rtgodam_get_user_data( false, HOUR_IN_SECONDS, true );
		}

		return new WP_REST_Response( $this->with_source_context( $result ), 200 );
	}

	/**
	 * Attach the admin's source choice and the leadin-plugin connection state to a
	 * status payload, so the settings tab can render whichever source is chosen
	 * from a single response. (The Central `get_status` only knows about Central.)
	 *
	 * @param array $status Status payload (live or fallback).
	 * @return array
	 */
	private function with_source_context( $status ) {
		$status['chosen_source'] = Hubspot::get_chosen_source();
		$status['active_source'] = Hubspot::get_active_source();
		$status['leadin']        = array(
			'active'    => Hubspot::is_leadin_active(),
			'connected' => Hubspot::is_leadin_connected(),
			'portal_id' => Hubspot::get_leadin_portal_id(),
			'region'    => Hubspot::is_leadin_connected() ? Hubspot::get_leadin_region() : '',
		);

		return $status;
	}

	/**
	 * A read-only status built from the cached `map` block, for when Central's
	 * live `get_status` cannot be reached.
	 *
	 * Shaped like Central's `get_status` so the tab consumes one response either
	 * way, with `live: false` as the only difference the UI branches on.
	 *
	 * @return array
	 */
	private function fallback_status() {
		$central = Hubspot::get_central_config();
		$has     = ! empty( $central['portal_id'] );

		return array(
			'live'         => false,
			'status'       => 'success',
			'settings_url' => Hubspot::central_settings_url(),
			'hubspot'      => array(
				'state'     => $has ? 'connected' : 'not_connected',
				'reason'    => null,
				'portal_id' => $has ? (string) $central['portal_id'] : null,
				'region'    => isset( $central['region'] ) ? $central['region'] : null,
			),
		);
	}
}
