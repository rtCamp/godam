<?php
/**
 * Register REST API endpoints for EverestForms.
 *
 * Get a single WPForm.
 *
 * @since 1.4.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Everest_Forms;

use WP_Query;
use RTGODAM\Inc\REST_API\Base;

defined( 'ABSPATH' ) || exit;

/**
 * Class LocationAPI
 *
 * @since 1.4.0
 */
class Everest_Forms_Rest_Api extends Base {

	/**
	 * Get REST routes.
	 *
	 * @since 1.4.0
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
									'description'       => __( 'The ID of the Everest Forms Form.', 'godam' ),
									'type'              => 'integer',
									'required'          => true,
									'sanitize_callback' => 'absint',
								),
								'theme' => array(
									'description'       => __( 'The theme to be applied to the Everest Forms Form.', 'godam' ),
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
	 * Get all Everest Forms.
	 *
	 * @since 1.4.0
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
	 * @since 1.4.0
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

		$form = do_shortcode( "[everest_form id='{$form_id}' title='{$title}' description='{$description}']" );

		return rest_ensure_response( $form );
	}

	/**
	 * Return true if either Everest Forms Free or Pro plugin is active.
	 *
	 * @since 1.4.0
	 *
	 * @return boolean
	 */
	public function is_form_active() {
		// TODO Handle Everest Forms pro versions as well in future.
		return is_plugin_active( 'everest-forms/everest-forms.php' );
	}
}
