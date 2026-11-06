<?php
/**
 * Unit tests for GoDAM's oEmbed handling.
 *
 * Only a URL on GoDAM's own host is sent to GoDAM's oEmbed API; a URL that just
 * mentions GoDAM somewhere in it is left to WordPress. The HTML GoDAM returns
 * keeps its iframe and loses scripts, styles and event handlers.
 *
 * The test API base (see tests/stubs/site-functions.php) is https://api.test.
 * wp_remote_post() is the stub from tests/stubs/engagement-functions.php: each
 * test sets what GoDAM answers with `post_handler` and reads the calls from
 * `posts`.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Embed;

/**
 * @covers \RTGODAM\Inc\Embed::pre_oembed_result
 * @covers \RTGODAM\Inc\Embed::register_oembed_provider
 */
class EmbedGodamUrlTest extends TestCase {

	private const IFRAME = '<iframe src="https://api.test/web/embed/abc" width="640" height="360" allowfullscreen></iframe>';

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__, 2 ) . '/inc/classes/class-embed.php';

		require_once dirname( __DIR__ ) . '/stubs/embed-functions.php';

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array(
			'options'      => array(),
			'posts'        => array(),
			'post_handler' => function () {
				return array(
					'code' => 200,
					'body' => wp_json_encode(
						array(
							'type' => 'json',
							'html' => self::IFRAME . '<script>alert(1)</script>',
						)
					),
				);
			},
		);
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $GLOBALS['rtgodam_hooks'] );
		parent::tearDown();
	}

	/**
	 * Embed without its constructor (it registers WP hooks).
	 *
	 * @return Embed
	 */
	private function embed() {
		return ( new \ReflectionClass( Embed::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * URLs that are on GoDAM's host.
	 *
	 * @return array<string, array{0: string}>
	 */
	public function godam_urls() {
		return array(
			'https'            => array( 'https://api.test/web/video/abc' ),
			'http'             => array( 'http://api.test/web/video/abc' ),
			'host in capitals' => array( 'HTTPS://API.TEST/web/video/abc' ),
			'with a query'     => array( 'https://api.test/web/video/abc?autoplay=1' ),
		);
	}

	/**
	 * A GoDAM URL is sent to GoDAM's oEmbed API.
	 *
	 * @dataProvider godam_urls
	 *
	 * @param string $url GoDAM URL.
	 */
	public function test_a_godam_url_is_sent_to_the_godam_api( $url ) {
		$result = $this->embed()->pre_oembed_result( null, $url );

		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['posts'] );
		$this->assertSame( 'https://api.test/api/method/godam_core.api.oembed.get_oembed', $GLOBALS['rtgodam_stub']['posts'][0]['url'] );
		$this->assertSame( array( 'url' => $url ), json_decode( $GLOBALS['rtgodam_stub']['posts'][0]['args']['body'], true ) );
		$this->assertStringStartsWith( '<div class="llms-av-embed fitvidsignore">', $result );
	}

	/**
	 * URLs that only mention GoDAM's address somewhere in them.
	 *
	 * @return array<string, array{0: string}>
	 */
	public function urls_that_only_mention_godam() {
		return array(
			'in the query'      => array( 'https://example.test/page?u=https://api.test/web/video/abc' ),
			'in the path'       => array( 'https://example.test/https://api.test/web/video/abc' ),
			'in the fragment'   => array( 'https://example.test/#https://api.test/web/video/abc' ),
			'on a longer host'  => array( 'https://api.test.example.test/web/video/abc' ),
			'as the user name'  => array( 'https://api.test@example.test/web/video/abc' ),
			'on a sub domain'   => array( 'https://www.api.test/web/video/abc' ),
			'not http or https' => array( 'ftp://api.test/web/video/abc' ),
			'a script URL'      => array( 'javascript://api.test/%0Aalert(1)' ),
			'no host'           => array( '/web/video/abc' ),
		);
	}

	/**
	 * Such a URL is left to WordPress and nothing is sent to GoDAM.
	 *
	 * @dataProvider urls_that_only_mention_godam
	 *
	 * @param string $url URL.
	 */
	public function test_a_url_that_only_mentions_godam_is_left_alone( $url ) {
		$this->assertNull( $this->embed()->pre_oembed_result( null, $url ) );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['posts'] );
	}

	/** The HTML from GoDAM is filtered with the post markup plus an iframe, before it is used. */
	public function test_returned_html_is_filtered_with_post_markup_and_an_iframe() {
		$GLOBALS['rtgodam_stub']['kses_result'] = self::IFRAME;

		$result = $this->embed()->pre_oembed_result( null, 'https://api.test/web/video/abc' );

		$this->assertSame( '<div class="llms-av-embed fitvidsignore">' . self::IFRAME . '</div>', $result );

		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['kses_calls'] );
		$this->assertSame( 'post', $GLOBALS['rtgodam_stub']['kses_context'] );
		$this->assertSame( self::IFRAME . '<script>alert(1)</script>', $GLOBALS['rtgodam_stub']['kses_calls'][0]['content'] );

		$allowed = $GLOBALS['rtgodam_stub']['kses_calls'][0]['allowed'];
		$this->assertArrayHasKey( 'p', $allowed, 'The post markup is kept.' );
		$this->assertArrayHasKey( 'iframe', $allowed );
		foreach ( array( 'src', 'width', 'height', 'title', 'allow', 'allowfullscreen', 'frameborder', 'loading', 'class', 'data-*' ) as $attribute ) {
			$this->assertArrayHasKey( $attribute, $allowed['iframe'] );
		}
		foreach ( array( 'onload', 'onerror', 'srcdoc' ) as $attribute ) {
			$this->assertArrayNotHasKey( $attribute, $allowed['iframe'] );
		}
		$this->assertArrayNotHasKey( 'script', $allowed );
		$this->assertArrayNotHasKey( 'style', $allowed );
	}

	/** A site can widen what is kept. */
	public function test_allowed_html_can_be_filtered() {
		add_filter(
			'rtgodam_oembed_allowed_html',
			function ( $allowed ) {
				$allowed['span'] = array( 'class' => true );
				return $allowed;
			}
		);

		$this->embed()->pre_oembed_result( null, 'https://api.test/web/video/abc' );

		$this->assertArrayHasKey( 'span', $GLOBALS['rtgodam_stub']['kses_calls'][0]['allowed'] );
	}

	/** The LifterLMS autoplay option still adds its class to the iframe that is kept. */
	public function test_autoplay_option_is_applied_to_the_filtered_html() {
		$GLOBALS['rtgodam_stub']['options'][ Embed::LLMS_AV_PROG_AUTO_PLAY_OPTION ] = 'yes';
		$GLOBALS['rtgodam_stub']['kses_result']                                     = '<iframe src="https://api.test/web/embed/abc"></iframe>';

		$result = $this->embed()->pre_oembed_result( null, 'https://api.test/web/video/abc' );

		$this->assertSame(
			'<div class="llms-av-embed fitvidsignore"><iframe class="rtgodam-llms-autoplay" allow="autoplay;encrypted-media;" src="https://api.test/web/embed/abc"></iframe></div>',
			$result
		);
	}

	/** An answer that is not a usable oEmbed result, or whose HTML is not text, is not used. */
	public function test_an_unusable_answer_is_not_used() {
		foreach ( array( '{"type":"json"}', '{"html":"<p>x</p>"}', '{"type":"json","html":["<p>x</p>"]}', 'not json' ) as $body ) {
			$GLOBALS['rtgodam_stub']['post_handler'] = function () use ( $body ) {
				return array(
					'code' => 200,
					'body' => $body,
				);
			};

			$this->assertNull( $this->embed()->pre_oembed_result( null, 'https://api.test/web/video/abc' ), $body );
		}
	}

	/** A failed request is passed on as false, as before. */
	public function test_a_failed_request_returns_false() {
		$GLOBALS['rtgodam_stub']['post_handler'] = function () {
			return new \WP_Error( 'http_request_failed', 'Failed' );
		};

		$this->assertFalse( $this->embed()->pre_oembed_result( null, 'https://api.test/web/video/abc' ) );
	}

	/** The provider pattern matches a GoDAM video URL and nothing that only contains one. */
	public function test_provider_pattern_is_anchored_to_the_start_of_the_url() {
		$this->embed()->register_oembed_provider();

		$provider = $GLOBALS['rtgodam_stub']['providers'][0];
		$this->assertSame( 'https://api.test/api/method/godam_core.api.oembed.get_oembed', $provider[1] );
		$this->assertTrue( $provider[2] );

		$this->assertSame( 1, preg_match( $provider[0], 'https://api.test/web/video/abc' ) );
		$this->assertSame( 1, preg_match( $provider[0], 'http://api.test/web/video/abc' ) );
		$this->assertSame( 0, preg_match( $provider[0], 'https://example.test/page?u=https://api.test/web/video/abc' ) );
		$this->assertSame( 0, preg_match( $provider[0], 'https://api.test.example.test/web/video/abc' ) );
	}
}
