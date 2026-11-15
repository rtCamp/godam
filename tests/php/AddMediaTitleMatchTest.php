<?php
/**
 * Tests that a title matching a published page does not change it, and that an
 * unpublished page with the same title is still reused.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Block_Abilities;

/**
 * godam/add-media-to-page reuses the one unpublished page whose title matches, so
 * agents do not make duplicates, even when a published page has the same title.
 * It refuses a published match only when there is no single unpublished page to
 * reuse: a title names a new page, and changing a live page has to be asked for
 * with page or post_id.
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
	 * @param array $pages Post ID => status of the editable pages titled "Home". The
	 *                     suite's get_posts() stub returns the ones in the statuses asked for.
	 *
	 * @return int|\WP_Error
	 */
	private function lookup( array $pages ) {
		$GLOBALS['rtgodam_stub']                = array();
		$GLOBALS['rtgodam_stub']['title_pages'] = $pages;
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'edit_post' => array_keys( $pages ) );
		$GLOBALS['rtgodam_stub']['caps']        = array();
		// The suite's get_posts() stub starts from this list for a query with no meta_query.
		$GLOBALS['rtgodam_stub']['video_posts'] = array( '' => array_keys( $pages ) );

		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-block-abilities.php';

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

	/**
	 * A draft is reused even when a published page has the same title.
	 *
	 * The published page used to be looked up first, so the draft could not be reached.
	 *
	 * @return void
	 */
	public function test_draft_is_reused_when_a_published_page_has_the_same_title() {
		$this->assertSame(
			8,
			$this->lookup(
				array(
					7 => 'publish',
					8 => 'draft',
				)
			)
		);
	}

	/**
	 * Every unpublished status counts as a page to reuse.
	 *
	 * @return void
	 */
	public function test_pending_private_and_scheduled_pages_are_reused_next_to_a_published_one() {
		foreach ( array( 'pending', 'private', 'future' ) as $status ) {
			$this->assertSame(
				8,
				$this->lookup(
					array(
						7 => 'publish',
						8 => $status,
					)
				),
				$status
			);
		}
	}

	/**
	 * Two unpublished pages are no single page to reuse, so the published match is refused.
	 *
	 * @return void
	 */
	public function test_published_match_is_refused_when_two_unpublished_pages_share_the_title() {
		$result = $this->lookup(
			array(
				7 => 'publish',
				8 => 'draft',
				9 => 'pending',
			)
		);

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'rtgodam_title_matches_published_page', $result->get_error_code() );
		$this->assertStringContainsString( '(ID 7)', $result->get_error_message() );
	}

	/**
	 * Two unpublished pages and no published one create a new page, as before.
	 *
	 * @return void
	 */
	public function test_two_unpublished_matches_create_a_new_page() {
		$this->assertSame(
			0,
			$this->lookup(
				array(
					8 => 'draft',
					9 => 'private',
				)
			)
		);
	}

	/**
	 * Two published pages are not guessed between, so a new page is created, as before.
	 *
	 * @return void
	 */
	public function test_two_published_matches_create_a_new_page() {
		$this->assertSame(
			0,
			$this->lookup(
				array(
					7 => 'publish',
					8 => 'publish',
				)
			)
		);
	}
}
