<?php
/**
 * The site's GoDAM connection status.
 *
 * @see https://github.com/rtCamp/godam-plugin-wp/issues/101
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Enums;

defined( 'ABSPATH' ) || exit;

/**
 * One status every screen reads, instead of guessing from "is the key valid".
 *
 * GoDAM Central sends `connected`, `trial`, `expired` or `none` as `connection_status`
 * from `verify_api_key`. `unreachable` is the plugin's own: Central didn't answer.
 *
 * @since n.e.x.t
 */
class Connection_Status {

	/**
	 * A paid plan: everything on.
	 *
	 * @var string
	 */
	const CONNECTED = 'connected';

	/**
	 * A trial: everything on, with days left.
	 *
	 * @var string
	 */
	const TRIAL = 'trial';

	/**
	 * The plan lapsed or was revoked: show the renewal screen, not signup.
	 *
	 * @var string
	 */
	const EXPIRED = 'expired';

	/**
	 * Central couldn't be reached: keep working from the last good status.
	 *
	 * @var string
	 */
	const UNREACHABLE = 'unreachable';

	/**
	 * No key, or Central doesn't know it: show the connect screen.
	 *
	 * @var string
	 */
	const NONE = 'none';

	/**
	 * The statuses Central sends.
	 *
	 * @return string[]
	 */
	public static function from_central() {
		return array( self::CONNECTED, self::TRIAL, self::EXPIRED, self::NONE );
	}

	/**
	 * Every status.
	 *
	 * @return string[]
	 */
	public static function get_all() {
		return array( self::CONNECTED, self::TRIAL, self::EXPIRED, self::UNREACHABLE, self::NONE );
	}
}
