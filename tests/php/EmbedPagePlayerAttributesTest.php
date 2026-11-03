<?php
/**
 * Unit tests for the player the embed and preview pages render.
 *
 * godam_embed_page_content() takes `godam_context` and `block_source` from the URL. They reach
 * the player as attribute values, reduced to slug characters, and never as shortcode syntax.
 *
 * Each test runs in its own process because it loads the player-entry stubs.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * @covers ::godam_embed_page_content
 * @covers ::godam_preview_page_content
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class EmbedPagePlayerAttributesTest extends TestCase {

	private const CONTEXT_PAYLOAD = 'x][gx_marker]';

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/video-seo-functions.php';
		require_once dirname( __DIR__ ) . '/stubs/player-entry-stubs.php';

		$GLOBALS['rtgodam_stub'] = array(
			'posts' => array(
				7 => new \WP_Post(
					array(
						'ID'             => 7,
						'post_type'      => 'attachment',
						'post_mime_type' => 'video/mp4',
					)
				),
			),
			'mime'  => 'video/mp4',
			'title' => 'Sample video',
		);
		rtgodam_stub_register_player_and_marker();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/** @return array[] Attributes each player render received. */
	private function player_atts() {
		return $GLOBALS['rtgodam_stub']['player_atts'];
	}

	/** A link the plugin itself builds renders the player with the same attributes as before. */
	public function test_a_normal_link_renders_the_player_with_the_same_attributes() {
		add_filter(
			'rtgodam_enable_engagement_feature',
			static function () {
				return true;
			}
		);

		$html = godam_embed_page_content( 7, 'godam-video-product-gallery', '#112233', true, 'video-gallery', 12 );

		$this->assertSame(
			array(
				array(
					'id'            => '7',
					'godam_context' => 'godam-video-product-gallery',
					'engagements'   => 'show',
					'block_source'  => 'video-gallery',
					'host_post_id'  => '12',
				),
			),
			$this->player_atts()
		);
		$this->assertStringContainsString( 'class="godam-player-double" data-id="7"', $html );
		$this->assertStringContainsString( 'data-godam-context="godam-video-product-gallery"', $html );
		$this->assertStringContainsString( '--godam-video-bg-color: #112233;', $html );
	}

	/** A link with only the video ID renders the bare player. */
	public function test_a_link_with_only_the_video_id_renders_the_bare_player() {
		godam_embed_page_content( 7 );

		$this->assertSame( array( array( 'id' => '7' ) ), $this->player_atts() );
	}

	/** Shortcode text appended to godam_context is not run. */
	public function test_shortcode_text_in_godam_context_is_not_run() {
		$html = godam_embed_page_content( 7, self::CONTEXT_PAYLOAD );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
		$this->assertStringNotContainsString( 'GX-MARKER', $html );
		$this->assertCount( 1, $this->player_atts() );
		$this->assertSame( 'xgx_marker', $this->player_atts()[0]['godam_context'] );
		$this->assertStringContainsString( 'data-godam-context="xgx_marker"', $html );
	}

	/** Shortcode text appended to block_source is not run. */
	public function test_shortcode_text_in_block_source_is_not_run() {
		$html = godam_embed_page_content( 7, '', '', false, self::CONTEXT_PAYLOAD );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
		$this->assertStringNotContainsString( 'GX-MARKER', $html );
		$this->assertCount( 1, $this->player_atts() );
		$this->assertSame( 'xgx_marker', $this->player_atts()[0]['block_source'] );
	}

	/** A value with quotes and a second tag is cut down to slug characters and runs nothing. */
	public function test_quotes_and_tags_are_dropped_from_both_values() {
		$value = 'a" b="][gx_marker]["';

		godam_embed_page_content( 7, $value, '', false, $value );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
		$this->assertSame( 'abgx_marker', $this->player_atts()[0]['godam_context'] );
		$this->assertSame( 'abgx_marker', $this->player_atts()[0]['block_source'] );
	}

	/** The values are slugs, so upper case is lowered the way sanitize_key() does. */
	public function test_values_are_reduced_to_slugs() {
		godam_embed_page_content( 7, 'Video-Only', '', false, 'Video-Gallery' );

		$this->assertSame( 'video-only', $this->player_atts()[0]['godam_context'] );
		$this->assertSame( 'video-gallery', $this->player_atts()[0]['block_source'] );
	}

	/** The preview page renders a video attachment through the video player attributes. */
	public function test_the_preview_page_renders_a_video_from_attributes() {
		$html = godam_preview_page_content( 7 );

		$this->assertSame( array( array( 'id' => '7' ) ), $this->player_atts() );
		$this->assertStringContainsString( 'class="godam-player-double" data-id="7"', $html );
		$this->assertArrayNotHasKey( 'shortcodes', $GLOBALS['rtgodam_stub'] );
	}

	/** The preview page renders an audio attachment through the audio shortcode's attributes. */
	public function test_the_preview_page_renders_audio_from_attributes() {
		$GLOBALS['rtgodam_stub']['mime']  = 'audio/mpeg';
		$GLOBALS['rtgodam_stub']['posts'] = array(
			7 => new \WP_Post(
				array(
					'ID'             => 7,
					'post_type'      => 'attachment',
					'post_mime_type' => 'audio/mpeg',
				)
			),
		);

		$audio_atts = array();
		add_shortcode(
			'godam_audio',
			static function ( $atts ) use ( &$audio_atts ) {
				$audio_atts[] = $atts;
				return '<div class="godam-audio-double"></div>';
			}
		);

		$html = godam_preview_page_content( 7 );

		$this->assertSame( array( array( 'id' => '7' ) ), $audio_atts );
		$this->assertSame( array(), $this->player_atts() );
		$this->assertStringContainsString( 'godam-audio-double', $html );
	}
}
