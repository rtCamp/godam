<?php
/**
 * Unit tests for who may use the media-folder routes and for the folder lock.
 *
 * Reading the media-folder terms needs `edit_posts` and changing them `upload_files`, and a locked folder, or one inside
 * a locked folder, cannot be renamed, moved, filled or given a child on any route. The
 * lock is applied where the change happens:
 *  - the native term routes carry the check on their own permission callbacks, so it does
 *    not depend on how the request spells the route;
 *  - the `assign_term` capability and `pre_insert_term` cover filing a file into a folder
 *    and creating a folder;
 *  - the core media route is checked when a request would take a file out of a folder.
 * These tests drive each piece against a stubbed folder tree: Locked (20) holds Child
 * (21), which holds Grandchild (22); Open (10) and Other (30) are not locked.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Media_Library\Media_Folder_Utils;
use RTGODAM\Inc\REST_API\Media_Library;
use RTGODAM\Inc\Taxonomies\Media_Folders;

/**
 * @covers \RTGODAM\Inc\Media_Library\Media_Folder_Utils::is_folder_locked
 * @covers \RTGODAM\Inc\Taxonomies\Media_Folders::setup_hooks
 * @covers \RTGODAM\Inc\Taxonomies\Media_Folders::lock_folder_assignment
 * @covers \RTGODAM\Inc\Taxonomies\Media_Folders::lock_folder_creation
 * @covers \RTGODAM\Inc\Taxonomies\Media_Folders::hide_folders_from_post_classes
 * @covers \RTGODAM\Inc\REST_API\Media_Library::guard_media_folder_routes
 * @covers \RTGODAM\Inc\REST_API\Media_Library::check_media_folder_request
 * @covers \RTGODAM\Inc\REST_API\Media_Library::enforce_locked_folder_on_media_update
 */
class MediaFolderLockTest extends TestCase {

	const OPEN       = 10;
	const LOCKED     = 20;
	const CHILD      = 21;
	const GRANDCHILD = 22;
	const OTHER      = 30;

	/**
	 * An attachment filed in the locked folder.
	 */
	const IN_LOCKED = 500;

	/**
	 * An attachment filed in the child of the locked folder.
	 */
	const IN_CHILD = 501;

	/**
	 * An attachment filed in an open folder.
	 */
	const IN_OPEN = 502;

	/**
	 * Capabilities of an author, the lowest role that can upload files.
	 */
	const AUTHOR_CAPS = array( 'read', 'edit_posts', 'upload_files' );

