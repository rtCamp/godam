<?php
/**
 * Unit tests for the onboarding godam-core response parser.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Onboarding_Response;

/**
 * @covers \RTGODAM\Inc\REST_API\Onboarding_Response
 */
class OnboardingResponseTest extends TestCase {

	/** Frappe wraps success payloads under `message` — unwrap returns the inner. */
	public function test_unwrap_returns_inner_payload() {
		$this->assertSame(
			array(
				'token' => 'abc',
				'user'  => 'a@b.com',
			),
			Onboarding_Response::unwrap(
				array(
					'message' => array(
						'token' => 'abc',
						'user'  => 'a@b.com',
					),
				) 
			)
		);
	}

	/** A plain-string message is returned as-is (e.g. check_user_exists → "disabled"). */
	public function test_unwrap_returns_inner_string() {
		$this->assertSame( 'disabled', Onboarding_Response::unwrap( array( 'message' => 'disabled' ) ) );
	}

	/** Bodies without a `message` key pass through unchanged. */
	public function test_unwrap_passthrough_without_message() {
		$this->assertSame( array( 'a' => 1 ), Onboarding_Response::unwrap( array( 'a' => 1 ) ) );
	}

	/** The real develop error shape: { message: { message, error_type } }. */
	public function test_error_message_nested() {
		$body = array(
			'message' => array(
				'message'    => 'Invalid email or password.',
				'error_type' => 'AuthenticationFailed',
			),
		);
		$this->assertSame( 'Invalid email or password.', Onboarding_Response::error_message( $body ) );
	}

	/** A plain-string error message. */
	public function test_error_message_string() {
		$this->assertSame( 'Boom', Onboarding_Response::error_message( array( 'message' => 'Boom' ) ) );
	}

	/** Frappe `_server_messages` (JSON-encoded array of JSON strings). */
	public function test_error_message_server_messages() {
		$body = array(
			'_server_messages' => json_encode( array( json_encode( array( 'message' => 'Email already exists' ) ) ) ), // phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode
		);
		$this->assertSame( 'Email already exists', Onboarding_Response::error_message( $body ) );
	}

	/** No recognizable message → null (caller supplies the i18n fallback). */
	public function test_error_message_null_when_absent() {
		$this->assertNull( Onboarding_Response::error_message( array( 'foo' => 'bar' ) ) );
		$this->assertNull( Onboarding_Response::error_message( 'not-an-array' ) );
		$this->assertNull( Onboarding_Response::error_message( array( 'message' => array( 'error_type' => 'X' ) ) ) );
	}
}
