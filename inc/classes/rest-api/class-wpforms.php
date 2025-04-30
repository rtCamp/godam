<?php
/**
 * Register REST API endpoints for WPForms.
 * 
 * Get a single WPForm.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class LocationAPI
 */
class WPForms extends Base {

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/wpform',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_wpforms_form' ),
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							array(
								'id'    => array(
									'description' => 'The ID of the Contact Form 7 Form.',
									'type'        => 'string',
									'required'    => true,
								),
								'theme' => array(
									'description'       => 'The theme to be applied to the Contact Form 7 Form.',
									'type'              => 'string',
									'required'          => false,
									'sanitize_callback' => 'sanitize_text_field',
								),
							)
						),
					),
				),
			),
		);
	}

	/**
	 * Get a single Gravity Form.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_wpforms_form( $request ) {
		// Check if Gravity Forms plugin is active.
		if ( ! is_plugin_active( 'wpforms-lite/wpforms.php' ) && ! is_plugin_active( 'wpforms/wpforms.php' ) ) {
			return new \WP_Error( 'wpforms_not_active', 'WPForms plugin is not active.', array( 'status' => 404 ) );
		}

		$form_id     = $request->get_param( 'id' );
		$title       = $request->get_param( 'title' );
		$title       = empty( $title ) ? 'false' : 'true';
		$description = $request->get_param( 'description' );
		$description = empty( $description ) ? 'false' : 'true';

		if ( empty( $form_id ) ) {
			return new \WP_Error( 'invalid_form_id', 'Invalid form ID.', array( 'status' => 404 ) );
		}

		$wpform = do_shortcode( "[wpforms id='{$form_id}' title='{$title}' description='{$description}' ajax='true']" );

		return rest_ensure_response( $wpform );
	}
}
