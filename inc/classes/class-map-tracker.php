<?php
/**
 * Forward video view milestones to the customer's marketing automation platform.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Map_Tracker
 *
 * When a visitor the customer's marketing automation platform ("MAP" — Marketo or
 * HubSpot) already knows watches a GoDAM video, that tool should record how far they
 * got. This class is the WordPress half of that path.
 *
 * Flow:
 * 1. `godam-map-tracking.min.js` watches each player, works out the highest milestone
 *    reached (0 = started, then 25/50/75/100) and posts it, with the visitor's
 *    `_mkto_trk` and/or `hubspotutk` cookie, to `godam/v1/map-events` (REST_API\Map_Events).
 * 2. That route validates the shape and schedules self::ASYNC_HOOK.
 * 3. async_map_event() forwards it to GoDAM Central server-to-server with the licence
 *    key in `X-Api-Key`, the same way Media_Usage_Tracker forwards `log_media_view`.
 *
 * Central owns the connection to Marketo and HubSpot, so no API key for either tool
 * ever lives on this site, and the GoDAM licence key never reaches the browser.
 *
 * Which tools are connected comes from the `map` block of the `verify_api_key`
 * response, which the plugin already caches hourly in `rtgodam_user_data`
 * (rtgodam_get_user_data()), so there is no extra call to Central.
 *
 * The cookie identifies a person to their own marketing tool, so it is treated as
 * personal data throughout: it is never logged, never stored in an option or transient,
 * and only ever travels to Central over the server-to-server call.
 */
class Map_Tracker {

	use Singleton;

	/**
	 * Action Scheduler hook for the server-to-server forward to Central.
	 */
	const ASYNC_HOOK = 'godam_async_map_event';

	/**
	 * Script handle for the frontend milestone tracker.
	 */
	const SCRIPT_HANDLE = 'godam-map-tracking-script';

	/**
	 * Maximum attempts (initial + retries) for one event before it is dropped.
	 *
	 * A view milestone is low-value and high-volume: unlike media usage, there is no
	 * point retrying for long. Five attempts over ~15 minutes covers a Central deploy.
	 */
	const MAX_ATTEMPTS = 5;

	/**
	 * Milestones Central accepts. 0 means "started playing".
	 *
	 * Kept in sync with `MILESTONES` in godam-core's `utils/map_events/tokens.py`.
	 */
	const MILESTONES = array( 0, 25, 50, 75, 100 );

	/**
	 * Longest acceptable media ID, matching Central's `MEDIA_ID_MAX_LEN`.
	 */
	const MEDIA_ID_MAX_LEN = 64;

	/**
	 * Longest acceptable page URL, matching Central's `PAGE_URL_MAX_LEN`.
	 */
	const PAGE_URL_MAX_LEN = 2000;

