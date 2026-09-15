<?php
/**
 * Unit tests for the "What's New" release-post feature parser.
 *
 * Regression guard for the inline-<style> leak: the godam.io release post
 * renders the GoDAM video block's inline <style id="godam-player-wrapper-inline-css">
 * into content.rendered. wp_kses_post() strips that disallowed tag but keeps its
 * inner text, so the raw CSS ended up parsed into a feature description and was
 * shown as plain text on the What's New admin page. build_features() now removes
 * <script>/<style> blocks (tag + contents) before sanitizing, so nothing leaks.
 *
 * build_features()/parse_features_from_content() are private, so they're exercised
 * via reflection on a constructor-less instance (Base's constructor registers WP
 * hooks we don't want here). The kses stub reproduces the real tag-stripping when
 * the test opts in via $GLOBALS['rtgodam_stub']['kses_strip_disallowed'].
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
	 * in shape (a <style> element sitting between the section's paragraphs).
	 */
	private const INLINE_STYLE = '<style id="godam-player-wrapper-inline-css">.godam-video-placeholder{aspect-ratio:var(--rtgodam-video-aspect-ratio,16/9);position:relative}.godam-blurred-img:before{content:""}@keyframes godam_pulse_animation{50%{opacity:.8}}</style>';

	protected function setUp(): void {
		parent::setUp();
		// Reproduce the real wp_kses_post() behaviour that triggers the leak:
		// disallowed <style>/<script> tags are removed but their inner text kept.
		$GLOBALS['rtgodam_stub']['kses_strip_disallowed'] = true;
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Invoke Release_Post::build_features() on a constructor-less instance.
	 *
	 * @param string $rendered_content Rendered post content to parse.
	 * @return array Parsed features.
	 */
	private function build_features( $rendered_content ) {
		$ref    = new \ReflectionClass( Release_Post::class );
		$object = $ref->newInstanceWithoutConstructor();
		$m      = $ref->getMethod( 'build_features' );
		$m->setAccessible( true );
		return $m->invokeArgs( $object, array( $rendered_content, '' ) );
	}

	/** Content shaped like the real release post: paragraphs, an inline <style>, then a video block. */
	private function content_with_inline_style() {
		return '
			<h2 class="wp-block-heading" id="h-preview-in-one-click">Preview in one click</h2>
			<p class="wp-block-paragraph">You know the routine: download the deck, wait for the app to open.</p>
			<p class="wp-block-paragraph">With GoDAM 2.2 it is just a click. The document opens right in your browser.</p>
			' . self::INLINE_STYLE . '
			<div class="wp-block-godam-video"><figure class="wp-block-image"><img src="https://example.com/poster.webp" /></figure></div>
			<h2 class="wp-block-heading">Wrap up</h2>
			<p class="wp-block-paragraph">Closing summary paragraph.</p>
		';
	}

	/** The inline <style> block must not leak into any feature description. */
	public function test_inline_style_block_does_not_leak_into_description() {
		$features = $this->build_features( $this->content_with_inline_style() );

		$this->assertNotEmpty( $features, 'Expected at least one parsed feature.' );

		$preview = $features[0];
		$this->assertSame( 'Preview in one click', $preview['title'] );

		// The real paragraph content is preserved.
		$this->assertStringContainsString( 'just a click', $preview['description'] );

		// None of the CSS text (nor a stray <style> tag) survives into the description.
		$this->assertStringNotContainsString( '.godam-video-placeholder', $preview['description'] );
		$this->assertStringNotContainsString( 'godam_pulse_animation', $preview['description'] );
		$this->assertStringNotContainsString( '<style', $preview['description'] );
	}

	/** A <script> block in the content is stripped the same way. */
	public function test_inline_script_block_does_not_leak_into_description() {
		$content = '
			<h2 class="wp-block-heading">Analytics</h2>
			<p class="wp-block-paragraph">Track everything.</p>
			<script>window.__leak = "should not appear";</script>
			<div class="wp-block-godam-video"></div>
			<h2 class="wp-block-heading">Wrap up</h2>
			<p class="wp-block-paragraph">Closing summary paragraph.</p>
		';

		$features = $this->build_features( $content );

		$this->assertNotEmpty( $features );
		$this->assertStringContainsString( 'Track everything.', $features[0]['description'] );
		$this->assertStringNotContainsString( 'should not appear', $features[0]['description'] );
		$this->assertStringNotContainsString( '<script', $features[0]['description'] );
	}

	/** Ordinary content (no style/script) is unaffected: paragraphs are kept intact. */
	public function test_regular_content_is_preserved() {
		$content = '
			<h2 class="wp-block-heading">Feature</h2>
			<p class="wp-block-paragraph">A plain paragraph.</p>
			<ul><li>Point one</li></ul>
			<h2 class="wp-block-heading">Wrap up</h2>
			<p class="wp-block-paragraph">Closing summary paragraph.</p>
		';

		$features = $this->build_features( $content );

		$this->assertNotEmpty( $features );
		$this->assertStringContainsString( 'A plain paragraph.', $features[0]['description'] );
		$this->assertStringContainsString( 'Point one', $features[0]['description'] );
	}
}
