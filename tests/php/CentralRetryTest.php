<?php
/**
 * Tests which GoDAM Central errors the Central media abilities retry.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Library_Abilities;

require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-library-abilities.php';

/**
 * Only a server or connection fault is retried; a 4xx such as a revoked key is not.
 *
 * @covers \RTGODAM\Inc\Abilities\Library_Abilities::is_retryable_central_error
 */
class CentralRetryTest extends TestCase {

	/**
	 * Server and connection faults get one more try.
	 *
	 * @return void
	 */
	public function test_server_faults_are_retried() {
		$this->assertTrue( Library_Abilities::is_retryable_central_error( new \WP_Error( 'x', 'GoDAM Central did not return the media list.', array( 'status' => 502 ) ) ) );
		$this->assertTrue( Library_Abilities::is_retryable_central_error( new \WP_Error( 'http_request_failed', 'cURL error 28: Operation timed out' ) ) );
	}

	/**
	 * A 4xx from Central comes back the same, so it is not retried.
	 *
	 * @return void
	 */
	public function test_client_errors_are_not_retried() {
		$this->assertFalse( Library_Abilities::is_retryable_central_error( new \WP_Error( 'x', 'GoDAM API returned HTTP status: 401', array( 'status' => 500 ) ) ) );
		$this->assertFalse( Library_Abilities::is_retryable_central_error( new \WP_Error( 'x', 'Forbidden', array( 'status' => 403 ) ) ) );
	}
}
