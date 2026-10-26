<?php
/**
 * Unit tests for filing an upload into the folder it names.
 *
 * An upload that names a folder (`media-folder` in the request) is filed there, unless that
 * folder is locked, or inside a locked folder: the upload still succeeds but stays unfiled,
 * as the assign-folder route refuses the same move. The folder tree is stubbed (see
 * tests/stubs/media-folder-functions.php): Locked (20) holds Child (21), which holds
 * Grandchild (22); Open (10) is not locked.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Media_Library_Ajax;

/**
 * Runs in separate processes, like the other tests that stub WordPress functions.
 *
 * @covers \RTGODAM\Inc\Media_Library_Ajax::add_media_library_taxonomy_on_media_upload
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class MediaUploadLockedFolderTest extends TestCase {

	const OPEN       = 10;
	const LOCKED     = 20;
	const CHILD      = 21;
	const GRANDCHILD = 22;

	/**
	 * The attachment being uploaded.
	 */
	const ATTACHMENT = 700;

	/**
	 * Build the folder tree and stub the slice of WordPress the upload handler touches.
	 *
	 * @return void
	 */
	protected function setUp(): void {
		parent::setUp();

		$folder = static function ( $id, $parent_id ) {
			return (object) array(
				'term_id'  => $id,
				'taxonomy' => 'media-folder',
				'parent'   => $parent_id,
			);
		};

		$GLOBALS['rtgodam_stub'] = array(
			'terms'       => array(
				self::OPEN       => $folder( self::OPEN, 0 ),
				self::LOCKED     => $folder( self::LOCKED, 0 ),
				self::CHILD      => $folder( self::CHILD, self::LOCKED ),
				self::GRANDCHILD => $folder( self::GRANDCHILD, self::CHILD ),
			),
			'term_meta'   => array( self::LOCKED => array( 'locked' => '1' ) ),
			'nonce_valid' => true,
			'assigned'    => array(),
		);

		$_REQUEST = array( '_wpnonce' => 'media-form-nonce' );

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		eval( 'function wp_verify_nonce( $nonce, $action = -1 ) { return ! empty( $GLOBALS["rtgodam_stub"]["nonce_valid"] ); }' );
		eval( 'function wp_unslash( $value ) { return $value; }' );
		eval( 'function wp_set_object_terms( $object_id, $terms, $taxonomy ) { $GLOBALS["rtgodam_stub"]["assigned"][] = array( $object_id, $terms, $taxonomy ); return array(); }' );
		// phpcs:enable Squiz.PHP.Eval.Discouraged
	}

	/**
	 * Run the upload handler for a request that names $folder.
	 *
	 * @param mixed $folder Value of the `media-folder` request field.
	 * @return array The files filed so far: array( attachment, term, taxonomy ) per call.
	 */
	private function upload_into( $folder ) {
		$_REQUEST['media-folder'] = $folder;

		$ajax = ( new \ReflectionClass( Media_Library_Ajax::class ) )->newInstanceWithoutConstructor();
		$ajax->add_media_library_taxonomy_on_media_upload( self::ATTACHMENT );

		return $GLOBALS['rtgodam_stub']['assigned'];
	}

	/**
	 * An upload that names an open folder is filed there.
	 *
	 * @return void
	 */
	public function test_an_upload_is_filed_in_an_open_folder() {
		$this->assertSame(
			array( array( self::ATTACHMENT, self::OPEN, 'media-folder' ) ),
			$this->upload_into( (string) self::OPEN )
		);
	}

	/**
	 * An upload that names a locked folder, or one inside it, is not filed there.
	 *
	 * @return void
	 */
	public function test_an_upload_is_not_filed_in_a_locked_folder() {
		foreach ( array( self::LOCKED, self::CHILD, self::GRANDCHILD ) as $folder ) {
			$this->assertSame( array(), $this->upload_into( (string) $folder ), "Folder $folder" );
		}
	}

	/**
	 * The checks that were there before the lock still leave an upload unfiled.
	 *
	 * @return void
	 */
	public function test_an_upload_is_not_filed_without_a_valid_folder_and_nonce() {
		$this->assertSame( array(), $this->upload_into( '0' ), 'No folder' );
		$this->assertSame( array(), $this->upload_into( '-3' ), 'Negative id' );
		$this->assertSame( array(), $this->upload_into( '404' ), 'A folder that does not exist' );

		$GLOBALS['rtgodam_stub']['nonce_valid'] = false;
		$this->assertSame( array(), $this->upload_into( (string) self::OPEN ), 'Without a valid nonce' );
	}
}
