<?php
/**
 * Unit tests for the GoDAM Dashboard widget's rules.
 *
 * Covers what decides what the widget shows: which state it is in, how
 * processing statuses and library files are counted, which tiles appear and
 * stay, which connect prompt a library gets, what needs attention and for
 * whom, and how analytics responses are shaped for the script.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Dashboard_Widget;
use RTGODAM\Inc\Enums\Api_Key_Status;
use RTGODAM\Inc\REST_API\Dashboard_Widget_Summary;

/**
 * @covers \RTGODAM\Inc\Dashboard_Widget
 * @covers \RTGODAM\Inc\REST_API\Dashboard_Widget_Summary
 */
class DashboardWidgetTest extends TestCase {

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Transcoding counts with nothing in flight, overridden per test.
	 *
	 * @param array $overrides Counts to change.
	 * @return array
	 */
	private function counts( array $overrides = array() ) {
		return array_merge(
			array(
				'transcoded' => 0,
				'failed'     => 0,
				'processing' => 0,
				'total'      => 0,
			),
			$overrides
		);
	}

	/**
	 * The ids of a list of attention items, in order.
	 *
	 * @param array $items Attention items.
	 * @return string[]
	 */
	private function ids( array $items ) {
		return array_column( $items, 'id' );
	}

	/** No key means the connect prompt, whatever else is on the site. */
	public function test_no_key_is_not_connected() {
		$this->assertSame( 'not_connected', Dashboard_Widget::determine_state( Api_Key_Status::NO_API_KEY, 12 ) );
	}

	/** A connected site stays in setup until its first video is ready to stream. */
	public function test_setting_up_until_first_transcode() {
		$this->assertSame( 'setting_up', Dashboard_Widget::determine_state( Api_Key_Status::VALID, 0 ) );
		$this->assertSame( 'active', Dashboard_Widget::determine_state( Api_Key_Status::VALID, 1 ) );
	}

	/** An expired key still shows the value delivered; the key goes under Needs attention. */
	public function test_expired_key_keeps_the_active_state() {
		$this->assertSame( 'active', Dashboard_Widget::determine_state( Api_Key_Status::EXPIRED, 5 ) );
	}

	/**
	 * A processing status row.
	 *
	 * @param string $mime   MIME type.
	 * @param string $status Status as stored.
	 * @param int    $total  Attachments.
	 * @return array
	 */
	private function row( $mime, $status, $total ) {
		return array(
			'mime'   => $mime,
			'status' => $status,
			'total'  => $total,
		);
	}

	/** Statuses are matched case-insensitively and grouped, finished files are split by type, and every status counts toward the total. */
	public function test_status_rows_are_grouped_and_split_by_type() {
		$counts = Dashboard_Widget::summarize_status_rows(
			array(
				$this->row( 'video/mp4', 'Transcoded', 3 ),
				$this->row( 'video/mp4', 'transcoded', 2 ),
				$this->row( 'audio/mpeg', 'transcoded', 1 ),
				$this->row( 'application/pdf', 'transcoded', 2 ),
				$this->row( 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'transcoded', 1 ),
				$this->row( 'image/jpeg', 'transcoded', 4 ),
				$this->row( 'video/mp4', 'failed', 1 ),
				$this->row( 'audio/mpeg', 'blocked', 1 ),
				$this->row( 'video/mp4', 'Queued', 2 ),
				$this->row( 'video/mp4', 'transcoding', 1 ),
				$this->row( 'video/mp4', 'not_started', 4 ),
			)
		);

		$this->assertSame(
			array(
				'videos_ready'    => 5,
				'audio_ready'     => 1,
				'documents_ready' => 3,
				'transcoded'      => 9,
				'failed'          => 2,
				'processing'      => 3,
				'total'           => 22,
			),
			$counts
		);
	}

