<?php
/**
 * Unit tests for storing an audio-only WebM or MP4 upload as audio.
 *
 * WordPress types an upload by its extension, so a voice recording saved as .webm or .mp4 is
 * stored as video/webm or video/mp4. Media_Library_Ajax::store_audio_only_upload_as_audio()
 * runs on `wp_handle_upload`, reads the file the way WordPress does for the attachment
 * metadata, and switches the type to audio/webm or audio/mp4 when the file has no video.
 * These tests pin which uploads are switched, that a WebM or MP4 with video is left alone,
 * and that no other upload is even read. wp_read_video_metadata() is stubbed here; the real
 * reading of real files is checked on a site (see the PR).
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Media_Library_Ajax;

/**
 * @covers \RTGODAM\Inc\Media_Library_Ajax::store_audio_only_upload_as_audio
 * @covers \RTGODAM\Inc\Media_Library_Ajax::get_audio_type_for_upload
 * @covers \RTGODAM\Inc\Media_Library_Ajax::setup_hooks
 */
class AudioOnlyUploadTypeTest extends TestCase {

	/**
	 * A real, readable file standing in for the upload.
	 *
	 * @var string
	 */
	private $file;

	/**
	 * Create the stand-in file and reset the stubs.
	 *
	 * @return void
	 */
	protected function setUp(): void {
		$this->file = tempnam( sys_get_temp_dir(), 'godam-upload' );

		$GLOBALS['rtgodam_stub']['video_metadata']       = array();
		$GLOBALS['rtgodam_stub']['video_metadata_reads'] = array();
		$GLOBALS['rtgodam_hooks']                        = array();
	}

	/**
	 * Remove the stand-in file.
	 *
	 * @return void
	 */
	protected function tearDown(): void {
		if ( $this->file && file_exists( $this->file ) ) {
			unlink( $this->file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink -- test cleanup.
		}
	}

	/**
	 * Run the filter callback on an upload whose content reads as $content_mime.
	 *
	 * @param string      $type         Type WordPress gave the upload.
	 * @param string|null $content_mime Type read from the content, or null for "unreadable".
	 * @return array The filtered upload.
	 */
	private function filter_upload( $type, $content_mime ) {
		$GLOBALS['rtgodam_stub']['video_metadata'][ $this->file ] = null === $content_mime ? false : array( 'mime_type' => $content_mime );

		$instance = ( new \ReflectionClass( Media_Library_Ajax::class ) )->newInstanceWithoutConstructor();

		return $instance->store_audio_only_upload_as_audio(
			array(
				'file' => $this->file,
				'url'  => 'https://example.test/wp-content/uploads/recording',
				'type' => $type,
			)
		);
	}

	/**
	 * An audio-only WebM or MP4 is stored as audio.
	 *
	 * @return void
	 */
	public function test_audio_only_webm_and_mp4_are_stored_as_audio() {
		$this->assertSame( 'audio/webm', $this->filter_upload( 'video/webm', 'audio/webm' )['type'] );
		$this->assertSame( 'audio/mp4', $this->filter_upload( 'video/mp4', 'audio/mp4' )['type'] );
	}

	/**
	 * A WebM or MP4 with a video track keeps its video type.
	 *
	 * @return void
	 */
	public function test_webm_and_mp4_with_video_stay_video() {
		$this->assertSame( 'video/webm', $this->filter_upload( 'video/webm', 'video/webm' )['type'] );
		$this->assertSame( 'video/mp4', $this->filter_upload( 'video/mp4', 'video/mp4' )['type'] );
	}

	/**
	 * A file that cannot be read keeps the type WordPress gave it.
	 *
	 * @return void
	 */
	public function test_unreadable_content_keeps_the_type() {
		$this->assertSame( 'video/webm', $this->filter_upload( 'video/webm', null )['type'] );
		$this->assertSame( 'video/mp4', $this->filter_upload( 'video/mp4', '' )['type'] );
	}

	/**
	 * Any other upload is returned untouched and its file is never read, so image and
	 * document uploads pay nothing for this.
	 *
	 * @return void
	 */
	public function test_other_types_are_not_read_or_changed() {
		foreach ( array( 'audio/mpeg', 'audio/webm', 'image/png', 'application/pdf', 'video/quicktime', 'video/x-matroska' ) as $type ) {
			$this->assertSame( $type, $this->filter_upload( $type, 'audio/webm' )['type'], $type . ' should keep its type.' );
		}

		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['video_metadata_reads'] );
	}

