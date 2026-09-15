<?php
/**
 * Unit tests for the "What's New" release-post feature parser.
 *
 * Regression guard for the inline-<style> leak: the godam.io release post
 * renders the GoDAM video block's inline <style id="godam-player-wrapper-inline-css">
 * into content.rendered. The old code ran the whole document through
 * wp_kses_post() before parsing; kses strips that disallowed tag but keeps its
 * inner text, which DOMDocument re-wrapped in a <p> and the parser folded into a
 * feature description, shown as raw CSS on the What's New admin page.
 *
 * parse_features_from_content() now parses the raw content and drops
 * <script>/<style>/<noscript> nodes, sanitizing each extracted field instead of
 * the whole document. It is private, so it's exercised via reflection on a
 * constructor-less instance (Base's constructor registers WP hooks we don't want
 * here). The kses stub reproduces the real tag-stripping when the test opts in
 * via $GLOBALS['rtgodam_stub']['kses_strip_disallowed'], so the nested-element
 * case below fails red against the pre-fix parser and passes against the fix.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Release_Post;

/**
 * @covers \RTGODAM\Inc\REST_API\Release_Post
 */
class ReleasePostFeatureParsingTest extends TestCase {

	/**
	 * The inline CSS block WordPress prints for the GoDAM video block, verbatim
	 * in shape (a <style> element with an id attribute and CSS text).
	 */
	private const INLINE_STYLE = '<style id="godam-player-wrapper-inline-css">.godam-video-placeholder{aspect-ratio:var(--rtgodam-video-aspect-ratio,16/9);position:relative}.godam-blurred-img:before{content:""}@keyframes godam_pulse_animation{50%{opacity:.8}}</style>';

