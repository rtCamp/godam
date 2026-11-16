<?php
/**
 * Unit tests for the `[video]` shortcode override in Media_Edit_Enhancements.
 *
 * WordPress renders a `[video]` shortcode itself only when the
 * `wp_video_shortcode_override` filter returns ''. The override is meant for
 * .mov files only, so for anything else it must hand back what it was given.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Media_Library\Media_Edit_Enhancements;

require_once dirname( __DIR__ ) . '/stubs/i18n.php';

/**
 * @covers \RTGODAM\Inc\Media_Library\Media_Edit_Enhancements::video_shortcode_override
 */
class MediaEditVideoShortcodeOverrideTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__, 2 ) . '/inc/traits/trait-singleton.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/media-library/class-media-edit-enhancements.php';
	}

	/**
	 * Media_Edit_Enhancements without its constructor (it registers WP hooks).
	 *
	 * @return Media_Edit_Enhancements
	 */
	private function enhancements() {
		return ( new \ReflectionClass( Media_Edit_Enhancements::class ) )->newInstanceWithoutConstructor();
	}

	public function test_other_videos_are_left_to_wordpress() {
		$override = $this->enhancements();

		$this->assertSame( '', $override->video_shortcode_override( '', array( 'src' => 'https://example.test/a.mp4' ) ) );
		$this->assertSame( '', $override->video_shortcode_override( '', array() ) );
	}

	public function test_an_earlier_override_is_kept() {
		$this->assertSame(
			'<iframe></iframe>',
			$this->enhancements()->video_shortcode_override( '<iframe></iframe>', array( 'src' => 'https://example.test/a.mp4' ) )
		);
	}

	public function test_mov_files_get_a_plain_video_element() {
		$html = $this->enhancements()->video_shortcode_override( '', array( 'src' => 'https://example.test/clip.mov' ) );

		$this->assertStringStartsWith( '<video ', $html );
		$this->assertStringContainsString( '<source src="https://example.test/clip.mov" type="video/mp4">', $html );
	}
}
