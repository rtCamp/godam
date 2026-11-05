<?php
/**
 * Unit tests for the player the video-shortcode REST route renders.
 *
 * The route's `godam_context` parameter reaches the player as an attribute value, reduced to
 * slug characters, and never as shortcode syntax.
 *
 * Each test runs in its own process: it loads admin/godam-transcoder-functions.php, which
 * EarlyTranslationHooksTest checks on its first load in the shared process, and the
 * player-entry stubs.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Dynamic_Shortcode;

/**
 * @covers \RTGODAM\Inc\REST_API\Dynamic_Shortcode
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class VideoShortcodeRoutePlayerAttributesTest extends TestCase {

	/**
	 * @var Dynamic_Shortcode
	 */
	private $route;

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/video-seo-functions.php';
		require_once dirname( __DIR__ ) . '/stubs/player-entry-stubs.php';
		require_once dirname( __DIR__ ) . '/stubs/template-tags.php';
		require_once dirname( __DIR__, 2 ) . '/admin/godam-transcoder-functions.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-dynamic-shortcode.php';

		$GLOBALS['rtgodam_stub'] = array(
			'posts'          => array(
				7 => new \WP_Post(
					array(
						'ID'        => 7,
						'post_type' => 'attachment',
					)
				),
			),
			'post_meta'      => array(
				'rtgodam_transcoded_url'     => 'https://cdn.example.test/7/master.mpd',
				'rtgodam_hls_transcoded_url' => 'https://cdn.example.test/7/master.m3u8',
			),
			'attachment_url' => 'https://example.test/wp-content/uploads/sample.mp4',
			'mime'           => 'video/mp4',
			'title'          => 'Sample video',
		);
		rtgodam_stub_register_player_and_marker();

		$this->route = ( new \ReflectionClass( Dynamic_Shortcode::class ) )->newInstanceWithoutConstructor();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Call the route the way WordPress does.
	 *
	 * @param array $params Request params.
	 * @return array The response data.
	 */
	private function call( array $params ) {
		$response = $this->route->render_shortcode( new \WP_REST_Request( $params ) );

		return $response->get_data();
	}

	/** @return array[] Attributes each player render received. */
	private function player_atts() {
		return $GLOBALS['rtgodam_stub']['player_atts'];
	}

	/**
	 * The sources attribute as the player reads it, whatever way the placeholders were written.
	 *
	 * @param string $sources The attribute value.
	 * @return array
	 */
	private function decoded_sources( $sources ) {
		return json_decode( str_replace( array( '__rtgob__', '__rtgcb__' ), array( '[', ']' ), $sources ), true );
	}

	/** A normal call returns the player HTML and renders it with the same attributes as before. */
	public function test_a_normal_call_renders_the_player_with_the_same_attributes() {
		$data = $this->call(
			array(
				'id'            => 7,
				'engagements'   => '',
				'godam_context' => 'godam-video-product-gallery',
			)
		);

		$this->assertSame( 'success', $data['status'] );
		$this->assertStringContainsString( 'class="godam-player-double" data-id="7"', $data['html'] );
		$this->assertSame( 'Sample video', $data['title'] );

		$this->assertCount( 1, $this->player_atts() );
		$atts = $this->player_atts()[0];
		$this->assertSame( '7', $atts['id'] );
		$this->assertSame( '', $atts['engagements'] );
		$this->assertSame( 'godam-video-product-gallery', $atts['godam_context'] );
		$this->assertSame(
			array(
				array(
					'src'  => 'https://cdn.example.test/7/master.mpd',
					'type' => 'application/dash+xml',
				),
				array(
					'src'  => 'https://cdn.example.test/7/master.m3u8',
					'type' => 'application/x-mpegURL',
				),
				array(
					'src'  => 'https://example.test/wp-content/uploads/sample.mp4',
					'type' => 'video/mp4',
				),
			),
			$this->decoded_sources( $atts['sources'] )
		);
	}

	/** A call without a context renders the player without one. */
	public function test_a_call_without_a_context_has_no_context_attribute() {
		$this->call(
			array(
				'id'          => 7,
				'engagements' => 'show',
			)
		);

		$atts = $this->player_atts()[0];
		$this->assertArrayNotHasKey( 'godam_context', $atts );
		$this->assertSame( 'show', $atts['engagements'] );
	}

	/** Shortcode text appended to godam_context is not run. */
	public function test_shortcode_text_in_godam_context_is_not_run() {
		$data = $this->call(
			array(
				'id'            => 7,
				'engagements'   => '',
				'godam_context' => 'x][gx_marker]',
			)
		);

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
		$this->assertStringNotContainsString( 'GX-MARKER', $data['html'] );
		$this->assertSame( 'success', $data['status'] );
		$this->assertCount( 1, $this->player_atts() );
		$this->assertSame( 'xgx_marker', $this->player_atts()[0]['godam_context'] );
	}

	/** The route argument reduces the value to slug characters before the callback runs. */
	public function test_the_route_argument_is_sanitized_as_a_key() {
		$routes = $this->route->get_rest_routes();
		$arg    = $routes[0]['args']['args']['godam_context'];

		$this->assertSame( 'sanitize_key', $arg['sanitize_callback'] );
		$this->assertSame( 'x_gx_marker', call_user_func( $arg['sanitize_callback'], 'X][_gx_marker]' ) );
	}

	/** A video the site does not have is still reported as not found, and nothing is rendered. */
	public function test_a_missing_video_is_not_found() {
		$response = $this->route->render_shortcode( new \WP_REST_Request( array( 'id' => 99 ) ) );

		$this->assertSame( 404, $response->get_status() );
		$this->assertSame( array(), $this->player_atts() );
	}

	/** The new attributes filter can change what the player renders with. */
	public function test_the_attributes_filter_applies() {
		add_filter(
			'rtgodam_shortcode_atts',
			static function ( $atts ) {
				$atts['godam_context'] = 'from-filter';
				return $atts;
			}
		);

		$this->call(
			array(
				'id'          => 7,
				'engagements' => '',
			)
		);

		$this->assertSame( 'from-filter', $this->player_atts()[0]['godam_context'] );
	}

	/** A site that still filters the old shortcode string keeps working, and gets a deprecation notice. */
	public function test_the_deprecated_shortcode_filter_still_applies() {
		$seen = array();
		add_filter(
			'rtgodam_shortcode_output',
			static function ( $shortcode ) use ( &$seen ) {
				$seen[] = $shortcode;
				return substr( $shortcode, 0, -1 ) . " aspectratio='16:9']";
			}
		);

		$data = $this->call(
			array(
				'id'            => 7,
				'engagements'   => 'show',
				'godam_context' => 'godam-video-product-gallery',
			)
		);

		$this->assertSame( 'success', $data['status'] );
		$this->assertSame( array( 'rtgodam_shortcode_output' ), $GLOBALS['rtgodam_stub']['deprecated_hooks'] );
		$this->assertCount( 1, $seen );
		$this->assertStringStartsWith( "[godam_video id='7' engagements='show' sources='", $seen[0] );
		$this->assertStringEndsWith( " godam_context='godam-video-product-gallery']", $seen[0] );

		$atts = $this->player_atts()[0];
		$this->assertSame( '16:9', $atts['aspectratio'] );
		$this->assertSame( 'godam-video-product-gallery', $atts['godam_context'] );
		$this->assertCount( 3, $this->decoded_sources( $atts['sources'] ) );
	}

	/** With the deprecated filter hooked, shortcode text in godam_context still does not run. */
	public function test_shortcode_text_in_godam_context_is_not_run_with_the_deprecated_filter() {
		add_filter(
			'rtgodam_shortcode_output',
			static function ( $shortcode ) {
				return $shortcode;
			}
		);

		$data = $this->call(
			array(
				'id'            => 7,
				'engagements'   => '',
				'godam_context' => "x'][gx_marker]['",
			)
		);

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
		$this->assertStringNotContainsString( 'GX-MARKER', $data['html'] );
		$this->assertSame( 'xgx_marker', $this->player_atts()[0]['godam_context'] );
	}
}
