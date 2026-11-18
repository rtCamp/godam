<?php
/**
 * Tests which stored transcript URLs godam/get-transcript will fetch.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Media_Abilities;

/**
 * The transcript path is stored per media and can be set by anyone who can
 * edit it, so the server fetches it only from GoDAM's CDN or this site.
 *
 * Runs in its own process because it defines core functions.
 *
 * @covers \RTGODAM\Inc\Abilities\Media_Abilities
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class TranscriptFetchHostTest extends TestCase {

	/**
	 * Calls the private host check.
	 *
	 * @param mixed $url Stored transcript URL.
	 *
	 * @return bool
	 */
	private function allowed( $url ) {
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-media-abilities.php';
		require_once dirname( __DIR__ ) . '/stubs/hooks.php';

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		if ( ! function_exists( 'rtgodam_is_transcoder_file_url' ) ) {
			eval( 'function rtgodam_is_transcoder_file_url( $url ) { return 1 === preg_match( "#^https://[a-z0-9]+\\\\.gdcdn\\\\.us/#", (string) $url ); }' );
		}
		if ( ! function_exists( 'home_url' ) ) {
			eval( 'function home_url() { return "https://shop.example"; }' );
		}
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		$reflection = new \ReflectionClass( Media_Abilities::class );
		$method     = $reflection->getMethod( 'is_transcript_url_allowed' );

		if ( PHP_VERSION_ID < 80100 ) {
			$method->setAccessible( true );
		}

		return $method->invoke( $reflection->newInstanceWithoutConstructor(), $url );
	}

	/**
	 * GoDAM's CDN and the site's own host are fetched.
	 *
	 * @return void
	 */
	public function test_cdn_and_own_site_are_allowed() {
		$this->assertTrue( $this->allowed( 'https://abc123.gdcdn.us/job1/captions.vtt' ) );
		$this->assertTrue( $this->allowed( 'https://example.com/wp-content/uploads/2026/11/captions.vtt' ) );
		$this->assertTrue( $this->allowed( 'https://example.com/wp-content/uploads/captions.SRT' ) );
	}

	/**
	 * On the site's own host, only a caption file in the uploads folder is fetched.
	 *
	 * @return void
	 */
	public function test_own_site_paths_outside_uploads_are_refused() {
		$this->assertFalse( $this->allowed( 'https://example.com/private/notes.vtt' ), 'Outside uploads.' );
		$this->assertFalse( $this->allowed( 'https://example.com/wp-content/uploads/../../wp-config.vtt' ), 'Climbs out of uploads.' );
		$this->assertFalse( $this->allowed( 'https://example.com/wp-content/uploads/%2e%2e/%2E%2E/wp-config.vtt' ), 'Climbs out with an encoded "..".' );
		$this->assertFalse( $this->allowed( 'https://example.com/wp-content/uploads/%5c..%5cx.vtt' ), 'Climbs out with encoded backslashes.' );
		$this->assertFalse( $this->allowed( 'https://example.com/wp-content/uploads/report.txt' ), 'Not a caption file.' );
		$this->assertFalse( $this->allowed( 'https://example.com/wp-content/uploads-other/x.vtt' ), 'A sibling folder whose name starts the same.' );
		$this->assertFalse( $this->allowed( 'https://shop.example/wp-content/uploads/x.vtt' ), 'The home host, when uploads live elsewhere.' );
		$this->assertFalse( $this->allowed( 'https://example.com:8080/wp-content/uploads/x.vtt' ), 'Another port.' );
	}

	/**
	 * When uploads sit at the root of their host, every path would be "in uploads", so none is.
	 *
	 * @return void
	 */
	public function test_uploads_at_the_host_root_allow_nothing() {
		$GLOBALS['rtgodam_stub']['uploads_baseurl'] = 'https://example.com';

		$this->assertFalse( $this->allowed( 'https://example.com/private/notes.vtt' ) );
	}

	/**
	 * Any other host, an internal address, or a URL with credentials is refused.
	 *
	 * @return void
	 */
	public function test_other_hosts_are_refused() {
		$this->assertFalse( $this->allowed( 'http://evil.example/x.vtt' ) );
		$this->assertFalse( $this->allowed( 'http://169.254.169.254/latest/meta-data/x.vtt' ) );
		$this->assertFalse( $this->allowed( 'http://localhost/x.vtt' ) );
		$this->assertFalse( $this->allowed( 'file:///etc/passwd' ) );
		$this->assertFalse( $this->allowed( '' ) );
		$this->assertFalse( $this->allowed( null ) );
	}
}