	/**
	 * A failed upload, or one with no file, is returned as it came.
	 *
	 * @return void
	 */
	public function test_failed_or_incomplete_uploads_pass_through() {
		$instance = ( new \ReflectionClass( Media_Library_Ajax::class ) )->newInstanceWithoutConstructor();
		$failed   = array( 'error' => 'The uploaded file exceeds the upload_max_filesize directive.' );
		$no_file  = array(
			'file' => '',
			'url'  => '',
			'type' => 'video/webm',
		);
		$missing  = array(
			'file' => $this->file . '-missing',
			'url'  => '',
			'type' => 'video/webm',
		);

		$this->assertSame( $failed, $instance->store_audio_only_upload_as_audio( $failed ) );
		$this->assertSame( $no_file, $instance->store_audio_only_upload_as_audio( $no_file ) );
		$this->assertSame( $missing, $instance->store_audio_only_upload_as_audio( $missing ) );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['video_metadata_reads'] );
	}

	/**
	 * The type pairs: only an audio reading of a WebM or MP4 gives an audio type, and always
	 * the one paired with its container.
	 *
	 * @return void
	 */
	public function test_audio_type_for_upload_pairs() {
		$this->assertSame( 'audio/webm', Media_Library_Ajax::get_audio_type_for_upload( 'video/webm', 'audio/webm' ) );
		$this->assertSame( 'audio/mp4', Media_Library_Ajax::get_audio_type_for_upload( 'video/mp4', 'audio/mp4' ) );

		// The container decides the audio type, whatever audio subtype the reader names.
		$this->assertSame( 'audio/webm', Media_Library_Ajax::get_audio_type_for_upload( 'video/webm', 'audio/x-matroska' ) );
		$this->assertSame( 'audio/mp4', Media_Library_Ajax::get_audio_type_for_upload( 'video/mp4', 'audio/x-m4a' ) );

		$this->assertSame( '', Media_Library_Ajax::get_audio_type_for_upload( 'video/webm', 'video/webm' ) );
		$this->assertSame( '', Media_Library_Ajax::get_audio_type_for_upload( 'video/mp4', '' ) );
		$this->assertSame( '', Media_Library_Ajax::get_audio_type_for_upload( 'video/quicktime', 'audio/mp4' ) );
		$this->assertSame( '', Media_Library_Ajax::get_audio_type_for_upload( 'audio/mpeg', 'audio/mpeg' ) );
	}

	/**
	 * The callback is registered on `wp_handle_upload`, the step every upload passes through
	 * before its attachment is created, so add_attachment hooks already see the audio type.
	 *
	 * @return void
	 */
	public function test_registered_on_wp_handle_upload() {
		$instance = ( new \ReflectionClass( Media_Library_Ajax::class ) )->newInstanceWithoutConstructor();
		$instance->setup_hooks();

		$GLOBALS['rtgodam_stub']['video_metadata'][ $this->file ] = array( 'mime_type' => 'audio/webm' );

		$upload = apply_filters(
			'wp_handle_upload',
			array(
				'file' => $this->file,
				'url'  => 'https://example.test/wp-content/uploads/recording.webm',
				'type' => 'video/webm',
			),
			'upload'
		);

		$this->assertSame( 'audio/webm', $upload['type'] );
	}
}
