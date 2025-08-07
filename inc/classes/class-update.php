<?php
/**
 * Class to handle plugin update logic.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

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
	 * If a version bump is detected, sets a transient
	 * to show the "What's New" page on next GoDAM menu admin load.
	 */
	public function rtgodam_update_plugin_version() {
		$saved_version   = get_option( 'rtgodam_plugin_version' );
		$current_version = RTGODAM_VERSION;

		if ( version_compare( $current_version, $saved_version, '>' ) ) {
			// Set transient if this is a new version update.
			if ( $this->rtgodam_is_release_bump( $saved_version, $current_version ) ) {
				set_transient( 'rtgodam_show_whats_new', true );
			}

			update_option( 'rtgodam_plugin_version', $current_version );
		}
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
