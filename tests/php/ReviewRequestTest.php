<?php
/**
 * The wordpress.org review request: when the notice may appear, who may see it, and what
 * each button stores.
 *
 * WordPress is faked with the narrow stubs in tests/stubs/review-request-functions.php.
 * Each test sets who is looking, at which screen, with how many finished videos and how
 * long after the start, then checks the decision, the lookup it ran, the markup, or the
 * user meta a dismissal left behind.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Review_Request;

/**
 * Runs in separate processes: the stub file defines global functions and the class is a
 * singleton, so each test needs a clean one.
 *
 * @covers \RTGODAM\Inc\Review_Request
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class ReviewRequestTest extends TestCase {

	private const ADMIN_ID = 7;
	private const OTHER_ID = 8;

	/**
	 * An administrator on the Media Library, a week and a day after the start, with three
	 * finished videos. Every test changes one thing from here.
	 */
	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/review-request-functions.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/class-review-request.php';

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array(
			'caps'               => array( 'manage_options' ),
			'screen_id'          => 'upload',
			'user_id'            => self::ADMIN_ID,
			'options'            => array( Review_Request::STARTED_OPTION => time() - 8 * DAY_IN_SECONDS ),
			'finished_video_ids' => array( 11, 12, 13 ),
			'nonce_ok'           => true,
		);
	}

	/**
	 * @return Review_Request
	 */
	private function notice() {
		return Review_Request::get_instance();
	}

	/**
	 * Send a dismissal as the current user, the way admin-ajax would.
	 *
	 * @param string $choice The `choice` POST field.
	 * @return array The JSON the handler sent.
	 */
	private function dismiss( $choice ) {
		$_POST = array( 'choice' => $choice );

		try {
			$this->notice()->handle_dismiss();
		} catch ( \Rtgodam_Json_Done $e ) {
			// wp_die() stand-in; the response is in the stub state.
			unset( $e );
		}

		return $GLOBALS['rtgodam_stub']['json'];
	}

	/**
	 * Hooks go where they say, so the notice is only ever printed in the admin.
	 */
	public function test_registers_its_hooks() {
		$notice = $this->notice();

		$this->assertTrue( has_action( 'admin_init', array( $notice, 'record_start' ) ) );
		$this->assertTrue( has_action( 'admin_notices', array( $notice, 'render_notice' ) ) );
		$this->assertTrue( has_action( 'wp_ajax_' . Review_Request::AJAX_ACTION, array( $notice, 'handle_dismiss' ) ) );
	}

	/**
	 * Three finished videos, a week and a day in, an administrator on the Media Library:
	 * the notice shows.
	 */
	public function test_shows_when_every_condition_holds() {
		$this->assertTrue( $this->notice()->should_show() );
	}

	/**
	 * @return array<string, array{int, bool}>
	 */
	public function video_counts() {
		return array(
			'none'  => array( 0, false ),
			'two'   => array( 2, false ),
			'three' => array( 3, true ),
			'four'  => array( 4, true ),
		);
	}

	/**
	 * @dataProvider video_counts
	 *
	 * @param int  $count    Finished videos.
	 * @param bool $expected Whether the notice shows.
	 */
	public function test_needs_three_finished_videos( $count, $expected ) {
		$GLOBALS['rtgodam_stub']['finished_video_ids'] = array_slice( array( 11, 12, 13, 14 ), 0, $count );

		$this->assertSame( $expected, $this->notice()->should_show() );
	}

	/**
	 * The lookup counts only the site's own finished videos, and reads just enough rows to
	 * tell "at least three" from "fewer".
	 */
	public function test_video_lookup_is_limited_and_skips_demo_videos() {
		$this->notice()->should_show();

		$args = $GLOBALS['rtgodam_stub']['wp_query_args'];

		$this->assertSame( 'attachment', $args['post_type'] );
		$this->assertSame( 'video', $args['post_mime_type'] );
		$this->assertSame( 3, $args['posts_per_page'] );
		$this->assertSame( 'ids', $args['fields'] );
		$this->assertContains(
			array(
				'key'   => 'rtgodam_transcoding_status',
				'value' => 'transcoded',
			),
			$args['meta_query']
		);
		$this->assertContains(
			array(
				'key'     => 'rtgodam_is_demo_attachment',
				'compare' => 'NOT EXISTS',
			),
			$args['meta_query']
		);
	}

	/**
	 * Sites that keep media on another site switch context on these two hooks, so the
	 * lookup runs between them, and the second one fires even when the lookup fails.
	 */
	public function test_video_lookup_runs_inside_the_attachment_lookup_hooks() {
		$GLOBALS['rtgodam_stub']['lookup_log'] = array();
		add_action(
			'rtgodam_before_attachment_lookup',
			function () {
				$GLOBALS['rtgodam_stub']['lookup_log'][] = 'before';
			}
		);
		add_action(
			'rtgodam_after_attachment_lookup',
			function () {
				$GLOBALS['rtgodam_stub']['lookup_log'][] = 'after';
			}
		);

		$this->notice()->should_show();
		$this->assertSame( array( 'before', 'query', 'after' ), $GLOBALS['rtgodam_stub']['lookup_log'] );

		$GLOBALS['rtgodam_stub']['lookup_log']   = array();
		$GLOBALS['rtgodam_stub']['query_throws'] = true;

		try {
			$this->notice()->should_show();
			$this->fail( 'The lookup failure should have propagated.' );
		} catch ( \RuntimeException $e ) {
			$this->assertSame( array( 'before', 'query', 'after' ), $GLOBALS['rtgodam_stub']['lookup_log'] );
		}
	}

	/**
	 * Cheaper checks come first: a hidden notice never runs the video lookup.
	 */
	public function test_no_video_lookup_when_an_earlier_check_fails() {
		$GLOBALS['rtgodam_stub']['screen_id'] = 'edit-post';

		$this->assertFalse( $this->notice()->should_show() );
		$this->assertArrayNotHasKey( 'wp_query_args', $GLOBALS['rtgodam_stub'] );
	}

	/**
	 * @return array<string, array{int, bool}> Seconds since the start, whether it shows.
	 */
	public function waits() {
		$day = DAY_IN_SECONDS;

		return array(
			'just started'   => array( 0, false ),
			'six days'       => array( 6 * $day, false ),
			'a minute short' => array( 7 * $day - 60, false ),
			'exactly seven'  => array( 7 * $day, true ),
			'a month in'     => array( 30 * $day, true ),
		);
	}

	/**
	 * @dataProvider waits
	 *
	 * @param int  $elapsed  Seconds since the start.
	 * @param bool $expected Whether the notice shows.
	 */
	public function test_waits_seven_days_after_the_start( $elapsed, $expected ) {
		$now = 1800000000;

		$this->assertSame( $expected, Review_Request::has_waited_long_enough( $now - $elapsed, $now ) );
	}

	/**
	 * With no recorded start, there is nothing to measure from.
	 */
	public function test_hidden_when_no_start_was_recorded() {
		unset( $GLOBALS['rtgodam_stub']['options'][ Review_Request::STARTED_OPTION ] );

		$this->assertFalse( $this->notice()->should_show() );
		$this->assertFalse( Review_Request::has_waited_long_enough( false, time() ) );
		$this->assertFalse( Review_Request::has_waited_long_enough( '', time() ) );
	}

	/**
	 * The clock starts the first time an admin screen loads, and never restarts.
	 */
	public function test_records_the_start_once() {
		unset( $GLOBALS['rtgodam_stub']['options'][ Review_Request::STARTED_OPTION ] );

		$before = time();
		$this->notice()->record_start();
		$first = $GLOBALS['rtgodam_stub']['options'][ Review_Request::STARTED_OPTION ];

		$this->assertGreaterThanOrEqual( $before, $first );
		$this->assertLessThanOrEqual( time(), $first );

		$GLOBALS['rtgodam_stub']['options'][ Review_Request::STARTED_OPTION ] = $before - 5 * DAY_IN_SECONDS;
		$this->notice()->record_start();

		$this->assertSame( $before - 5 * DAY_IN_SECONDS, $GLOBALS['rtgodam_stub']['options'][ Review_Request::STARTED_OPTION ] );
	}

	/**
	 * Only administrators see it.
	 */
	public function test_hidden_without_manage_options() {
		$GLOBALS['rtgodam_stub']['caps'] = array( 'edit_posts', 'upload_files' );

		$this->assertFalse( $this->notice()->should_show() );
	}

	/**
	 * Never in network admin, even for a super admin on a listed screen.
	 */
	public function test_hidden_in_network_admin() {
		$GLOBALS['rtgodam_stub']['is_network_admin'] = true;
		$GLOBALS['rtgodam_stub']['screen_id']        = 'plugins-network';

		$this->assertFalse( $this->notice()->should_show() );

		$GLOBALS['rtgodam_stub']['screen_id'] = 'plugins';

		$this->assertFalse( $this->notice()->should_show() );
	}

	/**
	 * @return array<string, array{string, bool}>
	 */
	public function screens() {
		return array(
			'WordPress Dashboard' => array( 'dashboard', true ),
			'Media Library'       => array( 'upload', true ),
			'Plugins'             => array( 'plugins', true ),
			'GoDAM Dashboard'     => array( 'toplevel_page_rtgodam', false ),
			'GoDAM Settings'      => array( 'godam_page_rtgodam_settings', false ),
			'GoDAM Media Editor'  => array( 'godam_page_rtgodam_media_editor', false ),
			'Posts list'          => array( 'edit-post', false ),
			'Add Media'           => array( 'media', false ),
			'Network Dashboard'   => array( 'dashboard-network', false ),
			'Network Plugins'     => array( 'plugins-network', false ),
		);
	}

	/**
	 * @dataProvider screens
	 *
	 * @param string $screen_id Current screen ID.
	 * @param bool   $expected  Whether the notice shows.
	 */
	public function test_shows_only_on_dashboard_media_library_and_plugins( $screen_id, $expected ) {
		$GLOBALS['rtgodam_stub']['screen_id'] = $screen_id;

		$this->assertSame( $expected, $this->notice()->should_show() );
	}

	/**
	 * No screen at all (a request that never set one) shows nothing.
	 */
	public function test_hidden_without_a_screen() {
		unset( $GLOBALS['rtgodam_stub']['screen_id'] );

		$this->assertFalse( $this->notice()->should_show() );
	}

	/**
	 * "Leave a review" and "I already did" hide it for good, "Maybe later" for 30 days.
	 */
	public function test_a_users_choice_hides_the_notice() {
		$now = 1800000000;

		$this->assertFalse( Review_Request::is_hidden_for_user( '', '', $now ), 'No choice yet.' );
		$this->assertTrue( Review_Request::is_hidden_for_user( '1', '', $now ), 'Never again.' );
		$this->assertTrue( Review_Request::is_hidden_for_user( '', $now + 1, $now ), 'Snoozed, still running.' );
		$this->assertFalse( Review_Request::is_hidden_for_user( '', $now, $now ), 'Snooze ended this second.' );
		$this->assertFalse( Review_Request::is_hidden_for_user( '', $now - DAY_IN_SECONDS, $now ), 'Snooze ended.' );
	}

	/**
	 * The stored choice reaches the decision for that user only.
	 */
	public function test_choices_are_per_user() {
		$GLOBALS['rtgodam_stub']['user_meta'][ self::ADMIN_ID ][ Review_Request::NEVER_META ] = 1;

		$this->assertFalse( $this->notice()->should_show(), 'The user who chose is not asked again.' );

		$GLOBALS['rtgodam_stub']['user_id'] = self::OTHER_ID;

		$this->assertTrue( $this->notice()->should_show(), 'Another administrator still is.' );
	}

	/**
	 * A snoozed notice comes back once the 30 days are over.
	 */
	public function test_maybe_later_comes_back_after_thirty_days() {
		$GLOBALS['rtgodam_stub']['user_meta'][ self::ADMIN_ID ][ Review_Request::SNOOZED_UNTIL_META ] = time() + DAY_IN_SECONDS;

		$this->assertFalse( $this->notice()->should_show() );

		$GLOBALS['rtgodam_stub']['user_meta'][ self::ADMIN_ID ][ Review_Request::SNOOZED_UNTIL_META ] = time() - 1;

		$this->assertTrue( $this->notice()->should_show() );
	}

	/**
	 * @return array<string, array{string}>
	 */
	public function permanent_choices() {
		return array(
			'Leave a review' => array( 'review' ),
			'I already did'  => array( 'done' ),
		);
	}

	/**
	 * Both buttons store the same thing for the current user, so a click on the review
	 * button cannot be told apart from "I already did".
	 *
	 * @dataProvider permanent_choices
	 *
	 * @param string $choice The `choice` POST field.
	 */
	public function test_review_and_already_did_store_a_permanent_dismissal( $choice ) {
		$response = $this->dismiss( $choice );

		$this->assertTrue( $response['success'] );
		$this->assertSame(
			array( self::ADMIN_ID => array( Review_Request::NEVER_META => 1 ) ),
			$GLOBALS['rtgodam_stub']['user_meta']
		);
		$this->assertFalse( $this->notice()->should_show() );
	}

	/**
	 * "Maybe later" stores a time 30 days out and nothing else.
	 */
	public function test_maybe_later_stores_thirty_days() {
		$before   = time();
		$response = $this->dismiss( 'later' );

		$this->assertTrue( $response['success'] );
		$this->assertSame( array( self::ADMIN_ID ), array_keys( $GLOBALS['rtgodam_stub']['user_meta'] ) );
		$this->assertSame( array( Review_Request::SNOOZED_UNTIL_META ), array_keys( $GLOBALS['rtgodam_stub']['user_meta'][ self::ADMIN_ID ] ) );

		$until = $GLOBALS['rtgodam_stub']['user_meta'][ self::ADMIN_ID ][ Review_Request::SNOOZED_UNTIL_META ];

		$this->assertGreaterThanOrEqual( $before + 30 * DAY_IN_SECONDS, $until );
		$this->assertLessThanOrEqual( time() + 30 * DAY_IN_SECONDS, $until );
		$this->assertFalse( $this->notice()->should_show() );
	}

	/**
	 * An unknown choice, an empty one, and a missing one all change nothing.
	 */
	public function test_unknown_choice_is_rejected() {
		foreach ( array( 'delete-everything', '', 'reviewed' ) as $choice ) {
			$response = $this->dismiss( $choice );

			$this->assertFalse( $response['success'] );
			$this->assertSame( 400, $response['status'] );
		}

		$_POST = array();
		try {
			$this->notice()->handle_dismiss();
		} catch ( \Rtgodam_Json_Done $e ) {
			unset( $e );
		}

		$this->assertSame( 400, $GLOBALS['rtgodam_stub']['json']['status'] );
		$this->assertArrayNotHasKey( 'user_meta', $GLOBALS['rtgodam_stub'] );
	}

	/**
	 * Only an administrator's dismissal is stored.
	 */
	public function test_dismissal_needs_manage_options() {
		$GLOBALS['rtgodam_stub']['caps'] = array( 'edit_posts' );

		$response = $this->dismiss( 'done' );

		$this->assertFalse( $response['success'] );
		$this->assertSame( 403, $response['status'] );
		$this->assertArrayNotHasKey( 'user_meta', $GLOBALS['rtgodam_stub'] );
	}

	/**
	 * A request without a valid nonce is stopped before it stores anything.
	 */
	public function test_dismissal_needs_a_valid_nonce() {
		$GLOBALS['rtgodam_stub']['nonce_ok'] = false;

		$response = $this->dismiss( 'done' );

		$this->assertFalse( $response['success'] );
		$this->assertSame( 403, $response['status'] );
		$this->assertArrayNotHasKey( 'user_meta', $GLOBALS['rtgodam_stub'] );
	}

	/**
	 * The markup: the right link in a new tab, three buttons, and a script carrying the
	 * nonce for the dismissal.
	 */
	public function test_notice_markup() {
		ob_start();
		$this->notice()->render_notice();
		$html = ob_get_clean();

		$this->assertStringContainsString( 'class="notice notice-info is-dismissible rtgodam-review-request"', $html );
		$this->assertStringContainsString( 'href="https://wordpress.org/support/plugin/godam/reviews/?filter=5#new-post"', $html );
		$this->assertStringContainsString( 'target="_blank" rel="noopener noreferrer"', $html );
		$this->assertSame( 1, substr_count( $html, 'data-rtgodam-review-choice="review"' ) );
		$this->assertSame( 1, substr_count( $html, 'data-rtgodam-review-choice="later"' ) );
		$this->assertSame( 1, substr_count( $html, 'data-rtgodam-review-choice="done"' ) );
		$this->assertStringContainsString( 'Leave a review', $html );
		$this->assertStringContainsString( 'Maybe later', $html );
		$this->assertStringContainsString( 'I already did', $html );
		$this->assertStringContainsString( '"nonce":"nonce-for-' . Review_Request::AJAX_ACTION . '"', $html );
		$this->assertStringContainsString( '"action":"' . Review_Request::AJAX_ACTION . '"', $html );
	}

	/**
	 * Nothing is printed, script included, when the notice should not show.
	 */
	public function test_nothing_is_printed_when_hidden() {
		$GLOBALS['rtgodam_stub']['finished_video_ids'] = array( 11, 12 );

		ob_start();
		$this->notice()->render_notice();

		$this->assertSame( '', ob_get_clean() );
	}
}
