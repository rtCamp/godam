<?php
/**
 * API Key helper functions.
 *
 * Provides static utility methods for managing API key state, status,
 * and grace periods. Using a class with static methods avoids the need
 * for global function prefixing.
 *
 * @since 1.7.0
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
	 * How often an expired key past its grace period is still re-checked, so a
	 * renewed subscription is picked up without a manual refresh.
	 *
	 * @var int
	 */
	const EXPIRED_RECHECK_INTERVAL = 12 * HOUR_IN_SECONDS;

	/**
	 * Delay before retrying a check that failed because Central could not answer.
	 *
	 * @var int
	 */
	const RETRY_INTERVAL = 5 * MINUTE_IN_SECONDS;

	/**
	 * How long a key that last verified as valid keeps working while Central
	 * cannot be reached (timeouts, 5xx). A definitive answer from Central
	 * (expired, invalid) still takes effect immediately.
	 *
	 * @var int
	 */
	const LAST_KNOWN_GOOD_WINDOW = DAY_IN_SECONDS;

	/**
	 * How far past its refresh time cached user data may be served while a
	 * background refresh runs. Older data is re-verified in the request, which
	 * covers sites where WP-Cron never runs.
	 *
	 * @var int
	 */
	const BACKGROUND_REFRESH_WINDOW = 2 * HOUR_IN_SECONDS;

	/**
	 * Timeout in seconds for the verify request. On a cold cache Central runs
	 * its preflight checks before answering, which can take longer than the
	 * WordPress default of 5 seconds.
	 *
	 * @var int
	 */
	const VERIFY_TIMEOUT = 30;

	/**
	 * Get the stored API key.
	 *
	 * @since 1.7.0
	 *
	 * @return string The API key, or empty string if not set.
	 */
	public static function get_key() {
		return get_option( self::OPTION_KEY, '' );
	}

	/**
	 * Get the API key status from the database.
	 *
	 * 'valid', 'expired', and 'no_api_key' are persisted in the database.
	 * 'verification_failed' is a runtime state stored only in user-data cache.
	 * Defaults to 'no_api_key' so fresh installs and wiped keys are handled
	 * correctly without relying on the legacy 'valid' fallback.
	 *
	 * @since 1.7.0
	 *
	 * @return string One of Api_Key_Status constants.
	 */
	public static function get_status() {
		return get_option( self::STATUS_OPTION_KEY, Api_Key_Status::NO_API_KEY );
	}

	/**
	 * Set the API key status in the database.
	 *
	 * Only permanent states (valid, expired) can be persisted.
	 * States like verification_failed are handled at runtime.
	 *
	 * @since 1.7.0
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
	 * @since 1.7.0
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
	 * @since 1.7.0
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
	 * @since 1.7.0
	 */
	public static function clear_error_timestamp() {
		delete_option( self::ERROR_SINCE_OPTION_KEY );
	}

	/**
	 * Whether an HTTP status from Central means "try again later" rather than
	 * an answer about the key: any 5xx, a timeout (408) or a rate limit (429).
	 *
	 * @param int|string $status_code HTTP status code.
	 *
	 * @return bool
	 */
	public static function is_retryable_status( $status_code ) {
		$status_code = (int) $status_code;

		return $status_code >= 500 || in_array( $status_code, array( 408, 429 ), true );
	}
}
