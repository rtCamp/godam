<?php
/**
 * Pure parsing helpers for godam-core (Frappe) responses.
 *
 * Kept dependency-free (no WordPress functions) so the response-shape logic —
 * which is the most bug-prone part of the onboarding proxy — can be unit-tested
 * without a WordPress bootstrap. The WP layer (Onboarding) handles i18n + HTTP.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class Onboarding_Response
 */
class Onboarding_Response {

	/**
	 * Unwrap Frappe's top-level `message` envelope from a success response.
	 *
	 * @param mixed $body Decoded response body.
	 * @return mixed Inner payload (or the body unchanged when not wrapped).
	 */
	public static function unwrap( $body ) {
		return ( is_array( $body ) && array_key_exists( 'message', $body ) ) ? $body['message'] : $body;
	}

	/**
	 * Extract a human-readable error string from a godam-core error body.
	 *
	 * Handles the shapes godam-core actually returns:
	 *  - `{ message: { message, error_type } }` (nested — the common case)
	 *  - `{ message: "..." }` (plain string)
	 *  - `{ _server_messages: "[\"{...}\"]" }` (Frappe server messages)
	 *
	 * @param mixed $body Decoded response body.
	 * @return string|null The message, or null when none can be found.
	 */
	public static function error_message( $body ) {
		if ( ! is_array( $body ) ) {
			return null;
		}

		$inner = isset( $body['message'] ) ? $body['message'] : null;

		if ( is_array( $inner ) && isset( $inner['message'] ) && is_string( $inner['message'] ) ) {
			return $inner['message'];
		}

		if ( is_string( $inner ) && '' !== $inner ) {
			return $inner;
		}

		if ( ! empty( $body['_server_messages'] ) ) {
			$messages = json_decode( (string) $body['_server_messages'], true );
			if ( is_array( $messages ) && ! empty( $messages[0] ) ) {
				$first = json_decode( (string) $messages[0], true );
				if ( isset( $first['message'] ) && is_string( $first['message'] ) ) {
					return trim( wp_strip_all_tags( $first['message'] ) );
				}
			}
		}

		return null;
	}
}
