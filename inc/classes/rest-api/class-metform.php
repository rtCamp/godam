<?php
/**
 * Register REST API endpoints for MetForm.
 *
 * Get all MetForm forms and single MetForm form.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

use WP_Error;
use WP_Query;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * Class MetForm
 *
 * @since n.e.x.t
 */
class MetForm extends Base {

	/**
	 * Check if metform active.
	 *
	 * @var bool
	 * @access private
	 */
	private $is_metform_active = false;

	/**
	 * Check if metform is active or not.
	 *
	 * @return true|false true on active and false on not active.
	 */
	private function check_metform_active() {
		return is_plugin_active( 'metform/metform.php' );
	}

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {

		// Check for metform plugin activation.
		$this->is_metform_active = $this->check_metform_active();

		if ( ! $this->is_metform_active ) {
			return array();
		}

		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/metforms',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::READABLE,
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
						'methods'             => WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_metform' ),
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							array(
								'id' => array(
									'description'       => __( 'The ID of the Met Form.', 'godam' ),
									'type'              => 'integer',
									'required'          => true,
									'sanitize_callback' => 'absint',
								),
							),
						),
					),
				),
			),
		);
	}

	/**
	 * Get all MetForm Forms.
	 *
	 * @param WP_REST_Request $request Request Object.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_metforms( $request ) {

		if ( ! $this->is_metform_active ) {
			return new \WP_Error( 'metform_not_active', __( 'MetForm plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$paged    = 1;
		$per_page = 50;
		$forms    = array();

		do {
			$query = new WP_Query(
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
			return new WP_Error( 'metform_empty', __( 'No MetForm on the site. Please create one', 'godam' ), array( 'status' => 404 ) );
		}

		foreach ( $forms as $form ) {
			$met_forms[] = array(
				'id'          => $form->ID,
				'title'       => $form->post_title,
				'description' => $form->post_excerpt,
				'content'     => $form->post_content,
			);
		}

		return new WP_REST_Response( $met_forms );
	}

	/**
	 * Get a single Met Form.
	 *
	 * @param WP_REST_Request $request Request Object.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_metform( $request ) {

		if ( ! $this->is_metform_active ) {
			return new WP_Error( 'metform_not_active', __( 'Metform plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$form_id = $request->get_param( 'id' );

		if ( empty( $form_id ) ) {
			return new WP_Error( 'invalid_form_id', __( 'Invalid form ID.', 'godam' ), array( 'status' => 404 ) );
		}

		$met_form = do_shortcode( "[metform form_id='{$form_id}']" );

		return new WP_REST_Response( $met_form );
	}
}