	/** Every MIME type lands in one family; only Word, Excel and PowerPoint files (and their OpenDocument twins) count as office files. */
	public function test_mime_families() {
		$this->assertSame( 'images', Dashboard_Widget::mime_family( 'image/png' ) );
		$this->assertSame( 'videos', Dashboard_Widget::mime_family( 'VIDEO/MP4' ) );
		$this->assertSame( 'videos', Dashboard_Widget::mime_family( 'application/ogg' ) );
		$this->assertSame( 'audio', Dashboard_Widget::mime_family( 'audio/mpeg' ) );
		$this->assertSame( 'documents', Dashboard_Widget::mime_family( 'application/pdf' ) );
		$this->assertSame( 'documents', Dashboard_Widget::mime_family( 'text/plain' ) );
		$this->assertSame( 'other', Dashboard_Widget::mime_family( 'application/zip' ) );
		$this->assertSame( 'other', Dashboard_Widget::mime_family( '' ) );

		$this->assertTrue( Dashboard_Widget::is_office_mime( 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ) );
		$this->assertTrue( Dashboard_Widget::is_office_mime( 'application/msword' ) );
		$this->assertTrue( Dashboard_Widget::is_office_mime( 'application/vnd.oasis.opendocument.spreadsheet' ) );
		$this->assertFalse( Dashboard_Widget::is_office_mime( 'application/pdf' ) );
		$this->assertFalse( Dashboard_Widget::is_office_mime( 'text/csv' ) );
		$this->assertFalse( Dashboard_Widget::is_office_mime( 'application/csv' ) );
		$this->assertFalse( Dashboard_Widget::is_office_mime( 'video/mp4' ) );
	}

	/** Library counts by MIME type fold into families, with office files counted inside documents too. */
	public function test_group_mime_counts() {
		$this->assertSame(
			array(
				'images'    => 7,
				'videos'    => 2,
				'audio'     => 1,
				'documents' => 4,
				'other'     => 1,
				'office'    => 3,
			),
			Dashboard_Widget::group_mime_counts(
				array(
					'image/jpeg'         => 5,
					'image/png'          => 2,
					'video/mp4'          => 2,
					'audio/mpeg'         => 1,
					'application/pdf'    => 1,
					'application/msword' => 2,
					'application/vnd.ms-excel' => 1,
					'application/zip'    => 1,
					'text/html'          => -4,
				)
			)
		);
	}

	/** From 80% a quota is a warning, over the limit it is an error, and errors come first. */
	public function test_usage_thresholds() {
		$items = Dashboard_Widget::build_attention_items(
			Api_Key_Status::VALID,
			$this->counts(),
			array(
				'storage_used'    => 43,
				'total_storage'   => 50,
				'bandwidth_used'  => 104,
				'total_bandwidth' => 100,
			),
			true
		);

		$this->assertSame( array( 'bandwidth_over', 'storage_high' ), $this->ids( $items ) );
		$this->assertSame( 'error', $items[0]['tone'] );
		$this->assertSame( 104.0, $items[0]['percent'] );
		$this->assertSame( 86.0, $items[1]['percent'] );
	}

	/** Below 80% there is nothing to flag, and exactly at the limit is not over it. */
	public function test_usage_below_warning_and_at_the_limit() {
		$below = Dashboard_Widget::build_attention_items(
			Api_Key_Status::VALID,
			$this->counts(),
			array(
				'storage_used'  => 39.9,
				'total_storage' => 50,
			),
			true
		);
		$this->assertSame( array(), $below );

		$at_limit = Dashboard_Widget::build_attention_items(
			Api_Key_Status::VALID,
			$this->counts(),
			array(
				'storage_used'  => 50,
				'total_storage' => 50,
			),
			true
		);
		$this->assertSame( array( 'storage_high' ), $this->ids( $at_limit ) );
	}

	/** Without quota figures there is nothing to say about usage, rather than a divide by zero. */
	public function test_missing_quota_is_skipped() {
		$items = Dashboard_Widget::build_attention_items(
			Api_Key_Status::VALID,
			$this->counts(),
			array(
				'storage_used'  => 10,
				'total_storage' => 0,
			),
			true
		);

		$this->assertSame( array(), $items );
	}

	/** Account items are for admins; failed transcodes are for everyone who uploads. */
	public function test_non_admins_see_only_transcode_failures() {
		$items = Dashboard_Widget::build_attention_items(
			Api_Key_Status::EXPIRED,
			$this->counts( array( 'failed' => 2 ) ),
			array(
				'storage_used'  => 60,
				'total_storage' => 50,
			),
			false
		);

		$this->assertSame( array( 'transcode_failed' ), $this->ids( $items ) );
		$this->assertSame( 2, $items[0]['count'] );
	}

