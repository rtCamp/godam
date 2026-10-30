<?php
/**
 * Unit tests for the colours the player and the engagement bar print into a
 * style attribute.
 *
 * An attachment's appearance colour and a layer's background colour are stored
 * data. Both end up in an inline style, where escaping the value for HTML does
 * not stop it from carrying more declarations, so only a plain colour may reach
 * the attribute. Colours the editor's colour picker produces must pass through
 * unchanged.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Video_Engagement;

/**
 * @covers ::rtgodam_sanitize_css_color
 * @covers \RTGODAM\Inc\Video_Engagement::add_engagement_to_video
 */
class PlayerColorOutputTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__, 2 ) . '/inc/classes/class-video-engagement.php';

		if ( ! function_exists( 'get_site_url' ) ) {
			// phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stand-in for a WordPress function.
			eval( 'function get_site_url() { return "https://site.example"; }' );
		}

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array(
			'post_meta' => array( 'rtgodam_transcoding_status' => 'transcoded' ),
			'options'   => array( 'rtgodam-account-token' => 'verified-account' ),
			'title'     => 'A video',
		);

		add_filter(
			'rtgodam_enable_engagement_feature',
			function () {
				return true;
			}
		);
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $GLOBALS['rtgodam_hooks'] );
		parent::tearDown();
	}

	/**
	 * Colours the editor and the settings page produce, and the other plain forms.
	 *
	 * @return array<string, array{0: string}>
	 */
	public function plain_colors() {
		return array(
			'hex 3'                     => array( '#fff' ),
			'hex 4'                     => array( '#fffa' ),
			'hex 6'                     => array( '#2b333f' ),
			'hex 8 (picker with alpha)' => array( '#2b333fb3' ),
			'hex upper case'            => array( '#2B333FB3' ),
			'rgb'                       => array( 'rgb(10, 20, 30)' ),
			'rgba'                      => array( 'rgba(10, 20, 30, 0.5)' ),
			'rgba without spaces'       => array( 'rgba(10,20,30,.5)' ),
			'rgb with space syntax'     => array( 'rgb(10 20 30 / 50%)' ),
			'hsl'                       => array( 'hsl(210, 40%, 90%)' ),
			'hsla'                      => array( 'hsla(210, 40%, 90%, 0.8)' ),
			'hsl with angle unit'       => array( 'hsl(0.5turn 40% 90% / 0.8)' ),
			'named'                     => array( 'red' ),
			'named in capitals'         => array( 'RebeccaPurple' ),
			'transparent'               => array( 'transparent' ),
			'currentcolor'              => array( 'currentColor' ),
		);
	}

	/**
	 * A plain colour comes back as it was stored.
	 *
	 * @dataProvider plain_colors
	 *
	 * @param string $color Stored colour.
	 */
	public function test_plain_colors_are_kept( $color ) {
		$this->assertSame( $color, rtgodam_sanitize_css_color( $color ) );
	}

	/** Surrounding whitespace is not part of the colour. */
	public function test_whitespace_around_a_colour_is_trimmed() {
		$this->assertSame( '#2b333fb3', rtgodam_sanitize_css_color( "  #2b333fb3\n" ) );
	}

	/**
	 * Values that are more than a colour.
	 *
	 * @return array<string, array{0: mixed}>
	 */
	public function not_plain_colors() {
		return array(
			'extra declaration'         => array( 'red; position: fixed; inset: 0' ),
			'declaration after hex'     => array( '#fff; background-image: url(https://example.test/x)' ),
			'declaration after rgba'    => array( 'rgba(0, 0, 0, 0.5); filter: blur(9px)' ),
			'declaration inside rgb'    => array( 'rgb(0;color:red)' ),
			'url'                       => array( 'url(https://example.test/x)' ),
			'expression'                => array( 'expression(alert(1))' ),
			'css variable'              => array( 'var(--x)' ),
			'closes the attribute'      => array( '#fff" onmouseover="x' ),
			'closes the style element'  => array( 'red}</style><script>x</script>' ),
			'not a colour name'         => array( 'notacolour' ),
			'hex with a bad length'     => array( '#fffff' ),
			'hex with a trailing line'  => array( "#fff\nposition:fixed" ),
			'function with a text part' => array( 'rgb(a, b, c)' ),
			'function with four parts'  => array( 'rgb(1 2 3 4 5)' ),
			'array'                     => array( array( 'red' ) ),
			'null'                      => array( null ),
			'empty'                     => array( '' ),
			'blank'                     => array( '   ' ),
		);
	}

	/**
	 * Anything that is not a plain colour is dropped.
	 *
	 * @dataProvider not_plain_colors
	 *
	 * @param mixed $value Stored value.
	 */
	public function test_values_that_are_not_plain_colors_are_dropped( $value ) {
		$this->assertSame( '', rtgodam_sanitize_css_color( $value ) );
	}

	/** The caller picks what a dropped value becomes. */
	public function test_fallback_is_returned_for_a_dropped_value() {
		$this->assertSame( '#FFFFFFB3', rtgodam_sanitize_css_color( 'red; top: 0', '#FFFFFFB3' ) );
		$this->assertSame( 'red', rtgodam_sanitize_css_color( 'red', '#FFFFFFB3' ) );
	}

	/**
	 * Render the engagement bar and return the colour in its style attribute.
	 *
	 * @param array $settings GoDAM settings (brand colour lives here).
	 * @param array $meta     The attachment's `rtgodam_meta`.
	 * @return string The value of --godam-video-engagement-background-color.
	 */
	private function engagement_bar_color( array $settings, array $meta ) {
		$engagement = ( new \ReflectionClass( Video_Engagement::class ) )->newInstanceWithoutConstructor();

		ob_start();
		$engagement->add_engagement_to_video(
			array(
				'id'          => 12,
				'engagements' => true,
			),
			'video_1',
			$meta,
			$settings
		);
		$html = ob_get_clean();

		$this->assertNotSame( '', $html, 'The engagement bar rendered.' );
		$this->assertSame( 1, preg_match( '/style="--godam-video-engagement-background-color: ([^"]*);"/', $html, $found ) );

		return $found[1];
	}

	/** The engagement bar takes the attachment's colour, as before. */
	public function test_engagement_bar_uses_the_appearance_colour() {
		$meta = array( 'videoConfig' => array( 'controlBar' => array( 'appearanceColor' => '#2b333fb3' ) ) );

		$this->assertSame( '#2b333fb3', $this->engagement_bar_color( array(), $meta ) );
	}

	/** Without an attachment colour it takes the brand colour, then the default. */
	public function test_engagement_bar_falls_back_to_brand_colour_then_default() {
		$settings = array( 'video_player' => array( 'brand_color' => 'rgba(10, 20, 30, 0.5)' ) );

		$this->assertSame( 'rgba(10, 20, 30, 0.5)', $this->engagement_bar_color( $settings, array() ) );
		$this->assertSame( '#000', $this->engagement_bar_color( array(), array() ) );
	}

	/** An appearance colour that is more than a colour never reaches the bar's style. */
	public function test_engagement_bar_drops_an_appearance_colour_that_is_not_a_colour() {
		$meta = array( 'videoConfig' => array( 'controlBar' => array( 'appearanceColor' => 'red; position: fixed; inset: 0' ) ) );

		// The brand colour is the next in line.
		$settings = array( 'video_player' => array( 'brand_color' => '#123456' ) );
		$this->assertSame( '#123456', $this->engagement_bar_color( $settings, $meta ) );

		// With no brand colour either, it is the default.
		$this->assertSame( '#000', $this->engagement_bar_color( array(), $meta ) );
	}

	/** A brand colour that is more than a colour is dropped the same way. */
	public function test_engagement_bar_drops_a_brand_colour_that_is_not_a_colour() {
		$settings = array( 'video_player' => array( 'brand_color' => '#123456; background: url(https://example.test/x)' ) );

		$this->assertSame( '#000', $this->engagement_bar_color( $settings, array() ) );
	}
}
