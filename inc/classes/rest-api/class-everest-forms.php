<?php
/**
 * Register REST API endpoints for EverestForms.
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
class Everest_Forms extends Base {

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/everest-forms',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_forms' ),
						'permission_callback' => '__return_true',
						'args'                => $this->get_collection_params(),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/everest-form',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_form' ),
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							array(
								'id'    => array(
									'description' => __( 'The ID of the Everest Forms Form.', 'godam' ),
									'type'        => 'string',
									'required'    => true,
								),
								'theme' => array(
									'description'       => __( 'The theme to be applied to the Everest Forms Form.', 'godam' ),
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
	 * Get all Everest Forms.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_forms( $request ) {
		// Check if Everest Forms plugin is active.
		if ( ! $this->is_form_active() ) {
			return new \WP_Error( 'everest_forms_not_active', __( 'Everest Forms plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		// Fetch all Everest Forms in a paginated manner.
		// Using pagination to avoid memory issues with large datasets.
		$paged    = 1;
		$per_page = 50;
		$forms    = array();

		while ( true ) {
			$query = new WP_Query(
				array(
					'post_type'      => 'everest_form',
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
		}

		$formatted_forms = array();

		if ( ! empty( $forms ) && ! is_wp_error( $forms ) ) {
			$formatted_forms = array_map(
				function ( $form ) {
					return array(
						'id'          => $form->ID,
						'title'       => $form->post_title,
						'description' => $form->post_excerpt,
					);
				},
				$forms
			);
		}

		return rest_ensure_response( $formatted_forms );
	}

	/**
	 * Get a single Everest Form.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_form( $request ) {
		// Check if Everest Forms plugin is active.
		if ( ! $this->is_form_active() ) {
			return new \WP_Error( 'everest_forms_not_active', __( 'Everest Forms plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$form_id     = $request->get_param( 'id' );
		$title       = $request->get_param( 'title' );
		$title       = empty( $title ) ? 'false' : 'true';
		$description = $request->get_param( 'description' );
		$description = empty( $description ) ? 'false' : 'true';

		if ( empty( $form_id ) ) {
			return new \WP_Error( 'invalid_form_id', __( 'Invalid form ID.', 'godam' ), array( 'status' => 404 ) );
		}

		$form = do_shortcode( "[everest-forms id='{$form_id}' title='{$title}' description='{$description}' ajax='true']" );

		return rest_ensure_response( $form );
	}

	/**
	 * Return true if either Everest Forms Free or Pro plugin is active.
	 *
	 * @return boolean
	 */
	public function is_form_active() {
		return is_plugin_active( 'everest-forms/everest-forms.php' ) || is_plugin_active( 'everest-forms-pro/everest-forms-pro.php' );
	}
}
