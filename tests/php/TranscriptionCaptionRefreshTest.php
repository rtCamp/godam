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
	 * The SEO data queues one refresh when the last check is over 12 hours
	 * old, and none when it is recent or one is already queued.
	 */
	public function test_queues_one_refresh_after_12_hours() {
		$this->assertFalse( Transcription::maybe_schedule_refresh( 7, time() - HOUR_IN_SECONDS ) );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['scheduled'] );

		$this->assertTrue( Transcription::maybe_schedule_refresh( 7, time() - 13 * HOUR_IN_SECONDS ) );
		$this->assertFalse( Transcription::maybe_schedule_refresh( 7, 0 ) );

		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['scheduled'] );
		$this->assertSame( Transcription::REFRESH_HOOK, $GLOBALS['rtgodam_stub']['scheduled'][0]['hook'] );
		$this->assertSame( array( 7 ), $GLOBALS['rtgodam_stub']['scheduled'][0]['args'] );
	}
}
