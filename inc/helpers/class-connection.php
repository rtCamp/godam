<?php
/**
 * The site's GoDAM connection status, as GoDAM Central reports it.
 *
 * @see https://github.com/rtCamp/godam-plugin-wp/issues/101
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Helpers;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Enums\Api_Key_Status;
use RTGODAM\Inc\Enums\Connection_Status;

/**
 * One connection status for GoDAM and GoDAM for WooCommerce.
 *
 * Before this the plugins only knew "valid key or not", so a lapsed trial was sent to
 * signup instead of renewal and Woo couldn't tell an expired plan from a missing key.
 * Central now sends `connection_status`, `trial_ends_at` and (when it knows)
 * `expired_at` and `organization` with every `verify_api_key` answer: 200, 401 and 403.
 * They are stored here; on an older Central that doesn't send them, the status is
 * worked out from the key status, as before.
 *
 * The status describes the plan, for choosing the screen (connect, renewal, trial days).
 * It doesn't switch features on or off: whether this site may use the key is still the
 * key status, rtgodam_is_api_key_valid(). The two can differ: a cancelled subscription on
 * an active licence is `expired` while the key still works, and a site that isn't on the
 * key's allowed sites can't use a key whose plan is `connected`.
 *
 * @since n.e.x.t
 */
class Connection {

	/**
	 * Option holding the last answer from Central.
	 *
	 * @var string
	 */
	const OPTION_KEY = 'rtgodam-connection';

	/**
	 * Option set when an administrator dismisses the "subscription has ended" notice.
	 *
	 * @var string
	 */
	const SUBSCRIPTION_ENDED_DISMISSED_OPTION_KEY = 'rtgodam-subscription-ended-notice-dismissed';

	/**
	 * Remember what Central said about the stored key.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $message   The `message` of Central's `verify_api_key` answer.
	 * @param bool  $succeeded Whether Central accepted the key (HTTP 200).
	 *
	 * @return void
	 */
	public static function record( $message, $succeeded ) {
		$message = is_array( $message ) ? $message : array();
		$status  = isset( $message['connection_status'] ) ? sanitize_key( $message['connection_status'] ) : '';

		if ( ! in_array( $status, Connection_Status::from_central(), true ) ) {
			// An older Central: only a success says anything for sure.
			$status = $succeeded ? Connection_Status::CONNECTED : '';
		} elseif ( $succeeded && Connection_Status::NONE === $status ) {
			// The key works but Central has no subscription to read yet (one still being
			// set up). The connect screen would be wrong: the key status decides instead.
			$status = '';
		}

		// Central refusing this site (it isn't on the key's allowed sites) still sends the
		// plan's real status: connected, trial or expired. Kept as sent. Whether this site
		// may use the key is the key status (rtgodam_is_api_key_valid()), not this.

		// A dismissed "subscription has ended" notice comes back for the next lapse.
		if ( Connection_Status::EXPIRED !== $status ) {
			delete_option( self::SUBSCRIPTION_ENDED_DISMISSED_OPTION_KEY );
		}

		update_option(
			self::OPTION_KEY,
			array(
				'status'        => $status,
				'trial_ends_at' => Connection_Status::TRIAL === $status ? self::to_timestamp( $message['trial_ends_at'] ?? '' ) : 0,
				'expired_at'    => Connection_Status::EXPIRED === $status ? self::to_timestamp( $message['expired_at'] ?? '' ) : 0,
				'organization'  => isset( $message['organization'] ) ? sanitize_text_field( (string) $message['organization'] ) : self::get_organization(),
				'updated'       => time(),
			),
			false
		);
	}

	/**
	 * Forget what Central said, when the key is removed.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public static function clear() {
		delete_option( self::OPTION_KEY );
		delete_option( self::SUBSCRIPTION_ENDED_DISMISSED_OPTION_KEY );
	}

	/**
	 * Whether to ask the administrator to renew a subscription that ended while the licence
	 * still works: Pro features keep working, so it's a dismissible notice, not a screen.
	 *
	 * @since n.e.x.t
	 *
	 * @param array|null $user_data The cached user data, when the caller already has it.
	 *
	 * @return bool
	 */
	public static function should_show_subscription_ended_notice( $user_data = null ) {
		if ( null === $user_data ) {
			$user_data = rtgodam_get_user_data();
		}

		return Connection_Status::EXPIRED === self::get_status( $user_data )
			&& ! empty( $user_data['valid_api_key'] )
			&& ! get_option( self::SUBSCRIPTION_ENDED_DISMISSED_OPTION_KEY, false );
	}

	/**
	 * Hide the "subscription has ended" notice until the subscription lapses again.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public static function dismiss_subscription_ended_notice() {
		update_option( self::SUBSCRIPTION_ENDED_DISMISSED_OPTION_KEY, time(), false );
	}

	/**
	 * The site's connection status.
	 *
	 * @since n.e.x.t
	 *
	 * @param array|null $user_data The cached user data (rtgodam_get_user_data()), when the
	 *                              caller already has it. Read when null.
	 *
	 * @return string One of the Connection_Status constants.
	 */
	public static function get_status( $user_data = null ) {
		if ( '' === (string) Api_Key::get_key() ) {
			return Connection_Status::NONE;
		}

		if ( null === $user_data ) {
			$user_data = rtgodam_get_user_data();
		}

		// The last check couldn't reach Central. While the last good answer is still
		// trusted the site keeps working (rtgodam_keep_user_data_after_failed_check()).
		if ( is_array( $user_data ) && ! empty( $user_data['retry_at'] ) ) {
			return Connection_Status::UNREACHABLE;
		}

		$stored = self::get_stored();

		if ( '' !== $stored['status'] ) {
			return $stored['status'];
		}

		switch ( Api_Key::get_status() ) {
			case Api_Key_Status::VALID:
				return Connection_Status::CONNECTED;
			case Api_Key_Status::EXPIRED:
				return Connection_Status::EXPIRED;
			default:
				return Connection_Status::NONE;
		}
	}