	protected function setUp(): void {
		parent::setUp();
		// Reproduce the real wp_kses_post() behaviour that triggered the leak:
		// disallowed <style>/<script> tags are removed but their inner text kept.
		$GLOBALS['rtgodam_stub']['kses_strip_disallowed'] = true;
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Invoke Release_Post::parse_features_from_content() on a constructor-less
	 * instance. This is the method that existed before the fix, so the tests
	 * below fail red against the original implementation.
	 *
	 * @param string $content The raw content to parse.
	 * @return array Parsed features.
	 */
	private function parse( $content ) {
		$ref    = new \ReflectionClass( Release_Post::class );
		$object = $ref->newInstanceWithoutConstructor();
		$m      = $ref->getMethod( 'parse_features_from_content' );
		$m->setAccessible( true );
		return $m->invokeArgs( $object, array( $content, '' ) );
	}

	/**
	 * Assert the first parsed feature has the given title and a leak-free
	 * description, and return that description for further assertions.
	 *
	 * @param array  $features       Parsed features.
	 * @param string $expected_title Expected title of the first feature.
	 * @return string The first feature's description.
	 */
	private function assertCleanFirstFeature( $features, $expected_title ) {
		$this->assertNotEmpty( $features, 'Expected at least one parsed feature.' );
		$this->assertSame( $expected_title, $features[0]['title'] );

		$desc = $features[0]['description'];
		$this->assertStringNotContainsString( '.godam-video-placeholder', $desc );
		$this->assertStringNotContainsString( 'godam_pulse_animation', $desc );
		$this->assertStringNotContainsString( '<style', $desc );
		$this->assertStringNotContainsString( '<script', $desc );

		return $desc;
	}

	/**
	 * The production case: an inline <style> sitting BETWEEN the section's
	 * paragraphs (a sibling) must not leak into the description.
	 */
	public function test_inline_style_sibling_does_not_leak() {
		$content = '
			<h2 class="wp-block-heading" id="h-preview-in-one-click">Preview in one click</h2>
			<p class="wp-block-paragraph">You know the routine: download the deck, wait for the app to open.</p>
			<p class="wp-block-paragraph">With GoDAM 2.2 it is just a click. The document opens right in your browser.</p>
			' . self::INLINE_STYLE . '
			<div class="wp-block-godam-video"><figure class="wp-block-image"><img src="https://example.com/poster.webp" /></figure></div>
			<h2 class="wp-block-heading">Wrap up</h2>
			<p class="wp-block-paragraph">Closing summary paragraph.</p>
		';

		$desc = $this->assertCleanFirstFeature( $this->parse( $content ), 'Preview in one click' );
		$this->assertStringContainsString( 'just a click', $desc );
	}

	/**
	 * The genuine red-without-fix guard: a <style> nested INSIDE a collected
	 * <p>. The pre-fix parser gathered the paragraph and wp_kses_post() then
	 * stripped the tag while keeping the CSS text; dropping the node first
	 * prevents that.
	 */
	public function test_inline_style_nested_in_paragraph_does_not_leak() {
		$content = '
			<h2 class="wp-block-heading">Preview in one click</h2>
			<p class="wp-block-paragraph">Real copy the user should read.' . self::INLINE_STYLE . '</p>
			<h2 class="wp-block-heading">Wrap up</h2>
			<p class="wp-block-paragraph">Closing summary paragraph.</p>
		';

		$desc = $this->assertCleanFirstFeature( $this->parse( $content ), 'Preview in one click' );
		$this->assertStringContainsString( 'Real copy the user should read.', $desc );
	}

	/**
	 * An unclosed <style> (no </style>) must not leak. DOMDocument parses it
	 * into a node we drop; the earlier regex approach required a closing tag, so
	 * it would have left the lone <style> for wp_kses_post() to strip while
	 * keeping the CSS text. Placed at the tail (after the last heading, which
	 * array_pop() drops) so a feature survives to assert against.
	 */
	public function test_unclosed_style_block_does_not_leak() {
		$content = '
			<h2 class="wp-block-heading">Alpha feature</h2>
			<p class="wp-block-paragraph">Alpha copy that must survive.</p>
			<h2 class="wp-block-heading">Preview in one click</h2>
			<p class="wp-block-paragraph">Beta copy.</p>
			<style id="godam-player-wrapper-inline-css">.godam-video-placeholder{position:relative}@keyframes godam_pulse_animation{50%{opacity:.8}}
		';

		$features = $this->parse( $content );
		$this->assertNotEmpty( $features );
		foreach ( $features as $feature ) {
			$this->assertStringNotContainsString( '.godam-video-placeholder', $feature['description'] );
			$this->assertStringNotContainsString( 'godam_pulse_animation', $feature['description'] );
			$this->assertStringNotContainsString( '<style', $feature['description'] );
		}
		$this->assertStringContainsString( 'Alpha copy that must survive.', $features[0]['description'] );
	}

	/** A <script> block (sibling or nested) is dropped the same way. */
	public function test_inline_script_block_does_not_leak() {
		$content = '
			<h2 class="wp-block-heading">Analytics</h2>
			<p class="wp-block-paragraph">Track everything.<script>window.__leak = "should not appear";</script></p>
			<h2 class="wp-block-heading">Wrap up</h2>
			<p class="wp-block-paragraph">Closing summary paragraph.</p>
		';

		$desc = $this->assertCleanFirstFeature( $this->parse( $content ), 'Analytics' );
		$this->assertStringContainsString( 'Track everything.', $desc );
		$this->assertStringNotContainsString( 'should not appear', $desc );
	}

	/** Ordinary content (no style/script) is unaffected: paragraphs and lists are kept. */
	public function test_regular_content_is_preserved() {
		$content = '
			<h2 class="wp-block-heading">Feature</h2>
			<p class="wp-block-paragraph">A plain paragraph.</p>
			<ul><li>Point one</li></ul>
			<h2 class="wp-block-heading">Wrap up</h2>
			<p class="wp-block-paragraph">Closing summary paragraph.</p>
		';

		$features = $this->parse( $content );
		$this->assertNotEmpty( $features );
		$this->assertStringContainsString( 'A plain paragraph.', $features[0]['description'] );
		$this->assertStringContainsString( 'Point one', $features[0]['description'] );
	}
}
