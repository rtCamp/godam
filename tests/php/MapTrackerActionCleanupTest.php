<?php
/**
 * The visitor's cookie does not outlive the forward that carries it.
 *
 * A forward's Action Scheduler row holds the visitor's `_mkto_trk` / `hubspotutk`
 * cookie in its arguments, and Action Scheduler would otherwise keep a completed row
 * for 31 days and a failed one indefinitely. Map_Tracker deletes the row as soon as
 * the forward finishes; these pin that it does so on every way an action can finish,
 * and that it leaves every other plugin's actions alone.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Map_Tracker;

/**
 * Runs in separate processes: each test defines its own stand-in for Action
 * Scheduler's store, which must not leak into the rest of the suite.
 *
 * @covers \RTGODAM\Inc\Map_Tracker::delete_finished_forward
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class MapTrackerActionCleanupTest extends TestCase {

	/**
	 * A forward's action ID.
	 */
	const FORWARD = 11;

	/**
	 * Another plugin's action ID.
	 */
	const OTHER = 12;

	/**
	 * Stand in for Action Scheduler's store and register the tracker's hooks.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_hooks'] = array();

		// The actions table: action ID => hook.
		$GLOBALS['rtgodam_as'] = array(
			'rows'          => array(
				self::FORWARD => Map_Tracker::ASYNC_HOOK,
				self::OTHER   => 'woocommerce_cleanup_sessions',
			),
			'delete_throws' => false,
		);

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		eval(
			'class ActionScheduler {
				public static function store() {
					return new ActionScheduler_Fake_Store();
				}
			}

			class ActionScheduler_Fake_Store {
				public function fetch_action( $action_id ) {
					return new ActionScheduler_Fake_Action( $GLOBALS["rtgodam_as"]["rows"][ $action_id ] ?? "" );
				}

				public function delete_action( $action_id ) {
					if ( $GLOBALS["rtgodam_as"]["delete_throws"] || ! isset( $GLOBALS["rtgodam_as"]["rows"][ $action_id ] ) ) {
						throw new InvalidArgumentException( "Unidentified action " . $action_id );
					}
					unset( $GLOBALS["rtgodam_as"]["rows"][ $action_id ] );
				}
			}

			class ActionScheduler_Fake_Action {
				private $hook;

				public function __construct( $hook ) {
					$this->hook = $hook;
				}

				public function get_hook() {
					return $this->hook;
				}
			}'
		);
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		$tracker = ( new \ReflectionClass( Map_Tracker::class ) )->newInstanceWithoutConstructor();
		$setup   = new \ReflectionMethod( Map_Tracker::class, 'setup_hooks' );
		$setup->setAccessible( true );
		$setup->invoke( $tracker );
	}

	/**
	 * A forward that completed is deleted.
	 *
	 * @return void
	 */
	public function test_deletes_a_forward_once_it_completes() {
		do_action( 'action_scheduler_completed_action', self::FORWARD );

		$this->assertArrayNotHasKey( self::FORWARD, $GLOBALS['rtgodam_as']['rows'] );
	}

	/**
	 * A forward that threw, or that Action Scheduler gave up on after a timeout, is
	 * deleted too. Failed rows are never purged by Action Scheduler, so this is the
	 * case that would otherwise keep the cookie for good.
	 *
	 * @return void
	 */
	public function test_deletes_a_forward_that_failed() {
		do_action( 'action_scheduler_failed_execution', self::FORWARD, new \Exception( 'boom' ), 'WP Cron' );

		$this->assertArrayNotHasKey( self::FORWARD, $GLOBALS['rtgodam_as']['rows'] );

		$GLOBALS['rtgodam_as']['rows'][ self::FORWARD ] = Map_Tracker::ASYNC_HOOK;

		do_action( 'action_scheduler_failed_action', self::FORWARD, 300 );

		$this->assertArrayNotHasKey( self::FORWARD, $GLOBALS['rtgodam_as']['rows'] );
	}

	/**
	 * Every action on the site passes through these hooks; only forwards are touched.
	 *
	 * @return void
	 */
	public function test_leaves_other_actions_alone() {
		do_action( 'action_scheduler_completed_action', self::OTHER );
		do_action( 'action_scheduler_failed_execution', self::OTHER, new \Exception( 'boom' ), 'WP Cron' );
		do_action( 'action_scheduler_failed_action', self::OTHER, 300 );

		$this->assertArrayHasKey( self::OTHER, $GLOBALS['rtgodam_as']['rows'] );
	}

	/**
	 * A row another process deleted first is not an error inside Action Scheduler's
	 * runner.
	 *
	 * @return void
	 */
	public function test_a_row_already_deleted_is_not_an_error() {
		$GLOBALS['rtgodam_as']['delete_throws'] = true;

		do_action( 'action_scheduler_completed_action', self::FORWARD );

		$this->assertArrayHasKey( self::FORWARD, $GLOBALS['rtgodam_as']['rows'] );
	}

	/**
	 * The cleanup runs after Action Scheduler's logger (priority 10) writes the
	 * outcome, so deleting the row clears that log line rather than orphaning it.
	 *
	 * @return void
	 */
	public function test_runs_after_action_scheduler_logs_the_outcome() {
		$hooks = array( 'action_scheduler_completed_action', 'action_scheduler_failed_execution', 'action_scheduler_failed_action' );

		foreach ( $hooks as $hook ) {
			$callbacks = $GLOBALS['rtgodam_hooks'][ $hook ][20] ?? array();
			$methods   = array_map(
				static function ( $callback ) {
					return is_array( $callback ) ? $callback[1] : null;
				},
				$callbacks
			);

			$this->assertContains( 'delete_finished_forward', $methods, $hook );
		}
	}
}
