<?php
/**
 * The type GoDAM saves when GoDAM Central sends back a converted file.
 *
 * Audio is converted to MP3, and WordPress registers MP3 as `audio/mpeg`. The plugin used to save
 * `audio/mp3`, which WordPress does not know, so REST `media_type=audio` left these files out.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * Runs in separate processes, like the other tests that stub WordPress functions.
 *
 * @covers \RTGODAM_Transcoder_Handler::add_transcoded_files
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class TranscodedAudioMimeTypeTest extends TestCase {

	/**
	 * Load the handler and stub the WordPress functions add_transcoded_files() calls.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array(
			'http'    => array( 'body' => 'converted file bytes' ),
			'updates' => array(),
		);

		if ( ! defined( 'RTGODAM_PATH' ) ) {
			define( 'RTGODAM_PATH', dirname( __DIR__, 2 ) . '/' );
		}
		require_once dirname( __DIR__, 2 ) . '/admin/class-rtgodam-transcoder-handler.php';

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		eval( 'function wp_upload_bits( $name, $deprecated, $bits ) { return array( "file" => "/uploads/2026/10/" . $name, "url" => "https://example.test/uploads/2026/10/" . $name ); }' );
		eval( 'function _wp_relative_upload_path( $path ) { return ltrim( str_replace( "/uploads/", "", $path ), "/" ); }' );
		eval( 'function update_post_meta( $id, $key, $value ) { $GLOBALS["rtgodam_stub"]["meta"][ $key ] = $value; return true; }' );
		eval( 'function wp_update_post( $postarr ) { $GLOBALS["rtgodam_stub"]["updates"][] = $postarr; return $postarr["ID"]; }' );
		// phpcs:enable Squiz.PHP.Eval.Discouraged
	}

	/**
	 * Converted audio is saved as audio/mpeg, the type WordPress registers for MP3.
	 *
	 * @dataProvider uploaded_audio_types
	 *
	 * @param string $uploaded_type The attachment's type before the conversion.
	 */
	public function test_converted_audio_is_saved_as_audio_mpeg( $uploaded_type ) {
		$GLOBALS['rtgodam_stub']['mime'] = $uploaded_type;

		$this->handler()->add_transcoded_files( array( 'mp3' => array( 'https://cdn.example.test/voice-note.mp3' ) ), 12, 'wp-media' );

		$this->assertSame(
			array(
				array(
					'ID'             => 12,
					'post_mime_type' => 'audio/mpeg',
				),
			),
			$GLOBALS['rtgodam_stub']['updates']
		);
		$this->assertSame( '2026/10/voice-note.mp3', $GLOBALS['rtgodam_stub']['meta']['_wp_attached_file'] );
	}

	/**
	 * Audio types GoDAM sends to GoDAM Central for conversion.
	 *
	 * @return array<string, array>
	 */
	public function uploaded_audio_types() {
		return array(
			'voice recording (.webm)' => array( 'audio/webm' ),
			'Safari recording (.mp4)' => array( 'audio/mp4' ),
			'WAV'                     => array( 'audio/wav' ),
		);
	}

	/**
	 * A converted video is still saved as video/mp4.
	 */
	public function test_converted_video_is_still_saved_as_video_mp4() {
		$GLOBALS['rtgodam_stub']['mime'] = 'video/quicktime';

		$this->handler()->add_transcoded_files( array( 'mp4' => array( 'https://cdn.example.test/clip.mp4' ) ), 7, 'wp-media' );

		$this->assertSame( 'video/mp4', $GLOBALS['rtgodam_stub']['updates'][0]['post_mime_type'] );
	}

	/**
	 * The handler without its constructor, which reads options and loads other files.
	 *
	 * @return \RTGODAM_Transcoder_Handler
	 */
	private function handler() {
		return ( new \ReflectionClass( \RTGODAM_Transcoder_Handler::class ) )->newInstanceWithoutConstructor();
	}
}
