<?php
/**
 * How a finished transcoding job replaces a video attachment's file with the MP4 GoDAM Central made.
 *
 * Central's callback carries `mp4_url`. GoDAM downloads it only from the hosts Central serves
 * files from, stores it under a name it makes itself (the attachment's own name with an .mp4
 * extension, never the URL's), accepts it only if it is an MP4, and overwrites a file only when
 * it is the attachment's own.
 *
 * The uploads folder is a real temp folder, so the tests read the outcome from disk.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Media_Library_Ajax;

/**
 * Runs in separate processes, like the other tests that stub WordPress functions.
 *
 * @covers \RTGODAM\Inc\Media_Library_Ajax::download_transcoded_mp4_source
 * @covers \RTGODAM\Inc\Media_Library_Ajax::godam_replace_attachment_with_external_file
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class Mp4ReplacementTest extends TestCase {

	/**
	 * Attachment the callback is for.
	 */
	const ATTACHMENT_ID = 12;

	/**
	 * The MP4 a CDN URL serves.
	 */
	const NEW_MP4 = 'new mp4 bytes';

	/**
	 * Uploads folder of the test, a real folder.
	 *
	 * @var string
	 */
	private $uploads;

	/**
	 * Create the uploads folder and stub the WordPress functions the replacement calls.
	 */
	protected function setUp(): void {
		parent::setUp();

		$this->uploads = sys_get_temp_dir() . '/godam-uploads-' . uniqid( '', true );
		mkdir( $this->uploads, 0777, true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.mkdir_mkdir -- test fixture folder.

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array(
			'mime'          => 'video/quicktime',
			'attached_file' => $this->uploads . '/holiday.mov',
			'upload_dir'    => array(
				'path'    => $this->uploads,
				'basedir' => dirname( $this->uploads ),
				'error'   => false,
			),
			'files'         => array(),
			'downloads'     => array(),
			'temp_files'    => array(),
			'updates'       => array(),
		);

		$GLOBALS['wp_filesystem_double'] = new class() {

			/**
			 * Like WP_Filesystem_Direct::move(): refuses an existing destination unless told to overwrite.
			 *
			 * @param string $source      Source path.
			 * @param string $destination Destination path.
			 * @param bool   $overwrite   Whether to overwrite.
			 * @return bool
			 */
			public function move( $source, $destination, $overwrite = false ) {
				if ( ! file_exists( $source ) ) {
					return false;
				}

				if ( file_exists( $destination ) ) {
					if ( ! $overwrite ) {
						return false;
					}
					unlink( $destination ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink -- stand-in for WP_Filesystem_Direct.
				}

				return rename( $source, $destination ); // phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename -- stand-in for WP_Filesystem_Direct.
			}

			/**
			 * @param string $file File to delete.
			 * @return bool
			 */
			public function delete( $file ) {
				return is_file( $file ) && unlink( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink -- stand-in for WP_Filesystem_Direct.
			}
		};

		require_once dirname( __DIR__ ) . '/stubs/transcoded-file-functions.php';

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		eval( 'function esc_url_raw( $url ) { return (string) $url; }' );
		eval( 'function get_post( $id ) { return (object) array( "ID" => $id, "post_type" => "attachment" ); }' );
		eval( 'function WP_Filesystem() { $GLOBALS["wp_filesystem"] = $GLOBALS["wp_filesystem_double"]; return true; }' );
		eval(
			'function download_url( $url, $timeout = 300 ) {
				$GLOBALS["rtgodam_stub"]["downloads"][] = $url;
				if ( ! isset( $GLOBALS["rtgodam_stub"]["files"][ $url ] ) ) {
					return new WP_Error( "http_404", "Not found" );
				}
				$temp = tempnam( sys_get_temp_dir(), "godam-dl-" );
				file_put_contents( $temp, $GLOBALS["rtgodam_stub"]["files"][ $url ] );
				$GLOBALS["rtgodam_stub"]["temp_files"][] = $temp;
				return $temp;
			}'
		);
		eval( 'function wp_upload_dir() { return $GLOBALS["rtgodam_stub"]["upload_dir"]; }' );
		eval( 'function get_attached_file( $id ) { return $GLOBALS["rtgodam_stub"]["attached_file"]; }' );
		eval( 'function update_attached_file( $id, $path ) { $GLOBALS["rtgodam_stub"]["attached_file"] = $path; return true; }' );
		eval( 'function wp_update_post( $postarr ) { $GLOBALS["rtgodam_stub"]["updates"][] = $postarr; return $postarr["ID"]; }' );
		eval( 'function wp_generate_attachment_metadata( $id, $file ) { return array( "file" => $file ); }' );
		eval( 'function wp_update_attachment_metadata( $id, $metadata ) { return true; }' );
		eval( 'function wp_basename( $path ) { return basename( $path ); }' );
		eval( 'function trailingslashit( $value ) { return rtrim( (string) $value, "/\\\\" ) . "/"; }' );
		eval( 'function wp_normalize_path( $path ) { return preg_replace( "|(?<=.)/+|", "/", str_replace( "\\\\", "/", $path ) ); }' );
		eval( 'function sanitize_file_name( $name ) { return trim( preg_replace( "/[^A-Za-z0-9._-]+/", "-", $name ), "-" ); }' );
		eval(
			'function wp_unique_filename( $dir, $name ) {
				$info = pathinfo( $name );
				$base = $info["filename"];
				$ext  = isset( $info["extension"] ) ? "." . $info["extension"] : "";
				$n    = 0;
				while ( file_exists( $dir . "/" . $name ) ) {
					$name = $base . "-" . ++$n . $ext;
				}
				return $name;
			}'
		);
		// phpcs:enable Squiz.PHP.Eval.Discouraged
	}

	/**
	 * Remove the uploads folder and the temp files of the test.
	 */
	protected function tearDown(): void {
		foreach ( glob( $this->uploads . '/*' ) as $file ) {
			unlink( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink -- test fixture folder.
		}
		rmdir( $this->uploads ); // phpcs:ignore WordPress.WP.AlternativeFunctions.rmdir_rmdir -- test fixture folder.

		foreach ( $GLOBALS['rtgodam_stub']['temp_files'] as $temp_file ) {
			wp_delete_file( $temp_file );
		}

		parent::tearDown();
	}

	/**
	 * An MP4 attachment, converted by Central under the same name, is replaced where it is.
	 */
	public function test_the_attachments_own_file_is_replaced_in_place() {
		$GLOBALS['rtgodam_stub']['mime']          = 'video/mp4';
		$GLOBALS['rtgodam_stub']['attached_file'] = $this->uploads . '/clip.mp4';
		$this->put_file( 'clip.mp4', 'uploaded mp4 bytes' );

		$this->finish_job( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/clip.mp4' );

		$this->assertSame( array( 'clip.mp4' ), $this->uploads_listing(), 'No second copy is made.' );
		$this->assertSame( self::NEW_MP4, $this->read_file( 'clip.mp4' ) );
		$this->assertSame( $this->uploads . '/clip.mp4', $GLOBALS['rtgodam_stub']['attached_file'] );
		$this->assertSame( 'video/mp4', $GLOBALS['rtgodam_stub']['updates'][0]['post_mime_type'] );
	}

	/**
	 * A video uploaded in another format gets the MP4 next to it, under the same name.
	 */
	public function test_a_converted_mp4_is_stored_next_to_the_upload_with_an_mp4_extension() {
		$this->put_file( 'holiday.mov', 'uploaded mov bytes' );

		$this->finish_job( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/holiday.mp4' );

		$this->assertSame( array( 'holiday.mov', 'holiday.mp4' ), $this->uploads_listing() );
		$this->assertSame( 'uploaded mov bytes', $this->read_file( 'holiday.mov' ) );
		$this->assertSame( self::NEW_MP4, $this->read_file( 'holiday.mp4' ) );
		$this->assertSame( $this->uploads . '/holiday.mp4', $GLOBALS['rtgodam_stub']['attached_file'] );
		$this->assertSame( 'video/mp4', $GLOBALS['rtgodam_stub']['updates'][0]['post_mime_type'] );
	}

	/**
	 * A file that is not the attachment's own is never overwritten: the MP4 takes the next free name.
	 */
	public function test_another_file_with_the_same_name_is_not_overwritten() {
		$this->put_file( 'holiday.mov', 'uploaded mov bytes' );
		$this->put_file( 'holiday.mp4', 'a different upload' );

		$this->finish_job( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/holiday.mp4' );

		$this->assertSame( 'a different upload', $this->read_file( 'holiday.mp4' ) );
		$this->assertSame( self::NEW_MP4, $this->read_file( 'holiday-1.mp4' ) );
		$this->assertSame( $this->uploads . '/holiday-1.mp4', $GLOBALS['rtgodam_stub']['attached_file'] );
	}

	/**
	 * The name in the URL is not used, so a URL cannot pick which file is written.
	 *
	 * @dataProvider names_in_the_url
	 *
	 * @param string $name File name the URL ends with.
	 */
	public function test_the_name_in_the_url_does_not_choose_the_file( $name ) {
		$GLOBALS['rtgodam_stub']['mime']          = 'video/mp4';
		$GLOBALS['rtgodam_stub']['attached_file'] = $this->uploads . '/clip.mp4';
		$this->put_file( 'clip.mp4', 'uploaded mp4 bytes' );
		$this->put_file( 'existing.mp4', 'someone else\'s upload' );
		$this->put_file( 'existing.php', 'not mine' );

		$this->finish_job( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/' . $name );

		$this->assertSame( array( 'clip.mp4', 'existing.mp4', 'existing.php' ), $this->uploads_listing() );
		$this->assertSame( 'someone else\'s upload', $this->read_file( 'existing.mp4' ) );
		$this->assertSame( 'not mine', $this->read_file( 'existing.php' ) );
		$this->assertSame( self::NEW_MP4, $this->read_file( 'clip.mp4' ) );
	}

	/**
	 * Names a URL on the CDN could end with.
	 *
	 * @return array<string, array>
	 */
	public function names_in_the_url() {
		return array(
			'another upload'         => array( 'existing.mp4' ),
			'a script'               => array( 'existing.php' ),
			'a script with a suffix' => array( 'existing.php.mp4' ),
			'a path'                 => array( '..%2Fexisting.mp4' ),
		);
	}

	/**
	 * Content that is not an MP4 is refused: the attachment keeps its file, and the download is cleaned up.
	 */
	public function test_a_file_that_is_not_an_mp4_is_refused() {
		$GLOBALS['rtgodam_stub']['mime']          = 'video/mp4';
		$GLOBALS['rtgodam_stub']['attached_file'] = $this->uploads . '/clip.mp4';
		$this->put_file( 'clip.mp4', 'uploaded mp4 bytes' );

		$url                                      = 'https://n8e0ka87m9.gdcdn.us/vo15od683f/clip.mp4';
		$GLOBALS['rtgodam_stub']['files'][ $url ] = '<html><body>Not Found</body></html>';

		$this->finish_job( $url );

		$this->assertSame( array( $url ), $GLOBALS['rtgodam_stub']['downloads'], 'The file was downloaded, then refused.' );
		$this->assertSame( array( 'clip.mp4' ), $this->uploads_listing() );
		$this->assertSame( 'uploaded mp4 bytes', $this->read_file( 'clip.mp4' ) );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['updates'] );
		$this->assertFileDoesNotExist( $GLOBALS['rtgodam_stub']['temp_files'][0], 'The download is removed.' );
	}

	/**
	 * A URL that is not on a GoDAM host is not downloaded at all.
	 *
	 * @dataProvider urls_on_other_hosts
	 *
	 * @param string $url The callback's mp4_url.
	 */
	public function test_a_url_on_another_host_is_not_downloaded( $url ) {
		$GLOBALS['rtgodam_stub']['files'][ $url ] = self::NEW_MP4;
		$this->put_file( 'holiday.mov', 'uploaded mov bytes' );

		$this->finish_job( $url );

		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['downloads'] );
		$this->assertSame( array( 'holiday.mov' ), $this->uploads_listing() );
		$this->assertSame( $this->uploads . '/holiday.mov', $GLOBALS['rtgodam_stub']['attached_file'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['updates'] );
	}

	/**
	 * URLs that are not on the CDN: another host, an internal address, plain http, a CDN name used as a user name.
	 *
	 * @return array<string, array>
	 */
	public function urls_on_other_hosts() {
		return array(
			'another host'              => array( 'https://files.example.com/holiday.mp4' ),
			'a script on another host'  => array( 'https://files.example.com/shell.php' ),
			'loopback address'          => array( 'http://127.0.0.1:8080/holiday.mp4' ),
			'plain http on the CDN'     => array( 'http://n8e0ka87m9.gdcdn.us/vo15od683f/holiday.mp4' ),
			'CDN name as the user name' => array( 'https://n8e0ka87m9.gdcdn.us@files.example.com/holiday.mp4' ),
		);
	}

	/**
	 * A site that uses another Central lists that Central's CDN domain with the filter.
	 */
	public function test_a_host_added_with_the_filter_is_downloaded_from() {
		add_filter(
			'rtgodam_transcoder_file_hosts',
			function ( $hosts ) {
				$hosts[] = 'cdn.staging.example';
				return $hosts;
			}
		);

		$this->put_file( 'holiday.mov', 'uploaded mov bytes' );

		$this->finish_job( 'https://cdn.staging.example/vo15od683f/holiday.mp4' );

		$this->assertSame( self::NEW_MP4, $this->read_file( 'holiday.mp4' ) );
	}

	/**
	 * An attachment with no file of its own is named after the URL, cleaned up, with an .mp4 extension.
	 */
	public function test_an_attachment_without_a_file_is_named_after_the_url() {
		$GLOBALS['rtgodam_stub']['attached_file'] = false;

		$this->finish_job( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/my%20holiday.mp4' );

		$this->assertSame( array( 'my-holiday.mp4' ), $this->uploads_listing() );
		$this->assertSame( $this->uploads . '/my-holiday.mp4', $GLOBALS['rtgodam_stub']['attached_file'] );
	}

	/**
	 * Run the callback hook GoDAM Central's finished job triggers, with `mp4_url` set.
	 *
	 * @param string $url The callback's mp4_url. Served with NEW_MP4 unless the test set its own content.
	 */
	private function finish_job( $url ) {
		if ( ! isset( $GLOBALS['rtgodam_stub']['files'][ $url ] ) && 0 === strpos( $url, 'https://' ) ) {
			$GLOBALS['rtgodam_stub']['files'][ $url ] = self::NEW_MP4;
		}

		$instance = ( new \ReflectionClass( Media_Library_Ajax::class ) )->newInstanceWithoutConstructor();

		$instance->download_transcoded_mp4_source( self::ATTACHMENT_ID, 'job', 'wp-media', new \WP_REST_Request( array( 'mp4_url' => $url ) ) );
	}

	/**
	 * Put a file in the uploads folder.
	 *
	 * @param string $name    File name.
	 * @param string $content File content.
	 */
	private function put_file( $name, $content ) {
		file_put_contents( $this->uploads . '/' . $name, $content ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_put_contents_file_put_contents -- test fixture folder.
	}

	/**
	 * Read a file from the uploads folder.
	 *
	 * @param string $name File name.
	 * @return string
	 */
	private function read_file( $name ) {
		return (string) file_get_contents( $this->uploads . '/' . $name ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- test fixture folder.
	}

	/**
	 * Names of the files in the uploads folder.
	 *
	 * @return string[]
	 */
	private function uploads_listing() {
		$names = array_map( 'basename', glob( $this->uploads . '/*' ) );
		sort( $names );

		return $names;
	}
}
