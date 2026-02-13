<?php
/**
 * API Key Status enum class.
 *
 * Acts as a PHP enum for API key statuses since PHP native enums
 * require PHP 8.1+ which may not be available in all environments.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Enums;

defined( 'ABSPATH' ) || exit;

/**
 * Class Api_Key_Status
 *
 * Represents the possible states of an API key.
 *
 * VALID: API key is verified and working.
 * EXPIRED: API key was previously valid but has expired.
 * VERIFICATION_FAILED: Temporary server error during verification (stored in user data cache).
 */
class Api_Key_Status {

	/**
	 * API key is verified and working.
	 *
	 * @var string
	 */
	const VALID = 'valid';

	/**
	 * API key was previously valid but has expired.
	 *
	 * @var string
	 */
	const EXPIRED = 'expired';

	/**
	 * Temporary server error during API key verification.
	 *
	 * This status is NOT persisted in the database. It is a runtime state
	 * stored in the user data cache to indicate a temporary verification failure.
	 *
	 * @var string
	 */
	const VERIFICATION_FAILED = 'verification_failed';

	/**
	 * Get the status message for a given API key status.
	 *
	 * @param string $status The API key status.
	 *
	 * @return string The human-readable status message.
	 */
	public static function get_message( $status ) {
		$messages = self::get_all_messages();

		return $messages[ $status ] ?? __( 'API key status refreshed.', 'godam' );
	}

	/**
	 * Get all status messages.
	 *
	 * @return array Associative array of status => message.
	 */
	public static function get_all_messages() {
		return array(
			self::VALID               => __( 'API key is valid and active.', 'godam' ),
			self::EXPIRED             => __( 'API key has expired. Please renew your subscription.', 'godam' ),
			self::VERIFICATION_FAILED => __( 'Unable to verify API key. Please try again later.', 'godam' ),
		);
	}

	/**
	 * Get all valid statuses.
	 *
	 * @return array List of all valid status values.
	 */
	public static function get_all() {
		return array(
			self::VALID,
			self::EXPIRED,
			self::VERIFICATION_FAILED,
		);
	}

	/**
	 * Get statuses that can be persisted to the database.
	 *
	 * Only permanent states can be saved. VERIFICATION_FAILED is transient.
	 *
	 * @return array List of persistable status values.
	 */
	public static function get_persistable() {
		return array(
			self::VALID,
			self::EXPIRED,
		);
	}

	/**
	 * Check if a given status value is valid.
	 *
	 * @param string $status The status to validate.
	 *
	 * @return bool True if valid, false otherwise.
	 */
	public static function is_valid( $status ) {
		return in_array( $status, self::get_all(), true );
	}
}
