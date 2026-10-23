<?php
/**
 * Unit tests for the audio and video types a form recorder field accepts.
 *
 * The recorder upload handlers pass this list to wp_handle_upload() as its `mimes`
 * override, so a recording is stored and anything else is refused.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * Runs in separate processes: the stubs it loads are stubbed differently by other tests.
 *
 * @covers ::rtgodam_get_recorder_upload_mimes
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class RecorderUploadMimesTest extends TestCase {

	/**
	 * Load the stubs and reset the state they read.
	 */
	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/recorder-upload-functions.php';

		$GLOBALS['rtgodam_stub']  = array();
		$GLOBALS['rtgodam_hooks'] = array();
	}

	/**
	 * Every type the recorder produces, and the other video and audio files a local-file field picks, is accepted.
	 *
	 * @dataProvider recording_extensions
	 *
	 * @param string $extension Extension of a recording.
	 * @param string $mime_type Its MIME type.
	 */
	public function test_recordings_are_accepted( $extension, $mime_type ) {
		$accepted = array();

		foreach ( rtgodam_get_recorder_upload_mimes() as $extensions => $type ) {
			foreach ( explode( '|', $extensions ) as $ext ) {
				$accepted[ $ext ] = $type;
			}
		}

		$this->assertSame( $mime_type, $accepted[ $extension ] ?? null );
	}

	/**
	 * Recorded and local media files.
	 *
	 * @return array[]
	 */
	public function recording_extensions() {
		return array(
			'Chrome video, webm' => array( 'webm', 'video/webm' ),
			'Safari video, mp4'  => array( 'mp4', 'video/mp4' ),
			'Firefox audio, ogg' => array( 'ogg', 'audio/ogg' ),
			'local mp3'          => array( 'mp3', 'audio/mpeg' ),
			'local mov'          => array( 'mov', 'video/quicktime' ),
			'local mkv'          => array( 'mkv', 'video/x-matroska' ),
		);
	}

	/**
	 * Documents, images, archives and text are not accepted, only audio and video.
	 */
	public function test_other_types_are_refused() {
		$mimes = rtgodam_get_recorder_upload_mimes();

		$this->assertNotEmpty( $mimes );

		foreach ( $mimes as $extensions => $mime_type ) {
			$this->assertMatchesRegularExpression( '#^(audio|video)/#', $mime_type, $extensions . ' is not audio or video.' );
		}

		$this->assertArrayNotHasKey( 'pdf', $mimes );
		$this->assertArrayNotHasKey( 'png', $mimes );
		$this->assertArrayNotHasKey( 'zip', $mimes );
		$this->assertArrayNotHasKey( 'txt|asc|c|cc', $mimes );
	}

	/**
	 * A site's own upload types are kept: one it adds is accepted and one it removes is not.
	 */
	public function test_the_sites_allowed_upload_types_apply() {
		$GLOBALS['rtgodam_stub']['allowed_mimes'] = array(
			'webm' => 'video/webm',
			'weba' => 'audio/webm',
			'pdf'  => 'application/pdf',
		);

		$this->assertSame(
			array(
				'webm' => 'video/webm',
				'weba' => 'audio/webm',
			),
			rtgodam_get_recorder_upload_mimes()
		);
	}

	/**
	 * The list is filterable.
	 */
	public function test_the_list_can_be_filtered() {
		add_filter(
			'rtgodam_recorder_upload_mimes',
			function ( $mimes ) {
				unset( $mimes['mkv'] );
				$mimes['flv'] = 'video/x-flv';

				return $mimes;
			}
		);

		$mimes = rtgodam_get_recorder_upload_mimes();

		$this->assertArrayNotHasKey( 'mkv', $mimes );
		$this->assertSame( 'video/x-flv', $mimes['flv'] );
		$this->assertArrayHasKey( 'webm', $mimes );
	}
}
