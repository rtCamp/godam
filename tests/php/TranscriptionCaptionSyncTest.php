<?php
/**
 * Caption changes on GoDAM Central keep the attachment's cached transcript
 * (`rtgodam_transcript_path`) pointing at the default caption track, never
 * overwrite a transcript uploaded in WordPress, and language codes reach
 * Central the way it validates them.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Transcription;

/**
 * @covers \RTGODAM\Inc\REST_API\Transcription::sync_cached_transcript
 * @covers \RTGODAM\Inc\REST_API\Transcription::sanitize_language
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class TranscriptionCaptionSyncTest extends TestCase {

	/**
	 * Load the code under test.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array( 'post_meta' => array() );

		$root = dirname( __DIR__, 2 );
		require_once $root . '/tests/stubs/hooks.php';
		require_once $root . '/tests/stubs/media-file-functions.php';
		require_once $root . '/inc/classes/rest-api/class-base.php';
		require_once $root . '/inc/classes/rest-api/class-transcription.php';
	}

	/**
	 * Caption rows as Central returns them.
	 *
	 * @return array
	 */
	private function captions() {
		return array(
			array(
				'caption_id' => 'es1',
				'language'   => 'es',
				'vtt_path'   => 'https://n8e0ka87m9.gdcdn.us/job/es.vtt',
				'is_default' => false,
			),
			array(
				'caption_id' => 'en1',
				'language'   => 'en',
				'vtt_path'   => 'https://n8e0ka87m9.gdcdn.us/job/en.vtt',
				'is_default' => true,
			),
		);
	}

	/**
	 * The cached transcript follows Central's default caption, not the first
	 * row or the track that finished last, and a stale delete marker goes.
	 */
	public function test_caches_the_default_caption() {
		$GLOBALS['rtgodam_stub']['post_meta'] = array(
			'rtgodam_transcript_path'    => 'https://n8e0ka87m9.gdcdn.us/job/old.vtt',
			'rtgodam_transcript_deleted' => '1',
		);

		Transcription::sync_cached_transcript( 7, $this->captions() );

		$meta = $GLOBALS['rtgodam_stub']['post_meta'];
		$this->assertSame( 'https://n8e0ka87m9.gdcdn.us/job/en.vtt', $meta['rtgodam_transcript_path'] );
		$this->assertSame( 'Transcribed', $meta['rtgodam_transcript_status'] );
		$this->assertArrayNotHasKey( 'rtgodam_transcript_deleted', $meta );
	}

	/**
	 * When Central has no playable default (its generated caption was deleted),
	 * the cached link to the removed file is dropped.
	 */
	public function test_clears_the_cache_when_no_default_is_ready() {
		$GLOBALS['rtgodam_stub']['post_meta'] = array(
			'rtgodam_transcript_path'   => 'https://n8e0ka87m9.gdcdn.us/job/en.vtt',
			'rtgodam_transcript_status' => 'Transcribed',
		);

		Transcription::sync_cached_transcript(
			7,
			array(
				array(
					'caption_id' => 'en1',
					'vtt_path'   => null,
					'is_default' => true,
				),
			)
		);

		$meta = $GLOBALS['rtgodam_stub']['post_meta'];
		$this->assertArrayNotHasKey( 'rtgodam_transcript_path', $meta );
		$this->assertArrayNotHasKey( 'rtgodam_transcript_status', $meta );
	}

	/**
	 * A transcript uploaded in WordPress never reaches Central, so Central's
	 * list must not replace it.
	 */
	public function test_keeps_a_wordpress_upload() {
		$GLOBALS['rtgodam_stub']['post_meta'] = array(
			'rtgodam_transcript_path'   => 'https://site.example/wp-content/uploads/fixed.vtt',
			'rtgodam_transcript_source' => 'upload',
		);

		Transcription::sync_cached_transcript( 7, $this->captions() );

		$this->assertSame(
			'https://site.example/wp-content/uploads/fixed.vtt',
			$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcript_path']
		);
	}

	/**
	 * An upload from before 2.8.0 has no source mark. Its address is not on
	 * Central's CDN, so it is still kept.
	 */
	public function test_keeps_an_unmarked_upload_from_before_2_8() {
		$GLOBALS['rtgodam_stub']['post_meta'] = array(
			'rtgodam_transcript_path' => 'https://site.example/wp-content/uploads/fixed.vtt',
		);

		Transcription::sync_cached_transcript( 7, $this->captions() );

		$this->assertSame(
			'https://site.example/wp-content/uploads/fixed.vtt',
			$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcript_path']
		);
	}

	/**
	 * After Generate on a video with an old upload, the source is `central`,
	 * so the finished transcript replaces the upload.
	 */
	public function test_generate_replaces_an_unmarked_upload() {
		$GLOBALS['rtgodam_stub']['post_meta'] = array(
			'rtgodam_transcript_path'   => 'https://site.example/wp-content/uploads/fixed.vtt',
			'rtgodam_transcript_source' => 'central',
		);

		Transcription::sync_cached_transcript( 7, $this->captions() );

		$this->assertSame(
			'https://n8e0ka87m9.gdcdn.us/job/en.vtt',
			$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcript_path']
		);
	}

	/**
	 * Which stored transcripts count as uploaded in WordPress.
	 *
	 * @dataProvider upload_cases
	 *
	 * @param mixed $path     Stored transcript path.
	 * @param mixed $source   Stored source mark.
	 * @param bool  $expected Whether it is an upload.
	 */
	public function test_is_wordpress_upload( $path, $source, $expected ) {
		$this->assertSame( $expected, Transcription::is_wordpress_upload( $path, $source ) );
	}

	/**
	 * Cases for test_is_wordpress_upload.
	 *
	 * @return array
	 */
	public function upload_cases() {
		$site    = 'https://site.example/wp-content/uploads/2026/10/fixed.vtt';
		$offload = 'https://bucket.s3.amazonaws.com/uploads/fixed.srt';
		$central = 'https://n8e0ka87m9.gdcdn.us/job/en.vtt?token=a&expires=1';

		return array(
			'marked upload'                 => array( $central, 'upload', true ),
			'unmarked site file'            => array( $site, '', true ),
			'unmarked offloaded file'       => array( $offload, '', true ),
			'unmarked Central copy'         => array( $central, '', false ),
			'generated, old file still set' => array( $site, 'central', false ),
			'nothing stored'                => array( '', '', false ),
		);
	}

	/**
	 * Language codes keep their case and may have several subtags, like
	 * Central's own check; detection keywords are lower-cased; junk is dropped.
	 *
	 * @dataProvider language_cases
	 *
	 * @param string $input    Raw value.
	 * @param string $expected Sanitized value.
	 */
	public function test_sanitize_language( $input, $expected ) {
		// The class is a singleton; the sanitizer needs no constructor state.
		$controller = ( new \ReflectionClass( Transcription::class ) )->newInstanceWithoutConstructor();
		$this->assertSame( $expected, $controller->sanitize_language( $input ) );
	}

	/**
	 * Cases for test_sanitize_language.
	 *
	 * @return array
	 */
	public function language_cases() {
		return array(
			'plain'          => array( 'en', 'en' ),
			'region case'    => array( 'pt-BR', 'pt-BR' ),
			'script, region' => array( 'zh-Hant-TW', 'zh-Hant-TW' ),
			'auto'           => array( 'AUTO', 'auto' ),
			'multi'          => array( 'multi', 'multi' ),
			'empty'          => array( '', '' ),
			'junk'           => array( 'en_US<script>', '' ),
		);
	}
}
