<?php
/**
 * Tests who may retranscode which item, and the hourly limit below Editor.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Transcoding;

/**
 * The retranscode route (and godam/retranscode-media, which calls it) let
 * anyone who can edit an item retranscode it. A Contributor can edit their
 * own draft post, so the route must also require a media item. Each
 * retranscode uses the site's GoDAM plan, so users below Editor get an
 * hourly limit.
 *
 * Runs in its own process because it sets the bootstrap's stub globals.
 *
 * @covers \RTGODAM\Inc\REST_API\Transcoding::can_retranscode_item
 * @covers \RTGODAM\Inc\REST_API\Transcoding::retranscode_media
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class RetranscodePermissionTest extends TestCase {

	/**
	 * Sets up the stubs and returns the route class without its constructor.
	 *
	 * @param array $caps  Capabilities of the current user, in the bootstrap's `caps` shape.
	 * @param array $types Post ID => post type.
	 *
	 * @return Transcoding
	 */
	private function route( array $caps, array $types = array() ) {
		require_once dirname( __DIR__ ) . '/stubs/class-wp-rest-request.php';
		require_once dirname( __DIR__ ) . '/stubs/abilities-functions.php';

		$GLOBALS['rtgodam_stub']['caps']      = $caps;
		$GLOBALS['rtgodam_stub']['types']     = $types;
		$GLOBALS['rtgodam_stub']['transient'] = array();

		if ( ! function_exists( 'get_post_type' ) ) {
			eval( 'function get_post_type( $post = null ) { return $GLOBALS["rtgodam_stub"]["types"][ (int) $post ] ?? false; }' ); // phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
		}

		return ( new \ReflectionClass( Transcoding::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * A request for one ID.
	 *
	 * @param int $id Post ID.
	 *
	 * @return \WP_REST_Request
	 */
	private function request( $id ) {
		return new \WP_REST_Request( array( 'id' => $id ) );
	}

	/**
	 * The reported gap: a Contributor's own draft post is not media.
	 */
	public function test_an_editable_post_that_is_not_media_is_refused() {
		$route = $this->route( array( 'edit_post:77' ), array( 77 => 'post' ) );

		$this->assertFalse( $route->can_retranscode_item( $this->request( 77 ) ) );
	}

	/**
	 * An Author can still retranscode their own upload.
	 */
	public function test_an_author_can_retranscode_their_own_media() {
		$route = $this->route( array( 'edit_post:81' ), array( 81 => 'attachment' ) );

		$this->assertTrue( $route->can_retranscode_item( $this->request( 81 ) ) );
	}

	/**
	 * Media the user cannot edit stays refused.
	 */
	public function test_media_the_user_cannot_edit_is_refused() {
		$route = $this->route( array(), array( 82 => 'attachment' ) );

		$this->assertFalse( $route->can_retranscode_item( $this->request( 82 ) ) );
	}

	/**
	 * Counts one retranscode, as the route does before sending anything.
	 *
	 * @param Transcoding $route Route.
	 *
	 * @return bool
	 */
	private function claim( Transcoding $route ) {
		$claim = new \ReflectionMethod( Transcoding::class, 'claim_retranscode_slot' );

		if ( PHP_VERSION_ID < 80100 ) {
			$claim->setAccessible( true );
		}

		return $claim->invoke( $route );
	}

	/**
	 * Below Editor, the eleventh retranscode in an hour is refused before anything is sent.
	 */
	public function test_users_below_editor_have_an_hourly_limit() {
		$route = $this->route( array( 'edit_post:81' ), array( 81 => 'attachment' ) );

		for ( $i = 0; $i < Transcoding::RETRANSCODE_HOURLY_LIMIT; $i++ ) {
			$this->assertTrue( $this->claim( $route ), 'Within the limit.' );
		}

		$this->assertFalse( $this->claim( $route ), 'Over the limit.' );

		$response = $route->retranscode_media( $this->request( 81 ) );

		$this->assertSame( 429, $response->get_status() );
		$this->assertSame( 'rate_limited', $response->get_data()['reason'] );
	}

	/**
	 * The count starts again once the hour is over.
	 */
	public function test_the_limit_resets_after_the_hour() {
		$route = $this->route( array( 'edit_post:81' ), array( 81 => 'attachment' ) );

		$GLOBALS['rtgodam_stub']['transient']['rtgodam_retranscode_count_1'] = array(
			'count' => Transcoding::RETRANSCODE_HOURLY_LIMIT,
			'until' => time() - 1,
		);

		$this->assertTrue( $this->claim( $route ) );
	}

	/**
	 * Editors and above are not limited; the bulk Retranscoding page is theirs.
	 */
	public function test_editors_are_not_limited() {
		$route = $this->route( array( 'edit_others_posts' ), array( 81 => 'attachment' ) );

		for ( $i = 0; $i <= Transcoding::RETRANSCODE_HOURLY_LIMIT + 2; $i++ ) {
			$this->assertTrue( $this->claim( $route ) );
		}

		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['transient'], 'Nothing is counted for an Editor.' );
	}
}
