<?php
/**
 * rtgodam_signed_playback_job(): the GoDAM job id templates print as `data-godam-job`, so
 * the front end can ask the playback route for a signed copy of a failed thumbnail.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * @covers ::rtgodam_signed_playback_job
 */
class SignedPlaybackJobTest extends TestCase {

	/**
	 * Fresh post meta and hook registry per test.
	 */
	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_stub']  = array(
			'post_meta_by_id' => array(
				10 => array( 'rtgodam_transcoding_job_id' => 'job-uploaded' ),
				11 => array( '_godam_original_id' => 'job-virtual' ),
				12 => array(),
				13 => array( 'rtgodam_transcoding_job_id' => array( 'not', 'a', 'string' ) ),
			),
		);
		$GLOBALS['rtgodam_hooks'] = array();
	}

	/**
	 * An uploaded file's job id, else a virtual media entry's, else nothing.
	 */
	public function test_it_returns_the_job_id_of_a_godam_attachment() {
		$this->assertSame( 'job-uploaded', rtgodam_signed_playback_job( 10 ) );
		$this->assertSame( 'job-virtual', rtgodam_signed_playback_job( '11' ) );
		$this->assertSame( '', rtgodam_signed_playback_job( 12 ) );
		$this->assertSame( '', rtgodam_signed_playback_job( 13 ) );
		$this->assertSame( '', rtgodam_signed_playback_job( 0 ) );
		$this->assertSame( '', rtgodam_signed_playback_job( 'abc' ) );
	}

	/**
	 * The lookup is wrapped in the attachment-lookup actions, so a network that keeps media
	 * on another site can switch to it first (as the player template does).
	 */
	public function test_the_lookup_is_wrapped_in_the_attachment_lookup_actions() {
		$order = array();
		add_action(
			'rtgodam_before_attachment_lookup',
			static function () use ( &$order ) {
				$order[] = 'before';
			}
		);
		add_action(
			'rtgodam_after_attachment_lookup',
			static function () use ( &$order ) {
				$order[] = 'after';
			}
		);
		rtgodam_signed_playback_job( 10 );
		$this->assertSame( array( 'before', 'after' ), $order );

		$order = array();
		rtgodam_signed_playback_job( 0 );
		$this->assertSame( array(), $order, 'no lookup, no switch' );
	}
}
