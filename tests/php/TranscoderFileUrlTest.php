<?php
/**
 * Which URLs GoDAM downloads transcoded files from.
 *
 * GoDAM Central serves every account's files from its own subdomain on the CDN domain
 * (`https://{account}.gdcdn.us/{job_id}/{file}`). The transcoder callback only downloads from
 * those hosts, and a site that uses another Central can add its CDN domain with the
 * `rtgodam_transcoder_file_hosts` filter.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * @covers ::rtgodam_get_transcoder_file_hosts
 * @covers ::rtgodam_is_transcoder_file_url
 */
class TranscoderFileUrlTest extends TestCase {

	/**
	 * Start every test with no filters registered.
	 */
	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_hooks'] = array();
	}

	/**
	 * Leave no filters behind for the next test.
	 */
	protected function tearDown(): void {
		$GLOBALS['rtgodam_hooks'] = array();
		parent::tearDown();
	}

	/**
	 * Files on a GoDAM CDN host are accepted, whichever account's subdomain they are on.
	 *
	 * @dataProvider godam_cdn_urls
	 *
	 * @param string $url URL of a file.
	 */
	public function test_files_on_the_godam_cdn_are_accepted( $url ) {
		$this->assertTrue( rtgodam_is_transcoder_file_url( $url ) );
	}

	/**
	 * URLs GoDAM Central sends, with the odd-but-valid forms a host can take.
	 *
	 * @return array<string, array>
	 */
	public function godam_cdn_urls() {
		return array(
			'video'                     => array( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/clip.mp4' ),
			'audio'                     => array( 'https://cuunl3cre4.gdcdn.us/2b0eb6814v/voice-note.mp3' ),
			'another account'           => array( 'https://8gu7jdrvd6.gdcdn.us/sa1hvimon9/clip.mp4' ),
			'upper case host'           => array( 'https://N8E0KA87M9.GDCDN.US/vo15od683f/clip.mp4' ),
			'upper case scheme'         => array( 'HTTPS://n8e0ka87m9.gdcdn.us/vo15od683f/clip.mp4' ),
			'trailing dot on host'      => array( 'https://n8e0ka87m9.gdcdn.us./vo15od683f/clip.mp4' ),
			'explicit https port'       => array( 'https://n8e0ka87m9.gdcdn.us:443/vo15od683f/clip.mp4' ),
			'query string'              => array( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/clip.mp4?v=2' ),
			'name with spaces, as sent' => array( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/my%20clip.mp4' ),
		);
	}

	/**
	 * Anything else is refused, including addresses written to look like a CDN host.
	 *
	 * @dataProvider other_urls
	 *
	 * @param mixed $url Candidate URL.
	 */
	public function test_other_urls_are_refused( $url ) {
		$this->assertFalse( rtgodam_is_transcoder_file_url( $url ) );
	}

	/**
	 * Candidates that must not pass.
	 *
	 * @return array<string, array>
	 */
	public function other_urls() {
		return array(
			'plain http'                    => array( 'http://n8e0ka87m9.gdcdn.us/vo15od683f/clip.mp4' ),
			'another host'                  => array( 'https://files.example.com/clip.mp4' ),
			'the CDN name as a prefix'      => array( 'https://gdcdn.us.example.com/clip.mp4' ),
			'the CDN name inside a label'   => array( 'https://notgdcdn.us/clip.mp4' ),
			'the CDN name as a path'        => array( 'https://example.com/n8e0ka87m9.gdcdn.us/clip.mp4' ),
			'the CDN name in the query'     => array( 'https://example.com/clip.mp4?host=n8e0ka87m9.gdcdn.us' ),
			'the CDN name in the fragment'  => array( 'https://example.com/clip.mp4#n8e0ka87m9.gdcdn.us' ),
			'CDN name as the user name'     => array( 'https://n8e0ka87m9.gdcdn.us@example.com/clip.mp4' ),
			'CDN name with a password'      => array( 'https://n8e0ka87m9.gdcdn.us:secret@example.com/clip.mp4' ),
			'user name on a CDN host'       => array( 'https://user@n8e0ka87m9.gdcdn.us/clip.mp4' ),
			'backslash before the CDN name' => array( 'https://example.com\\.n8e0ka87m9.gdcdn.us/clip.mp4' ),
			'encoded dot in the host'       => array( 'https://example.com%2en8e0ka87m9.gdcdn.us/clip.mp4' ),
			'encoded slash in the host'     => array( 'https://example.com%2F.gdcdn.us/clip.mp4' ),
			'loopback address'              => array( 'https://127.0.0.1/clip.mp4' ),
			'loopback on the http port'     => array( 'http://127.0.0.1:8080/clip.mp4' ),
			'private address'               => array( 'https://10.0.0.5/clip.mp4' ),
			'link-local metadata address'   => array( 'https://169.254.169.254/latest/meta-data/' ),
			'localhost'                     => array( 'https://localhost/clip.mp4' ),
			'bracketed IPv6 loopback'       => array( 'https://[::1]/clip.mp4' ),
			'other scheme'                  => array( 'ftp://n8e0ka87m9.gdcdn.us/clip.mp4' ),
			'file scheme'                   => array( 'file:///etc/passwd' ),
			'no scheme'                     => array( 'n8e0ka87m9.gdcdn.us/vo15od683f/clip.mp4' ),
			'protocol-relative'             => array( '//n8e0ka87m9.gdcdn.us/vo15od683f/clip.mp4' ),
			'a path only'                   => array( '/vo15od683f/clip.mp4' ),
			'empty'                         => array( '' ),
			'null'                          => array( null ),
			'an array'                      => array( array( 'https://n8e0ka87m9.gdcdn.us/vo15od683f/clip.mp4' ) ),
		);
	}

	/**
	 * Out of the box the CDN domain is the only host.
	 */
	public function test_the_default_host_is_the_godam_cdn_domain() {
		$this->assertSame( array( 'gdcdn.us' ), rtgodam_get_transcoder_file_hosts() );
	}

	/**
	 * A site that uses another Central adds its CDN domain, and its subdomains follow.
	 */
	public function test_a_host_added_with_the_filter_is_accepted_with_its_subdomains() {
		add_filter(
			'rtgodam_transcoder_file_hosts',
			function ( $hosts ) {
				$hosts[] = 'cdn.staging.example';
				return $hosts;
			}
		);

		$this->assertTrue( rtgodam_is_transcoder_file_url( 'https://cdn.staging.example/job/clip.mp4' ) );
		$this->assertTrue( rtgodam_is_transcoder_file_url( 'https://abc123.cdn.staging.example/job/clip.mp4' ) );
		$this->assertTrue( rtgodam_is_transcoder_file_url( 'https://n8e0ka87m9.gdcdn.us/job/clip.mp4' ), 'The default host still works.' );
		$this->assertFalse( rtgodam_is_transcoder_file_url( 'https://staging.example/job/clip.mp4' ), 'A parent domain is not added.' );
		$this->assertFalse( rtgodam_is_transcoder_file_url( 'https://evilcdn.staging.example.com/job/clip.mp4' ) );
	}

	/**
	 * Entries are cleaned up: case, surrounding space and dots, repeats, and anything that is not a name.
	 */
	public function test_filtered_hosts_are_normalised() {
		add_filter(
			'rtgodam_transcoder_file_hosts',
			function () {
				return array( ' CDN.Staging.Example. ', 'cdn.staging.example', '', '.', 12, null, array( 'gdcdn.us' ) );
			}
		);

		$this->assertSame( array( 'cdn.staging.example' ), rtgodam_get_transcoder_file_hosts() );
	}

	/**
	 * A filter can narrow the list as well as widen it.
	 */
	public function test_the_filter_can_drop_the_default_host() {
		add_filter(
			'rtgodam_transcoder_file_hosts',
			function () {
				return array( 'cdn.staging.example' );
			}
		);

		$this->assertFalse( rtgodam_is_transcoder_file_url( 'https://n8e0ka87m9.gdcdn.us/job/clip.mp4' ) );
		$this->assertTrue( rtgodam_is_transcoder_file_url( 'https://cdn.staging.example/job/clip.mp4' ) );
	}

	/**
	 * A filter that returns something that is not a list leaves no host allowed, rather than every host.
	 */
	public function test_a_filter_returning_a_non_list_allows_nothing() {
		add_filter(
			'rtgodam_transcoder_file_hosts',
			function () {
				return 'gdcdn.us';
			}
		);

		$this->assertSame( array(), rtgodam_get_transcoder_file_hosts() );
		$this->assertFalse( rtgodam_is_transcoder_file_url( 'https://n8e0ka87m9.gdcdn.us/job/clip.mp4' ) );
	}
}
