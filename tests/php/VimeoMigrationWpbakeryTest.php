<?php
/**
 * Unit tests for replacing Vimeo videos in WPBakery content (Vimeo migration, issue #100).
 *
 * The fixture is a WPBakery page: a Vimeo Video Player with title, width,
 * aspect, alignment, class, ID and Design Options, a YouTube Video Player,
 * and a Vimeo Video Player inside a Tabs section.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Vimeo_Migration\WPBakery_Source;

require_once dirname( __DIR__ ) . '/stubs/vimeo-migration-functions.php';

/**
 * @covers \RTGODAM\Inc\Vimeo_Migration\WPBakery_Source
 */
class VimeoMigrationWpbakeryTest extends TestCase {

	const VIMEO_URL = 'https://vimeo.com/1126119215?fl=pl&fe=sh';

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_stub'] = array();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * The stored page content.
	 *
	 * @return string
	 */
	private function fixture(): string {
		return trim( file_get_contents( dirname( __DIR__ ) . '/fixtures/vimeo-migration/wpbakery-content.txt' ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local test fixture.
	}

	/**
	 * Source with a resolver that knows the test video.
	 *
	 * @return WPBakery_Source
	 */
	private function source(): WPBakery_Source {
		return new WPBakery_Source(
			static function ( string $url ) {
				return self::VIMEO_URL === $url ? array(
					'id'  => 501,
					'url' => 'https://cdn.example.org/501/video.mp4',
				) : null;
			}
		);
	}

	public function test_replaces_vimeo_video_players() {
		$source = $this->source();
		$result = $source->migrate_content( $this->fixture() );

		$expected = '[vc_row][vc_column]'
			. '[godam_video id="501" aspect_ratio="responsive" css=".vc_custom_1762850000001{margin-top: 20px !important;}"]'
			. '[vc_video link="https://www.youtube.com/watch?v=XHOmBV4js_E"]'
			. '[/vc_column][/vc_row]'
			. '[vc_row][vc_column][vc_tta_tabs][vc_tta_section title="Tab 1" tab_id="tab-vimeo-1"]'
			. '[godam_video id="501" aspect_ratio="16:9"]'
			. '[/vc_tta_section][/vc_tta_tabs][/vc_column][/vc_row]';

		$this->assertSame( $expected, $result );
		$this->assertSame(
			array(
				'found'    => 2,
				'migrated' => 2,
			),
			$source->get_counts()
		);
	}

	public function test_keeps_players_when_the_video_is_not_in_godam_central() {
		$source = new WPBakery_Source(
			static function () {
				return null;
			}
		);

		$this->assertSame( $this->fixture(), $source->migrate_content( $this->fixture() ) );
		$this->assertSame(
			array(
				'found'    => 2,
				'migrated' => 0,
			),
			$source->get_counts()
		);
	}

	public function test_leaves_an_escaped_shortcode_alone() {
		$content = 'Use [[vc_video link="' . self::VIMEO_URL . '"]] to embed a video.';
		$source  = $this->source();

		$this->assertSame( $content, $source->migrate_content( $content ) );
		$this->assertSame( 0, $source->get_counts()['found'] );
	}

	public function test_decodes_a_wpbakery_encoded_link() {
		$source = $this->source();
		$result = $source->migrate_content( '[vc_video link="' . self::VIMEO_URL . '" el_aspect="169"]' );

		$this->assertSame( '[godam_video id="501" aspect_ratio="16:9"]', $result );
	}

	public function test_content_without_video_players_is_unchanged() {
		$content = '[vc_row][vc_column][vc_column_text]See https://vimeo.com/1126119215[/vc_column_text][/vc_column][/vc_row]';
		$source  = $this->source();

		$this->assertSame( $content, $source->migrate_content( $content ) );
		$this->assertSame( 0, $source->get_counts()['found'] );
	}
}
