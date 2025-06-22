<?php
/**
 * Register REST API endpoints for Contact Form 7.
 *
 * Get a single Contact Form 7 Form.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class LocationAPI
 */
class CF7 extends Base {

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return [
			[
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/cf7-form',
				'args'      => [
					[
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => [ $this, 'get_cf7_form' ],
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							[
								'id'    => [
									'description' => __( 'The ID of the Contact Form 7 Form.', 'godam' ),
									'type'        => 'string',
									'required'    => true,
								],
								'theme' => [
									'description'       => __( 'The theme to be applied to the Contact Form 7 Form.', 'godam' ),
									'type'              => 'string',
									'required'          => false,
									'sanitize_callback' => 'sanitize_text_field',
								],
							]
						),
					],
				],
			],
		];
	}

	/**
	 * Get a single Gravity Form.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_cf7_form( $request ) {
		// Check if Gravity Forms plugin is active.
		if ( ! class_exists( 'WPCF7_ShortcodeManager' ) ) {
			return new \WP_Error( 'contactform7_not_active', __( 'Contact Form 7 plugin is not active.', 'godam' ), [ 'status' => 404 ] );
		}

		$form_id = $request->get_param( 'id' );
		$theme   = $request->get_param( 'theme' );

		if ( empty( $form_id ) ) {
			return new \WP_Error( 'invalid_form_id', __( 'Invalid form ID.', 'godam' ), [ 'status' => 404 ] );
		}

		$cf7_form = do_shortcode( "[contact-form-7 id='{$form_id}' theme='{$theme}']" );

		return rest_ensure_response( $cf7_form );
	}
}
