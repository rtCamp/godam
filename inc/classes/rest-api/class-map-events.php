<?php
/**
 * REST route that takes video view milestones from the player.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Map_Tracker;
use WP_REST_Server;
use WP_REST_Response;

/**
 * Class Map_Events
 *
 * `POST godam/v1/map-events` — one video view milestone, on its way to the customer's
 * Marketo or HubSpot. See Map_Tracker for the whole path.
 *
 * The route is public. A nonce is no use here: most viewers are logged out, and on a
 * page-cached site a logged-out page is served without a fresh nonce, so requiring one
 * would mean tracking nothing on exactly the pages that matter. What it does instead:
 *
 * - It never trusts the caller for anything that identifies the site. The licence key
 *   is added server-side on the forward, so a caller cannot aim an event at another
 *   account, and Central checks the key against the media before recording.
 * - It validates every field to the same rules Central applies, so a made-up cookie
 *   never costs the customer a Marketo lead lookup.
 * - It answers `{"status": "ok"}` to everything it accepts and everything it drops
 *   alike, so a prober learns nothing about which media exist or which tools are
 *   connected. (A request malformed enough to fail WP's own parameter validation
 *   still gets the usual 400, which gives away nothing about this account.)
 *
 * The worst a flood can do is fill Action Scheduler with events Central will drop, so
 * the route is also rate-limited per IP and de-duplicated per view.
 */
class Map_Events extends Base {

	/**
	 * Route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'map-events';

	/**
	 * Object cache group for the rate-limit and de-duplication counters.
	 */
	const CACHE_GROUP = 'godam_map_events';

	/**
	 * Events accepted from one IP per window.
	 *
	 * A viewer sends at most five per video, so this allows a page with several
	 * videos, or a handful of people behind one NAT, without being generous enough
	 * to matter.
	 */
	const RATE_LIMIT = 60;

	/**
	 * Rate-limit window, in seconds.
	 */
	const RATE_WINDOW = 60;

	/**
	 * Get REST routes.
	 *
	 * @return array
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base,
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'track' ),
						'permission_callback' => '__return_true',
						'args'                => array(
							'media_id'   => array(
								'description' => __( 'GoDAM Central media ID of the video being watched.', 'godam' ),
								'type'        => 'string',
								'required'    => true,
							),
							'milestone'  => array(
								'description' => __( 'How far the viewer has watched: 0 (started), 25, 50, 75 or 100.', 'godam' ),
								'type'        => 'integer',
								'required'    => true,
							),
							'page_url'   => array(
								'description' => __( 'URL of the page the video is on.', 'godam' ),
								'type'        => 'string',
								'required'    => true,
							),
							'session_id' => array(
								'description' => __( 'Random ID grouping the milestones of one view.', 'godam' ),
								'type'        => 'string',
								'required'    => true,
							),
							'ids'        => array(
								'description' => __( 'Marketing automation cookies identifying the viewer.', 'godam' ),
								'type'        => 'object',
								'required'    => true,
							),
						),
					),
				),
			),
		);
	}

	/**
	 * Accept one milestone and schedule the forward to Central.
	 *
	 * Always answers `{"status": "ok"}`, including for everything it drops.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function track( $request ) {
		$ok = new WP_REST_Response( array( 'status' => 'ok' ), 200 );

		if ( ! Map_Tracker::is_tracking_enabled() ) {
			return $ok;
		}

		$media_id   = $request->get_param( 'media_id' );
		$milestone  = Map_Tracker::normalize_milestone( $request->get_param( 'milestone' ) );
		$page_url   = $request->get_param( 'page_url' );
		$session_id = $request->get_param( 'session_id' );

		if (
			! Map_Tracker::is_valid_media_id( $media_id )
			|| null === $milestone
			|| ! Map_Tracker::is_valid_page_url( $page_url )
			|| ! Map_Tracker::is_valid_session_id( $session_id )
		) {
			return $ok;
		}

		// Only the cookies for tools this account has connected and ready. Sending a
		// HubSpot cookie to an account with only Marketo connected is just noise
		// Central would drop, and it keeps the viewer's HubSpot ID off the wire.
		$ids = array_intersect_key(
			Map_Tracker::filter_visitor_ids( $request->get_param( 'ids' ) ),
			$this->cookie_names_for_connected_providers()
		);

		if ( empty( $ids ) ) {
			return $ok;
		}

		if ( $this->is_rate_limited() ) {
			return $ok;
		}

		// One (media, session, milestone) is one event. The player already sends each
		// milestone once, so a repeat is a retry, a double-fire or a replay; Central
		// de-duplicates too, but there is no reason to spend a job on it.
		if ( $this->is_duplicate( $media_id, $session_id, $milestone ) ) {
			return $ok;
		}

		Map_Tracker::get_instance()->schedule_map_event(
			array(
				'media_id'   => $media_id,
				'milestone'  => $milestone,
				'page_url'   => $page_url,
				'session_id' => $session_id,
				'ids'        => $ids,
			)
		);

		return $ok;
	}

	/**
	 * Cookie names worth forwarding, keyed for array_intersect_key().
	 *
	 * Taken through {@see Map_Tracker::frontend_providers()}, the same filter the
	 * frontend applies, so a provider the site has switched off (or a HubSpot portal
	 * mismatch) is dropped here too. The route is public and the inline
	 * `godamMapTracking` on a full-page-cached page can outlive that switch, so a
	 * disabled tool's cookie could still arrive by POST; filtering here means it is
	 * never forwarded regardless.
	 *
	 * @return array<string,bool>
	 */
	private function cookie_names_for_connected_providers() {
		$config    = Map_Tracker::get_map_config();
		$providers = Map_Tracker::frontend_providers( $config['providers'] ?? array() );

		$names = array();

		foreach ( $providers as $provider ) {
			switch ( strtolower( (string) $provider ) ) {
				case 'marketo':
					$names['mkto_trk'] = true;
					break;
				case 'hubspot':
					$names['hubspotutk'] = true;
					break;
			}
		}

		return $names;
	}

