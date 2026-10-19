<?php
/**
 * The Media Editor opens with the admin menu already folded when it opens a file.
 *
 * The editor also folds the menu from React, but that runs after the page has painted, so the menu
 * showed at full width and then collapsed.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Pages;

/**
 * Runs in separate processes, like the other tests that stub WordPress functions.
 *
 * @covers \RTGODAM\Inc\Pages::fold_admin_menu_in_media_editor
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class MediaEditorMenuFoldTest extends TestCase {

	/**
	 * Load Pages and stub get_current_screen().
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array();
		$_GET                    = array();

		require_once dirname( __DIR__, 2 ) . '/inc/traits/trait-singleton.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/class-pages.php';

		// phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
		eval( 'function get_current_screen() { return isset( $GLOBALS["rtgodam_stub"]["screen"] ) ? (object) array( "id" => $GLOBALS["rtgodam_stub"]["screen"] ) : null; }' );
	}

	/**
	 * The Media Editor with a file gets the folded class, and keeps the classes it had.
	 */
	public function test_the_editor_with_a_file_is_folded() {
		$GLOBALS['rtgodam_stub']['screen'] = 'godam_page_rtgodam_media_editor';
		$_GET['id']                        = '203';

		$this->assertSame( ' auto-fold folded', $this->pages()->fold_admin_menu_in_media_editor( ' auto-fold' ) );
	}

	/**
	 * Everything else is left alone: the editor's file picker, other GoDAM pages, and no screen.
	 *
	 * @dataProvider not_folded
	 *
	 * @param string|null $screen The current screen id.
	 * @param array       $get    The query string.
	 */
	public function test_other_screens_are_left_alone( $screen, $get ) {
		if ( null !== $screen ) {
			$GLOBALS['rtgodam_stub']['screen'] = $screen;
		}
		$_GET = $get;

		$this->assertSame( ' auto-fold', $this->pages()->fold_admin_menu_in_media_editor( ' auto-fold' ) );
	}

	/**
	 * Screens and query strings that must not fold the menu.
	 *
	 * @return array<string, array>
	 */
	public function not_folded() {
		return array(
			'Media Editor file picker (no id)' => array( 'godam_page_rtgodam_media_editor', array() ),
			'GoDAM Settings with an id'        => array( 'godam_page_rtgodam_settings', array( 'id' => '203' ) ),
			'Media Library item'               => array( 'upload', array( 'item' => '203' ) ),
			'no screen yet'                    => array( null, array( 'id' => '203' ) ),
		);
	}

	/**
	 * Pages without its constructor, which registers hooks.
	 *
	 * @return Pages
	 */
	private function pages() {
		return ( new \ReflectionClass( Pages::class ) )->newInstanceWithoutConstructor();
	}
}
