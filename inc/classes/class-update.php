<?php
/**
 * Class to handle plugin update logic.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Enums\Api_Key_Status;
use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Update
 */
class Update {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Register hooks related to plugin updates.
	 */
	protected function setup_hooks() {
		add_action( 'admin_init', array( $this, 'rtgodam_update_plugin_version' ) );
	}

	/**
	 * Check if the plugin version has changed.
	 *
	 * Fresh install: sets options for both Welcome walkthrough AND What's New page.
	 * Version bump:  sets option for What's New page only.
	 */
	public function rtgodam_update_plugin_version() {
		$saved_version   = get_option( 'rtgodam_plugin_version' );
		$current_version = RTGODAM_VERSION;

		if ( false === $saved_version ) {
			// Fresh install — show the welcome walkthrough first, then What's New.
			update_option( 'rtgodam_show_welcome', true );
			update_option( 'rtgodam_show_whats_new', true );
			$this->rtgodam_reconcile_api_key_state();
			update_option( 'rtgodam_plugin_version', $current_version );
			return;
		}

		if ( version_compare( $current_version, $saved_version, '>' ) ) {
			// Existing install with a version bump — show What's New only.
			if ( $this->rtgodam_is_release_bump( $saved_version, $current_version ) ) {
				update_option( 'rtgodam_show_whats_new', true );
			}

			$this->rtgodam_reconcile_api_key_state();
			update_option( 'rtgodam_plugin_version', $current_version );
		}
	}

	/**
	 * Reconcile API-key-related cached state during install/update.
	 *
	 * If no API key exists, stale cached user data and old persisted statuses
	 * are normalized to "no_api_key" to avoid backward-compatibility issues.
	 */
	private function rtgodam_reconcile_api_key_state() {
		$api_key = get_option( 'rtgodam-api-key', '' );

		if ( ! empty( $api_key ) ) {
			return;
		}

		rtgodam_set_api_key_status( Api_Key_Status::NO_API_KEY );
		rtgodam_clear_api_key_invalid_timestamp();
		delete_option( 'rtgodam_user_data' );
	}

	/**
	 * Determine whether there's a new release bump in the plugin version.
	 *
	 * @param string $old_version Previous plugin version.
	 * @param string $new_version Current plugin version.
	 *
	 * @return boolean True if it's a release version bump, false otherwise.
	 */
	private function rtgodam_is_release_bump( $old_version, $new_version ) {
		$old_version_parts = explode( '.', $old_version );
		$new_version_parts = explode( '.', $new_version );

		$major_version_bump = $new_version_parts[0] > $old_version_parts[0];
		$minor_version_bump = $new_version_parts[0] === $old_version_parts[0] && $new_version_parts[1] > $old_version_parts[1];

		return $major_version_bump || $minor_version_bump;
	}
}
