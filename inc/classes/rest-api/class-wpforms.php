<?php
/**
 * Register REST API endpoints for WPForms.
 *
 * Get a single WPForm.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

use WP_Query;

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
				'route'     => '/' . $this->rest_base . '/wpforms',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_gforms' ),
						'permission_callback' => '__return_true',
						'args'                => $this->get_collection_params(),
					),
				),
			),
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
									'description'       => __( 'The ID of the WPForms Form.', 'godam' ),
									'type'              => 'integer',
									'required'          => true,
									'sanitize_callback' => 'absint',
								),
								'theme' => array(
									'description'       => __( 'The theme to be applied to the WPForms Form.', 'godam' ),
									'type'              => 'string',
									'required'          => false,
									'sanitize_callback' => 'sanitize_key',
								),
							)
						),
					),
				),
			),
		);
	}

	/**
	 * Get all WPForms.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_gforms( $request ) {
		// Check if WPForms plugin is active.
		$is_wpforms_active = is_plugin_active( 'wpforms-lite/wpforms.php' ) || is_plugin_active( 'wpforms/wpforms.php' );
		if ( ! $is_wpforms_active ) {
			return new \WP_Error( 'wpforms_not_active', __( 'WPForms plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		// Fetch all WPForms in a paginated manner.
		// Using pagination to avoid memory issues with large datasets.
		$paged    = 1;
		$per_page = 50;
		$forms    = array();

		do {
			$query = new WP_Query(
				array(
					'post_type'      => 'wpforms',
					'posts_per_page' => $per_page,
					'paged'          => $paged,
					'post_status'    => 'publish',
				)
			);

			if ( ! empty( $query->posts ) ) {
				$forms = array_merge( $forms, $query->posts );
				++$paged;
			} else {
				break;
			}
		} while ( true );

		$wpforms = array();

		if ( ! empty( $forms ) && ! is_wp_error( $forms ) ) {
			foreach ( $forms as $form ) {
				$wpforms[] = array(
					'id'          => $form->ID,
					'title'       => $form->post_title,
					'description' => $form->post_excerpt,
				);
			}
		}

		return rest_ensure_response( $wpforms );
	}

	/**
	 * Get a single WPForms Form.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_wpforms_form( $request ) {
		// Check if WPForms plugin is active.
		if ( ! is_plugin_active( 'wpforms-lite/wpforms.php' ) && ! is_plugin_active( 'wpforms/wpforms.php' ) ) {
			return new \WP_Error( 'wpforms_not_active', __( 'WPForms plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$form_id     = $request->get_param( 'id' );
		$title       = $request->get_param( 'title' );
		$title       = empty( $title ) ? 'false' : 'true';
		$description = $request->get_param( 'description' );
		$description = empty( $description ) ? 'false' : 'true';

		if ( empty( $form_id ) ) {
			return new \WP_Error( 'invalid_form_id', __( 'Invalid form ID.', 'godam' ), array( 'status' => 404 ) );
		}

		$wpform = do_shortcode( "[wpforms id='{$form_id}' title='{$title}' description='{$description}' ajax='true']" );

		return rest_ensure_response( $wpform );
	}
}