	/**
	 * Build the folder tree and sign in an author.
	 *
	 * @return void
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array(
			'caps'         => self::AUTHOR_CAPS,
			'user'         => array( 'name' => 'Author' ),
			'terms'        => array(
				self::OPEN       => $this->term( self::OPEN, 0, 'Open' ),
				self::LOCKED     => $this->term( self::LOCKED, 0, 'Locked' ),
				self::CHILD      => $this->term( self::CHILD, self::LOCKED, 'Child' ),
				self::GRANDCHILD => $this->term( self::GRANDCHILD, self::CHILD, 'Grandchild' ),
				self::OTHER      => $this->term( self::OTHER, 0, 'Other' ),
				99               => $this->term( 99, 0, 'A category', 'category' ),
			),
			'term_meta'    => array(
				// Only the top folder carries the lock; the rest are locked through it.
				self::LOCKED => array( 'locked' => '1' ),
			),
			'object_terms' => array(
				self::IN_LOCKED => array( self::LOCKED ),
				self::IN_CHILD  => array( self::CHILD ),
				self::IN_OPEN   => array( self::OPEN ),
			),
		);
	}

	/**
	 * Clear the stubs.
	 *
	 * @return void
	 */
	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		$GLOBALS['rtgodam_hooks'] = array();
		parent::tearDown();
	}

	/**
	 * A stubbed term.
	 *
	 * @param int    $id        Term ID.
	 * @param int    $parent_id Parent term ID.
	 * @param string $name      Name.
	 * @param string $taxonomy  Taxonomy slug.
	 * @return object
	 */
	private function term( $id, $parent_id, $name, $taxonomy = 'media-folder' ) {
		return (object) array(
			'term_id'     => $id,
			'taxonomy'    => $taxonomy,
			'parent'      => $parent_id,
			'name'        => $name,
			'slug'        => strtolower( $name ),
			'description' => '',
		);
	}

	/**
	 * The REST controller, built without its constructor (which would register routes).
	 *
	 * @return Media_Library
	 */
	private function rest() {
		return ( new \ReflectionClass( Media_Library::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * The taxonomy, built without its constructor.
	 *
	 * @return Media_Folders
	 */
	private function taxonomy() {
		return ( new \ReflectionClass( Media_Folders::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * A request to the media-folder routes. A null argument leaves that param out.
	 *
	 * @param string          $method    HTTP method.
	 * @param int|null        $id        Folder ID, in the URL or the body.
	 * @param string|null     $name      New name.
	 * @param int|null        $parent_id New parent folder.
	 * @param array|null      $meta      Term meta, such as `bookmark` and `locked`.
	 * @return \WP_REST_Request
	 */
	private function folder_request( $method, $id = null, $name = null, $parent_id = null, $meta = null ) {
		$params = array_filter(
			array(
				'id'     => $id,
				'name'   => $name,
				'parent' => $parent_id,
				'meta'   => $meta,
			),
			static function ( $value ) {
				return null !== $value;
			}
		);

		return new \WP_REST_Request( $params, $method );
	}

	/**
	 * The request the folder menu sends to bookmark the locked folder: the whole folder, sent back.
	 *
	 * @param string $name      Name to send.
	 * @param int    $parent_id Parent to send.
	 * @param array  $meta      Term meta to send.
	 * @return \WP_REST_Request
	 */
	private function whole_folder_request( $name, $parent_id, $meta ) {
		return new \WP_REST_Request(
			array(
				'id'          => self::LOCKED,
				'name'        => $name,
				'slug'        => 'locked',
				'description' => '',
				'parent'      => $parent_id,
				'meta'        => $meta,
			),
			'POST'
		);
	}

	/**
	 * Call the permission callback the guard puts on a route handler.
	 *
	 * @param \WP_REST_Request $request  The request.
	 * @param array            $spy      Filled with the arguments of each call to the original check.
	 * @param mixed            $original What the route's own permission check answers.
	 * @return mixed
	 */
	private function permission( $request, &$spy = array(), $original = true ) {
		$route     = '/wp/v2/media-folder/(?P<id>[\d]+)';
		$endpoints = array(
			$route => array(
				array(
					'methods'             => 'POST, PUT, PATCH',
					'permission_callback' => static function ( $request ) use ( &$spy, $original ) {
						$spy[] = $request;
						return $original;
					},
				),
			),
		);

		$guarded = $this->rest()->guard_media_folder_routes( $endpoints );

		return call_user_func( $guarded[ $route ][0]['permission_callback'], $request );
	}

	/**
	 * Whether a value is the folder-locked refusal.
	 *
	 * @param mixed $value Value to test.
	 * @return bool
	 */
	private function is_locked_error( $value ) {
		return $value instanceof \WP_Error && 'godam_folder_locked' === $value->get_error_code() && array( 'status' => 403 ) === $value->get_error_data();
	}

	/**
	 * Every way the plugin has stored a lock reads as locked, and nothing else does.
	 *
	 * @dataProvider lock_values
	 *
	 * @param mixed $stored Stored `locked` term meta.
	 * @param bool  $locked Whether the folder reads as locked.
	 * @return void
	 */
	public function test_lock_meta_values( $stored, $locked ) {
		$GLOBALS['rtgodam_stub']['term_meta'] = array(
			self::OPEN => array( 'locked' => $stored ),
		);

		$this->assertSame( $locked, Media_Folder_Utils::get_instance()->is_folder_locked( self::OPEN ) );
	}

	/**
	 * @return array<string, array>
	 */
	public function lock_values() {
		return array(
			'string one'   => array( '1', true ),
			'int one'      => array( 1, true ),
			'true'         => array( true, true ),
			'string true'  => array( 'true', true ),
			'empty string' => array( '', false ),
			'string zero'  => array( '0', false ),
			'int zero'     => array( 0, false ),
			'false'        => array( false, false ),
			'string false' => array( 'false', false ),
		);
	}

	/**
	 * A locked folder shields everything inside it, and nothing outside it.
	 *
	 * @return void
	 */
	public function test_a_locked_folder_locks_its_descendants() {
		$utils = Media_Folder_Utils::get_instance();

		$this->assertTrue( $utils->is_folder_locked( self::LOCKED ) );
		$this->assertTrue( $utils->is_folder_locked( self::CHILD ) );
		$this->assertTrue( $utils->is_folder_locked( self::GRANDCHILD ) );
		$this->assertFalse( $utils->is_folder_locked( self::OPEN ) );
		$this->assertFalse( $utils->is_folder_locked( self::OTHER ) );
		$this->assertFalse( $utils->is_folder_locked( 0 ) );
		$this->assertFalse( $utils->is_folder_locked( -4 ) );
	}

	/**
	 * The taxonomy registers its two lock rules.
	 *
	 * @return void
	 */
	public function test_taxonomy_registers_the_lock_rules() {
		$taxonomy = $this->taxonomy();
		$setup    = new \ReflectionMethod( Media_Folders::class, 'setup_hooks' );
		$setup->setAccessible( true );
		$setup->invoke( $taxonomy );

		$this->assertTrue( has_action( 'map_meta_cap', array( $taxonomy, 'lock_folder_assignment' ) ) );
		$this->assertTrue( has_action( 'pre_insert_term', array( $taxonomy, 'lock_folder_creation' ) ) );
		$this->assertTrue( has_action( 'post_class_taxonomies', array( $taxonomy, 'hide_folders_from_post_classes' ) ) );
	}

	/**
	 * Folder names stay out of the post classes core shows to visitors.
	 *
	 * @return void
	 */
	public function test_folders_are_left_out_of_post_classes() {
		$public = array(
			'category'     => 'category',
			'media-folder' => 'media-folder',
			'post_tag'     => 'post_tag',
		);

		$this->assertSame(
			array(
				'category' => 'category',
				'post_tag' => 'post_tag',
			),
			$this->taxonomy()->hide_folders_from_post_classes( $public )
		);
	}

	/**
	 * Filing a file in a locked folder, or one inside it, is refused for every user.
	 *
	 * @return void
	 */
	public function test_assigning_to_a_locked_folder_is_refused() {
		foreach ( array( self::LOCKED, self::CHILD, self::GRANDCHILD ) as $folder ) {
			$caps = $this->taxonomy()->lock_folder_assignment( array( 'upload_files' ), 'assign_term', 1, array( $folder ) );

			$this->assertSame( array( 'upload_files', 'do_not_allow' ), $caps, "Folder $folder" );
		}
	}

	/**
	 * Open folders, other taxonomies and other capabilities are left as core mapped them.
	 *
	 * @return void
	 */
	public function test_the_assign_capability_is_untouched_elsewhere() {
		$taxonomy = $this->taxonomy();
		$caps     = array( 'upload_files' );

		$this->assertSame( $caps, $taxonomy->lock_folder_assignment( $caps, 'assign_term', 1, array( self::OPEN ) ) );
		$this->assertSame( $caps, $taxonomy->lock_folder_assignment( $caps, 'assign_term', 1, array( self::OTHER ) ) );
		$this->assertSame( $caps, $taxonomy->lock_folder_assignment( $caps, 'assign_term', 1, array( 99 ) ), 'A term of another taxonomy' );
		$this->assertSame( $caps, $taxonomy->lock_folder_assignment( $caps, 'assign_term', 1, array( 12345 ) ), 'A term that does not exist' );
		$this->assertSame( $caps, $taxonomy->lock_folder_assignment( $caps, 'assign_term', 1, array() ) );
		$this->assertSame( $caps, $taxonomy->lock_folder_assignment( $caps, 'edit_term', 1, array( self::LOCKED ) ) );
		$this->assertSame( $caps, $taxonomy->lock_folder_assignment( $caps, 'upload_files', 1, array() ) );
	}

	/**
	 * A folder cannot be created inside a locked folder or inside one of its descendants.
	 *
	 * @return void
	 */
	public function test_a_folder_cannot_be_created_inside_a_locked_folder() {
		foreach ( array( self::LOCKED, self::CHILD, self::GRANDCHILD ) as $parent_id ) {
			$result = $this->taxonomy()->lock_folder_creation( 'New', 'media-folder', array( 'parent' => $parent_id ) );

			$this->assertTrue( $this->is_locked_error( $result ), "Parent $parent_id" );
		}
	}

	/**
	 * Other new folders, other taxonomies and earlier errors pass through.
	 *
	 * @return void
	 */
	public function test_other_new_terms_pass_through() {
		$taxonomy = $this->taxonomy();

		$this->assertSame( 'New', $taxonomy->lock_folder_creation( 'New', 'media-folder', array( 'parent' => self::OPEN ) ) );
		$this->assertSame( 'New', $taxonomy->lock_folder_creation( 'New', 'media-folder', array() ) );
		$this->assertSame( 'New', $taxonomy->lock_folder_creation( 'New', 'media-folder', array( 'parent' => 0 ) ) );
		$this->assertSame( 'New', $taxonomy->lock_folder_creation( 'New', 'media-folder', array( 'parent' => -1 ) ) );
		$this->assertSame( 'New', $taxonomy->lock_folder_creation( 'New', 'category', array( 'parent' => self::LOCKED ) ) );

		$earlier = new \WP_Error( 'other_plugin', 'Refused earlier' );
		$this->assertSame( $earlier, $taxonomy->lock_folder_creation( $earlier, 'media-folder', array( 'parent' => self::LOCKED ) ) );
	}

	/**
	 * The guard wraps the collection and single-term routes, and nothing else.
	 *
	 * @return void
	 */
	public function test_the_guard_wraps_only_the_media_folder_routes() {
		$original  = static function () {
			return true;
		};
		$handler   = array(
			'methods'             => 'GET',
			'callback'            => '__return_true',
			'permission_callback' => $original,
		);
		$single    = '/wp/v2/media-folder/(?P<id>[\d]+)';
		$endpoints = array(
			'/wp/v2/media-folder'          => array( $handler, $handler ),
			$single                        => array(
				$handler,
				'allow_batch' => array( 'v1' => true ),
			),
			'/wp/v2/media'                 => array( $handler ),
			'/wp/v2/media-folders-sibling' => array( $handler ),
			'/wp/v2/categories'            => array( $handler ),
		);

		$guarded = $this->rest()->guard_media_folder_routes( $endpoints );

		$this->assertNotSame( $original, $guarded['/wp/v2/media-folder'][0]['permission_callback'] );
		$this->assertNotSame( $original, $guarded['/wp/v2/media-folder'][1]['permission_callback'] );
		$this->assertNotSame( $original, $guarded[ $single ][0]['permission_callback'] );
		$this->assertSame( array( 'v1' => true ), $guarded[ $single ]['allow_batch'], 'Route options are kept' );
		$this->assertSame( $endpoints['/wp/v2/media'], $guarded['/wp/v2/media'] );
		$this->assertSame( $endpoints['/wp/v2/media-folders-sibling'], $guarded['/wp/v2/media-folders-sibling'] );
		$this->assertSame( $endpoints['/wp/v2/categories'], $guarded['/wp/v2/categories'] );
	}

	/**
	 * A visitor who is not signed in is refused with a 401, and the route's own check never runs.
	 *
	 * @return void
	 */
	public function test_a_logged_out_visitor_is_refused() {
		unset( $GLOBALS['rtgodam_stub']['user'] );
		$GLOBALS['rtgodam_stub']['caps'] = array();

		foreach ( array( 'GET', 'POST', 'DELETE' ) as $method ) {
			$spy    = array();
			$result = $this->permission( $this->folder_request( $method, self::OPEN ), $spy );

			$this->assertInstanceOf( \WP_Error::class, $result, $method );
			$this->assertSame( 'rest_forbidden', $result->get_error_code(), $method );
			$this->assertSame( array( 'status' => 401 ), $result->get_error_data(), $method );
			$this->assertSame( array(), $spy, 'The route check must not run for a refused request' );
		}
	}

	/**
	 * A signed-in user who writes posts (a Contributor) reads folders, for the gallery block's
	 * folder picker, but cannot change them without upload rights.
	 *
	 * @return void
	 */
	public function test_a_contributor_reads_folders_but_cannot_change_them() {
		$GLOBALS['rtgodam_stub']['caps'] = array( 'read', 'edit_posts' );

		$spy = array();
		$this->assertTrue( $this->permission( $this->folder_request( 'GET', self::OPEN ), $spy ) );
		$this->assertCount( 1, $spy );

		foreach ( array( 'POST', 'DELETE' ) as $method ) {
			$spy    = array();
			$result = $this->permission( $this->folder_request( $method, self::OPEN ), $spy );

			$this->assertInstanceOf( \WP_Error::class, $result, $method );
			$this->assertSame( array( 'status' => 403 ), $result->get_error_data(), $method );
			$this->assertSame( array(), $spy, $method );
		}
	}

	/**
	 * A signed-in user who cannot write posts (a Subscriber) is refused with a 403.
	 *
	 * @return void
	 */
	public function test_a_subscriber_is_refused() {
		$GLOBALS['rtgodam_stub']['caps'] = array( 'read' );

		$spy    = array();
		$result = $this->permission( $this->folder_request( 'GET', self::OPEN ), $spy );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( array( 'status' => 403 ), $result->get_error_data() );
		$this->assertSame( array(), $spy );
	}

	/**
	 * Anyone who can upload files reads folders, locked ones included, and the route's own answer stands.
	 *
	 * @return void
	 */
	public function test_an_uploader_reads_folders_and_the_route_check_decides() {
		foreach ( array( self::OPEN, self::LOCKED, self::CHILD ) as $folder ) {
			$spy = array();

			$this->assertTrue( $this->permission( $this->folder_request( 'GET', $folder ), $spy ), "Folder $folder" );
			$this->assertCount( 1, $spy );
		}

		$denied = new \WP_Error( 'rest_cannot_update', 'The route said no' );
		$this->assertSame( $denied, $this->permission( $this->folder_request( 'POST', self::OPEN ), $spy, $denied ) );
	}

	/**
	 * A locked folder, or one inside it, cannot be changed by any of the mutating verbs.
	 *
	 * @return void
	 */
	public function test_a_locked_folder_cannot_be_modified() {
		foreach ( array( self::LOCKED, self::CHILD, self::GRANDCHILD ) as $folder ) {
			foreach ( array( 'POST', 'PUT', 'PATCH', 'DELETE' ) as $method ) {
				$spy    = array();
				$result = $this->permission( $this->folder_request( $method, $folder, 'Renamed' ), $spy );

				$this->assertTrue( $this->is_locked_error( $result ), "$method on $folder" );
				$this->assertSame( array(), $spy, 'The route check must not run for a refused request' );
			}
		}
	}

	/**
	 * The id is read the way the controller reads it, so a body id naming a locked folder is caught.
	 *
	 * @return void
	 */
	public function test_the_id_the_controller_acts_on_is_the_one_checked() {
		// The controller reads `$request['id']`, where a body or query value outranks the URL's.
		$result = $this->permission( $this->folder_request( 'POST', self::LOCKED, 'Hijacked' ) );

		$this->assertTrue( $this->is_locked_error( $result ) );
	}

	/**
	 * Moving a folder into a locked folder, or creating one there, is refused.
	 *
	 * @return void
	 */
	public function test_nothing_is_added_to_a_locked_folder() {
		$moved = $this->permission( $this->folder_request( 'POST', self::OPEN, null, self::LOCKED ) );
		$this->assertTrue( $this->is_locked_error( $moved ), 'Move an open folder in' );

		$created = $this->permission( $this->folder_request( 'POST', null, 'New', self::CHILD ) );
		$this->assertTrue( $this->is_locked_error( $created ), 'Create a folder in' );
	}

	/**
	 * Open folders keep working: rename, move, create and delete reach the route's own check.
	 *
	 * @return void
	 */
	public function test_open_folders_are_unaffected() {
		$requests = array(
			'rename' => $this->folder_request( 'POST', self::OPEN, 'Renamed' ),
			'move'   => $this->folder_request( 'POST', self::OPEN, null, self::OTHER ),
			'to top' => $this->folder_request( 'POST', self::OPEN, null, 0 ),
			'create' => $this->folder_request( 'POST', null, 'New', self::OPEN ),
			'delete' => $this->folder_request( 'DELETE', self::OPEN ),
		);

		foreach ( $requests as $name => $request ) {
			$this->assertTrue( $this->permission( $request ), $name );
		}
	}

	/**
	 * Bookmarking a locked folder, as the folder menu does, is still allowed; changing the lock is not.
	 *
	 * @return void
	 */
	public function test_bookmarking_a_locked_folder_is_allowed_but_not_changing_it() {
		$bookmark = $this->permission( $this->whole_folder_request( 'Locked', 0, array( 'bookmark' => true ) ) );
		$this->assertTrue( $bookmark, 'Bookmark with the whole folder sent back' );

		$only_meta = $this->permission( $this->folder_request( 'POST', self::LOCKED, null, null, array( 'bookmark' => true ) ) );
		$this->assertTrue( $only_meta, 'Bookmark alone' );

		$unlock = $this->permission( $this->whole_folder_request( 'Locked', 0, array( 'locked' => false ) ) );
		$this->assertTrue( $this->is_locked_error( $unlock ), 'Unlock' );

		$renamed = $this->permission( $this->whole_folder_request( 'Renamed', 0, array( 'bookmark' => true ) ) );
		$this->assertTrue( $this->is_locked_error( $renamed ), 'Rename with a bookmark' );

		$moved = $this->permission( $this->whole_folder_request( 'Locked', self::OPEN, array( 'bookmark' => true ) ) );
		$this->assertTrue( $this->is_locked_error( $moved ), 'Move with a bookmark' );
	}

	/**
	 * A core media update that takes a file out of a locked folder is refused.
	 *
	 * @return void
	 */
	public function test_a_file_cannot_leave_a_locked_folder() {
		$cases = array(
			'to no folder'            => array( self::IN_LOCKED, array() ),
			'to another folder'       => array( self::IN_LOCKED, array( self::OTHER ) ),
			'from a locked child'     => array( self::IN_CHILD, array( self::OPEN ) ),
			'as string ids'           => array( self::IN_LOCKED, array( (string) self::OTHER ) ),
			'to a folder, not a list' => array( self::IN_LOCKED, self::OTHER ),
		);

		foreach ( $cases as $name => $case ) {
			list( $attachment, $folders ) = $case;

			$result = $this->rest()->enforce_locked_folder_on_media_update(
				(object) array( 'ID' => $attachment ),
				new \WP_REST_Request( array( 'media-folder' => $folders ), 'POST' )
			);

			$this->assertTrue( $this->is_locked_error( $result ), $name );
		}
	}

	/**
	 * Other core media updates are left alone.
	 *
	 * @return void
	 */
	public function test_other_media_updates_pass_through() {
		$rest    = $this->rest();
		$request = static function ( $params ) {
			return new \WP_REST_Request( $params, 'POST' );
		};

		$in_locked = (object) array( 'ID' => self::IN_LOCKED );
		$in_open   = (object) array( 'ID' => self::IN_OPEN );
		$new       = (object) array( 'post_title' => 'New' );

		$this->assertSame( $in_locked, $rest->enforce_locked_folder_on_media_update( $in_locked, $request( array( 'title' => 'Renamed' ) ) ), 'A request that does not name folders' );
		$this->assertSame( $in_open, $rest->enforce_locked_folder_on_media_update( $in_open, $request( array( 'media-folder' => array( self::OTHER ) ) ) ), 'A file leaving an open folder' );
		$this->assertSame( $in_open, $rest->enforce_locked_folder_on_media_update( $in_open, $request( array( 'media-folder' => array() ) ) ), 'A file taken out of every folder' );
		$this->assertSame( $in_locked, $rest->enforce_locked_folder_on_media_update( $in_locked, $request( array( 'media-folder' => array( self::LOCKED ) ) ) ), 'Naming the folder it is already in leaves it there; the assign capability decides that case' );
		$this->assertSame( $new, $rest->enforce_locked_folder_on_media_update( $new, $request( array( 'media-folder' => array( self::OPEN ) ) ) ), 'A new upload has no folder to leave' );

		$earlier = new \WP_Error( 'rest_invalid_param', 'Refused earlier' );
		$this->assertSame( $earlier, $rest->enforce_locked_folder_on_media_update( $earlier, $request( array( 'media-folder' => array() ) ) ) );
	}
}
