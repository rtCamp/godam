<?php
/**
 * Register REST API endpoints for Metform.
 *
 * Get a single Metform.
 *
 * @since 1.4.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Metform;

use RTGODAM\Inc\REST_API\Base;


defined( 'ABSPATH' ) || exit;

/**
 * Class Metform_Rest_Api
 *
 * @since 1.4.0
 */
class Metform_Rest_Api extends Base {

	/**
	 * Get REST routes.
	 *
	 * @since 1.4.0
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/metforms',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_metforms' ),
						'permission_callback' => '__return_true',
						'args'                => $this->get_collection_params(),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/metform',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_metform' ),
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							array(
								'id' => array(
									'description'       => __( 'The ID of the Metform.', 'godam' ),
									'type'              => 'integer',
									'required'          => true,
									'sanitize_callback' => 'absint',
								),
							)
						),
					),
				),
			),
		);
	}

	/**
	 * Get all Metforms.
	 *
	 * @since 1.4.0
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_metforms( $request ) {
		// Check if Metform plugin is active.
		if ( ! is_plugin_active( 'metform/metform.php' ) ) {
			return new \WP_Error( 'metform_not_active', __( 'Metform plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$paged    = 1;
		$per_page = 50;
		$forms    = array();

		do {
			$query = new \WP_Query(
				array(
					'post_type'      => 'metform-form',
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

		$met_forms = array();

		if ( empty( $forms ) ) {
			return new \WP_Error( 'metform_empty', __( 'No MetForm on the site. Please create one', 'godam' ), array( 'status' => 404 ) );
		}

		foreach ( $forms as $form ) {
			$met_forms[] = array(
				'id'          => $form->ID,
				'title'       => $form->post_title,
				'description' => $form->post_excerpt,
				'content'     => $form->post_content,
			);
		}

		return new \WP_REST_Response( $met_forms );
	}

	/**
	 * Get a single Metform.
	 *
	 * @since 1.4.0
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_metform( $request ) {
		// Check if Metform plugin is active.
		if ( ! is_plugin_active( 'metform/metform.php' ) ) {
			return new \WP_Error(
				'metform_not_active',
				__( 'Metform plugin is not active.', 'godam' ),
				array( 'status' => 404 )
			);
		}

		$form_id = absint( $request->get_param( 'id' ) );

		if ( empty( $form_id ) ) {
			return new \WP_Error( 'invalid_form_id', __( 'Invalid form ID.', 'godam' ), array( 'status' => 404 ) );
		}

		if ( $form_id ) {
			$metform = do_shortcode( "[metform form_id={$form_id}]" );
		} else {
			/* translators: %d is the Metform ID */
			$metform = sprintf( __( 'Unable to find the Metform with ID:%d', 'godam' ), $form_id );
		}

		return rest_ensure_response( $metform );
	}
}
