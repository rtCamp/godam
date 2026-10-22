<?php
/**
 * Media files that GoDAM deletes, exports or stores stay inside the uploads folder.
 *
 * - Deleting a media item removes the transcoded files and thumbnails listed in its meta,
 *   but only when they are files inside the uploads folder.
 * - The two meta keys that list those files are protected meta.
 * - create-media-entry stores a bare file name as the media item's file.
 * - The folder ZIP export leaves out files that are not inside the uploads folder.
 *
 * Runs against a temporary uploads folder with a sibling folder that stands in for the
 * rest of the server.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * Each test runs in its own process: loading the transcoder functions file registers
 * hooks as it loads, and EarlyTranslationHooksTest checks exactly that on the first
 * load in the shared process. The file stubs load here for the same reason.
 *
 * @covers ::rtgodam_get_uploads_file_path
 * @covers ::rtgodam_delete_transcoded_files
 * @covers ::rtgodam_delete_related_transcoded_files
 * @covers ::rtgodam_protect_media_file_meta
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class MediaFilePathsTest extends TestCase {

	/**
	 * Temporary folder that holds both the uploads folder and the "outside" folder.
	 *
	 * @var string
	 */
	private $root;

	/**
	 * Uploads folder (the stubbed upload base directory).
	 *
	 * @var string
	 */
	private $uploads;

	/**
	 * Folder next to the uploads folder, standing in for the rest of the server.
	 *
	 * @var string
	 */
	private $outside;

	protected function setUp(): void {
		parent::setUp();

		$plugin = dirname( __DIR__, 2 );

		require_once __DIR__ . '/../stubs/media-file-functions.php';
		require_once $plugin . '/admin/godam-transcoder-functions.php';
		require_once $plugin . '/inc/classes/class-filesystem.php';
		require_once $plugin . '/inc/classes/media-library/class-media-folder-create-zip.php';
		require_once $plugin . '/inc/classes/rest-api/class-media-library.php';

		// realpath() so the folders are compared the way the code under test compares them
		// (the system temp folder is a symlink on macOS).
		$this->root    = realpath( sys_get_temp_dir() ) . '/godam-media-paths-' . uniqid( '', true );
		$this->uploads = $this->root . '/uploads';
		$this->outside = $this->root . '/outside';

		mkdir( $this->uploads . '/2026/10', 0777, true );
		mkdir( $this->outside, 0777, true );

		$GLOBALS['rtgodam_stub']                    = array();
		$GLOBALS['rtgodam_stub']['uploads_basedir'] = $this->uploads;
		$GLOBALS['rtgodam_stub']['uploads_baseurl'] = 'https://example.test/wp-content/uploads';
		$GLOBALS['wp_filesystem']                   = new \WP_Filesystem_Base();
	}

	protected function tearDown(): void {
		$this->remove_tree( $this->root );
		unset( $GLOBALS['rtgodam_stub'], $GLOBALS['wp_filesystem'] );
		parent::tearDown();
	}

	/**
	 * Create a file with some content, creating its folder when needed.
	 *
	 * @param string $path    Absolute path.
	 * @param string $content File content.
	 * @return string The path.
	 */
	private function make_file( $path, $content = 'content' ) {
		if ( ! is_dir( dirname( $path ) ) ) {
			mkdir( dirname( $path ), 0777, true );
		}

		file_put_contents( $path, $content );

		return $path;
	}

	/**
	 * Remove a folder and everything in it.
	 *
	 * @param string $path Absolute path.
	 */
	private function remove_tree( $path ) {
		if ( is_link( $path ) || is_file( $path ) ) {
			unlink( $path );
			return;
		}

		if ( ! is_dir( $path ) ) {
			return;
		}

		foreach ( scandir( $path ) as $entry ) {
			if ( '.' !== $entry && '..' !== $entry ) {
				$this->remove_tree( $path . '/' . $entry );
			}
		}

		rmdir( $path );
	}

	/**
	 * Run the attachment-deletion handler against the stubbed meta.
	 *
	 * @param array $transcoded Value of `rtgodam_media_transcoded_files`.
	 * @param array $thumbnails Value of `rtgodam_media_thumbnails`.
	 */
	private function delete_attachment_with_meta( array $transcoded, array $thumbnails ) {
		$GLOBALS['rtgodam_stub']['post_meta'] = array(
			'rtgodam_media_transcoded_files' => $transcoded,
			'rtgodam_media_thumbnails'       => $thumbnails,
		);

		rtgodam_delete_related_transcoded_files( 123 );
	}

	/*
	 * ---------------------------------------------------------------------------
	 * Deleting a media item.
	 * ---------------------------------------------------------------------------
	 */

	public function test_delete_removes_transcoded_files_and_thumbnails_inside_uploads(): void {
		$video     = $this->make_file( $this->uploads . '/2026/10/clip-transcoded.mp4' );
		$thumbnail = $this->make_file( $this->uploads . '/2026/10/clip-thumb.jpg' );
		$absolute  = $this->make_file( $this->uploads . '/2026/10/clip-abs.mp4' );

		$this->delete_attachment_with_meta(
			array( 'mp4' => array( '2026/10/clip-transcoded.mp4', $absolute ) ),
			array( '2026/10/clip-thumb.jpg' )
		);

		$this->assertFileDoesNotExist( $video, 'A transcoded file listed relative to uploads is deleted.' );
		$this->assertFileDoesNotExist( $absolute, 'A transcoded file listed by absolute path inside uploads is deleted.' );
		$this->assertFileDoesNotExist( $thumbnail, 'A thumbnail inside uploads is deleted.' );
		$this->assertContains( 'rtgodam_media_transcoded_files', $GLOBALS['rtgodam_stub']['meta_deletes'] );
		$this->assertContains( 'rtgodam_media_thumbnails', $GLOBALS['rtgodam_stub']['meta_deletes'] );
	}

	public function test_delete_skips_files_outside_uploads_and_still_deletes_the_ones_inside(): void {
		$marker   = $this->make_file( $this->outside . '/marker.txt', 'keep me' );
		$inside   = $this->make_file( $this->uploads . '/2026/10/clip-thumb.jpg' );
		$inside_2 = $this->make_file( $this->uploads . '/2026/10/clip-transcoded.mp4' );

		$this->delete_attachment_with_meta(
			array(
				'mp4' => array(
					$marker,
					'../outside/marker.txt',
					'2026/10/../../../outside/marker.txt',
					'2026/10/clip-transcoded.mp4',
				),
			),
			array( $marker, '../outside/marker.txt', '2026/10/clip-thumb.jpg' )
		);

		$this->assertFileExists( $marker, 'A file outside uploads survives, whether listed by absolute or relative path.' );
		$this->assertSame( 'keep me', file_get_contents( $marker ) );
		$this->assertFileDoesNotExist( $inside );
		$this->assertFileDoesNotExist( $inside_2 );
	}

	public function test_delete_skips_a_link_inside_uploads_that_points_outside(): void {
		$marker = $this->make_file( $this->outside . '/marker.txt', 'keep me' );
		$link   = $this->uploads . '/2026/10/link.mp4';

		if ( ! @symlink( $marker, $link ) ) { // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- symlinks may be unavailable on the test host.
			$this->markTestSkipped( 'Symlinks are not available on this host.' );
		}

		$this->delete_attachment_with_meta( array( 'mp4' => array( '2026/10/link.mp4' ) ), array() );

		$this->assertFileExists( $marker );
		$this->assertTrue( is_link( $link ), 'The link itself is left alone too.' );
	}

	public function test_delete_leaves_the_uploads_folder_and_other_folders_alone(): void {
		$sub_folder = $this->uploads . '/2026/10';
		$sibling    = $this->make_file( $this->uploads . '/2026/10/keep.jpg' );

		$this->delete_attachment_with_meta(
			array( 'mp4' => array( '', '.', '2026/10', '2026', "2026/10/keep.jpg\0.mp4" ) ),
			array( '/', $this->uploads )
		);

		$this->assertDirectoryExists( $this->uploads );
		$this->assertDirectoryExists( $sub_folder );
		$this->assertFileExists( $sibling );
	}

	public function test_delete_ignores_urls_and_values_that_are_not_paths(): void {
		$marker = $this->make_file( $this->outside . '/marker.txt' );

		$this->delete_attachment_with_meta(
			array( 'mp4' => array( array( $marker ), 12, null, 'https://cdn.example.test/clip.mp4' ) ),
			array( 'https://cdn.example.test/thumb.jpg', 'php://filter/resource=' . $marker )
		);

		$this->assertFileExists( $marker );
	}

	public function test_a_single_path_string_is_accepted_as_well_as_a_list(): void {
		$inside  = $this->make_file( $this->uploads . '/2026/10/single.jpg' );
		$outside = $this->make_file( $this->outside . '/marker.txt' );

		rtgodam_delete_transcoded_files( '2026/10/single.jpg' );
		rtgodam_delete_transcoded_files( $outside );

		$this->assertFileDoesNotExist( $inside );
		$this->assertFileExists( $outside );
	}

	public function test_uploads_path_resolver_returns_the_real_path_only_for_files_inside_uploads(): void {
		$inside = $this->make_file( $this->uploads . '/2026/10/clip.mp4' );
		$this->make_file( $this->outside . '/marker.txt' );

		$this->assertSame( $inside, rtgodam_get_uploads_file_path( '2026/10/clip.mp4' ) );
		$this->assertSame( $inside, rtgodam_get_uploads_file_path( $inside ) );
		$this->assertSame( $inside, rtgodam_get_uploads_file_path( '2026/10/../10/clip.mp4' ) );

		$this->assertFalse( rtgodam_get_uploads_file_path( $this->outside . '/marker.txt' ) );
		$this->assertFalse( rtgodam_get_uploads_file_path( '../outside/marker.txt' ) );
		$this->assertFalse( rtgodam_get_uploads_file_path( '2026/10/missing.mp4' ) );
		$this->assertFalse( rtgodam_get_uploads_file_path( '2026/10' ), 'A folder is not a file.' );
		$this->assertFalse( rtgodam_get_uploads_file_path( '' ) );
		$this->assertFalse( rtgodam_get_uploads_file_path( array( $inside ) ) );
	}

	public function test_a_folder_that_only_shares_the_uploads_name_prefix_is_outside(): void {
		$lookalike = $this->make_file( $this->root . '/uploads-private/secret.txt' );

		$this->assertFalse( rtgodam_get_uploads_file_path( $lookalike ) );
		$this->assertFalse( rtgodam_get_uploads_file_path( '../uploads-private/secret.txt' ) );
	}

	public function test_uploads_path_resolver_works_with_a_stream_wrapper_uploads_folder(): void {
		stream_wrapper_register( 'rtgodamtest', \RtgodamTestStream::class );
		\RtgodamTestStream::$root                   = $this->uploads;
		$GLOBALS['rtgodam_stub']['uploads_basedir'] = 'rtgodamtest://bucket';
		$this->make_file( $this->uploads . '/2026/10/clip.mp4' );

		$this->assertSame( 'rtgodamtest://bucket/2026/10/clip.mp4', rtgodam_get_uploads_file_path( '2026/10/clip.mp4' ) );
		$this->assertFalse( rtgodam_get_uploads_file_path( '2026/10/missing.mp4' ) );
		$this->assertFalse( rtgodam_get_uploads_file_path( '../outside/marker.txt' ) );
		$this->assertFalse( rtgodam_get_uploads_file_path( '2026/../../outside/marker.txt' ) );
		$this->assertFalse( rtgodam_get_uploads_file_path( '/etc/hostname' ) );

		stream_wrapper_unregister( 'rtgodamtest' );
	}

	/*
	 * ---------------------------------------------------------------------------
	 * Protected meta.
	 * ---------------------------------------------------------------------------
	 */

	public function test_the_media_file_meta_keys_are_protected(): void {
		$this->assertTrue( apply_filters( 'is_protected_meta', false, 'rtgodam_media_thumbnails', 'post' ) );
		$this->assertTrue( apply_filters( 'is_protected_meta', false, 'rtgodam_media_transcoded_files', 'post' ) );
	}

	public function test_other_meta_keys_keep_their_protection_state(): void {
		$this->assertFalse( apply_filters( 'is_protected_meta', false, 'rtgodam_transcoding_status', 'post' ) );
		$this->assertFalse( apply_filters( 'is_protected_meta', false, 'rtgodam_media_thumbnails_extra', 'post' ) );
		$this->assertTrue( apply_filters( 'is_protected_meta', true, '_wp_attached_file', 'post' ), 'A key that is already protected stays protected.' );
	}

	public function test_godams_own_meta_writes_are_not_affected_by_protection(): void {
		// update_post_meta() does not consult is_protected_meta, so the transcoder callback
		// and the migration keep saving these keys.
		update_post_meta( 123, 'rtgodam_media_thumbnails', array( 'https://cdn.example.test/thumb.jpg' ) );

		$this->assertSame(
			array( 'https://cdn.example.test/thumb.jpg' ),
			$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_media_thumbnails']
		);
	}

	/*
	 * ---------------------------------------------------------------------------
	 * create-media-entry.
	 * ---------------------------------------------------------------------------
	 */

	/**
	 * Run the virtual media creation the create-media-entry route uses.
	 *
	 * @param string $filename Value of the request's `filename`.
	 * @return string The stored `_wp_attached_file`.
	 */
	private function stored_file_for_filename( $filename ) {
		$media_library = ( new \ReflectionClass( \RTGODAM\Inc\REST_API\Media_Library::class ) )->newInstanceWithoutConstructor();
		$method        = new \ReflectionMethod( $media_library, 'create_virtual_attachment_after_lookup' );
		$method->setAccessible( true );

		$attachment_id = $method->invoke(
			$media_library,
			array(
				'id'       => 'job-abc',
				'title'    => 'Clip',
				'mime'     => 'video/mp4',
				'url'      => 'https://cdn.example.test/clip.mp4',
				'filename' => $filename,
			)
		);

		$this->assertSame( 99, $attachment_id );

		return $GLOBALS['rtgodam_stub']['meta_writes']['_wp_attached_file'];
	}

	/**
	 * @return array<string, array{string, string}>
	 */
	public function filename_provider(): array {
		return array(
			'plain name'              => array( 'clip.mp4', 'clip.mp4' ),
			'absolute path'           => array( '/etc/hosts', 'hosts' ),
			'relative path with dots' => array( '../../outside/marker.txt', 'marker.txt' ),
			'nested folders'          => array( 'a/b/c/clip.mp4', 'clip.mp4' ),
			'windows path'            => array( 'C:\\Windows\\clip.mp4', 'clip.mp4' ),
			'backslash dots'          => array( '..\\..\\clip.mp4', 'clip.mp4' ),
			'dot segments only'       => array( '../..', '' ),
			'single dot'              => array( '.', '' ),
			'trailing slash'          => array( 'folder/', 'folder' ),
			'name kept as given'      => array( 'My Clip (1).mp4', 'My Clip (1).mp4' ),
			'no filename'             => array( '', '' ),
		);
	}

	/**
	 * @dataProvider filename_provider
	 *
	 * @param string $filename Requested file name.
	 * @param string $expected Stored value.
	 */
	public function test_create_media_entry_stores_only_a_bare_file_name( $filename, $expected ): void {
		$stored = $this->stored_file_for_filename( $filename );

		$this->assertSame( $expected, $stored );
		$this->assertStringNotContainsString( '/', $stored );
		$this->assertStringNotContainsString( '\\', $stored );
		$this->assertNotContains( $stored, array( '.', '..' ) );
	}

	public function test_a_missing_filename_is_stored_as_an_empty_string_as_before(): void {
		$media_library = ( new \ReflectionClass( \RTGODAM\Inc\REST_API\Media_Library::class ) )->newInstanceWithoutConstructor();
		$method        = new \ReflectionMethod( $media_library, 'create_virtual_attachment_after_lookup' );
		$method->setAccessible( true );

		$method->invoke(
			$media_library,
			array(
				'id'    => 'job-abc',
				'title' => 'Clip',
				'mime'  => 'video/mp4',
				'url'   => 'https://cdn.example.test/clip.mp4',
			)
		);

		$this->assertSame( '', $GLOBALS['rtgodam_stub']['meta_writes']['_wp_attached_file'] );
	}

	/*
	 * ---------------------------------------------------------------------------
	 * Folder ZIP export.
	 * ---------------------------------------------------------------------------
	 */

	/**
	 * Build the ZIP for the stubbed folder, the way run_folder_zip_job() does.
	 *
	 * @param array $attached_files Attachment ID => stored file path.
	 * @return array|\WP_Error Result of the ZIP build.
	 */
	private function build_zip( array $attached_files ) {
		if ( ! class_exists( 'ZipArchive' ) ) {
			$this->markTestSkipped( 'The zip extension is not available.' );
		}

		$GLOBALS['rtgodam_stub']['attached_files']        = $attached_files;
		$GLOBALS['rtgodam_stub']['folder_attachment_ids'] = array_keys( $attached_files );

		$zipper = \RTGODAM\Inc\Media_Library\Media_Folder_Create_Zip::get_instance();
		$method = new \ReflectionMethod( $zipper, 'create_zip_file_batched' );
		$method->setAccessible( true );

		return $method->invoke( $zipper, 5, 'folder.zip', count( $attached_files ) );
	}

	/**
	 * File names inside a built ZIP, mapped to their content.
	 *
	 * @param array $result Result of build_zip().
	 * @return array<string, string>
	 */
	private function zip_entries( array $result ) {
		$zip = new \ZipArchive();
		$this->assertTrue( $zip->open( $result['zip_path'] ) );

		$count   = $zip->count();
		$entries = array();
		for ( $i = 0; $i < $count; $i++ ) {
			$entries[ $zip->getNameIndex( $i ) ] = $zip->getFromIndex( $i );
		}
		$zip->close();

		return $entries;
	}

	public function test_folder_zip_includes_normal_uploads_and_skips_files_outside_uploads(): void {
		$video = $this->make_file( $this->uploads . '/2026/10/clip.mp4', 'video bytes' );
		$image = $this->make_file( $this->uploads . '/2026/10/photo.jpg', 'image bytes' );
		$this->make_file( $this->outside . '/marker.txt', 'secret bytes' );

		$result = $this->build_zip(
			array(
				11 => $video,
				12 => $image,
				13 => $this->outside . '/marker.txt',
				14 => $this->uploads . '/../outside/marker.txt',
				15 => $this->uploads . '/2026/10/missing.mp4',
				16 => false,
			)
		);

		$this->assertIsArray( $result, 'The ZIP was built.' );

		$entries = $this->zip_entries( $result );

		$this->assertSame(
			array(
				'11_clip.mp4'  => 'video bytes',
				'12_photo.jpg' => 'image bytes',
			),
			$entries
		);
		$this->assertSame( 2, $result['added_files'] );
		$this->assertSame( 4, $result['skipped_files'] );
		$this->assertStringNotContainsString( 'secret bytes', implode( '', $entries ) );
	}

	public function test_folder_zip_fails_without_a_file_when_every_file_is_outside_uploads(): void {
		$marker = $this->make_file( $this->outside . '/marker.txt', 'secret bytes' );

		$result = $this->build_zip( array( 11 => $marker ) );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'no_files_added', $result->get_error_code() );
		$this->assertFileDoesNotExist( $this->uploads . '/godam/folder.zip', 'No ZIP is left behind.' );
	}
}
