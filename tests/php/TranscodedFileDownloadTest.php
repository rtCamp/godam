<?php
/**
 * What GoDAM downloads when GoDAM Central sends back a converted file.
 *
 * Central lists the converted MP4 or MP3 in the callback. GoDAM fetches it with WordPress's safe
 * request, only from the hosts Central serves files from, and stores it only when its content is the
 * type its name says. Anything else in the list is skipped and the rest of the list is still handled.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * Runs in separate processes, like the other tests that stub WordPress functions.
 *
 * @covers \RTGODAM_Transcoder_Handler::add_transcoded_files
 * @covers \RTGODAM_Transcoder_Handler::is_expected_file_type
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class TranscodedFileDownloadTest extends TestCase {

	/**
	 * Where PHP's error_log() writes during a test.
	 *
	 * @var string
	 */
	private $log_file;

	/**
	 * Load the handler and stub the WordPress functions add_transcoded_files() calls.
	 */
	protected function setUp(): void {
		parent::setUp();

		$this->log_file = tempnam( sys_get_temp_dir(), 'godam-log-' );
		// phpcs:ignore WordPress.PHP.IniSet.Risky -- sending the plugin's error_log() lines to a file the test reads.
		ini_set( 'error_log', $this->log_file );

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array(
			'http'    => array( 'body' => 'converted file bytes' ),
			'mime'    => 'audio/wav',
			'updates' => array(),
			'stored'  => array(),
			'meta'    => array(),
		);

		if ( ! defined( 'RTGODAM_PATH' ) ) {
			define( 'RTGODAM_PATH', dirname( __DIR__, 2 ) . '/' );
		}
		require_once dirname( __DIR__, 2 ) . '/admin/class-rtgodam-transcoder-handler.php';
		require_once dirname( __DIR__ ) . '/stubs/transcoded-file-functions.php';

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		eval( 'function wp_upload_bits( $name, $deprecated, $bits ) { $GLOBALS["rtgodam_stub"]["stored"][ $name ] = $bits; return array( "file" => "/uploads/2026/10/" . $name, "url" => "https://example.test/uploads/2026/10/" . $name ); }' );
		eval( 'function _wp_relative_upload_path( $path ) { return ltrim( str_replace( "/uploads/", "", $path ), "/" ); }' );
		eval( 'function update_post_meta( $id, $key, $value ) { $GLOBALS["rtgodam_stub"]["meta"][ $key ] = $value; return true; }' );
		eval( 'function wp_update_post( $postarr ) { $GLOBALS["rtgodam_stub"]["updates"][] = $postarr; return $postarr["ID"]; }' );
		// phpcs:enable Squiz.PHP.Eval.Discouraged
	}

	/**
	 * Remove the log file.
	 */
	protected function tearDown(): void {
		wp_delete_file( $this->log_file );
		parent::tearDown();
	}

	/**
	 * A converted file on the GoDAM CDN is fetched with the safe request and stored.
	 */
	public function test_a_file_on_the_godam_cdn_is_fetched_safely_and_stored() {
		$url = 'https://n8e0ka87m9.gdcdn.us/vo15od683f/voice-note.mp3';

		$this->handler()->add_transcoded_files( array( 'mp3' => array( $url ) ), 12, 'wp-media' );

		$this->assertSame( array( $url ), $GLOBALS['rtgodam_stub']['safe_get_urls'] );
		$this->assertArrayNotHasKey( 'last_remote_url', $GLOBALS['rtgodam_stub'], 'The unrestricted request is not used.' );
		$this->assertSame( array( 'voice-note.mp3' => 'converted file bytes' ), $GLOBALS['rtgodam_stub']['stored'] );
		$this->assertSame( '2026/10/voice-note.mp3', $GLOBALS['rtgodam_stub']['meta']['_wp_attached_file'] );
		$this->assertSame( $url, $GLOBALS['rtgodam_stub']['meta']['rtgodam_transcoded_url'] );
		$this->assertSame( 'audio/mpeg', $GLOBALS['rtgodam_stub']['updates'][0]['post_mime_type'] );
	}

	/**
	 * A converted video is stored the same way, and the file name comes from the path, not the query string.
	 */
	public function test_a_video_with_a_query_string_is_stored_under_its_path_name() {
		$GLOBALS['rtgodam_stub']['mime'] = 'video/quicktime';

		$this->handler()->add_transcoded_files( array( 'mp4' => array( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/clip.mp4?v=2' ) ), 7, 'wp-media' );

		$this->assertSame( array( 'clip.mp4' ), array_keys( $GLOBALS['rtgodam_stub']['stored'] ) );
		$this->assertSame( 'video/mp4', $GLOBALS['rtgodam_stub']['updates'][0]['post_mime_type'] );
	}

	/**
	 * A URL that is not on a GoDAM host is not requested, stores nothing, and the skip is logged.
	 *
	 * @dataProvider urls_on_other_hosts
	 *
	 * @param string $url URL in the callback's files list.
	 */
	public function test_a_file_on_another_host_is_not_requested( $url ) {
		$this->handler()->add_transcoded_files( array( 'mp3' => array( $url ) ), 12, 'wp-media' );

		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['safe_get_urls'] ?? array(), 'No request is made.' );
		$this->assertArrayNotHasKey( 'last_remote_url', $GLOBALS['rtgodam_stub'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['stored'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['meta'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['updates'] );
		$this->assertStringContainsString( 'rtgodam_transcoder_file_hosts', (string) file_get_contents( $this->log_file ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reading the test's own log file.
	}

	/**
	 * URLs that are not on the CDN: another host, an internal address, plain http, a CDN name used as a user name.
	 *
	 * @return array<string, array>
	 */
	public function urls_on_other_hosts() {
		return array(
			'another host'              => array( 'https://files.example.com/note.mp3' ),
			'loopback address'          => array( 'http://127.0.0.1:8080/note.mp3' ),
			'metadata address'          => array( 'https://169.254.169.254/latest/meta-data/note.mp3' ),
			'plain http on the CDN'     => array( 'http://n8e0ka87m9.gdcdn.us/vo15od683f/note.mp3' ),
			'CDN name as the user name' => array( 'https://n8e0ka87m9.gdcdn.us@files.example.com/note.mp3' ),
			'CDN name only in the path' => array( 'https://files.example.com/n8e0ka87m9.gdcdn.us/note.mp3' ),
		);
	}

	/**
	 * The URL is checked as it is fetched: after the two rounds of decoding GoDAM has always applied.
	 */
	public function test_the_url_is_checked_after_decoding() {
		// Decodes to https://n8e0ka87m9.gdcdn.us@files.example.com/note.mp3.
		$this->handler()->add_transcoded_files( array( 'mp3' => array( 'https://n8e0ka87m9.gdcdn.us%2540files.example.com/note.mp3' ) ), 12, 'wp-media' );

		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['safe_get_urls'] ?? array() );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['stored'] );
	}

	/**
	 * A fully encoded CDN URL, which GoDAM has always accepted, still works.
	 */
	public function test_an_encoded_cdn_url_is_still_fetched() {
		$this->handler()->add_transcoded_files( array( 'mp3' => array( 'https%253A%252F%252Fn8e0ka87m9.gdcdn.us%252Fvo15od683f%252Fnote.mp3' ) ), 12, 'wp-media' );

		$this->assertSame( array( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/note.mp3' ), $GLOBALS['rtgodam_stub']['safe_get_urls'] );
		$this->assertSame( array( 'note.mp3' ), array_keys( $GLOBALS['rtgodam_stub']['stored'] ) );
	}

	/**
	 * Only the MP4 or MP3 Central converts to is fetched, whatever else a URL on the CDN names.
	 *
	 * @dataProvider other_file_names
	 *
	 * @param string $url URL on the GoDAM CDN.
	 */
	public function test_only_mp4_and_mp3_files_are_fetched( $url ) {
		$this->handler()->add_transcoded_files( array( 'mp4' => array( $url ) ), 7, 'wp-media' );

		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['safe_get_urls'] ?? array() );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['stored'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['updates'] );
	}

	/**
	 * Names on the CDN that are not an MP4 or MP3.
	 *
	 * @return array<string, array>
	 */
	public function other_file_names() {
		return array(
			'text file'                    => array( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/notes.txt' ),
			'script'                       => array( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/page.php' ),
			'image'                        => array( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/picture.svg' ),
			'no extension'                 => array( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/clip' ),
			'no file name'                 => array( 'https://n8e0ka87m9.gdcdn.us/' ),
			'MP3 named only in the query'  => array( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/page.php?name=note.mp3' ),
			'MP3 named only in a fragment' => array( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/page.php#note.mp3' ),
		);
	}

	/**
	 * A file whose content is not what its name says is not stored, and leaves no temp file behind.
	 *
	 * @dataProvider mismatched_content
	 *
	 * @param string $key Files list key.
	 * @param string $url URL on the GoDAM CDN.
	 */
	public function test_content_that_is_not_the_named_type_is_not_stored( $key, $url ) {
		$GLOBALS['rtgodam_stub']['http'] = array( 'body' => '<html><body>Not Found</body></html>' );
		$temp_files_before               = glob( sys_get_temp_dir() . '/godam-test-*' );

		$this->handler()->add_transcoded_files( array( $key => array( $url ) ), 12, 'wp-media' );

		$this->assertSame( array( $url ), $GLOBALS['rtgodam_stub']['safe_get_urls'], 'The file was fetched, then refused.' );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['stored'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['meta'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['updates'] );
		$this->assertSame( $temp_files_before, glob( sys_get_temp_dir() . '/godam-test-*' ) );
	}

	/**
	 * A page where an MP3 or an MP4 should be.
	 *
	 * @return array<string, array>
	 */
	public function mismatched_content() {
		return array(
			'MP3' => array( 'mp3', 'https://n8e0ka87m9.gdcdn.us/vo15od683f/note.mp3' ),
			'MP4' => array( 'mp4', 'https://n8e0ka87m9.gdcdn.us/vo15od683f/clip.mp4' ),
		);
	}

	/**
	 * A site that uses another Central lists that Central's CDN domain with the filter.
	 */
	public function test_a_host_added_with_the_filter_is_fetched() {
		add_filter(
			'rtgodam_transcoder_file_hosts',
			function ( $hosts ) {
				$hosts[] = 'cdn.staging.example';
				return $hosts;
			}
		);

		$url = 'https://cdn.staging.example/job/note.mp3';

		$this->handler()->add_transcoded_files( array( 'mp3' => array( $url ) ), 12, 'wp-media' );

		$this->assertSame( array( $url ), $GLOBALS['rtgodam_stub']['safe_get_urls'] );
		$this->assertSame( array( 'note.mp3' ), array_keys( $GLOBALS['rtgodam_stub']['stored'] ) );
	}

	/**
	 * One URL that is refused does not stop the others in the list.
	 */
	public function test_a_refused_url_does_not_stop_the_rest_of_the_list() {
		$good = 'https://n8e0ka87m9.gdcdn.us/vo15od683f/note.mp3';

		$this->handler()->add_transcoded_files( array( 'mp3' => array( 'https://files.example.com/other.mp3', $good ) ), 12, 'wp-media' );

		$this->assertSame( array( $good ), $GLOBALS['rtgodam_stub']['safe_get_urls'] );
		$this->assertSame( array( 'note.mp3' ), array_keys( $GLOBALS['rtgodam_stub']['stored'] ) );
		$this->assertSame( $good, $GLOBALS['rtgodam_stub']['meta']['rtgodam_transcoded_url'] );
	}

	/**
	 * A download that comes back empty stores nothing.
	 */
	public function test_an_empty_download_stores_nothing() {
		$GLOBALS['rtgodam_stub']['http'] = array(
			'code' => 404,
			'body' => '',
		);

		$this->handler()->add_transcoded_files( array( 'mp3' => array( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/note.mp3' ) ), 12, 'wp-media' );

		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['stored'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['meta'] );
	}

	/**
	 * The handler without its constructor, which reads options and loads other files.
	 *
	 * @return \RTGODAM_Transcoder_Handler
	 */
	private function handler() {
		return ( new \ReflectionClass( \RTGODAM_Transcoder_Handler::class ) )->newInstanceWithoutConstructor();
	}
}