	/**
	 * Whether this caller has gone past self::RATE_LIMIT in the current window.
	 *
	 * Counted in the object cache. Without a persistent object cache every request
	 * starts its own cache, so this does nothing — which is the same trade the rest
	 * of the plugin's caching makes, and the validation above is what actually keeps
	 * junk out of the queue.
	 *
	 * @return bool
	 */
	private function is_rate_limited() {
		/*
		 * Validated as an IP by filter_var() below before it is used for anything:
		 * behind a proxy REMOTE_ADDR can be any string, and a counter key built from
		 * an unchecked value is a bucket the caller gets to choose. Nothing in the
		 * response varies by caller, so this does not make the route uncacheable.
		 */
		// phpcs:disable WordPressVIPMinimum.Variables.ServerVariables.UserControlledHeaders, WordPressVIPMinimum.Variables.RestrictedVariables.cache_constraints___SERVER__REMOTE_ADDR__
		$raw = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		// phpcs:enable WordPressVIPMinimum.Variables.ServerVariables.UserControlledHeaders, WordPressVIPMinimum.Variables.RestrictedVariables.cache_constraints___SERVER__REMOTE_ADDR__

		$ip = filter_var( $raw, FILTER_VALIDATE_IP );

		if ( false === $ip ) {
			return false;
		}

		// Hashed so a visitor's IP is not sitting in the cache in the clear.
		$key   = 'rate_' . md5( $ip );
		$count = (int) wp_cache_get( $key, self::CACHE_GROUP );

		if ( $count >= self::RATE_LIMIT ) {
			return true;
		}

		// phpcs:ignore WordPressVIPMinimum.Performance.LowExpiryCacheTime.CacheTimeUndetermined -- a rate-limit window is short by definition; this is a counter, not cached output.
		wp_cache_set( $key, $count + 1, self::CACHE_GROUP, self::RATE_WINDOW );

		return false;
	}

	/**
	 * Whether this exact milestone has already been accepted for this view.
	 *
	 * @param string $media_id   Media ID.
	 * @param string $session_id Session ID.
	 * @param int    $milestone  Milestone.
	 * @return bool
	 */
	private function is_duplicate( $media_id, $session_id, $milestone ) {
		$key = 'event_' . md5( $media_id . '|' . $session_id . '|' . $milestone );

		if ( wp_cache_get( $key, self::CACHE_GROUP ) ) {
			return true;
		}

		// A view rarely outlives a few hours; Central's own unique key is what makes
		// de-duplication actually reliable.
		wp_cache_set( $key, 1, self::CACHE_GROUP, 4 * HOUR_IN_SECONDS );

		return false;
	}
}
