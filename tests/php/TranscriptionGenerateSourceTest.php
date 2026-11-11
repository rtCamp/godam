<?php
/**
 * Generate Transcription keeps the stored caption file (often one uploaded in
 * WordPress) until GoDAM Central reports a ready default caption, then lets
 * Central's transcript replace it.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Transcription;

/**
 * @covers \RTGODAM\Inc\REST_API\Transcription::generate_transcription
 * @covers \RTGODAM\Inc\REST_API\Transcription::sync_cached_transcript
 * @covers \RTGODAM\Inc\REST_API\Transcription::refresh_cached_default
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class TranscriptionGenerateSourceTest extends TestCase {

	/**
	 * A caption file uploaded in WordPress before 2.8.0 (no source mark).
	 */
	const UPLOAD = 'https://site.example/wp-content/uploads/fixed.vtt';

	/**
	 * Central's AI transcript once it is ready.
	 */
	const CENTRAL = 'https://n8e0ka87m9.gdcdn.us/job/en.vtt';

	/**
	 * Load the code under test, with an old upload stored on a transcoded video.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array(
			'post_meta' => array(
				'rtgodam_transcoding_job_id' => 'job-1',
				'rtgodam_transcript_path'    => self::UPLOAD,
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
		require_once $root . '/tests/stubs/media-library-functions.php';
		require_once $root . '/tests/stubs/class-wp-rest-request.php';
		require_once $root . '/inc/classes/rest-api/class-base.php';
		require_once $root . '/inc/classes/rest-api/class-transcription.php';
	}

	/**
	 * Make every Central call answer with this message.
	 *
	 * @param array $message Frappe `message` payload.
	 */
	private function central_answers( array $message ) {
		$GLOBALS['rtgodam_stub']['post_handler'] = static function () use ( $message ) {
			return array(
				'code' => 200,
				'body' => json_encode( array( 'message' => $message ) ), // phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode -- test fixture.
			);
		};
	}

	/**
	 * Click Generate Transcription for attachment 7.
	 */
	private function generate() {
		$controller = ( new \ReflectionClass( Transcription::class ) )->newInstanceWithoutConstructor();
		$controller->generate_transcription( new \WP_REST_Request( array( 'attachment_id' => 7 ), 'POST' ) );
	}

	/**
	 * Central's caption list: one default row, with or without a file.
	 *
	 * @param string|null $vtt_path The default's file, or null while it has none.
	 * @return array
	 */
	private function default_row( $vtt_path ) {
		return array(
			array(
				'caption_id' => 'en1',
				'language'   => 'en',
				'vtt_path'   => $vtt_path,
				'is_default' => true,
			),
		);
	}

	/**
	 * Generate starts a job: the upload stays and still counts as one, so the
	 * player keeps playing it.
	 */
	public function test_generate_keeps_the_upload_while_the_job_runs() {
		$this->central_answers(
			array(
				'success'        => true,
				'current_status' => 'Transcribing',
			)
		);

		$this->generate();

		$meta = $GLOBALS['rtgodam_stub']['post_meta'];
		$this->assertSame( Transcription::SOURCE_PENDING, $meta['rtgodam_transcript_source'] );
		$this->assertSame( self::UPLOAD, $meta['rtgodam_transcript_path'] );
		$this->assertTrue( Transcription::is_wordpress_upload( self::UPLOAD, $meta['rtgodam_transcript_source'] ) );
	}

	/**
	 * Central answers Generate with a finished transcript at once: it replaces
	 * the upload and is marked as Central's.
	 */
	public function test_generate_with_an_immediate_transcript_replaces_the_upload() {
		$this->central_answers(
			array(
				'success'         => true,
				'transcript_path' => self::CENTRAL,
			)
		);

		$this->generate();

		$meta = $GLOBALS['rtgodam_stub']['post_meta'];
		$this->assertSame( Transcription::SOURCE_CENTRAL, $meta['rtgodam_transcript_source'] );
		$this->assertSame( self::CENTRAL, $meta['rtgodam_transcript_path'] );
	}

	/**
	 * While the job runs, or after it failed, Central's default row has no
	 * file. The upload is not dropped.
	 *
	 * @dataProvider unfinished_statuses
	 *
	 * @param string $status Central's status for the default row.
	 */
	public function test_an_unfinished_job_keeps_the_upload( $status ) {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcript_source'] = Transcription::SOURCE_PENDING;
		$captions              = $this->default_row( null );
		$captions[0]['status'] = $status;

		Transcription::sync_cached_transcript( 7, $captions );

		$meta = $GLOBALS['rtgodam_stub']['post_meta'];
		$this->assertSame( self::UPLOAD, $meta['rtgodam_transcript_path'] );
		$this->assertSame( Transcription::SOURCE_PENDING, $meta['rtgodam_transcript_source'] );
	}

	/**
	 * Statuses of a default row with no file.
	 *
	 * @return array
	 */
	public function unfinished_statuses() {
		return array(
			'still running' => array( 'Pending' ),
			'failed'        => array( 'Failed' ),
		);
	}

	/**
	 * Opening the Transcription tab after the job finished asks Central, and
	 * the ready default replaces the upload.
	 */
	public function test_the_finished_transcript_replaces_the_upload() {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcript_source'] = Transcription::SOURCE_PENDING;
		$this->central_answers(
			array(
				'success'  => true,
				'captions' => $this->default_row( self::CENTRAL ),
			)
		);

		$this->assertTrue( Transcription::refresh_cached_default( 7 ) );

		$meta = $GLOBALS['rtgodam_stub']['post_meta'];
		$this->assertSame( self::CENTRAL, $meta['rtgodam_transcript_path'] );
		$this->assertSame( Transcription::SOURCE_CENTRAL, $meta['rtgodam_transcript_source'] );
	}

	/**
	 * Central's copy written by the sync is marked, so the address check is
	 * only needed for transcripts stored before 2.8.0.
	 */
	public function test_the_sync_marks_central_copies() {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcript_path'] = 'https://n8e0ka87m9.gdcdn.us/job/old.vtt';

		Transcription::sync_cached_transcript( 7, $this->default_row( self::CENTRAL ) );

		$this->assertSame( Transcription::SOURCE_CENTRAL, $GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcript_source'] );
	}
}
