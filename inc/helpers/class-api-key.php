<?php
/**
 * API Key helper functions.
 *
 * Provides static utility methods for managing API key state, status,
 * and grace periods. Using a class with static methods avoids the need
 * for global function prefixing.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Helpers;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Enums\Api_Key_Status;

/**
 * Class Api_Key
 *
 * Utility class for API key management operations.
 */
class Api_Key {

	/**
	 * Option key for the API key.
	 *
	 * @var string
	 */
	const OPTION_KEY = 'rtgodam-api-key';

	/**
	 * Option key for the API key status.
	 *
	 * @var string
	 */
	const STATUS_OPTION_KEY = 'rtgodam-api-key-status';

	/**
	 * Option key for the API key error timestamp.
	 *
	 * @var string
	 */
	const ERROR_SINCE_OPTION_KEY = 'rtgodam-api-key-error-since';

	/**
	 * Grace period for invalid API keys in seconds (4 hours).
	 *
	 * @var int
	 */
	const GRACE_PERIOD = 4 * HOUR_IN_SECONDS;

	/**
	 * Get the stored API key.
	 *
	 * @since n.e.x.t
	 *
	 * @return string The API key, or empty string if not set.
	 */
	public static function get_key() {
		return get_option( self::OPTION_KEY, '' );
	}

	/**
	 * Get the API key status from the database.
	 *
	 * Only 'valid' and 'expired' are persisted in the database.
	 * 'verification_failed' is a runtime state.
	 *
	 * @since n.e.x.t
	 *
	 * @return string One of Api_Key_Status constants.
	 */
	public static function get_status() {
		return get_option( self::STATUS_OPTION_KEY, Api_Key_Status::VERIFICATION_FAILED );
	}

	/**
	 * Set the API key status in the database.
	 *
	 * Only permanent states (valid, expired) can be persisted.
	 * States like verification_failed are handled at runtime.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $status Status to set. Must be a persistable Api_Key_Status constant.
	 *
	 * @return bool Whether the option was updated.
	 */
	public static function set_status( $status ) {
		if ( ! in_array( $status, Api_Key_Status::get_persistable(), true ) ) {
			return false;
		}

		return update_option( self::STATUS_OPTION_KEY, $status );
	}

	/**
	 * Check if API key is in grace period.
	 *
	 * Grace period only applies to EXPIRED keys to reduce unnecessary verification attempts.
	 * When an API key expires, we allow a grace period before stopping automatic checks.
	 * After the grace period, automatic verification is paused until manual refresh.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool True if in grace period (should not skip verification), false otherwise.
	 */
	public static function is_in_grace_period() {
		$status = self::get_status();

		if ( Api_Key_Status::EXPIRED !== $status ) {
			return false;
		}

		$error_since = get_option( self::ERROR_SINCE_OPTION_KEY, 0 );

		if ( empty( $error_since ) ) {
			return true;
		}

		$elapsed = time() - $error_since;

		return $elapsed < self::GRACE_PERIOD;
	}

	/**
	 * Mark API key as expired and set timestamp.
	 *
	 * @since n.e.x.t
	 */
	public static function mark_expired() {
		self::set_status( Api_Key_Status::EXPIRED );

		$error_since = get_option( self::ERROR_SINCE_OPTION_KEY, 0 );
		if ( empty( $error_since ) ) {
			update_option( self::ERROR_SINCE_OPTION_KEY, time() );
		}
	}

	/**
	 * Clear API key error timestamp.
	 *
	 * @since n.e.x.t
	 */
	public static function clear_error_timestamp() {
		delete_option( self::ERROR_SINCE_OPTION_KEY );
	}
}
