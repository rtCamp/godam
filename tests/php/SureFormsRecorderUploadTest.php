<?php
/**
 * The SureForms recorder field's upload on form submission.
 *
 * The submission is public, so the handler only takes files under a recorder field's own
 * key, and only as audio or video checked against the file itself.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Sureforms\Form_Submit;

/**
 * Runs in separate processes, so the upload stubs below stay local to it.
 *
 * @covers \RTGODAM\Inc\Sureforms\Form_Submit::prepare_submission_data
 * @covers \RTGODAM\Inc\Sureforms\Form_Submit::is_recorder_file_key
 * @covers \RTGODAM\Inc\Sureforms\Form_Submit::get_recorder_upload_mimes
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class SureFormsRecorderUploadTest extends TestCase {

	/**
	 * A key the recorder block prints, from its render.php.
	 */
	private const RECORDER_KEY = 'godam-upload-a1b2c3-lbl-UmVjb3JkIHlvdXIgdmlkZW8-input-recorder0';

	/**
	 * Load the class and stub the slice of WordPress the upload touches.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array( 'uploads' => array() );

		require_once dirname( __DIR__, 2 ) . '/inc/classes/sureforms/class-form-submit.php';

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		eval( 'function wp_max_upload_size() { return 100 * 1024 * 1024; }' );
		eval( 'function sanitize_file_name( $name ) { return (string) $name; }' );
		eval( 'function get_allowed_mime_types() { if ( ! empty( $GLOBALS["rtgodam_stub"]["no_media"] ) ) { return array( "jpg|jpeg|jpe" => "image/jpeg", "pdf" => "application/pdf" ); } return array( "jpg|jpeg|jpe" => "image/jpeg", "pdf" => "application/pdf", "svg" => "image/svg+xml", "webm" => "video/webm", "mp4|m4v" => "video/mp4", "mp3|m4a|m4b" => "audio/mpeg", "ogg|oga" => "audio/ogg" ); }' );
		eval( 'function wp_handle_upload( $file, $overrides ) { $GLOBALS["rtgodam_stub"]["uploads"][] = array( "file" => $file, "overrides" => $overrides ); return array( "url" => "https://site.example/wp-content/uploads/godam/" . $file["name"], "file" => "/tmp/" . $file["name"] ); }' );
		eval( 'function wp_send_json_error( $data = null, $status = null ) { $GLOBALS["rtgodam_stub"]["json"] = $data; throw new \RuntimeException( "json" ); }' );
		// phpcs:enable Squiz.PHP.Eval.Discouraged
	}

	/**
	 * Clear the posted files.
	 */
	protected function tearDown(): void {
		$_FILES = array();
		parent::tearDown();
	}

	/**
	 * The keys the recorder block prints are taken; anything else that only contains `-input-recorder` is not.
	 *
	 * @dataProvider keys
	 *
	 * @param string $key      The posted file key.
	 * @param bool   $expected Whether it is a recorder field's key.
	 */
	public function test_recorder_file_key( $key, $expected ) {
		$this->assertSame( $expected, Form_Submit::is_recorder_file_key( $key ) );
	}

	/**
	 * Posted file keys.
	 *
	 * @return array<string, array>
	 */
	public function keys() {
		return array(
			'recorder block key'          => array( self::RECORDER_KEY, true ),
			'recorder key without index'  => array( 'godam-upload-a1b2c3-lbl-TGFiZWw-input-recorder', true ),
			'label with base64 slash'     => array( 'godam-upload-a1b2c3-lbl-YS9i/c2xhc2g-input-recorder2', true ),
			'empty block id'              => array( 'godam-upload--lbl-R29EQU0gUmVjb3JkZXI-input-recorder1', true ),
			'other field containing it'   => array( 'srfm-upload-x-input-recorder', false ),
			'prefix before the block key' => array( 'evil-godam-upload-a1b2c3-lbl-TGFiZWw-input-recorder', false ),
			'text after the index'        => array( 'godam-upload-a1b2c3-lbl-TGFiZWw-input-recorder1.php', false ),
			'plain upload field'          => array( 'srfm-upload-123', false ),
		);
	}

	/**
	 * Only the site's audio and video types are allowed for the upload.
	 */
	public function test_recorder_upload_mimes_are_audio_and_video_only() {
		$this->assertSame(
			array(
				'webm'        => 'video/webm',
				'mp4|m4v'     => 'video/mp4',
				'mp3|m4a|m4b' => 'audio/mpeg',
				'ogg|oga'     => 'audio/ogg',
			),
			Form_Submit::get_recorder_upload_mimes()
		);
	}

	/**
	 * The recorder file is uploaded with the audio and video list and a real type check.
	 */
	public function test_recorder_file_is_uploaded_as_audio_or_video_only() {
		$_FILES = array(
			self::RECORDER_KEY => $this->file( 'recording.webm', 'video/webm' ),
		);

		$data = $this->handler()->prepare_submission_data( array( 'godam-max-file-size' => 50 * 1024 * 1024 ) );

		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['uploads'] );
		$overrides = $GLOBALS['rtgodam_stub']['uploads'][0]['overrides'];
		$this->assertTrue( $overrides['test_type'] );
		$this->assertSame( Form_Submit::get_recorder_upload_mimes(), $overrides['mimes'] );
		$this->assertArrayNotHasKey( 'image/svg+xml', array_flip( $overrides['mimes'] ) );
		$this->assertSame( 'https://site.example/wp-content/uploads/godam/recording.webm', $data[ self::RECORDER_KEY ] );
	}

	/**
	 * A site that allows no audio or video type gets no upload, not the whole allowed list.
	 */
	public function test_no_upload_when_the_site_allows_no_audio_or_video() {
		$GLOBALS['rtgodam_stub']['no_media'] = true;
		$_FILES                              = array(
			self::RECORDER_KEY => $this->file( 'recording.webm', 'video/webm' ),
		);

		try {
			$this->handler()->prepare_submission_data( array( 'godam-max-file-size' => 50 * 1024 * 1024 ) );
			$this->fail( 'The upload was not refused.' );
		} catch ( \RuntimeException $e ) {
			$this->assertSame( 'json', $e->getMessage() );
		}

		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['uploads'] );
	}

	/**
	 * A file under any other key is left to SureForms and not uploaded here.
	 */
	public function test_file_under_another_key_is_not_uploaded() {
		$_FILES = array(
			'srfm-upload-x-input-recorder' => $this->file( 'page.svg', 'video/webm' ),
		);

		$data = $this->handler()->prepare_submission_data( array( 'godam-max-file-size' => 50 * 1024 * 1024 ) );

		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['uploads'] );
		$this->assertArrayNotHasKey( 'srfm-upload-x-input-recorder', $data );
	}

	/**
	 * A posted file.
	 *
	 * @param string $name File name.
	 * @param string $type Type the browser claims.
	 * @return array<string, mixed>
	 */
	private function file( $name, $type ) {
		return array(
			'name'     => $name,
			'type'     => $type,
			'tmp_name' => '/tmp/php' . md5( $name ),
			'error'    => 0,
			'size'     => 1024,
		);
	}

	/**
	 * The handler, built without its constructor (which registers hooks).
	 *
	 * @return Form_Submit
	 */
	private function handler() {
		return ( new \ReflectionClass( Form_Submit::class ) )->newInstanceWithoutConstructor();
	}
}