	/**
	 * When the trial ends, as a Unix time.
	 *
	 * @since n.e.x.t
	 *
	 * @return int 0 when the site isn't on a trial or Central didn't say.
	 */
	public static function get_trial_ends_at() {
		$stored = self::get_stored();

		return Connection_Status::TRIAL === $stored['status'] ? $stored['trial_ends_at'] : 0;
	}

	/**
	 * Days left in the trial: 0 on its last day.
	 *
	 * Central sends the trial's last day as that date's UTC midnight, to be read as a
	 * calendar date, not an instant. So this counts calendar days from today in the
	 * site's timezone; counting seconds would show a day short west of UTC.
	 *
	 * @since n.e.x.t
	 *
	 * @return int|null Null when the site isn't on a trial or Central didn't say when it ends.
	 */
	public static function get_trial_days_left() {
		$ends_at = self::get_trial_ends_at();

		if ( ! $ends_at ) {
			return null;
		}

		$last_day = gmdate( 'Y-m-d', $ends_at );
		$today    = function_exists( 'wp_date' ) ? wp_date( 'Y-m-d' ) : gmdate( 'Y-m-d' );
		$days     = (int) round( ( strtotime( $last_day . ' UTC' ) - strtotime( $today . ' UTC' ) ) / DAY_IN_SECONDS );

		return max( 0, $days );
	}

	/**
	 * When the licence stopped working on this site, as a Unix time: the start of Woo's
	 * grace period before it turns features off.
	 *
	 * Counted from the licence failing (Central answering 401 or 403 for the stored key),
	 * not from `connection_status` saying `expired`: a subscription can end while the
	 * licence still works, and then nothing is turned off. Central being unreachable
	 * doesn't start or move it, and a key that verifies again clears it, so a later lapse
	 * starts a new grace period (rtgodam_clear_api_key_invalid_timestamp()).
	 *
	 * Central's `expired_at` when it sends one (not yet). Otherwise the first time this
	 * site saw the licence fail, which is later than the real date if it didn't check in.
	 *
	 * @since n.e.x.t
	 *
	 * @return int 0 while the licence works, or when nothing recorded when it failed.
	 */
	public static function get_licence_failed_since() {
		if ( Api_Key_Status::EXPIRED !== Api_Key::get_status() ) {
			return 0;
		}

		$stored = self::get_stored();

		if ( Connection_Status::EXPIRED === $stored['status'] && $stored['expired_at'] ) {
			return $stored['expired_at'];
		}

		return (int) get_option( Api_Key::ERROR_SINCE_OPTION_KEY, 0 );
	}

	/**
	 * The GoDAM organization the key belongs to, when Central said.
	 *
	 * @since n.e.x.t
	 *
	 * @return string
	 */
	public static function get_organization() {
		return self::get_stored()['organization'];
	}

	/**
	 * Where to renew the plan.
	 *
	 * Central's `/godam_upgrade` opens billing for the organization and returns to
	 * WordPress afterwards. Without the organization, the plans page.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $return_url Where to come back to. Defaults to the GoDAM dashboard.
	 *
	 * @return string
	 */
	public static function get_renewal_url( $return_url = '' ) {
		$organization = self::get_organization();
		$return_url   = '' !== $return_url ? $return_url : admin_url( 'admin.php?page=rtgodam' );

		$url = '' !== $organization
			? add_query_arg(
				array(
					'organization' => rawurlencode( $organization ),
					'wp_return'    => rawurlencode( $return_url ),
				),
				RTGODAM_API_BASE . '/godam_upgrade'
			)
			: RTGODAM_API_BASE . '/web/billing?tab=Plans';

		/**
		 * Filters where a site with a lapsed plan is sent to renew.
		 *
		 * @since n.e.x.t
		 *
		 * @param string $url          Renewal URL.
		 * @param string $organization The GoDAM organization, or empty when unknown.
		 */
		return (string) apply_filters( 'rtgodam_renewal_url', $url, $organization );
	}

	/**
	 * The stored answer, with every field present.
	 *
	 * @return array{status: string, trial_ends_at: int, expired_at: int, organization: string}
	 */
	private static function get_stored() {
		$stored = get_option( self::OPTION_KEY, array() );
		$stored = is_array( $stored ) ? $stored : array();
		$status = (string) ( $stored['status'] ?? '' );

		return array(
			'status'        => in_array( $status, Connection_Status::from_central(), true ) ? $status : '',
			'trial_ends_at' => (int) ( $stored['trial_ends_at'] ?? 0 ),
			'expired_at'    => (int) ( $stored['expired_at'] ?? 0 ),
			'organization'  => (string) ( $stored['organization'] ?? '' ),
		);
	}

	/**
	 * A date from Central (ISO 8601, UTC) as a Unix time.
	 *
	 * @param mixed $value The date.
	 *
	 * @return int 0 when missing or not a date.
	 */
	private static function to_timestamp( $value ) {
		if ( ! is_string( $value ) || '' === $value ) {
			return 0;
		}

		$time = strtotime( $value );

		return false === $time ? 0 : $time;
	}
}