	/**
	 * Constructor.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	private function setup_hooks() {
		// The async forward. The trailing attempt counter drives the retry back-off,
		// so the callback takes one more argument than the scheduling payload.
		add_action( self::ASYNC_HOOK, array( $this, 'async_map_event' ), 10, 2 );

		add_action( 'wp_enqueue_scripts', array( $this, 'register_script' ) );

		/**
		 * Enqueued from `wp_footer`, not `wp_enqueue_scripts`.
		 *
		 * Players are rendered by blocks and shortcodes while the_content runs, which
		 * is after `wp_enqueue_scripts` has finished — so asking there whether a player
		 * is on the page always answers no. By `wp_footer` every player has rendered,
		 * and priority 1 is still ahead of wp_print_footer_scripts (priority 20).
		 */
		add_action( 'wp_footer', array( $this, 'maybe_enqueue_script' ), 1 );
	}

	// -------------------------------------------------------------------------
	// Configuration
	// -------------------------------------------------------------------------

	/**
	 * The `map` block from the cached `verify_api_key` response.
	 *
	 * Shape: `{ tracking: bool, providers: string[], marketo?: { munchkin_id, forms_host },
	 * hubspot?: { portal_id, region } }`. Account identifiers only, never a credential.
	 *
	 * @return array Empty array when the site has no key, Central sent no block, or
	 *               this version of Central predates it.
	 */
	public static function get_map_config() {
		if ( ! function_exists( 'rtgodam_get_user_data' ) ) {
			return array();
		}

		$user_data = rtgodam_get_user_data();
		$map       = $user_data['user_data']['map'] ?? null;

		return is_array( $map ) ? $map : array();
	}

	/**
	 * Whether this site should send view milestones at all.
	 *
	 * `providers` lists only the tools whose switch is on AND whose custom event or
	 * activity type exists in the customer's account, so an empty list means every
	 * event we sent would be rejected on arrival. Tracking off, or no provider ready,
	 * means the script is never enqueued and the route records nothing.
	 *
	 * @return bool
	 */
	public static function is_tracking_enabled() {
		$config = self::get_map_config();

		return ! empty( $config['tracking'] ) && ! empty( $config['providers'] ) && is_array( $config['providers'] );
	}

	// -------------------------------------------------------------------------
	// Frontend script
	// -------------------------------------------------------------------------

	/**
	 * Register the milestone tracker.
	 *
	 * Registered unconditionally but enqueued only by maybe_enqueue_script(), so a
	 * theme or add-on can still enqueue it deliberately.
	 *
	 * @return void
	 */
	public function register_script() {
		$path = RTGODAM_PATH . 'assets/build/js/godam-map-tracking.min.js';

		if ( ! file_exists( $path ) ) {
			return;
		}

		wp_register_script(
			self::SCRIPT_HANDLE,
			RTGODAM_URL . 'assets/build/js/godam-map-tracking.min.js',
			array(),
			filemtime( $path ),
			true
		);
	}

	/**
	 * Enqueue the tracker when this page has a player and tracking is on.
	 *
	 * @return void
	 */
	public function maybe_enqueue_script() {
		if ( ! self::is_tracking_enabled() ) {
			return;
		}

		// No player on this page means no milestone can ever fire.
		if ( ! wp_script_is( 'godam-player-frontend-script', 'enqueued' ) && ! wp_script_is( 'godam-player-frontend-script', 'done' ) ) {
			return;
		}

		if ( ! wp_script_is( self::SCRIPT_HANDLE, 'registered' ) ) {
			return;
		}

		$config = self::get_map_config();

		wp_add_inline_script(
			self::SCRIPT_HANDLE,
			'window.godamMapTracking = ' . wp_json_encode(
				array(
					'restUrl'   => rest_url( 'godam/v1/map-events' ),
					// Which cookies are worth reading at all. Account IDs stay on the
					// server: the script only needs to know which tools to look for.
					'providers' => array_values( array_filter( array_map( 'strval', (array) ( $config['providers'] ?? array() ) ) ) ),
				)
			) . ';',
			'before'
		);

		wp_enqueue_script( self::SCRIPT_HANDLE );
	}

	// -------------------------------------------------------------------------
	// Validation — pure, shared with REST_API\Map_Events
	// -------------------------------------------------------------------------

	/**
	 * Normalise a milestone, or null when it is not one Central accepts.
	 *
	 * @param mixed $value Raw milestone.
	 * @return int|null
	 */
	public static function normalize_milestone( $value ) {
		if ( ! is_scalar( $value ) || is_bool( $value ) ) {
			return null;
		}

		// Reject "50.5" and "50abc" rather than letting a cast round them into a
		// valid milestone: a caller sending either is not a player we wrote.
		if ( ! preg_match( '/^\d{1,3}$/', (string) $value ) ) {
			return null;
		}

		$milestone = (int) $value;

		return in_array( $milestone, self::MILESTONES, true ) ? $milestone : null;
	}

	/**
	 * Whether a media ID could be a GoDAM Central ID.
	 *
	 * Central looks it up as a `Transcoder Job` name, so the only job here is to keep
	 * junk out of the queue; Central decides whether it exists.
	 *
	 * @param mixed $value Raw media ID.
	 * @return bool
	 */
	public static function is_valid_media_id( $value ) {
		return is_string( $value ) && (bool) preg_match( '/^[A-Za-z0-9_-]{1,' . self::MEDIA_ID_MAX_LEN . '}$/', $value );
	}

	/**
	 * Whether a session ID matches Central's `SESSION_ID_RE`.
	 *
	 * The ID groups the milestones of one view so Central can discard duplicates. It
	 * is generated in the browser and means nothing on its own.
	 *
	 * @param mixed $value Raw session ID.
	 * @return bool
	 */
	public static function is_valid_session_id( $value ) {
		return is_string( $value ) && (bool) preg_match( '/^[A-Za-z0-9-]{8,64}$/', $value );
	}

	/**
	 * Whether a page URL is an http(s) URL this site would own.
	 *
	 * @param mixed $value Raw page URL.
	 * @return bool
	 */
	public static function is_valid_page_url( $value ) {
		if ( ! is_string( $value ) || '' === $value || strlen( $value ) > self::PAGE_URL_MAX_LEN ) {
			return false;
		}

		$parts = wp_parse_url( $value );

		if ( empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
			return false;
		}

		return in_array( strtolower( $parts['scheme'] ), array( 'http', 'https' ), true );
	}

	/**
	 * Keep only the visitor cookies Central can actually use.
	 *
	 * Both formats are checked here as well as in Central so a malformed or made-up
	 * cookie never reaches the queue — a Marketo lead lookup costs the customer API
	 * quota, so a bad value is worth dropping as early as possible.
	 *
	 * `_mkto_trk` is `id:<munchkin>&token:_mch-<domain>-<timestamp>-<random>`;
	 * `hubspotutk` is 32 hex characters.
	 *
	 * @param mixed $ids Raw `ids` member of the request.
	 * @return array Subset of `mkto_trk` and `hubspotutk` that passed. May be empty.
	 */
	public static function filter_visitor_ids( $ids ) {
		if ( ! is_array( $ids ) ) {
			return array();
		}

		$filtered = array();

		$mkto_trk = $ids['mkto_trk'] ?? null;
		if ( is_string( $mkto_trk ) && preg_match( '/^id:\d{3}-[A-Za-z]{3}-\d{3}&token:_mch-[A-Za-z0-9._-]{1,200}$/', $mkto_trk ) ) {
			$filtered['mkto_trk'] = $mkto_trk;
		}

		$hubspotutk = $ids['hubspotutk'] ?? null;
		if ( is_string( $hubspotutk ) && preg_match( '/^[0-9a-fA-F]{32}$/', $hubspotutk ) ) {
			$filtered['hubspotutk'] = strtolower( $hubspotutk );
		}

		return $filtered;
	}

	// -------------------------------------------------------------------------
	// Forward to Central
	// -------------------------------------------------------------------------

	/**
	 * Schedule the server-to-server forward.
	 *
	 * Falls back to a synchronous call when Action Scheduler is unavailable, as
	 * Media_Usage_Tracker does, so tracking still works on a minimal install.
	 *
	 * @param array $event Validated event payload.
	 * @return void
	 */
	public function schedule_map_event( array $event ) {
		if ( ! function_exists( 'as_enqueue_async_action' ) ) {
			$this->async_map_event( $event );
			return;
		}

		as_enqueue_async_action( self::ASYNC_HOOK, array( $event ) );
	}

	/**
	 * Send one milestone to Central.
	 *
	 * @param array $event   Validated event payload.
	 * @param int   $attempt 1-based attempt counter.
	 * @return void
	 */
	public function async_map_event( $event, $attempt = 1 ) {
		if ( ! is_array( $event ) ) {
			return;
		}

		$api_key = get_option( 'rtgodam-api-key', '' );
		if ( empty( $api_key ) ) {
			return;
		}

		$attempt = max( 1, (int) $attempt );

		$payload = array(
			'media_id'   => $event['media_id'] ?? '',
			'milestone'  => $event['milestone'] ?? null,
			'page_url'   => $event['page_url'] ?? '',
			'session_id' => $event['session_id'] ?? '',
			'ids'        => $event['ids'] ?? array(),
			'surface'    => 'wordpress',
		);

		if ( ! self::is_valid_media_id( $payload['media_id'] ) || null === self::normalize_milestone( $payload['milestone'] ) || empty( $payload['ids'] ) ) {
			return;
		}

		$response = wp_remote_post(
			RTGODAM_API_BASE . '/api/method/godam_core.api.map_events.track',
			array(
				'method'  => 'POST',
				'timeout' => 10, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
				'headers' => array(
					'Content-Type' => 'application/json',

					/*
					 * Central checks this equals the media's own licence key before it
					 * records anything. Fired from Action Scheduler, never the browser,
					 * so the key stays on the server.
					 */
					'X-Api-Key'    => $api_key,
				),
				'body'    => wp_json_encode( $payload ),
			)
		);

		$this->maybe_retry( $response, $event, $attempt );
	}

	/**
	 * Re-schedule on a transient failure, with exponential back-off.
	 *
	 * Central answers `{"status": "ok"}` to everything it accepts and everything it
	 * refuses alike, so there is nothing to inspect in a 200 body: only a transport
	 * error or a 5xx is worth another attempt. A 4xx is this site's own fault (a bad
	 * or revoked licence key) and will not fix itself.
	 *
	 * @param array|\WP_Error $response Result of wp_remote_post().
	 * @param array           $event    The event, for the retry payload.
	 * @param int             $attempt  Attempt that just finished.
	 * @return void
	 */
	private function maybe_retry( $response, array $event, $attempt ) {
		$retryable = false;

		if ( is_wp_error( $response ) ) {
			$retryable = true;
		} else {
			$code      = (int) wp_remote_retrieve_response_code( $response );
			$retryable = $code >= 500 || 429 === $code;
		}

		if ( ! $retryable || $attempt >= self::MAX_ATTEMPTS || ! function_exists( 'as_schedule_single_action' ) ) {
			return;
		}

		// 1, 2, 4, 8 minutes.
		$delay = MINUTE_IN_SECONDS * pow( 2, $attempt - 1 );

		as_schedule_single_action( time() + $delay, self::ASYNC_HOOK, array( $event, $attempt + 1 ) );
	}
}
