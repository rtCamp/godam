<?php
/**
 * One connection status for GoDAM and GoDAM for WooCommerce.
 *
 * @see https://github.com/rtCamp/godam-plugin-wp/issues/101
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Helpers\Connection;

/**
 * Runs in separate processes: each test stubs the option writes.
 *
 * @covers \RTGODAM\Inc\Helpers\Connection
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class ConnectionStatusTest extends TestCase {

	/**
	 * Stub the WordPress functions the helper calls.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array( 'options' => array() );

		$stubs = array(
			'update_option' => 'function update_option( $key, $value, $autoload = null ) { $GLOBALS["rtgodam_stub"]["options"][ $key ] = $value; return true; }',
			'delete_option' => 'function delete_option( $key ) { unset( $GLOBALS["rtgodam_stub"]["options"][ $key ] ); return true; }',
			'sanitize_key'  => 'function sanitize_key( $key ) { return preg_replace( "/[^a-z0-9_\\\\-]/", "", strtolower( (string) $key ) ); }',
			'admin_url'     => 'function admin_url( $path = "" ) { return "https://site.example/wp-admin/" . $path; }',
			// Today in the site's timezone: the test's date when it sets one.
			'wp_date'       => 'function wp_date( $format, $timestamp = null ) { return $GLOBALS["rtgodam_stub"]["today"] ?? gmdate( $format ); }',
		);

		foreach ( $stubs as $name => $code ) {
			if ( ! function_exists( $name ) ) {
				eval( $code ); // phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
			}
		}

		$root = dirname( __DIR__, 2 );
		require_once $root . '/inc/classes/enums/class-api-key-status.php';
		require_once $root . '/inc/helpers/class-api-key.php';
	}

	/**
	 * Store a key with this key status.
	 *
	 * @param string $status Key status.
	 */
	private function store_key( $status = 'valid' ) {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key']        = 'key';
		$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key-status'] = $status;
	}

	/**
	 * The status, with cached user data from a successful check.
	 *
	 * @return string
	 */
	private function status() {
		return Connection::get_status( array( 'valid_api_key' => true ) );
	}

	public function test_no_key_is_none() {
		$this->assertSame( 'none', $this->status() );
	}

	/**
	 * @return array
	 */
	public function central_statuses() {
		return array(
			'connected' => array( 'connected', true ),
			'trial'     => array( 'trial', true ),
			'expired'   => array( 'expired', false ),
			'none'      => array( 'none', false ),
		);
	}

	/**
	 * @dataProvider central_statuses
	 *
	 * @param string $status    What Central sent.
	 * @param bool   $succeeded Whether Central accepted the key.
	 */
	public function test_centrals_status_is_used( $status, $succeeded ) {
		$this->store_key();
		Connection::record( array( 'connection_status' => $status ), $succeeded );

		$this->assertSame( $status, $this->status() );
	}

	public function test_an_unknown_status_from_central_is_ignored() {
		$this->store_key( 'expired' );
		Connection::record( array( 'connection_status' => 'banana' ), false );

		$this->assertSame( 'expired', $this->status() );
	}

	/**
	 * @return array
	 */
	public function key_statuses() {
		return array(
			'valid'      => array( 'valid', 'connected' ),
			'expired'    => array( 'expired', 'expired' ),
			'no_api_key' => array( 'no_api_key', 'none' ),
		);
	}

	/**
	 * Before Central sends a status (or an older Central), the key status decides.
	 *
	 * @dataProvider key_statuses
	 *
	 * @param string $key_status The stored key status.
	 * @param string $expected   Expected connection status.
	 */
	public function test_without_centrals_status_the_key_status_decides( $key_status, $expected ) {
		$this->store_key( $key_status );

		$this->assertSame( $expected, $this->status() );
	}

	/**
	 * A 200 with no subscription to read yet (one still being set up): the key works, so
	 * it isn't sent to the connect screen.
	 */
	public function test_a_working_key_without_a_subscription_yet_reads_as_connected() {
		$this->store_key();
		Connection::record( array( 'connection_status' => 'none' ), true );

		$this->assertSame( 'connected', $this->status() );
	}

	/**
	 * Central refused this site (it isn't on the key's allowed sites) but the plan is fine:
	 * no trial countdown or renewal for a key the site can't use.
	 *
	 * @dataProvider live_statuses
	 *
	 * @param string $status What Central sent with the refusal.
	 */
	public function test_a_refused_site_with_a_live_plan_has_no_usable_key( $status ) {
		$this->store_key( 'expired' );
		Connection::record(
			array(
				'connection_status' => $status,
				'trial_ends_at'     => '2030-01-01T00:00:00Z',
			),
			false
		);

		$this->assertSame( 'none', $this->status() );
		$this->assertNull( Connection::get_trial_days_left() );
	}

	/**
	 * @return array
	 */
	public function live_statuses() {
		return array(
			'connected' => array( 'connected' ),
			'trial'     => array( 'trial' ),
		);
	}

	public function test_a_check_central_could_not_answer_is_unreachable() {
		$this->store_key();
		Connection::record( array( 'connection_status' => 'connected' ), true );

		$this->assertSame(
			'unreachable',
			Connection::get_status(
				array(
					'valid_api_key' => true,
					'retry_at'      => time() + 300,
				) 
			) 
		);
	}

	/**
	 * A trial whose last day is this one, as Central sends it (that date's UTC midnight).
	 *
	 * @param string $last_day Last day of the trial, Y-m-d.
	 */
	private function trial_until( $last_day ) {
		$this->store_key();
		Connection::record(
			array(
				'connection_status' => 'trial',
				'trial_ends_at'     => $last_day . 'T00:00:00Z',
			),
			true
		);
	}

	/**
	 * @return array
	 */
	public function trial_days() {
		return array(
			'three days to go' => array( '2026-11-28', '2026-12-01', 3 ),
			'last day'         => array( '2026-12-01', '2026-12-01', 0 ),
			'already over'     => array( '2026-12-03', '2026-12-01', 0 ),
		);
	}

	/**
	 * @dataProvider trial_days
	 *
	 * @param string $today    Today in the site's timezone.
	 * @param string $last_day The trial's last day.
	 * @param int    $expected Days left.
	 */
	public function test_trial_days_left_count_calendar_days( $today, $last_day, $expected ) {
		$GLOBALS['rtgodam_stub']['today'] = $today;
		$this->trial_until( $last_day );

		$this->assertSame( $expected, Connection::get_trial_days_left() );
	}

	/**
	 * Late on 30 Nov in New York it's already 1 Dec in UTC: still one day left, not none.
	 */
	public function test_trial_days_left_follow_the_sites_date_not_utc() {
		$GLOBALS['rtgodam_stub']['today'] = '2026-11-30';
		$this->trial_until( '2026-12-01' );

		$this->assertSame( 1, Connection::get_trial_days_left() );
	}

	public function test_no_trial_has_no_days_left() {
		$this->store_key();
		Connection::record(
			array(
				'connection_status' => 'connected',
				'trial_ends_at'     => '2030-01-01T00:00:00Z',
			),
			true 
		);

		$this->assertNull( Connection::get_trial_days_left() );
	}

	public function test_the_lapse_date_is_centrals_when_it_sends_one() {
		$this->store_key( 'expired' );
		$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key-error-since'] = 1000;
		Connection::record(
			array(
				'connection_status' => 'expired',
				'expired_at'        => '2026-11-01T00:00:00Z',
			),
			false 
		);

		$this->assertSame( strtotime( '2026-11-01T00:00:00Z' ), Connection::get_expired_since() );
	}

	public function test_without_centrals_lapse_date_the_first_expired_check_counts() {
		$this->store_key( 'expired' );
		$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key-error-since'] = 1000;
		Connection::record( array( 'connection_status' => 'expired' ), false );

		$this->assertSame( 1000, Connection::get_expired_since() );
	}

	public function test_renewal_goes_to_the_organizations_upgrade_page() {
		Connection::record(
			array(
				'connection_status' => 'expired',
				'organization'      => 'acme',
			),
			false 
		);

		$url = Connection::get_renewal_url();

		$this->assertStringStartsWith( RTGODAM_API_BASE . '/godam_upgrade?', $url );
		$this->assertStringContainsString( 'organization=acme', $url );
		$this->assertStringContainsString( 'wp_return=', $url );
	}

	public function test_without_the_organization_renewal_goes_to_the_plans_page() {
		$this->assertSame( RTGODAM_API_BASE . '/web/billing?tab=Plans', Connection::get_renewal_url() );
	}

	public function test_the_organization_is_kept_when_a_later_answer_leaves_it_out() {
		Connection::record(
			array(
				'connection_status' => 'connected',
				'organization'      => 'acme',
			),
			true 
		);
		Connection::record( array( 'connection_status' => 'expired' ), false );

		$this->assertSame( 'acme', Connection::get_organization() );
	}

	public function test_removing_the_key_forgets_centrals_answer() {
		$this->store_key();
		Connection::record( array( 'connection_status' => 'trial' ), true );
		Connection::clear();

		$this->assertSame( 'connected', $this->status() );
	}
}
