<?php
/**
 * REST API endpoint for installing add-on plugins via Frappe Dispatch.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Addon_Install REST endpoint.
 *
 * Downloads, installs, and optionally activates a GoDAM add-on plugin
 * using the Frappe Dispatch Installer.
 */
class Addon_Install extends Base {

	/**
	 * Route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'addon';

	/**
	 * Get REST routes.
	 *
	 * @return array
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/install',
				'args'      => array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'install_addon' ),
					'permission_callback' => function () {
						return current_user_can( 'install_plugins' );
					},
					'args'                => array(
						'plugin_slug' => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			),
		);
	}

	/**
	 * Install an add-on plugin via Frappe Dispatch.
	 *
	 * @param \WP_REST_Request $request Request object.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function install_addon( \WP_REST_Request $request ) {
		$plugin_slug = $request->get_param( 'plugin_slug' );

		/**
		 * Filter the list of allowed add-on plugin slugs that can be installed.
		 *
		 * @param array $allowed_addons Associative array of allowed Frappe Dispatch
		 *                              item IDs mapped to their WordPress plugin basenames.
		 */
		$allowed_addons = apply_filters(
			'godam_installable_addon_plugins',
			array(
				'godam-for-woo' => 'godam-for-woo/godam-for-woo.php',
			)
		);

		if ( ! array_key_exists( $plugin_slug, $allowed_addons ) ) {
			return new \WP_Error(
				'invalid_addon',
				__( 'This add-on is not available for installation.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		// Check if the plugin is already installed.
		$wp_plugin_slug = $allowed_addons[ $plugin_slug ];
		if ( file_exists( WP_PLUGIN_DIR . '/' . $wp_plugin_slug ) ) {
			return new \WP_Error(
				'already_installed',
				__( 'This add-on is already installed.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		$license_key = \RTGODAM\Inc\Helpers\Api_Key::get_key();

		if ( empty( $license_key ) ) {
			return new \WP_Error(
				'no_license',
				__( 'A valid API key is required to install add-ons.', 'godam' ),
				array( 'status' => 403 )
			);
		}

		// Load the Frappe Dispatch Installer.
		if ( ! class_exists( 'Godam_Frappe_Dispatch_Installer' ) ) {
			require_once RTGODAM_PATH . 'lib/class-godam-frappe-dispatch-installer.php';
		}

		$api_url = defined( 'RTGODAM_API_BASE' ) ? RTGODAM_API_BASE : 'https://app.godam.io';

		/**
		 * Filter the Frappe Dispatch API URL used for add-on installation.
		 *
		 * @param string $api_url     The API URL.
		 * @param string $plugin_slug The add-on slug being installed.
		 */
		$api_url = apply_filters( 'godam_addon_install_api_url', $api_url, $plugin_slug );

		$installer = new \Godam_Frappe_Dispatch_Installer( $api_url, $license_key );

		ob_start();
		$result = $installer->install_plugin( $plugin_slug, true );
		ob_end_clean();

		if ( empty( $result['success'] ) ) {
			// Reuse the installer to get a download link for manual installation.
			$download_link = $installer->get_download_link( $plugin_slug );

			return new \WP_Error(
				'install_failed',
				$result['message'] ?? __( 'Failed to install add-on.', 'godam' ),
				array(
					'status'        => 500,
					'download_link' => $download_link,
				)
			);
		}

		return rest_ensure_response(
			array(
				'status'    => 'success',
				'message'   => __( 'Add-on installed and activated successfully.', 'godam' ),
				'activated' => ! empty( $result['activated'] ),
			)
		);
	}
}
