<?php
/**
 * Class to handle plugin update logic.
 *
 * @since 1.4.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Enums\Api_Key_Status;
use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Update
 *
 * @since 1.4.0
 */
class Update {

	use Singleton;

	/**
	 * Option flag used to show the post-update video performance notice once.
	 *
	 * @var string
	 */
	const VIDEO_PERFORMANCE_NOTICE_OPTION = 'rtgodam_show_video_performance_notice';

	/**
	 * Construct method.
	 *
	 * @since 1.4.0
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Register hooks related to plugin updates.
	 *
	 * @since 1.4.0
	 */
	protected function setup_hooks() {
		add_action( 'admin_init', array( $this, 'rtgodam_update_plugin_version' ) );
		add_action( 'admin_notices', array( $this, 'maybe_render_video_performance_notice' ) );
	}

	/**
	 * Check if the plugin version has changed.
	 *
	 * Fresh install: sets options for What's New page.
	 * Version bump:  sets option for What's New page only.
	 *
	 * @since 1.4.0
	 */
	public function rtgodam_update_plugin_version() {
		$saved_version   = get_option( 'rtgodam_plugin_version' );
		$current_version = RTGODAM_VERSION;

		if ( false === $saved_version ) {
			// Fresh install — show What's New page.
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

			update_option( self::VIDEO_PERFORMANCE_NOTICE_OPTION, true, false );
			$this->rtgodam_reconcile_api_key_state();
			update_option( 'rtgodam_plugin_version', $current_version );
		}
	}

	/**
	 * Render a one-time admin notice after the video performance controls change.
	 *
	 * @since 1.8.0
	 *
	 * @return void
	 */
	public function maybe_render_video_performance_notice() {
		if ( ! current_user_can( 'manage_options' ) || ! get_option( self::VIDEO_PERFORMANCE_NOTICE_OPTION ) ) {
			return;
		}

		delete_option( self::VIDEO_PERFORMANCE_NOTICE_OPTION );
		?>
		<div class="notice notice-info is-dismissible">
			<p>
				<?php
				esc_html_e(
					'GoDAM video performance settings have been simplified to Balanced and Priority modes. Please review any hero videos that should stay in Priority mode after this update.',
					'godam'
				);
				?>
			</p>
		</div>
		<?php
	}

	/**
	 * Reconcile API-key-related cached state during install/update.
	 *
	 * Older plugin versions defaulted the stored api_key_status to 'valid' even
	 * when no key had ever been entered. This method detects that stale state on
	 * upgrade and corrects it to 'no_api_key', preventing the dashboard from
	 * loading indefinitely because the JS thinks the key is valid but no key
	 * is actually stored.
	 *
	 * @since 1.8.0
	 */
	private function rtgodam_reconcile_api_key_state() {
		$api_key       = get_option( 'rtgodam-api-key', '' );
		$stored_status = get_option( 'rtgodam-api-key-status', null );

		// Nothing to reconcile if the status option was explicitly set already.
		if ( null !== $stored_status ) {
			return;
		}

		// Status option has never been written. Normalise based on whether a key exists.
		if ( empty( $api_key ) ) {
			// No key → set the explicit no-key status and wipe any stale user data.
			rtgodam_set_api_key_status( \RTGODAM\Inc\Enums\Api_Key_Status::NO_API_KEY );
			rtgodam_clear_api_key_invalid_timestamp();
			delete_option( 'rtgodam_user_data' );
		} else {
			// Key exists but status was never persisted → write 'valid' explicitly so
			// future reads no longer fall back to the NO_API_KEY default.
			rtgodam_set_api_key_status( \RTGODAM\Inc\Enums\Api_Key_Status::VALID );
		}
	}

	/**
	 * Determine whether there's a new release bump in the plugin version.
	 *
	 * @since 1.4.0
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
