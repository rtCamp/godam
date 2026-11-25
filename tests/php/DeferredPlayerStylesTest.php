<?php
/**
 * When the player stylesheets may load without blocking the first render (#2403).
 *
 * Only player-only stylesheets, only on the front end, and only once the page
 * content has rendered and nothing on it except video players needs them:
 * otherwise content visible at once (the engagement bar, image hotspots,
 * galleries) would shift when the styles arrive.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Shortcodes\GoDAM_Player;

require_once dirname( __DIR__ ) . '/stubs/style-loader-functions.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/shortcodes/class-godam-player.php';

/**
 * @covers \RTGODAM\Inc\Shortcodes\GoDAM_Player::should_defer_style
 * @covers \RTGODAM\Inc\Shortcodes\GoDAM_Player::require_blocking_player_styles
 * @covers \RTGODAM\Inc\Shortcodes\GoDAM_Player::defer_player_style_tag
 */
class DeferredPlayerStylesTest extends TestCase {

	/**
	 * A front-end request on a block theme whose template has rendered.
	 */
	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array(
			'block_theme' => true,
			'did_filter'  => array( 'render_block' => 3 ),
		);
		$this->set_styles_needed_at_first_paint( false );
	}

	/**
	 * Reset the page-level flag between tests.
	 */
	protected function tearDown(): void {
		$this->set_styles_needed_at_first_paint( false );
		parent::tearDown();
	}

	/**
	 * Set the private page-level "needed at first paint" flag.
	 *
	 * @param bool $value Flag value.
	 */
	private function set_styles_needed_at_first_paint( bool $value ): void {
		$property = new \ReflectionProperty( GoDAM_Player::class, 'styles_needed_at_first_paint' );
		$property->setAccessible( true );
		$property->setValue( null, $value );
	}

	/**
	 * The player object, without running its constructor: that would register
	 * the real `[godam_video]` shortcode for every later test in the run.
	 *
	 * @return GoDAM_Player
	 */
	private function player(): GoDAM_Player {
		return ( new \ReflectionClass( GoDAM_Player::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * Player and skin stylesheets are deferred once the content has rendered.
	 */
	public function test_defers_player_only_stylesheets_once_content_has_rendered(): void {
		$this->assertTrue( GoDAM_Player::should_defer_style( 'godam-player-style', 'all' ) );
		$this->assertTrue( GoDAM_Player::should_defer_style( 'godam-player-minimal-skin', 'all' ) );
	}

	/**
	 * The wrapper stylesheet reserves the video's box, so it always blocks.
	 */
	public function test_never_defers_the_wrapper_or_other_stylesheets(): void {
		$this->assertFalse( GoDAM_Player::should_defer_style( 'godam-player-wrapper-style', 'all' ) );
		$this->assertFalse( GoDAM_Player::should_defer_style( 'godam-gallery-v2-style', 'all' ) );
	}

	/**
	 * On a classic theme the head prints before the content renders, so what
	 * the page contains is not known yet.
	 */
	public function test_keeps_blocking_in_the_head_of_a_classic_theme(): void {
		$GLOBALS['rtgodam_stub']['block_theme'] = false;

		$this->assertFalse( GoDAM_Player::should_defer_style( 'godam-player-style', 'all' ) );
	}

	/**
	 * A stylesheet printed late, in the footer, is printed after the content.
	 */
	public function test_defers_a_stylesheet_printed_in_the_footer(): void {
		$GLOBALS['rtgodam_stub']['block_theme'] = false;
		$GLOBALS['rtgodam_stub']['did_action']  = array( 'wp_footer' => 1 );

		$this->assertTrue( GoDAM_Player::should_defer_style( 'godam-player-style', 'all' ) );
	}

	/**
	 * The engagement bar, image hotspots or a gallery need the styles at once.
	 */
	public function test_keeps_blocking_when_other_godam_content_needs_the_styles(): void {
		GoDAM_Player::require_blocking_player_styles();

		$this->assertFalse( GoDAM_Player::should_defer_style( 'godam-player-style', 'all' ) );
	}

	/**
	 * Admin screens and the editor are left alone.
	 */
	public function test_never_defers_in_admin(): void {
		$GLOBALS['rtgodam_stub']['is_admin'] = true;

		$this->assertFalse( GoDAM_Player::should_defer_style( 'godam-player-style', 'all' ) );
	}

	/**
	 * Sites can turn it off.
	 */
	public function test_the_filter_can_turn_it_off(): void {
		add_filter(
			'rtgodam_defer_player_styles',
			function () {
				return false;
			}
		);

		$this->assertFalse( GoDAM_Player::should_defer_style( 'godam-player-style', 'all' ) );
	}

	/**
	 * A tag that is not deferred is printed exactly as WordPress built it.
	 */
	public function test_leaves_the_tag_untouched_when_not_deferring(): void {
		GoDAM_Player::require_blocking_player_styles();
		$tag = "<link rel='stylesheet' id='godam-player-style-css' href='https://example.com/godam-player.css' media='all' />\n";

		$this->assertSame(
			$tag,
			$this->player()->defer_player_style_tag( $tag, 'godam-player-style', 'https://example.com/godam-player.css', 'all' )
		);
	}

	/**
	 * A deferred tag loads as print, switches itself on, and keeps a no-JS copy.
	 */
	public function test_rewrites_a_deferred_tag(): void {
		if ( ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
			$this->markTestSkipped( 'Needs the WordPress HTML API.' );
		}

		$tag    = "<link rel='stylesheet' id='godam-player-style-css' href='https://example.com/godam-player.css' media='all' />\n";
		$output = $this->player()->defer_player_style_tag( $tag, 'godam-player-style', 'https://example.com/godam-player.css', 'all' );

		$this->assertStringContainsString( 'media="print"', $output );
		$this->assertStringContainsString( 'data-godam-deferred-style="all"', $output );
		$this->assertStringContainsString( '<noscript>' . trim( $tag ) . '</noscript>', $output );
	}
}
