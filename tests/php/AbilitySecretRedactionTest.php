<?php
/**
 * Tests that no ability result or error carries the GoDAM API key or account token.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Abilities;

require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-abilities.php';
require_once dirname( __DIR__ ) . '/stubs/abilities-functions.php';
require_once dirname( __DIR__ ) . '/stubs/class-test-ability-group.php';

/**
 * Every execute callback is wrapped so the key and token are replaced in
 * strings, arrays, objects and WP_Error messages and data, even when a route
 * or GoDAM Central put them there.
 *
 * @covers \RTGODAM\Inc\Abilities\Ability_Group
 */
class AbilitySecretRedactionTest extends TestCase {

	const KEY   = 'gdk_live_1234567890abcdef';
	const TOKEN = 'tok_9f8e7d6c5b4a3210';

	/**
	 * Sets a key and token on the site.
	 *
	 * @return void
	 */
	protected function setUp(): void {
		$GLOBALS['rtgodam_stub'] = array(
			'options'   => array(
				Abilities::MCP_ENABLED_OPTION => '1',
				'rtgodam-api-key'             => self::KEY,
				'rtgodam-account-token'       => self::TOKEN,
			),
			'caps'      => array(),
			'abilities' => array(),
		);
	}

	/**
	 * Registers an ability whose callback returns $result, runs it and returns the output.
	 *
	 * @param mixed $result What the raw callback returns.
	 *
	 * @return mixed
	 */
	private function run_ability( $result ) {
		( new Test_Ability_Group() )->add_for_test(
			'godam/test-ability',
			array(
				'execute_callback' => static function () use ( $result ) {
					return $result;
				},
			)
		);

		return call_user_func( $GLOBALS['rtgodam_stub']['abilities']['godam/test-ability']['execute_callback'], array() );
	}

	/**
	 * Strings, nested arrays and objects lose the key and token.
	 *
	 * @return void
	 */
	public function test_results_are_redacted() {
		$out  = $this->run_ability(
			array(
				'message' => 'Central said: key ' . self::KEY . ' rejected',
				'nested'  => array( array( 'token' => self::TOKEN ) ),
				'object'  => (object) array( 'raw' => 'Bearer ' . self::TOKEN ),
			)
		);
		$json = wp_json_encode( $out );

		$this->assertStringNotContainsString( self::KEY, $json );
		$this->assertStringNotContainsString( self::TOKEN, $json );
		$this->assertStringContainsString( 'Central said: key [redacted] rejected', $json );
	}

	/**
	 * A WP_Error's message and data lose them too, and the code is kept.
	 *
	 * @return void
	 */
	public function test_errors_are_redacted() {
		$out = $this->run_ability( new \WP_Error( 'godam_api_error', 'Invalid key ' . self::KEY, array( 'body' => 'token=' . self::TOKEN ) ) );

		$this->assertInstanceOf( \WP_Error::class, $out );
		$this->assertSame( 'godam_api_error', $out->get_error_code() );
		$this->assertSame( 'Invalid key [redacted]', $out->get_error_message() );
		$this->assertStringNotContainsString( self::TOKEN, wp_json_encode( $out->get_error_data() ) );
	}

	/**
	 * Placeholder values such as "unverified" are left alone.
	 *
	 * @return void
	 */
	public function test_placeholders_are_not_redacted() {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-account-token'] = 'unverified';
		$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key']       = '';

		$this->assertSame( array( 'status' => 'unverified' ), $this->run_ability( array( 'status' => 'unverified' ) ) );
	}
}
