<?php
/**
 * Marketo reads its account details from GoDAM Central, never from local fields.
 *
 * GoDAM Central is the single source of truth for the Marketo connection: the
 * account details (Munchkin ID, forms host, reCAPTCHA key) ride along in the
 * `map` block of the cached `verify_api_key` response, stored in the
 * `rtgodam_user_data` option. These cover how `Marketo` derives the forms2 host
 * from that block and when a form may render, with the option stubbed per case.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Marketo;

require_once dirname( __DIR__, 2 ) . '/inc/classes/class-marketo.php';

/**
 * @covers \RTGODAM\Inc\Marketo
 */
class MarketoConfigTest extends TestCase {

	/**
	 * Start every case with no options set.
	 */
	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_stub'] = array( 'options' => array() );
	}

	/**
	 * Leave no stub state behind.
	 */
	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Put a Marketo block into the cached licence response.
	 *
	 * @param array $marketo The `map.marketo` block.
	 */
	private function set_central( array $marketo ): void {
		$GLOBALS['rtgodam_stub']['options']['rtgodam_user_data'] = array(
			'user_data' => array( 'map' => array( 'marketo' => $marketo ) ),
		);
	}

	/**
	 * Set the site-level on/off switch.
	 *
	 * @param bool $enabled Whether the integration is enabled.
	 */
	private function set_enabled( bool $enabled ): void {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-settings'] = array(
			'integrations' => array( 'marketo' => array( 'enable' => $enabled ) ),
		);
	}

	/**
	 * A saved forms host is used as-is (protocol-relative).
	 */
	public function test_instance_host_uses_forms_host(): void {
		$this->set_central( array( 'forms_host' => 'app-sj04.marketo.com' ) );

		$this->assertSame( '//app-sj04.marketo.com', Marketo::get_instance_host() );
	}

	/**
	 * A forms host pasted with a scheme and a path is reduced to the bare host.
	 */
	public function test_instance_host_strips_scheme_and_path(): void {
		$this->set_central( array( 'forms_host' => 'https://app-sj04.marketo.com/js/forms2/' ) );

		$this->assertSame( '//app-sj04.marketo.com', Marketo::get_instance_host() );
	}

	/**
	 * A bare forms host (no dot) gets the `.mktoweb.com` suffix.
	 */
	public function test_instance_host_appends_mktoweb_to_bare_host(): void {
		$this->set_central( array( 'forms_host' => 'sj04' ) );

		$this->assertSame( '//sj04.mktoweb.com', Marketo::get_instance_host() );
	}

	/**
	 * With no forms host, the host is derived from the Munchkin ID, lowercased.
	 */
	public function test_instance_host_falls_back_to_munchkin(): void {
		$this->set_central( array( 'munchkin_id' => '123-ABC-456' ) );

		$this->assertSame( '//123-abc-456.mktoweb.com', Marketo::get_instance_host() );
	}

	/**
	 * Nothing connected: no host.
	 */
	public function test_instance_host_empty_when_not_connected(): void {
		$this->assertSame( '', Marketo::get_instance_host() );
	}

	/**
	 * Connected on Central means a non-empty Munchkin ID in the block.
	 */
	public function test_is_central_connected_tracks_munchkin_id(): void {
		$this->assertFalse( Marketo::is_central_connected() );

		$this->set_central( array( 'munchkin_id' => '123-ABC-456' ) );
		$this->assertTrue( Marketo::is_central_connected() );
	}

	/**
	 * The Munchkin ID and reCAPTCHA key are read straight from the block.
	 */
	public function test_reads_munchkin_and_recaptcha_from_central(): void {
		$this->set_central(
			array(
				'munchkin_id'        => '123-ABC-456',
				'recaptcha_site_key' => '6LcTEST',
			)
		);

		$this->assertSame( '123-ABC-456', Marketo::get_munchkin_id() );
		$this->assertSame( '6LcTEST', Marketo::get_recaptcha_key() );
	}

	/**
	 * A form renders only when the integration is enabled and Marketo is
	 * connected on Central (which yields a host).
	 */
	public function test_is_configured_requires_enabled_and_connected(): void {
		// Enabled but not connected.
		$this->set_enabled( true );
		$this->assertFalse( Marketo::is_configured() );

		// Enabled and connected.
		$this->set_central( array( 'munchkin_id' => '123-ABC-456' ) );
		$this->assertTrue( Marketo::is_configured() );

		// Connected but switched off.
		$this->set_enabled( false );
		$this->assertFalse( Marketo::is_configured() );
	}
}
