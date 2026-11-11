<?php
/**
 * Unit tests for rendering GoDAM share URLs with the site's own player (Vimeo migration, issue #100).
 *
 * A share URL (RTGODAM_API_BASE/web/video/<job ID>) whose video is in the
 * media library renders as [godam_video id="…"], without asking GoDAM's
 * oEmbed API, which only embeds videos shared publicly. Anything else still
 * goes to the API as before.
 *
 * The test API base is https://api.test. wp_remote_post() is the stub from
 * tests/stubs/engagement-functions.php, which records calls in `posts`.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Embed;

require_once dirname( __DIR__, 2 ) . '/inc/classes/class-embed.php';
require_once dirname( __DIR__ ) . '/stubs/embed-functions.php';
require_once dirname( __DIR__ ) . '/stubs/shortcode-functions.php';
require_once dirname( __DIR__ ) . '/stubs/class-embed-wpdb-double.php';

/**
 * @covers \RTGODAM\Inc\Embed::get_local_embed_html
 * @covers \RTGODAM\Inc\Embed::render_local_embed
 * @covers \RTGODAM\Inc\Embed::get_share_url_job_id
 * @covers \RTGODAM\Inc\Embed::pre_oembed_result
 */
class EmbedLocalRenderTest extends TestCase {

	/**
	 * The $wpdb that was set before the test.
	 *
	 * @var mixed
	 */
	private $previous_wpdb;

	/**
	 * The $wpdb double.
	 *
	 * @var Embed_Wpdb_Double
	 */
	private $wpdb;

	protected function setUp(): void {
		parent::setUp();

		$this->previous_wpdb      = $GLOBALS['wpdb'] ?? null;
		$this->wpdb               = new Embed_Wpdb_Double();
		$this->wpdb->attachments  = array( 'vimeomock01' => 4929 );
		$GLOBALS['wpdb']          = $this->wpdb; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- test double, restored in tearDown().
		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array(
			'options'      => array(),
			'posts'        => array(),
			'post_handler' => function () {
				return array(
					'code' => 200,
					'body' => wp_json_encode(
						array(
							'type' => 'video',
							'html' => '<iframe src="https://api.test/web/embed/other"></iframe>',
						)
					),
				);
			},
		);

		add_shortcode(
			'godam_video',
			static function ( $atts ) {
				return '<div class="godam-player" data-id="' . $atts['id'] . '"></div>';
			}
		);
	}

	protected function tearDown(): void {
		remove_shortcode( 'godam_video' );
		$GLOBALS['wpdb'] = $this->previous_wpdb; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- restores the original.
		unset( $GLOBALS['rtgodam_stub'], $GLOBALS['rtgodam_hooks'] );
		parent::tearDown();
	}

	/**
	 * Embed without its constructor (it registers WP hooks).
	 *
	 * @return Embed
	 */
	private function embed(): Embed {
		return ( new \ReflectionClass( Embed::class ) )->newInstanceWithoutConstructor();
	}

	public function test_a_share_url_of_a_library_video_renders_the_sites_player() {
		$html = $this->embed()->pre_oembed_result( null, 'https://api.test/web/video/vimeomock01' );

		$this->assertSame( '<div class="godam-player" data-id="4929"></div>', $html );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['posts'], 'GoDAM\'s oEmbed API is not asked.' );
	}

	public function test_the_embed_handler_renders_the_same_player() {
		$url = 'https://api.test/web/video/vimeomock01?org=abc';

		$this->assertSame( '<div class="godam-player" data-id="4929"></div>', $this->embed()->render_local_embed( array( $url ), array(), $url ) );
	}

	public function test_a_video_not_in_the_library_still_goes_to_the_oembed_api() {
		$embed = $this->embed();

		$this->assertFalse( $embed->render_local_embed( array(), array(), 'https://api.test/web/video/unknown01' ) );

		$html = $embed->pre_oembed_result( null, 'https://api.test/web/video/unknown01' );

		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['posts'] );
		$this->assertStringContainsString( 'https://api.test/web/embed/other', $html );
	}

	public function test_a_filter_can_keep_the_oembed_iframe() {
		add_filter(
			'rtgodam_render_share_url_locally',
			static function () {
				return false;
			}
		);

		$html = $this->embed()->pre_oembed_result( null, 'https://api.test/web/video/vimeomock01' );

		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['posts'] );
		$this->assertStringContainsString( '<iframe', $html );
	}

	public function test_each_job_is_looked_up_once_per_request() {
		$embed = $this->embed();

		$embed->get_local_embed_html( 'https://api.test/web/video/vimeomock01' );
		$embed->get_local_embed_html( 'https://api.test/web/video/vimeomock01' );
		$embed->get_local_embed_html( 'https://api.test/web/video/unknown01' );
		$embed->get_local_embed_html( 'https://api.test/web/video/unknown01' );

		$this->assertSame( array( 'vimeomock01', 'unknown01' ), $this->wpdb->lookups );
	}

	public function test_urls_off_godams_host_are_not_looked_up() {
		$this->assertSame( '', $this->embed()->get_local_embed_html( 'https://example.test/web/video/vimeomock01' ) );
		$this->assertSame( array(), $this->wpdb->lookups );
	}

	/**
	 * Share URLs and the job ID each holds.
	 *
	 * @return array<string, array{0: string, 1: string}>
	 */
	public function share_urls(): array {
		return array(
			'plain'          => array( 'https://api.test/web/video/3fqjd5bmpr', '3fqjd5bmpr' ),
			'with org query' => array( 'https://api.test/web/video/3fqjd5bmpr?org=d731f9ddfb', '3fqjd5bmpr' ),
			'trailing slash' => array( 'https://api.test/web/video/3fqjd5bmpr/', '3fqjd5bmpr' ),
			'embed page'     => array( 'https://api.test/web/embed/3fqjd5bmpr', '' ),
			'deeper path'    => array( 'https://api.test/web/video/3fqjd5bmpr/edit', '' ),
			'no job id'      => array( 'https://api.test/web/video/', '' ),
			'odd characters' => array( 'https://api.test/web/video/abc%27def', '' ),
		);
	}

	/**
	 * @dataProvider share_urls
	 *
	 * @param string $url      Share URL.
	 * @param string $expected Job ID it holds.
	 */
	public function test_reads_the_job_id( string $url, string $expected ) {
		$this->assertSame( $expected, Embed::get_share_url_job_id( $url ) );
	}
}
