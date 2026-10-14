<?php
/**
 * Migration: ask for the PostHog choice again on sites that already have tracking on.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Switches PostHog tracking off, once, on every site where it is on.
 *
 * Before GoDAM 2.4.0, verifying an API key switched tracking on without asking. Tracking now
 * starts only after an admin clicks Allow in the Dashboard notice or turns on the toggle on the
 * Help page. Sites the old behaviour switched on never agreed to it, and the stored setting
 * cannot tell them apart from sites where an admin did click Allow, so every site that has
 * tracking on is asked again: tracking goes off and the choice is cleared, which makes the
 * Dashboard notice show. A site that opted out is left as it is.
 *
 * ## Re-running (e.g. for testing)
 *
 *   wp option delete rtgodam_posthog_consent_reset_done
 *   wp option delete rtgodam_db_version
 *
 * @since n.e.x.t
 */
class Posthog_Consent_Reset {

	/**
	 * WordPress option key that records the migration ran.
	 *
	 * @var string
	 */
	const OPTION_KEY = 'rtgodam_posthog_consent_reset_done';

	/**
	 * Run the migration once for the current site.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool Always true: there is nothing to retry.
	 */
	public static function maybe_run(): bool {
		if ( get_option( self::OPTION_KEY ) ) {
			return true;
		}

		$settings = get_option( 'rtgodam-settings', array() );

		// Same test the admin pages use for "tracking is on" (an integer cast), so a value they read as off is left alone.
		if ( is_array( $settings ) && (int) ( $settings['general']['enable_posthog_tracking'] ?? 0 ) ) {
			$settings['general']['enable_posthog_tracking'] = false;
			$settings['general']['posthog_initialized']     = false;
			update_option( 'rtgodam-settings', $settings );
		}

		update_option( self::OPTION_KEY, 'done', false );

		return true;
	}
}
