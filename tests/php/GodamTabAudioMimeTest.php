<?php
/**
 * Unit tests for the MIME type the GoDAM tab reports for audio items.
 *
 * Form recorders register their audio with Central under the type WordPress guesses from
 * the file extension, so a Chrome recording arrives as job_type "audio" with mime_type
 * "video/webm" (and a Safari one as "video/mp4"). The GoDAM Audio block rejected these on
 * select from its GoDAM tab, and the attachment created from the item was typed as video.
 * get_mime_type_for_job_type() reports them as audio; these tests pin that, and pin that
 * nothing else changes. should_correct_audio_mime() decides whether an attachment saved
 * before the fix is corrected when picked again; its type comes from the browser, so it is
 * pinned to the exact container pairs and to users who may edit the attachment.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Media_Library_Ajax;

/**
 * @covers \RTGODAM\Inc\Media_Library_Ajax::get_mime_type_for_job_type
 * @covers \RTGODAM\Inc\Media_Library_Ajax::get_audio_container_mimes
 * @covers \RTGODAM\Inc\Media_Library_Ajax::should_correct_audio_mime
 */
class GodamTabAudioMimeTest extends TestCase {

	/**
	 * Call the private get_mime_type_for_job_type() on an instance built without its
	 * constructor, so no hooks are registered.
	 *
	 * @param string $job_type  Job type from Central.
	 * @param string $mime_type MIME type from Central.
	 * @return string
	 */
	private function mime_for( $job_type, $mime_type ) {
		$instance = ( new \ReflectionClass( Media_Library_Ajax::class ) )->newInstanceWithoutConstructor();
		$method   = new \ReflectionMethod( Media_Library_Ajax::class, 'get_mime_type_for_job_type' );
		$method->setAccessible( true );

		return $method->invoke( $instance, $job_type, $mime_type );
	}

	/**
	 * Audio recorded in a WebM or MP4 container is reported as audio.
	 *
	 * @return void
	 */
	public function test_audio_job_in_a_video_container_is_reported_as_audio() {
		$this->assertSame( 'audio/webm', $this->mime_for( 'audio', 'video/webm' ) );
		$this->assertSame( 'audio/mp4', $this->mime_for( 'audio', 'video/mp4' ) );
	}

	/**
	 * Audio MIME types pass through untouched, and a missing one still defaults to MP3.
	 *
	 * @return void
	 */
	public function test_other_audio_mime_types_are_unchanged() {
		$this->assertSame( 'audio/mpeg', $this->mime_for( 'audio', 'audio/mpeg' ) );
		$this->assertSame( 'audio/webm', $this->mime_for( 'audio', 'audio/webm' ) );
		$this->assertSame( 'audio/ogg', $this->mime_for( 'audio', 'audio/ogg' ) );
		$this->assertSame( 'audio/mpeg', $this->mime_for( 'audio', '' ) );
	}

	/**
	 * The container map is exactly the two recorder formats; get_mime_type_for_job_type()
	 * and should_correct_audio_mime() both read it.
	 *
	 * @return void
	 */
	public function test_audio_container_map_is_the_two_recorder_formats() {
		$this->assertSame(
			array(
				'video/webm' => 'audio/webm',
				'video/mp4'  => 'audio/mp4',
			),
			Media_Library_Ajax::get_audio_container_mimes()
		);
	}

	/**
	 * A user who may edit the attachment gets it corrected for either exact pair.
	 *
	 * @return void
	 */
	public function test_correction_allowed_for_exact_pairs_with_edit_rights() {
		$this->assertTrue( Media_Library_Ajax::should_correct_audio_mime( 'video/webm', 'audio/webm', true ) );
		$this->assertTrue( Media_Library_Ajax::should_correct_audio_mime( 'video/mp4', 'audio/mp4', true ) );
	}

	/**
	 * Without edit rights nothing changes: create-media-entry only needs upload_files, and the
	 * picked type comes from the browser.
	 *
	 * @return void
	 */
	public function test_correction_refused_without_edit_rights() {
		$this->assertFalse( Media_Library_Ajax::should_correct_audio_mime( 'video/webm', 'audio/webm', false ) );
		$this->assertFalse( Media_Library_Ajax::should_correct_audio_mime( 'video/mp4', 'audio/mp4', false ) );
	}

	/**
	 * Any other pair is refused, even with edit rights: a different audio type, a crossed
	 * container, an attachment that is already audio, and one that is not a recorder container.
	 *
	 * @return void
	 */
	public function test_correction_refused_for_any_other_pair() {
		$refused = array(
			array( 'video/webm', 'audio/mpeg' ),
			array( 'video/mp4', 'audio/webm' ),
			array( 'video/webm', 'audio/mp4' ),
			array( 'video/webm', 'video/webm' ),
			array( 'audio/webm', 'audio/webm' ),
			array( 'audio/mpeg', 'audio/webm' ),
			array( 'video/quicktime', 'audio/quicktime' ),
			array( 'image/png', 'audio/webm' ),
			array( '', 'audio/webm' ),
		);

		foreach ( $refused as $pair ) {
			$this->assertFalse(
				Media_Library_Ajax::should_correct_audio_mime( $pair[0], $pair[1], true ),
				$pair[0] . ' to ' . $pair[1] . ' should not be corrected.'
			);
		}
	}

	/**
	 * Only audio jobs are relabelled: a WebM or MP4 video keeps its video type.
	 *
	 * @return void
	 */
	public function test_video_containers_on_other_job_types_are_unchanged() {
		$this->assertSame( 'application/dash+xml', $this->mime_for( 'stream', 'video/webm' ) );
		$this->assertSame( 'video/webm', $this->mime_for( '', 'video/webm' ) );
		$this->assertSame( 'video/mp4', $this->mime_for( 'image', 'video/mp4' ) );
	}
}
