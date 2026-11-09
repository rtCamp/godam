<?php
/**
 * The cached transcript catches up with captions changed in GoDAM Central's own
 * dashboard: when the Transcription tab opens, and in the background (at most
 * every 12 hours) for the video SEO data.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Transcription;

/**
 * @covers \RTGODAM\Inc\REST_API\Transcription::refresh_cached_default
 * @covers \RTGODAM\Inc\REST_API\Transcription::maybe_schedule_refresh
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class TranscriptionCaptionRefreshTest extends TestCase {

	/**
	 * Load the code under test. The video SEO stubs go first, so the cron stubs
	 * that record what was scheduled are the ones defined.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array(
			'post_meta' => array(
				'rtgodam_transcoding_job_id' => 'job-1',
				'rtgodam_transcript_path'    => 'https://cdn.example/job/en.vtt',
			),
			'options'   => array( 'rtgodam-api-key' => 'key' ),
			'scheduled' => array(),
			'posts'     => array(),
		);

		$root = dirname( __DIR__, 2 );
		require_once $root . '/tests/stubs/hooks.php';
		require_once $root . '/tests/stubs/video-seo-functions.php';
		require_once $root . '/tests/stubs/engagement-functions.php';
		require_once $root . '/tests/stubs/media-file-functions.php';
		require_once $root . '/tests/stubs/option-functions.php';
		require_once $root . '/inc/classes/rest-api/class-base.php';
		require_once $root . '/inc/classes/rest-api/class-transcription.php';
	}

	/**
	 * Make Central answer the caption list with Spanish as the new default.
	 */
	private function central_default_is_spanish() {
		$GLOBALS['rtgodam_stub']['post_handler'] = static function () {
			return array(
				'code' => 200,
				'body' => json_encode( // phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode -- test fixture.
					array(
						'message' => array(
							'success'  => true,
							'captions' => array(
								array(
									'language'   => 'en',
									'vtt_path'   => 'https://cdn.example/job/en.vtt',
									'is_default' => false,
								),
								array(
									'language'   => 'es',
									'vtt_path'   => 'https://cdn.example/job/es.vtt',
									'is_default' => true,
								),
							),
						),
					)
				),
			);
		};
	}

	/**
	 * A default changed in Central reaches the cached transcript, and the time
	 * of the check is kept.
	 */
	public function test_follows_a_default_changed_in_central() {
		$this->central_default_is_spanish();

		$this->assertTrue( Transcription::refresh_cached_default( 7 ) );

		$meta = $GLOBALS['rtgodam_stub']['post_meta'];
		$this->assertSame( 'https://cdn.example/job/es.vtt', $meta['rtgodam_transcript_path'] );
		$this->assertGreaterThan( time() - 5, $meta[ Transcription::CHECKED_META ] );
		$this->assertStringEndsWith( 'godam_core.api.captions.list_captions', $GLOBALS['rtgodam_stub']['posts'][0]['url'] );
	}

	/**
	 * Central is not asked, and nothing changes, for a transcript uploaded in
	 * WordPress or one the user deleted.
	 *
	 * @dataProvider skipped_states
	 *
	 * @param string $key   Meta key that is set.
	 * @param string $value Its value.
	 */
	public function test_leaves_uploads_and_deletes_alone( $key, $value ) {
		$GLOBALS['rtgodam_stub']['post_meta'][ $key ] = $value;
		$this->central_default_is_spanish();

		$this->assertFalse( Transcription::refresh_cached_default( 7 ) );

		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['posts'] );
		$this->assertSame( 'https://cdn.example/job/en.vtt', $GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcript_path'] );
	}

	/**
	 * States in which the refresh must not run.
	 *
	 * @return array
	 */
	public function skipped_states() {
		return array(
			'uploaded in WordPress' => array( 'rtgodam_transcript_source', 'upload' ),
			'deleted by the user'   => array( 'rtgodam_transcript_deleted', '1' ),
		);
	}

	/**
	 * Make Central answer the caption list with the given captions.
	 *
	 * @param array $captions Caption rows, as Central lists them.
	 */
	private function central_lists( $captions ) {
		$GLOBALS['rtgodam_stub']['post_handler'] = static function () use ( $captions ) {
			return array(
				'code' => 200,
				'body' => json_encode( // phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode -- test fixture.
					array(
						'message' => array(
							'success'  => true,
							'captions' => $captions,
						),
					)
				),
			);
		};
	}

	/**
	 * A default AI transcript that is still pending or has failed has no file
	 * yet. The transcript WordPress has stays while Central still lists it.
	 */
	public function test_keeps_the_cache_when_the_default_has_no_file() {
		$this->central_lists(
			array(
				array(
					'language'   => 'en',
					'vtt_path'   => 'https://cdn.example/job/en.vtt',
					'is_default' => false,
				),
				array(
					'language'   => 'und',
					'vtt_path'   => null,
					'status'     => 'Pending',
					'is_default' => true,
				),
			)
		);

		$this->assertTrue( Transcription::refresh_cached_default( 7 ) );
		$this->assertSame( 'https://cdn.example/job/en.vtt', $GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcript_path'] );
	}

	/**
	 * Central signs caption URLs with a fresh token on every request, so the
	 * cached URL and the listed one differ only in their query string. The
	 * transcript is still the same file and stays.
	 */
	public function test_keeps_a_signed_cache_when_the_default_has_no_file() {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcript_path'] = 'https://cdn.example/job/en.vtt?token=A&expires=1';
		$this->central_lists(
			array(
				array(
					'language'   => 'en',
					'vtt_path'   => 'https://cdn.example/job/en.vtt?token=B&expires=2',
					'is_default' => false,
				),
				array(
					'language'   => 'und',
					'vtt_path'   => null,
					'status'     => 'Pending',
					'is_default' => true,
				),
			)
		);

		$this->assertTrue( Transcription::refresh_cached_default( 7 ) );
		$this->assertSame( 'https://cdn.example/job/en.vtt?token=A&expires=1', $GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcript_path'] );
	}

	/**
	 * A transcription still running keeps its status, so the tab opens on the
	 * progress state instead of the Generate form.
	 */
	public function test_keeps_an_in_flight_status_when_nothing_is_cached() {
		unset( $GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcript_path'] );
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcript_status'] = 'Transcribing';
		$this->central_lists(
			array(
				array(
					'language'   => 'und',
					'vtt_path'   => null,
					'status'     => 'Pending',
					'is_default' => true,
				),
			)
		);

		$this->assertTrue( Transcription::refresh_cached_default( 7 ) );
		$this->assertSame( 'Transcribing', $GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcript_status'] );
	}

	/**
	 * A cached transcript Central no longer lists is cleared.
	 */
	public function test_clears_a_transcript_central_no_longer_has() {
		$this->central_lists(
			array(
				array(
					'language'   => 'und',
					'vtt_path'   => null,
					'status'     => 'Failed',
					'is_default' => true,
				),
			)
		);

		$this->assertTrue( Transcription::refresh_cached_default( 7 ) );
		$this->assertArrayNotHasKey( 'rtgodam_transcript_path', $GLOBALS['rtgodam_stub']['post_meta'] );
	}

	/**
	 * A failed call keeps what WordPress has.
	 */
	public function test_keeps_the_cache_when_central_fails() {
		$GLOBALS['rtgodam_stub']['post_handler'] = static function () {
			return array(
				'code' => 500,
				'body' => '{}',
			);
		};

		$this->assertFalse( Transcription::refresh_cached_default( 7 ) );
		$this->assertSame( 'https://cdn.example/job/en.vtt', $GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcript_path'] );
	}

	/**
	 * A video is queued when its last check is over 12 hours old, and only once.
	 */
	public function test_queues_a_video_after_12_hours_once() {
		$this->assertFalse( Transcription::maybe_schedule_refresh( 7, time() - HOUR_IN_SECONDS ) );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['scheduled'] );

		$this->assertTrue( Transcription::maybe_schedule_refresh( 7, time() - 13 * HOUR_IN_SECONDS ) );
		$this->assertFalse( Transcription::maybe_schedule_refresh( 7, 0 ) );

		$this->assertSame( array( 7 ), $GLOBALS['rtgodam_stub']['options'][ Transcription::REFRESH_QUEUE_OPTION ] );
		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['scheduled'] );
		$this->assertSame( Transcription::REFRESH_HOOK, $GLOBALS['rtgodam_stub']['scheduled'][0]['hook'] );
	}

	/**
	 * Right after an update every video is due (never checked). A sitemap page
	 * with 1000 videos must not queue 1000 events: one request adds at most 20
	 * videos and one cron event.
	 */
	public function test_a_burst_of_due_videos_queues_one_event_and_a_capped_list() {
		$queued = 0;
		for ( $id = 1; $id <= 1000; $id++ ) {
			$queued += (int) Transcription::maybe_schedule_refresh( $id, 0 );
		}

		$this->assertSame( 20, $queued );
		$this->assertCount( 20, $GLOBALS['rtgodam_stub']['options'][ Transcription::REFRESH_QUEUE_OPTION ] );
		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['scheduled'] );
	}

	/**
	 * One cron run refreshes 20 videos, keeps the rest, and comes back for them;
	 * the last run empties the queue and schedules nothing more.
	 */
	public function test_the_cron_run_works_through_the_queue_in_batches() {
		$GLOBALS['rtgodam_stub']['options'][ Transcription::REFRESH_QUEUE_OPTION ] = range( 1, 45 );
		$this->central_default_is_spanish();

		$this->assertSame( 20, Transcription::process_refresh_queue() );
		$this->assertCount( 20, $GLOBALS['rtgodam_stub']['posts'] );
		$this->assertSame( range( 21, 45 ), $GLOBALS['rtgodam_stub']['options'][ Transcription::REFRESH_QUEUE_OPTION ] );
		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['scheduled'] );

		// WP-Cron drops an event before running it.
		$GLOBALS['rtgodam_stub']['scheduled'] = array();
		$this->assertSame( 20, Transcription::process_refresh_queue() );
		$this->assertSame( 5, Transcription::process_refresh_queue() );

		$this->assertArrayNotHasKey( Transcription::REFRESH_QUEUE_OPTION, $GLOBALS['rtgodam_stub']['options'] );
		$this->assertCount( 45, $GLOBALS['rtgodam_stub']['posts'] );
	}
}
