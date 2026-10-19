<?php
/**
 * Unit tests for reading Video SEO data from WPBakery godam_video shortcodes (#2183).
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Seo;

require_once dirname( __DIR__ ) . '/stubs/video-seo-functions.php';
require_once dirname( __DIR__ ) . '/stubs/shortcode-functions.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/class-seo.php';
require_once dirname( __DIR__ ) . '/stubs/class-wpbakery-seo-double.php';

/**
 * @covers \RTGODAM\Inc\Seo
 */
class VideoSeoWpbakeryTest extends TestCase {

	/**
	 * @var Wpbakery_Seo_Double
	 */
	private $seo;

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_stub'] = array();
		$this->seo               = ( new \ReflectionClass( Wpbakery_Seo_Double::class ) )->newInstanceWithoutConstructor();
		$this->seo->media        = array(
			7 => array(
				'headline'         => 'Media Library title',
				'description'      => 'Media Library description.',
				'contentUrl'       => 'https://cdn.example.test/7/master.m3u8',
				'uploadDate'       => '2026-01-15T08:00:00+00:00',
				'thumbnailUrl'     => 'https://cdn.example.test/7/t.jpg',
				'duration'         => 'PT2M',
				'isFamilyFriendly' => true,
			),
		);
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Attributes an element saves with Override = No after this PR: the editor
	 * fills every SEO param with the Media Library values.
	 *
	 * @param int $id Attachment ID.
	 * @return string
	 */
	private function synced_shortcode( $id ) {
		return '[godam_video id="' . $id . '" seo_override="0" seo_headline="Old title" seo_description="Old description."'
			. ' seo_content_url="https://cdn.example.test/old/master.m3u8" seo_upload_date="2025-01-01T00:00:00+00:00"'
			. ' seo_duration="PT1M" seo_thumbnail_url="https://cdn.example.test/old.jpg" seo_family_friendly="1"]';
	}

	public function test_override_off_uses_the_media_library() {
		$schemas = $this->seo->godam_get_video_seo_data_from_wpbakery( $this->synced_shortcode( 7 ) );

		$this->assertCount( 1, $schemas );
		$this->assertSame( 'Media Library title', $schemas[0]['headline'] );
		$this->assertSame( 'https://cdn.example.test/7/master.m3u8', $schemas[0]['contentUrl'] );
		$this->assertSame( 7, $schemas[0]['attachment_id'] );
	}

	public function test_override_off_with_a_deleted_video_outputs_nothing() {
		$result = $this->seo->godam_get_video_seo_data_from_wpbakery( $this->synced_shortcode( 99 ), true );

		$this->assertSame( array(), $result['schemas'] );
		$this->assertSame( array(), $result['attachments'] );
	}

	public function test_override_off_with_an_empty_media_title_outputs_nothing() {
		$this->seo->media[7]['headline'] = '';

		$this->assertSame( array(), $this->seo->godam_get_video_seo_data_from_wpbakery( $this->synced_shortcode( 7 ) ) );
	}

	public function test_override_on_uses_the_custom_values_and_media_technical_values() {
		$content = '[godam_video id="7" seo_override="1" seo_headline="Custom title" seo_description="Custom description."'
			. ' seo_content_url="https://cdn.example.test/old/master.m3u8" seo_family_friendly="0"]';

		$schemas = $this->seo->godam_get_video_seo_data_from_wpbakery( $content );

		$this->assertSame( 'Custom title', $schemas[0]['headline'] );
		$this->assertSame( 'Custom description.', $schemas[0]['description'] );
		$this->assertFalse( $schemas[0]['isFamilyFriendly'] );
		// Technical values still come from the attachment.
		$this->assertSame( 'https://cdn.example.test/7/master.m3u8', $schemas[0]['contentUrl'] );
		$this->assertSame( 'PT2M', $schemas[0]['duration'] );
	}

	public function test_override_on_with_a_deleted_video_falls_back_to_stored_values() {
		$content = '[godam_video id="99" seo_override="1" seo_headline="Custom title" seo_content_url="https://cdn.example.test/x.m3u8"]';

		$schemas = $this->seo->godam_get_video_seo_data_from_wpbakery( $content );

		$this->assertSame( 'Custom title', $schemas[0]['headline'] );
		$this->assertSame( 'https://cdn.example.test/x.m3u8', $schemas[0]['contentUrl'] );
	}

	public function test_wpbakery_encoded_characters_are_decoded() {
		$content = '[godam_video id="7" seo_override="1" seo_headline="Demo `{`2026`}` ``Final``"'
			. ' seo_description="Part `{`1`}` of ``the`` series."]';

		$schemas = $this->seo->godam_get_video_seo_data_from_wpbakery( $content );

		$this->assertSame( 'Demo [2026] "Final"', $schemas[0]['headline'] );
		$this->assertSame( 'Part [1] of "the" series.', $schemas[0]['description'] );
	}

	public function test_decode_wpbakery_param() {
		$this->assertSame( '[a] "b"', Seo::decode_wpbakery_param( '`{`a`}` ``b``' ) );
		$this->assertSame( 'plain', Seo::decode_wpbakery_param( 'plain' ) );
		$this->assertSame( '', Seo::decode_wpbakery_param( array( 'x' ) ) );
	}
}
