<?php
/**
 * Tests that godam/import-media-from-url only downloads from public addresses.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Library_Abilities;

/**
 * An Author can call the import, and it saves what it downloads in the public
 * uploads folder. Core's wp_http_validate_url() let link-local (169.254.0.0/16,
 * the cloud metadata service) and CGNAT addresses through before WordPress
 * 6.9.6 and 7.0.3, so the ability checks every address itself, including
 * where a host name resolves to and where a redirect leads.
 *
 * Runs in its own process because it defines core functions.
 *
 * @covers \RTGODAM\Inc\Abilities\Library_Abilities::import_media_from_url
 * @covers \RTGODAM\Inc\Abilities\Library_Abilities::public_addresses
 * @covers \RTGODAM\Inc\Abilities\Library_Abilities::resolve_host
 * @covers \RTGODAM\Inc\Abilities\Library_Abilities::pin_entry
 * @covers \RTGODAM\Inc\Abilities\Library_Abilities::is_public_ip
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class ImportMediaPublicUrlTest extends TestCase {

	/**
	 * Loads the ability with stubs; host names resolve through `$dns`.
	 *
	 * @param array $dns Host name => list of IP addresses.
	 *
	 * @return Library_Abilities
	 */
	private function ability( array $dns = array() ) {
		$GLOBALS['rtgodam_stub'] = array(
			'options'   => array(),
			'downloads' => array(),
			'dns'       => $dns,
			'home_url'  => 'https://site.test',
		);

		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-abilities.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-library-abilities.php';
		require_once dirname( __DIR__ ) . '/stubs/hooks.php';

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		if ( ! function_exists( 'esc_url_raw' ) ) {
			eval( 'function esc_url_raw( $url, $protocols = null ) { return (string) $url; }' ); }
		if ( ! function_exists( 'wp_http_validate_url' ) ) {
			// Core before 6.9.6 / 7.0.3: link-local and CGNAT pass.
			eval( 'function wp_http_validate_url( $url ) { return $url; }' ); }
		if ( ! function_exists( 'wp_parse_url' ) ) {
			eval( 'function wp_parse_url( $url, $component = -1 ) { return parse_url( $url, $component ); }' ); }
		if ( ! function_exists( 'home_url' ) ) {
			eval( 'function home_url() { return "https://site.test"; }' ); }
		if ( ! function_exists( 'wp_max_upload_size' ) ) {
			eval( 'function wp_max_upload_size() { return 1000; }' ); }
		eval(
			'function download_url( $url ) {
				$GLOBALS["rtgodam_stub"]["downloads"][] = $url;
				$GLOBALS["rtgodam_stub"]["redirect_checks"] = array_values( $GLOBALS["rtgodam_hooks"]["requests-requests.before_redirect"][10] ?? array() );
				$GLOBALS["rtgodam_stub"]["pins"] = array_values( $GLOBALS["rtgodam_hooks"]["http_api_curl"][10] ?? array() );
				return new WP_Error( "http_404", "Not Found", array( "code" => 404, "body" => "secret body" ) );
			}'
		);
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		return new class() extends Library_Abilities {

			/**
			 * Skips the parent's hooks.
			 */
			public function __construct() {}

			/**
			 * Resolves from the test's table instead of DNS.
			 *
			 * @param string $host Host.
			 *
			 * @return string[]
			 */
			protected function resolve_host( $host ) {
				if ( filter_var( $host, FILTER_VALIDATE_IP ) ) {
					return array( $host );
				}

				return $GLOBALS['rtgodam_stub']['dns'][ $host ] ?? array();
			}

			/**
			 * Exposes the protected check.
			 *
			 * @param string $url URL.
			 *
			 * @return bool
			 */
			public function public_url( $url ) {
				return null !== $this->public_addresses( $url );
			}
		};
	}

	/**
	 * Addresses that must never be downloaded from.
	 *
	 * @return array
	 */
	public function internal_urls() {
		return array(
			'cloud metadata'           => array( 'http://169.254.169.254/latest/meta-data/iam/security-credentials/role' ),
			'CGNAT'                    => array( 'http://100.64.0.1/' ),
			'private'                  => array( 'http://10.0.0.5/file.mp4' ),
			'loopback'                 => array( 'http://127.0.0.1/file.mp4' ),
			'IPv6 loopback'            => array( 'http://[::1]/file.mp4' ),
			'IPv6 unique local'        => array( 'http://[fd00::1]/file.mp4' ),
			'IPv6 link-local'          => array( 'http://[fe80::1]/file.mp4' ),
			'IPv4-mapped metadata'     => array( 'http://[::ffff:169.254.169.254]/x' ),
			'name to metadata address' => array( 'http://metadata.attacker.test/x.mp4' ),
			'name to a mix'            => array( 'http://mixed.attacker.test/x.mp4' ),
			'name that does not exist' => array( 'http://nothing.attacker.test/x.mp4' ),
		);
	}

	/**
	 * An internal address is refused before anything is downloaded.
	 *
	 * @dataProvider internal_urls
	 *
	 * @param string $url URL.
	 *
	 * @return void
	 */
	public function test_an_internal_address_is_refused_before_download( $url ) {
		$result = $this->ability(
			array(
				'metadata.attacker.test' => array( '169.254.169.254' ),
				'mixed.attacker.test'    => array( '93.184.215.14', '10.1.2.3' ),
			)
		)->import_media_from_url( array( 'url' => $url ) );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'rtgodam_invalid_url', $result->get_error_code() );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['downloads'], 'Nothing is downloaded.' );
	}

	/**
	 * A public host is downloaded from, and a failed download does not read back the response body.
	 *
	 * @return void
	 */
	public function test_a_public_host_is_downloaded_and_errors_carry_no_body() {
		$result = $this->ability( array( 'cdn.example.com' => array( '93.184.215.14' ) ) )
			->import_media_from_url( array( 'url' => 'https://cdn.example.com/clip.mp4' ) );

		$this->assertSame( array( 'https://cdn.example.com/clip.mp4' ), $GLOBALS['rtgodam_stub']['downloads'] );
		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'http_404', $result->get_error_code() );
		$this->assertSame( array( 'status' => 400 ), $result->get_error_data(), 'The response body is not handed back.' );
	}

	/**
	 * The site's own host stays allowed, as core allows it.
	 *
	 * @return void
	 */
	public function test_the_sites_own_host_is_allowed() {
		$this->assertTrue( $this->ability()->public_url( 'https://site.test/wp-content/uploads/a.mp4' ) );
	}

	/**
	 * A redirect to an internal address stops the download.
	 *
	 * @return void
	 */
	public function test_a_redirect_to_an_internal_address_is_stopped() {
		if ( ! class_exists( 'WpOrg\Requests\Exception' ) ) {
			eval( 'namespace WpOrg\Requests; class Exception extends \Exception { public function __construct( $message, $type ) { parent::__construct( $message ); } }' ); // phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
		}

		$ability = $this->ability( array( 'cdn.example.com' => array( '93.184.215.14' ) ) );

		$ability->import_media_from_url( array( 'url' => 'https://cdn.example.com/clip.mp4' ) );

		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['redirect_checks'], 'A redirect check is in place during the download.' );
		$this->assertArrayNotHasKey( 0, $GLOBALS['rtgodam_hooks']['requests-requests.before_redirect'][10] ?? array(), 'It is removed afterwards.' );

		$check = $GLOBALS['rtgodam_stub']['redirect_checks'][0];
		$check( 'https://cdn.example.com/other.mp4' );

		$stopped = '';

		try {
			$check( 'http://169.254.169.254/latest/meta-data/' );
		} catch ( \Exception $e ) {
			$stopped = get_class( $e );
		}

		$this->assertSame( 'WpOrg\Requests\Exception', $stopped, 'The redirect is stopped the way core stops an invalid one.' );
	}

	/**
	 * The download is pinned to the checked addresses while it runs, so a host
	 * that answers a second lookup with an internal address (DNS rebinding) is
	 * not followed there.
	 *
	 * @return void
	 */
	public function test_the_download_is_pinned_to_the_checked_addresses() {
		$this->ability( array( 'cdn.example.com' => array( '93.184.215.14' ) ) )
			->import_media_from_url( array( 'url' => 'https://cdn.example.com/clip.mp4' ) );

		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['pins'], 'The addresses are pinned during the download.' );
		$this->assertSame( array(), $GLOBALS['rtgodam_hooks']['http_api_curl'][10] ?? array(), 'The pin is removed afterwards.' );
	}

	/**
	 * The entry cURL is given for a checked host.
	 *
	 * @return void
	 */
	public function test_pin_entries() {
		$this->ability();

		$this->assertSame( 'cdn.example.com:443:93.184.215.14,2606:4700:4700::1111', Library_Abilities::pin_entry( 'https://CDN.example.com/clip.mp4', array( '93.184.215.14', '2606:4700:4700::1111' ) ) );
		$this->assertSame( 'cdn.example.com:80:93.184.215.14', Library_Abilities::pin_entry( 'http://cdn.example.com/clip.mp4', array( '93.184.215.14' ) ) );
		$this->assertSame( 'cdn.example.com:8080:93.184.215.14', Library_Abilities::pin_entry( 'http://cdn.example.com:8080/clip.mp4', array( '93.184.215.14' ) ) );
		$this->assertSame( '', Library_Abilities::pin_entry( 'https://93.184.215.14/clip.mp4', array( '93.184.215.14' ) ), 'An IP address needs no pin.' );
		$this->assertSame( '', Library_Abilities::pin_entry( 'https://site.test/clip.mp4', array() ), 'The site itself is not pinned.' );
	}

	/**
	 * A host the site owner allowed with core's filter can be imported from,
	 * as core's own requests can reach it. Without the filter it is refused.
	 *
	 * @return void
	 */
	public function test_a_host_allowed_with_cores_filter_is_allowed() {
		$ability = $this->ability( array( 'media.lan' => array( '10.0.0.5' ) ) );

		$this->assertFalse( $ability->public_url( 'http://media.lan/clip.mp4' ) );

		$allow = function ( $external, $host ) {
			return 'media.lan' === $host ? true : $external;
		};
		add_filter( 'http_request_host_is_external', $allow );

		$this->assertTrue( $ability->public_url( 'http://media.lan/clip.mp4' ), 'The allowed host passes.' );
		$this->assertFalse( $ability->public_url( 'http://169.254.169.254/latest/meta-data/' ), 'Another internal host is still refused.' );

		remove_filter( 'http_request_host_is_external', $allow );
	}

	/**
	 * The download may connect over IPv6, so a host whose IPv6 addresses
	 * cannot be read is refused instead of being checked on IPv4 alone.
	 *
	 * @return void
	 */
	public function test_a_host_whose_ipv6_lookup_fails_is_refused() {
		$ability = $this->ability();

		// The class calls these without a namespace, so stubs in its namespace are used.
		eval( 'namespace RTGODAM\\Inc\\Abilities; function gethostbynamel( $host ) { return $GLOBALS["rtgodam_stub"]["a"]; } function dns_get_record( $host, $type ) { return $GLOBALS["rtgodam_stub"]["aaaa"]; }' ); // phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.

		$resolve = new \ReflectionMethod( Library_Abilities::class, 'resolve_host' );
		if ( PHP_VERSION_ID < 80100 ) {
			$resolve->setAccessible( true );
		}

		$GLOBALS['rtgodam_stub']['a']    = array( '93.184.215.14' );
		$GLOBALS['rtgodam_stub']['aaaa'] = false;
		$this->assertSame( array(), $resolve->invoke( $ability, 'cdn.example.com' ), 'A failed IPv6 lookup gives no addresses, so the host is refused.' );

		$GLOBALS['rtgodam_stub']['aaaa'] = array();
		$this->assertSame( array( '93.184.215.14' ), $resolve->invoke( $ability, 'cdn.example.com' ), 'A host with no IPv6 address is checked on IPv4.' );

		$GLOBALS['rtgodam_stub']['aaaa'] = array( array( 'ipv6' => 'fd00:ec2::254' ) );
		$this->assertSame( array( '93.184.215.14', 'fd00:ec2::254' ), $resolve->invoke( $ability, 'cdn.example.com' ), 'IPv6 addresses are checked too.' );
	}

	/**
	 * The address rules on their own.
	 *
	 * @return void
	 */
	public function test_public_ip_rules() {
		$this->ability();

		foreach ( array( '93.184.215.14', '8.8.8.8', '2606:4700:4700::1111', '::ffff:8.8.8.8', '::ffff:808:808', '64:ff9b::808:808', '2002:808:808::1' ) as $ip ) {
			$this->assertTrue( Library_Abilities::is_public_ip( $ip ), $ip );
		}

		foreach ( array( '169.254.169.254', '100.64.0.1', '100.127.255.255', '10.0.0.1', '172.16.0.1', '192.168.1.1', '127.0.0.1', '0.0.0.0', '192.0.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', 'not-an-ip' ) as $ip ) {
			$this->assertFalse( Library_Abilities::is_public_ip( $ip ), $ip );
		}
	}

	/**
	 * An IPv6 address that carries an internal IPv4 address is refused however
	 * it is written. PHP before 8.2 compares IPv6 addresses as text, so the hex
	 * spelling a DNS lookup returns (::ffff:a9fe:a9fe) used to pass there.
	 *
	 * @return void
	 */
	public function test_an_internal_ipv4_address_inside_ipv6_is_refused() {
		$this->ability();

		$carried = array(
			'::ffff:a9fe:a9fe',              // IPv4-mapped 169.254.169.254, in hex.
			'::FFFF:A9FE:A9FE',
			'0:0:0:0:0:ffff:a9fe:a9fe',
			'::ffff:7f00:1',                 // IPv4-mapped 127.0.0.1.
			'::ffff:a00:5',                  // IPv4-mapped 10.0.0.5.
			'::ffff:6440:1',                 // IPv4-mapped 100.64.0.1 (CGNAT).
			'::169.254.169.254',             // IPv4-compatible.
			'0:0:0:0:0:0:0:1',               // Loopback, written out.
			'64:ff9b::a9fe:a9fe',            // NAT64.
			'64:ff9b::10.0.0.5',
			'2002:a9fe:a9fe::1',             // 6to4.
			'2002:7f00:1::1',
		);

		foreach ( $carried as $ip ) {
			$this->assertFalse( Library_Abilities::is_public_ip( $ip ), $ip );
		}
	}
}
