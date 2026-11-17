<?php
/**
 * Tests who may retranscode which item.
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
 * own draft post, so the route must also require a media item.
 *
 * Runs in its own process because it sets the bootstrap's stub globals.
 *
 * @covers \RTGODAM\Inc\REST_API\Transcoding::can_retranscode_item
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
}