	/** An expired key is an error; a failed check is a warning that clears itself. */
	public function test_key_items_for_admins() {
		$expired = Dashboard_Widget::build_attention_items( Api_Key_Status::EXPIRED, $this->counts(), array(), true );
		$this->assertSame( array( 'key_expired' ), $this->ids( $expired ) );
		$this->assertSame( 'error', $expired[0]['tone'] );

		$unverified = Dashboard_Widget::build_attention_items( Api_Key_Status::VERIFICATION_FAILED, $this->counts(), array(), true );
		$this->assertSame( array( 'key_unverified' ), $this->ids( $unverified ) );
		$this->assertSame( 'warning', $unverified[0]['tone'] );
	}

	/** Errors come before warnings, whatever order the rules ran in. */
	public function test_errors_come_first() {
		$items = Dashboard_Widget::build_attention_items(
			Api_Key_Status::VERIFICATION_FAILED,
			$this->counts( array( 'failed' => 1 ) ),
			array(
				'storage_used'  => 45,
				'total_storage' => 50,
			),
			true
		);

		$this->assertSame( array( 'transcode_failed', 'key_unverified', 'storage_high' ), $this->ids( $items ) );
	}

	/** Lifetime metrics become receipts, and countries with no views are not counted. */
	public function test_summary_maps_receipts() {
		$summary = Dashboard_Widget_Summary::shape_summary(
			array(
				'play_time'      => 7200.5,
				'plays'          => 42,
				'unique_viewers' => 30,
				'page_load'      => 180,
				'country_views'  => array(
					'US' => 20,
					'IN' => 10,
					'FR' => 0,
				),
			),
			array(),
			1700000000
		);

		$this->assertSame( 'success', $summary['status'] );
		$this->assertSame(
			array(
				'watch_seconds'  => 7200.5,
				'plays'          => 42,
				'unique_viewers' => 30,
				'countries'      => 2,
				'times_shown'    => 180,
			),
			$summary['receipts']
		);
		$this->assertSame( array(), $summary['top_videos'] );
		$this->assertSame( array(), $summary['history'] );
		$this->assertSame( 1700000000, $summary['fetched_at'] );
	}

	/** Missing or negative numbers become zeros, never negatives. */
	public function test_summary_defaults_to_zero() {
		$summary = Dashboard_Widget_Summary::shape_summary( array( 'plays' => -3 ), array(), 0 );

		$this->assertSame(
			array(
				'watch_seconds'  => 0.0,
				'plays'          => 0,
				'unique_viewers' => 0,
				'countries'      => 0,
				'times_shown'    => 0,
			),
			$summary['receipts']
		);
	}

	/** Top videos are capped at three, rows without an ID are dropped, and titles are decoded for textContent. */
	public function test_summary_shapes_top_videos() {
		$summary = Dashboard_Widget_Summary::shape_summary(
			array(),
			array(
				array(
					'video_id'  => 7,
					'title'     => 'Tom&#8217;s <b>demo</b>',
					'plays'     => 5,
					'play_time' => 90,
				),
				array( 'title' => 'No ID' ),
				array(
					'video_id' => 8,
					'title'    => 'B',
				),
				array(
					'video_id' => 9,
					'title'    => 'C',
				),
				array(
					'video_id' => 10,
					'title'    => 'D',
				),
			),
			0
		);

		$this->assertSame( array( 7, 8, 9 ), array_column( $summary['top_videos'], 'id' ) );
		$this->assertSame( "Tom\u{2019}s demo", $summary['top_videos'][0]['title'] );
		$this->assertSame( 90.0, $summary['top_videos'][0]['watch_seconds'] );
		$this->assertSame( 'admin.php?page=rtgodam_analytics&id=7', $summary['top_videos'][0]['url'] );
	}

	/** The chart gets one row per day of the window, oldest first, with quiet days as zero. */
	public function test_history_fills_the_window() {
		$history = Dashboard_Widget_Summary::shape_history(
			array(
				array(
					'date'  => '2026-09-24',
					'plays' => 5,
				),
				array(
					'date'  => '2026-09-22',
					'plays' => 3,
				),
				array(
					'date'  => '2026-09-22',
					'plays' => 2,
				),
				array(
					'date'  => '2026-08-01',
					'plays' => 9,
				),
				array( 'plays' => 4 ),
			),
			gmmktime( 12, 0, 0, 9, 24, 2026 ),
			3
		);

		$this->assertSame(
			array(
				array(
					'date'  => '2026-09-22',
					'plays' => 5,
				),
				array(
					'date'  => '2026-09-23',
					'plays' => 0,
				),
				array(
					'date'  => '2026-09-24',
					'plays' => 5,
				),
			),
			$history
		);
	}

