<?php
/**
 * The "CDN Conflict Detected" notice still finds a failed file Central answered with a 404,
 * now that the public status route returns the plugin's own reason codes.
 *
 * @see https://github.com/rtCamp/godam-plugin-wp/issues/109
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Media_Tracker;

/**
 * @covers \RTGODAM\Inc\Media_Tracker::status_with_not_found
 */
class MediaTrackerNotFoundTest extends TestCase {

	/**
	 * Load the class.
	 */
	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__, 2 ) . '/inc/traits/trait-singleton.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/class-media-tracker.php';
	}

	/**
	 * @return array
	 */
	public function statuses() {
		return array(
			'failed with a stored 404'     => array( 'failed', '404', 'not_found' ),
			'failed for another reason'    => array( 'failed', 'transcoder_error', 'failed' ),
			'failed with no stored code'   => array( 'failed', '', 'failed' ),
			'transcoding, with a 404 kept' => array( 'transcoding', '404', 'transcoding' ),
		);
	}

	/**
	 * @dataProvider statuses
	 *
	 * @param string $status     The status route's status.
	 * @param string $error_code The stored error code.
	 * @param string $expected   What the notice check sees.
	 */
	public function test_a_stored_404_on_a_failed_file_reads_as_not_found( $status, $error_code, $expected ) {
		$this->assertSame( $expected, Media_Tracker::status_with_not_found( $status, $error_code ) );
	}
}
