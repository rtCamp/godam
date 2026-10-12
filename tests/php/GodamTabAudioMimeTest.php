<?php
/**
 * Unit tests for the MIME type the GoDAM tab reports for audio items.
 *
 * Form recorders register their audio with Central under the type WordPress guesses from
 * the file extension, so a Chrome recording arrives as job_type "audio" with mime_type
 * "video/webm" (and a Safari one as "video/mp4"). The GoDAM Audio block rejected these on
 * select from its GoDAM tab, and the attachment created from the item was typed as video.
 * get_mime_type_for_job_type() reports them as audio; these tests pin that, and pin that
 * nothing else changes.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Media_Library_Ajax;

/**
 * @covers \RTGODAM\Inc\Media_Library_Ajax::get_mime_type_for_job_type
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
