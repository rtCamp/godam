<?php
/**
 * Tests that a title matching a published page does not change it.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Block_Abilities;

/**
 * godam/add-media-to-page reuses an unpublished page whose title matches, so
 * agents do not make duplicates, but refuses a published one: a title names a
 * new page, and changing a live page has to be asked for with page or post_id.
 *
 * Runs in its own process because it defines core functions.
 *
 * @covers \RTGODAM\Inc\Abilities\Block_Abilities
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class AddMediaTitleMatchTest extends TestCase {

	/**
	 * Looks up a title with the given pages on the site.
	 *
	 * @param array $pages Post ID => status of the editable pages titled "Home".
	 *
	 * @return int|\WP_Error
	 */
	private function lookup( array $pages ) {
		$GLOBALS['rtgodam_stub']                = array();
		$GLOBALS['rtgodam_stub']['title_pages'] = $pages;
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'edit_post' => array_keys( $pages ) );
		$GLOBALS['rtgodam_stub']['caps']        = array();
		// The suite's get_posts() stub returns this list for a query with no meta_query.
		$GLOBALS['rtgodam_stub']['video_posts'] = array( '' => array_keys( $pages ) );

		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-block-abilities.php';

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		if ( ! function_exists( 'get_post_status' ) ) {
			eval( 'function get_post_status( $id ) { return $GLOBALS["rtgodam_stub"]["title_pages"][ $id ] ?? false; }' );
		}
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		$reflection = new \ReflectionClass( Block_Abilities::class );
		$method     = $reflection->getMethod( 'existing_page_for_title' );

		if ( PHP_VERSION_ID < 80100 ) {
			$method->setAccessible( true );
		}

		return $method->invoke( $reflection->newInstanceWithoutConstructor(), 'Home', 'page' );
	}

	/**
	 * A published page with the title is refused, and the error names it.
	 *
	 * @return void
	 */
	public function test_published_match_is_refused() {
		$result = $this->lookup( array( 7 => 'publish' ) );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'rtgodam_title_matches_published_page', $result->get_error_code() );
		$this->assertStringContainsString( '(ID 7)', $result->get_error_message() );
		$this->assertStringContainsString( 'page or post_id', $result->get_error_message(), 'The error says how to add to it on purpose.' );
	}

	/**
	 * A draft with the title is still reused, so no duplicate is made.
	 *
	 * @return void
	 */
	public function test_draft_match_is_reused() {
		$this->assertSame( 8, $this->lookup( array( 8 => 'draft' ) ) );
	}

	/**
	 * No page with the title means a new page is created.
	 *
	 * @return void
	 */
	public function test_no_match_creates_a_new_page() {
		$this->assertSame( 0, $this->lookup( array() ) );
	}
}
