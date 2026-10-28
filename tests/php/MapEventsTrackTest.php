<?php
/**
 * What `POST godam/v1/map-events` does with a milestone before it becomes a job.
 *
 * The route is public, so this is the code standing between any caller and a queue
 * of forwards aimed at the customer's Marketo or HubSpot. These pin which cookie
 * reaches which tool, that nothing is queued while tracking is off or for a request
 * of the wrong shape, the per-view de-duplication and per-IP rate limit, and that
 * every one of those answers the same `{"status": "ok"}`.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Map_Events;

/**
 * Runs in separate processes: each test evals its own object cache and Action
 * Scheduler stand-ins, and Map_Tracker's singleton must start fresh.
 *
 * @covers \RTGODAM\Inc\REST_API\Map_Events::track
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class MapEventsTrackTest extends TestCase {

	/**
	 * A well-formed Marketo cookie.
	 */
	const MKTO = 'id:123-ABC-456&token:_mch-example.com-1760000000000-12345';

	/**
	 * A well-formed HubSpot cookie.
	 */
	const HUTK = '0123456789abcdef0123456789abcdef';

	/**
	 * The route under test.
	 *
	 * @var Map_Events
	 */
	private $route;

	/**
	 * Stub the object cache and Action Scheduler, and connect both tools.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub']  = array( 'options' => array() );
		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_cache'] = array();
		$GLOBALS['rtgodam_jobs']  = array();

		$_SERVER['REMOTE_ADDR'] = '203.0.113.5';

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		eval( 'function wp_unslash( $value ) { return $value; }' );
		eval( 'function wp_cache_get( $key, $group = "" ) { return $GLOBALS["rtgodam_cache"][ $group ][ $key ] ?? false; }' );
		eval( 'function wp_cache_set( $key, $value, $group = "", $expire = 0 ) { $GLOBALS["rtgodam_cache"][ $group ][ $key ] = $value; return true; }' );
		eval( 'function as_enqueue_async_action( $hook, $args = array() ) { $GLOBALS["rtgodam_jobs"][] = array( "hook" => $hook, "args" => $args ); return count( $GLOBALS["rtgodam_jobs"] ); }' );
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		// rtgodam_get_user_data() reads the key status, which lives with the transcoder
		// helpers, as ApiKeyVerificationResilienceTest loads it.
		$root = dirname( __DIR__, 2 );
		require_once $root . '/inc/helpers/class-api-key.php';
		require_once $root . '/admin/godam-transcoder-functions.php';
		require_once $root . '/inc/classes/rest-api/class-map-events.php';

		$this->connect( array( 'Marketo', 'HubSpot' ) );

		$this->route = ( new \ReflectionClass( Map_Events::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * Cache a fresh `verify_api_key` response whose `map` block lists these tools, so
	 * rtgodam_get_user_data() serves it without calling Central.
	 *
	 * @param string[] $providers Connected tools.
	 * @param bool     $tracking  Whether tracking is switched on.
	 * @return void
	 */
	private function connect( array $providers, $tracking = true ) {
		$map = array(
			'tracking'  => $tracking,
			'providers' => $providers,
		);

		// A Central HubSpot portal, so frontend_providers()'s portal-alignment check
		// passes for a connected HubSpot (no leadin plugin is active in these tests).
		foreach ( $providers as $provider ) {
			if ( 'hubspot' === strtolower( (string) $provider ) ) {
				$map['hubspot'] = array( 'portal_id' => '247' );
				break;
			}
		}

		$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key']        = 'key';
		$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key-status'] = 'valid';
		$GLOBALS['rtgodam_stub']['options']['rtgodam_user_data']      = array(
			'valid_api_key' => true,
			'timestamp'     => time(),
			'checked_at'    => time(),
			'user_data'     => array( 'map' => $map ),
		);
	}

	/**
	 * Switch a provider off at the site level (Settings → Integrations), the way an
	 * admin does, independently of what Central still lists.
	 *
	 * @param string $integration `marketo` or `hubspot`.
	 * @param bool   $enable      Whether the integration is on.
	 * @return void
	 */
	private function set_integration_enabled( string $integration, bool $enable ) {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-settings']['integrations'][ $integration ] = array(
			'enable' => $enable,
		);
	}

	/**
	 * Send one milestone through the route.
	 *
	 * @param array $overrides Params to change from a valid request.
	 * @return \WP_REST_Response
	 */
	private function send( array $overrides = array() ) {
		$params = array_merge(
			array(
				'media_id'   => 'job-abc123',
				'milestone'  => 25,
				'page_url'   => 'https://example.com/watch/',
				'session_id' => 'session-0001',
				'ids'        => array(
					'mkto_trk'   => self::MKTO,
					'hubspotutk' => self::HUTK,
				),
			),
			$overrides
		);

		$response = $this->route->track( new \WP_REST_Request( $params ) );

		// Every outcome, accepted or dropped, looks the same to the caller.
		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( array( 'status' => 'ok' ), $response->get_data() );

		return $response;
	}

	/**
	 * @return array[] The events queued so far.
	 */
	private function queued() {
		return array_map(
			static function ( $job ) {
				return $job['args'][0];
			},
			$GLOBALS['rtgodam_jobs']
		);
	}

	/**
	 * A valid milestone is queued once, as the forward hook, with every field.
	 *
	 * @return void
	 */
	public function test_queues_a_valid_milestone() {
		$this->send();

		$this->assertCount( 1, $GLOBALS['rtgodam_jobs'] );
		$this->assertSame( 'godam_async_map_event', $GLOBALS['rtgodam_jobs'][0]['hook'] );
		$this->assertSame(
			array(
				'media_id'   => 'job-abc123',
				'milestone'  => 25,
				'page_url'   => 'https://example.com/watch/',
				'session_id' => 'session-0001',
				'ids'        => array(
					'mkto_trk'   => self::MKTO,
					'hubspotutk' => self::HUTK,
				),
			),
			$this->queued()[0]
		);
	}

	/**
	 * Only the cookie for a connected tool is forwarded, so an account with only
	 * Marketo never receives the viewer's HubSpot ID, and the other way round.
	 *
	 * @return void
	 */
	public function test_forwards_only_the_cookie_of_each_connected_tool() {
		$this->connect( array( 'Marketo' ) );
		$this->send( array( 'session_id' => 'session-mkto' ) );

		$this->connect( array( 'HubSpot' ) );
		$this->send( array( 'session_id' => 'session-hubs' ) );

		$queued = $this->queued();

		$this->assertSame( array( 'mkto_trk' => self::MKTO ), $queued[0]['ids'] );
		$this->assertSame( array( 'hubspotutk' => self::HUTK ), $queued[1]['ids'] );
	}

	/**
	 * A visitor known only to a tool this account has not connected has no record
	 * to put the view on, so nothing is queued.
	 *
	 * @return void
	 */
	public function test_drops_a_visitor_known_only_to_an_unconnected_tool() {
		$this->connect( array( 'Marketo' ) );
		$this->send( array( 'ids' => array( 'hubspotutk' => self::HUTK ) ) );

		$this->assertSame( array(), $GLOBALS['rtgodam_jobs'] );
	}

	/**
	 * A provider switched off in the plugin settings is dropped here too, not only on
	 * the frontend: a full-page-cached page (or a direct POST) can keep sending its
	 * cookie after the switch, and the route must not forward it.
	 *
	 * @return void
	 */
	public function test_drops_the_cookie_of_a_provider_switched_off_in_settings() {
		// Both tools connected on Central and both cookies posted, but Marketo is off
		// at the site level: only HubSpot's cookie is forwarded.
		$this->set_integration_enabled( 'marketo', false );
		$this->send();

		$this->assertCount( 1, $GLOBALS['rtgodam_jobs'] );
		$this->assertSame( array( 'hubspotutk' => self::HUTK ), $this->queued()[0]['ids'] );
	}

	/**
	 * Both providers switched off: nothing is forwarded, whatever the request carries.
	 *
	 * @return void
	 */
	public function test_queues_nothing_when_both_providers_are_switched_off() {
		$this->set_integration_enabled( 'marketo', false );
		$this->set_integration_enabled( 'hubspot', false );
		$this->send();

		$this->assertSame( array(), $GLOBALS['rtgodam_jobs'] );
	}

	/**
	 * With tracking switched off, or no tool ready, the route queues nothing.
	 *
	 * @return void
	 */
	public function test_queues_nothing_while_tracking_is_off() {
		$this->connect( array( 'Marketo', 'HubSpot' ), false );
		$this->send();

		$this->connect( array() );
		$this->send();

		$this->assertSame( array(), $GLOBALS['rtgodam_jobs'] );
	}

	/**
	 * A request of the wrong shape is dropped, whichever field is wrong.
	 *
	 * @return void
	 */
	public function test_drops_a_request_of_the_wrong_shape() {
		$this->send( array( 'media_id' => '../etc/passwd' ) );
		$this->send( array( 'milestone' => 30 ) );
		$this->send( array( 'page_url' => 'javascript:alert(1)' ) );
		$this->send( array( 'session_id' => 'short' ) );
		$this->send( array( 'ids' => array( 'mkto_trk' => 'made-up' ) ) );

		$this->assertSame( array(), $GLOBALS['rtgodam_jobs'] );
	}

	/**
	 * One (media, session, milestone) is one event: a repeat is dropped, while the
	 * next milestone of the same view and the same milestone of another view are not.
	 *
	 * @return void
	 */
	public function test_queues_each_milestone_of_a_view_once() {
		$this->send();
		$this->send();
		$this->send( array( 'milestone' => 50 ) );
		$this->send( array( 'session_id' => 'session-0002' ) );

		$this->assertSame(
			array( array( 'session-0001', 25 ), array( 'session-0001', 50 ), array( 'session-0002', 25 ) ),
			array_map(
				static function ( $event ) {
					return array( $event['session_id'], $event['milestone'] );
				},
				$this->queued()
			)
		);
	}

	/**
	 * Past RATE_LIMIT events in a window, one IP's events are dropped; another IP's
	 * are not.
	 *
	 * @return void
	 */
	public function test_rate_limits_each_ip() {
		for ( $i = 0; $i <= Map_Events::RATE_LIMIT; $i++ ) {
			$this->send( array( 'session_id' => sprintf( 'session-%04d', $i ) ) );
		}

		$this->assertCount( Map_Events::RATE_LIMIT, $GLOBALS['rtgodam_jobs'] );

		$_SERVER['REMOTE_ADDR'] = '198.51.100.7';
		$this->send( array( 'session_id' => 'session-other' ) );

		$this->assertCount( Map_Events::RATE_LIMIT + 1, $GLOBALS['rtgodam_jobs'] );
	}
}