	/** Dates may carry a time part, and negative counts never reach the chart. */
	public function test_history_normalises_dates_and_counts() {
		$history = Dashboard_Widget_Summary::shape_history(
			array(
				array(
					'date'  => '2026-09-24T00:00:00',
					'plays' => -2,
				),
			),
			gmmktime( 0, 0, 0, 9, 24, 2026 ),
			1
		);

		$this->assertSame(
			array(
				array(
					'date'  => '2026-09-24',
					'plays' => 0,
				),
			),
			$history
		);
	}

	/** The origin keeps the port and drops any path, the form the player records. */
	public function test_site_origin() {
		$this->assertSame( 'http://localhost:9400', Dashboard_Widget_Summary::get_site_origin( 'http://localhost:9400/' ) );
		$this->assertSame( 'https://example.com', Dashboard_Widget_Summary::get_site_origin( 'https://example.com/blog' ) );
		$this->assertSame( '', Dashboard_Widget_Summary::get_site_origin( 'not a url' ) );
	}

	/** Admins are asked, once; never while something is failing, and not during a "Not now" snooze. */
	public function test_review_ask_eligibility() {
		$now     = 1700000000;
		$nothing = array();
		$failing = array(
			array(
				'id'   => 'transcode_failed',
				'tone' => 'error',
			),
		);
		$warning = array(
			array(
				'id'   => 'storage_high',
				'tone' => 'warning',
			),
		);

		$this->assertTrue( Dashboard_Widget::review_ask_eligible( array(), $now, true, $nothing ) );
		$this->assertTrue( Dashboard_Widget::review_ask_eligible( false, $now, true, $nothing ) );
		$this->assertTrue( Dashboard_Widget::review_ask_eligible( array(), $now, true, $warning ) );

		$this->assertFalse( Dashboard_Widget::review_ask_eligible( array(), $now, false, $nothing ) );
		$this->assertFalse( Dashboard_Widget::review_ask_eligible( array(), $now, true, $failing ) );
		$this->assertFalse( Dashboard_Widget::review_ask_eligible( array( 'status' => 'reviewed' ), $now, true, $nothing ) );
		$this->assertFalse( Dashboard_Widget::review_ask_eligible( array( 'status' => 'never' ), $now, true, $nothing ) );

		$snoozed = array(
			'status' => 'later',
			'until'  => $now + 1,
		);
		$this->assertFalse( Dashboard_Widget::review_ask_eligible( $snoozed, $now, true, $nothing ) );

		$snoozed['until'] = $now;
		$this->assertTrue( Dashboard_Widget::review_ask_eligible( $snoozed, $now, true, $nothing ) );
	}

	/** "Not now" holds the ask back 30 days; a review or "No thanks" ends it; anything unknown counts as "Not now". */
	public function test_review_choice_record() {
		$now = 1700000000;

		$this->assertSame(
			array(
				'status' => 'reviewed',
				'at'     => $now,
			),
			Dashboard_Widget::review_choice_record( 'review', $now )
		);
		$this->assertSame(
			array(
				'status' => 'never',
				'at'     => $now,
			),
			Dashboard_Widget::review_choice_record( 'never', $now )
		);
		$this->assertSame(
			array(
				'status' => 'later',
				'at'     => $now,
				'until'  => $now + 30 * DAY_IN_SECONDS,
			),
			Dashboard_Widget::review_choice_record( 'later', $now )
		);
		$this->assertSame( 'later', Dashboard_Widget::review_choice_record( 'bogus', $now )['status'] );
	}

	/** A tile shows once it reaches its floor, stays once shown, and keeps the display order. */
	public function test_visible_tiles_apply_floors_and_remember() {
		$result = Dashboard_Widget::visible_tiles(
			array(
				'watch_seconds' => 3599.0,
				'plays'         => 25,
				'library_files' => 9,
				'folders'       => 3,
				'videos_ready'  => 0,
			),
			array( 'library_files' )
		);

		$this->assertSame( array( 'plays', 'library_files', 'folders' ), $result['show'] );
		$this->assertSame( array( 'library_files', 'plays', 'folders' ), $result['seen'] );
	}

