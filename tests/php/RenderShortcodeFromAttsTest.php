<?php
/**
 * Unit tests for rtgodam_render_shortcode_from_atts().
 *
 * The helper hands an attributes array straight to a shortcode's callback, so an attribute
 * value is data and never shortcode syntax.
 *
 * Each test runs in its own process because it replaces the registered shortcodes.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * @covers ::rtgodam_render_shortcode_from_atts
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class RenderShortcodeFromAttsTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_stub'] = array();
		rtgodam_stub_register_player_and_marker();
	}

	protected function tearDown(): void {
		$GLOBALS['shortcode_tags'] = array();
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/** The harness itself: text built into a shortcode string does run another shortcode. */
	public function test_a_built_string_runs_the_marker_shortcode() {
		do_shortcode( '[godam_video src="x][gx_marker]"]' );

		$this->assertSame( 1, $GLOBALS['rtgodam_stub']['marker_runs'] );
	}

	/** A value that looks like shortcode syntax reaches the callback as it is and runs nothing. */
	public function test_shortcode_text_in_a_value_is_passed_as_data() {
		$value = 'https://example.test/a.webm][gx_marker]';

		$html = rtgodam_render_shortcode_from_atts( 'godam_video', array( 'src' => $value ) );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
		$this->assertStringNotContainsString( 'GX-MARKER', $html );
		$this->assertSame( array( array( 'src' => $value ) ), $GLOBALS['rtgodam_stub']['player_atts'] );
	}

	/** Normal values come back out of the callback exactly as they went in, and the callback's output is returned. */
	public function test_attributes_and_output_pass_through() {
		$atts = array(
			'id'          => '7',
			'src'         => 'https://example.test/a.webm',
			'aspectratio' => '',
		);

		$html = rtgodam_render_shortcode_from_atts( 'godam_video', $atts );

		$this->assertSame( array( $atts ), $GLOBALS['rtgodam_stub']['player_atts'] );
		$this->assertStringContainsString( 'data-src="https://example.test/a.webm"', $html );
	}

	/** The tag is looked up in the shortcode registry, so a shortcode another plugin registered works too. */
	public function test_the_callback_receives_the_tag() {
		$received = array();
		add_shortcode(
			'gx_other',
			static function ( $atts, $content, $tag ) use ( &$received ) {
				$received = array( $atts, $content, $tag );
				return 'other';
			}
		);

		$html = rtgodam_render_shortcode_from_atts( 'gx_other', array( 'a' => 'b' ) );

		$this->assertSame( 'other', $html );
		$this->assertSame( array( array( 'a' => 'b' ), '', 'gx_other' ), $received );
	}

	/** Rendering never goes through do_shortcode(), so no string is built or parsed. */
	public function test_do_shortcode_is_not_called() {
		rtgodam_render_shortcode_from_atts( 'godam_video', array( 'src' => 'https://example.test/a.webm' ) );

		$this->assertArrayNotHasKey( 'shortcodes', $GLOBALS['rtgodam_stub'] );
	}

	/** A shortcode whose callback can no longer be called renders nothing. */
	public function test_an_uncallable_shortcode_renders_nothing() {
		add_shortcode( 'gx_broken', array( 'GxMissingClass', 'render' ) );

		$this->assertSame( '', rtgodam_render_shortcode_from_atts( 'gx_broken', array( 'a' => 'b' ) ) );
	}

	/** An unregistered shortcode renders nothing, rather than printing the tag or its attributes. */
	public function test_an_unregistered_shortcode_renders_nothing() {
		$this->assertSame( '', rtgodam_render_shortcode_from_atts( 'gx_missing', array( 'src' => 'https://example.test/a.webm' ) ) );
	}
}
