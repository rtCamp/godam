<?php
/**
 * REST API endpoint for toggling add-on plugin activation.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Addon_Toggle REST endpoint.
 *
 * Activates or deactivates a GoDAM add-on plugin.
 */
class Addon_Toggle extends Base {

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
				'route'     => '/' . $this->rest_base . '/toggle',
				'args'      => array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'toggle_addon' ),
					'permission_callback' => function () {
						return current_user_can( 'activate_plugins' );
					},
					'args'                => array(
						'plugin'   => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'activate' => array(
							'required' => true,
							'type'     => 'boolean',
						),
					),
				),
			),
		);
	}

	/**
	 * Toggle add-on plugin activation.
	 *
	 * @param \WP_REST_Request $request Request object.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function toggle_addon( \WP_REST_Request $request ) {
		$plugin_slug = $request->get_param( 'plugin' );
		$activate    = $request->get_param( 'activate' );

		/**
		 * Filter the list of allowed add-on plugin slugs that can be toggled.
		 *
		 * @param array $allowed_addons List of plugin file paths (e.g. 'godam-for-woo/godam-for-woo.php').
		 */
		$allowed_addons = apply_filters(
			'godam_allowed_addon_plugins',
			array(
				'godam-for-woo/godam-for-woo.php',
			)
		);

		if ( ! in_array( $plugin_slug, $allowed_addons, true ) ) {
			return new \WP_Error(
				'invalid_addon',
				__( 'Invalid add-on plugin.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		if ( ! function_exists( 'activate_plugin' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$plugin_file = WP_PLUGIN_DIR . '/' . $plugin_slug;

		if ( ! file_exists( $plugin_file ) ) {
			return new \WP_Error(
				'plugin_not_found',
				__( 'Add-on plugin is not installed.', 'godam' ),
				array( 'status' => 404 )
			);
		}

		if ( $activate ) {
			if ( is_plugin_active( $plugin_slug ) ) {
				return rest_ensure_response(
					array(
						'status'  => 'success',
						'active'  => true,
						'message' => __( 'Plugin is already active.', 'godam' ),
					)
				);
			}

			ob_start();
			$result = activate_plugin( $plugin_slug );
			ob_end_clean();

			if ( is_wp_error( $result ) ) {
				$error_data = $result->get_error_data();
				$status     = ( is_array( $error_data ) && isset( $error_data['status'] ) ) ? (int) $error_data['status'] : 500;

				return new \WP_Error(
					'addon_activation_failed',
					wp_kses_post( (string) $result->get_error_message() ),
					array( 'status' => $status )
				);
			}

			return rest_ensure_response(
				array(
					'status'  => 'success',
					'active'  => true,
					'message' => __( 'Plugin activated successfully.', 'godam' ),
				)
			);
		}

		if ( ! is_plugin_active( $plugin_slug ) ) {
			return rest_ensure_response(
				array(
					'status'  => 'success',
					'active'  => false,
					'message' => __( 'Plugin is already inactive.', 'godam' ),
				)
			);
		}

		ob_start();
		deactivate_plugins( $plugin_slug );
		ob_end_clean();

		return rest_ensure_response(
			array(
				'status'  => 'success',
				'active'  => false,
				'message' => __( 'Plugin deactivated successfully.', 'godam' ),
			)
		);
	}
}