	/** A tile with no value this time (the Watching tiles during the page render) is skipped but not forgotten. */
	public function test_visible_tiles_keep_tiles_without_a_value() {
		$result = Dashboard_Widget::visible_tiles( array( 'plays' => 0 ), array( 'chart_plays' ) );

		$this->assertSame( array(), $result['show'] );
		$this->assertSame( array( 'chart_plays' ), $result['seen'] );
	}

	/** When nothing new appears, the seen list comes back unchanged, so it is not written again. */
	public function test_visible_tiles_seen_list_is_stable() {
		$seen = array( 'plays', 'videos_ready' );

		$this->assertSame( $seen, Dashboard_Widget::visible_tiles( array( 'plays' => 30 ), $seen )['seen'] );
	}

	/** Every tile in a section has a floor, and every floor belongs to a section or chart. */
	public function test_every_tile_has_a_floor() {
		$floors = array_keys( Dashboard_Widget::FLOORS );
		$tiles  = array_merge( Dashboard_Widget::REMOTE_TILES, Dashboard_Widget::LIBRARY_TILES, array( 'chart_library' ), Dashboard_Widget::READY_TILES );

		sort( $floors );
		sort( $tiles );

		$this->assertSame( $floors, $tiles );
		$this->assertSame( array(), array_diff( Dashboard_Widget::WATCHING_TILES, Dashboard_Widget::REMOTE_TILES ) );
	}

	/** Library values add up the five families (office files are not counted twice), and files in use waits for the usage scan. */
	public function test_local_values() {
		$library = array(
			'types'        => array(
				'images'    => 5,
				'videos'    => 3,
				'audio'     => 0,
				'documents' => 2,
				'other'     => 1,
				'office'    => 1,
			),
			'folder_files' => 4,
			'folders'      => 2,
			'files_in_use' => null,
			'captions'     => 1,
		);
		$counts  = array(
			'videos_ready'    => 2,
			'audio_ready'     => 0,
			'documents_ready' => 1,
		);

		$values = Dashboard_Widget::local_values( $library, $counts, 7200 );

		$this->assertSame( 11, $values['library_files'] );
		$this->assertSame( 4, $values['chart_library'] );
		$this->assertSame( 7200.0, $values['video_seconds'] );
		$this->assertSame( 2, $values['videos_ready'] );
		$this->assertSame( 1, $values['captions'] );
		$this->assertArrayNotHasKey( 'files_in_use', $values );

		$library['files_in_use'] = 6;
		$this->assertSame( 6, Dashboard_Widget::local_values( $library, $counts, 0 )['files_in_use'] );
	}

	/** Watching values come from the summary; the chart's value is its days with plays. */
	public function test_remote_values() {
		$summary = Dashboard_Widget_Summary::shape_summary(
			array(
				'play_time'      => 90,
				'plays'          => 3,
				'unique_viewers' => 2,
				'page_load'      => 40,
				'country_views'  => array( 'US' => 1 ),
			),
			array(
				array(
					'video_id' => 1,
					'title'    => 'A',
					'plays'    => 3,
				),
			),
			0,
			array(
				array(
					'date'  => '2026-09-01',
					'plays' => 0,
				),
				array(
					'date'  => '2026-09-02',
					'plays' => 2,
				),
				array(
					'date'  => '2026-09-03',
					'plays' => 1,
				),
			)
		);

		$this->assertSame(
			array(
				'watch_seconds' => 90.0,
				'plays'         => 3,
				'viewers'       => 2,
				'countries'     => 1,
				'times_shown'   => 40,
				'chart_plays'   => 2,
				'top_videos'    => 1,
			),
			Dashboard_Widget::remote_values( $summary )
		);
	}

	/** A successful summary gets its show list; an error is passed through and remembers nothing. */
	public function test_add_visible_tiles() {
		$summary = Dashboard_Widget_Summary::shape_summary(
			array(
				'plays'     => 30,
				'page_load' => 99,
			),
			array(),
			0
		);

		$result = Dashboard_Widget_Summary::add_visible_tiles( $summary, array( 'times_shown' ) );
		$this->assertSame( array( 'plays', 'times_shown' ), $result['summary']['show'] );
		$this->assertSame( array( 'times_shown', 'plays' ), $result['seen'] );

		$error  = array(
			'status'    => 'error',
			'errorType' => 'microservice_error',
		);
		$result = Dashboard_Widget_Summary::add_visible_tiles( $error, array( 'plays' ) );
		$this->assertSame( $error, $result['summary'] );
		$this->assertSame( array( 'plays' ), $result['seen'] );
	}

