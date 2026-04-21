<?php
/**
 * REST API endpoint to check for plugin updates via Frappe Dispatch.
 *
 * @package GoDAM_Woo
 * @since 1.0.0
 */

namespace GoDAM_Woo\Classes;

defined( 'ABSPATH' ) || exit;

/**
 * Class Update_Check_REST
 *
 * Provides a REST endpoint for the settings UI to trigger a fresh
 * update check using the Frappe_Dispatch_Updater instance.
 */
class Update_Check_REST extends \RTGODAM\Inc\REST_API\Base {

	/**
	 * Get REST routes.
	 *
	 * @return array
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/godam-woo/check-update',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'check_update' ),
						'permission_callback' => array( $this, 'check_update_permission' ),
					),
				),
			),
		);
	}

	/**
	 * Permission check – only administrators can trigger update checks.
	 *
	 * @return bool|\WP_Error
	 */
	public function check_update_permission() {
		if ( ! current_user_can( 'update_plugins' ) ) {
			return new \WP_Error(
				'rest_forbidden',
				__( 'You do not have permission to check for updates.', 'godam-woo' ),
				array( 'status' => $this->authorization_status_code() )
			);
		}

		return true;
	}

	/**
	 * Get the Frappe_Dispatch_Updater instance initialised in godam-for-woo.php.
	 *
	 * @return \Frappe_Dispatch_Updater|null
	 */
	private function get_updater() {
		// The updater is initialised on admin_init at priority 0.
		// REST requests may arrive before admin_init fires, so bootstrap it now if needed.
		if ( empty( $GLOBALS['godam_woo_updater'] ) && function_exists( 'godam_woo_frappe_dispatch_setup' ) ) {
			godam_woo_frappe_dispatch_setup();
		}

		return isset( $GLOBALS['godam_woo_updater'] ) ? $GLOBALS['godam_woo_updater'] : null;
	}

	/**
	 * Check Frappe Dispatch for an available update.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function check_update() {
		$license_key = get_option( 'rtgodam-api-key', '' );

		if ( empty( $license_key ) ) {
			return new \WP_Error(
				'no_license',
				__( 'A valid API key is required to check for updates.', 'godam-woo' ),
				array( 'status' => 403 )
			);
		}

		$updater = $this->get_updater();

		if ( ! $updater ) {
			return new \WP_Error(
				'updater_missing',
				__( 'The Frappe Dispatch updater is not initialised.', 'godam-woo' ),
				array( 'status' => 500 )
			);
		}

		// Clear the transient cache so we get fresh data from the server.
		$updater->clear_cache();

		$api_data = $updater->fetch_api_data();

		if ( ! $api_data || ! isset( $api_data->new_version ) ) {
			return new \WP_Error(
				'api_error',
				__( 'Could not retrieve update information from the update server.', 'godam-woo' ),
				array( 'status' => 502 )
			);
		}

		$has_update = version_compare( GODAM_WOO_VERSION, $api_data->new_version, '<' );

		if ( $has_update ) {
			// Force WordPress to re-evaluate the update_plugins transient with fresh data.
			// The updater's check_for_update filter will inject the update row.
			delete_site_transient( 'update_plugins' );
			wp_update_plugins();

			// Set a transient so we can show a notice on the plugins page.
			set_transient( 'godam_woo_update_notice', 'update_available', 30 );
		}

		return rest_ensure_response(
			array(
				'has_update'  => $has_update,
				'new_version' => sanitize_text_field( $api_data->new_version ),
				'plugins_url' => $has_update ? admin_url( 'plugins.php?plugin_status=all&s=godam-for-woo' ) : '',
			)
		);
	}
}