	/** The connect prompt names the type the library has most of; ties go to video; images and PDFs alone get the library line. */
	public function test_pick_connect_prompt() {
		$types = array(
			'images'    => 1980,
			'videos'    => 48,
			'audio'     => 92,
			'documents' => 190,
			'other'     => 0,
			'office'    => 150,
		);

		$this->assertSame(
			array(
				'type'  => 'office',
				'count' => 150,
			),
			Dashboard_Widget::pick_connect_prompt( $types )
		);

		$tie = array(
			'videos' => 5,
			'office' => 5,
			'audio'  => 5,
		);
		$this->assertSame( 'videos', Dashboard_Widget::pick_connect_prompt( $tie )['type'] );

		$this->assertSame( 'audio', Dashboard_Widget::pick_connect_prompt( array( 'audio' => 10, 'videos' => 3 ) )['type'] );

		$this->assertSame(
			array(
				'type'  => 'library',
				'count' => 0,
			),
			Dashboard_Widget::pick_connect_prompt(
				array(
					'images'    => 100,
					'documents' => 20,
				)
			)
		);
	}

	/** Only real tiles link, and the two with no screen that lists them (files in use, captions) do not. */
	public function test_tile_links() {
		$this->assertSame( array(), array_diff( array_keys( Dashboard_Widget::TILE_LINKS ), array_keys( Dashboard_Widget::FLOORS ) ) );
		$this->assertArrayNotHasKey( 'files_in_use', Dashboard_Widget::TILE_LINKS );
		$this->assertArrayNotHasKey( 'captions', Dashboard_Widget::TILE_LINKS );

		foreach ( Dashboard_Widget::WATCHING_TILES as $id ) {
			$this->assertSame( 'godam', Dashboard_Widget::TILE_LINKS[ $id ] );
		}
	}

	/** Type filters use core's own keys; Documents is the key that lists PDF among its types. */
	public function test_media_filter_key() {
		$keys = array( 'image', 'audio', 'video', 'application/msword,application/pdf,application/rtf', 'application/vnd.ms-excel,text/csv' );

		$this->assertSame( 'video', Dashboard_Widget::media_filter_key( 'video', $keys ) );
		$this->assertSame( 'audio', Dashboard_Widget::media_filter_key( 'audio', $keys ) );
		$this->assertSame( 'application/msword,application/pdf,application/rtf', Dashboard_Widget::media_filter_key( 'document', $keys ) );
		$this->assertSame( '', Dashboard_Widget::media_filter_key( 'video', array( 'image' ) ) );
		$this->assertSame( '', Dashboard_Widget::media_filter_key( 'document', array( 'image', 'application/pdfx' ) ) );
		$this->assertSame( '', Dashboard_Widget::media_filter_key( 'archive', $keys ) );
	}

	/** The summary is for authors and above, like the analytics routes; answering the review ask is for admins only. */
	public function test_route_permissions() {
		$endpoint = ( new \ReflectionClass( Dashboard_Widget_Summary::class ) )->newInstanceWithoutConstructor();
		$routes   = array_column( $endpoint->get_rest_routes(), 'args', 'route' );

		$this->assertSame( array( '/dashboard-widget/summary', '/dashboard-widget/review-ask' ), array_keys( $routes ) );

		$summary = $routes['/dashboard-widget/summary']['permission_callback'];
		$review  = $routes['/dashboard-widget/review-ask']['permission_callback'];

		$GLOBALS['rtgodam_stub']['caps'] = array( 'read', 'edit_posts' );
		$this->assertFalse( call_user_func( $summary ) );

		$GLOBALS['rtgodam_stub']['caps'] = array( 'read', 'edit_posts', 'upload_files' );
		$this->assertTrue( call_user_func( $summary ) );
		$this->assertFalse( call_user_func( $review ) );

		$GLOBALS['rtgodam_stub']['caps'] = array( 'read', 'upload_files', 'manage_options' );
		$this->assertTrue( call_user_func( $review ) );
	}
}
