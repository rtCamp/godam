<?php
/**
 * Register REST API endpoints for Sure forms.
 *
 * Get all Sure forms and single Sure form.
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
 * Class SureForms
 *
 * @since 1.3.0
 */
class SureForms extends Base {

	/**
	 * Check if sure forms active.
	 *
	 * @var bool
	 * @access private
	 */
	private $is_sure_form_active = false;

	/**
	 * Check if sureforms is active or not.
	 *
	 * @return true|false true on active and false on not active.
	 */
	private function check_sureforms_active() {
		return is_plugin_active( 'sureforms/sureforms.php' );
	}

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {

		// Check for sure forms plugin activation.
		$this->is_sure_form_active = $this->check_sureforms_active();

		if ( ! $this->is_sure_form_active ) {
			return array();
		}

		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/sureforms',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_sureforms' ),
						'permission_callback' => '__return_true',
						'args'                => $this->get_collection_params(),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/sureform',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_sureform' ),
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							array(
								'id' => array(
									'description'       => __( 'The ID of the Sure Form.', 'godam' ),
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
	 * Get all Sure Forms.
	 *
	 * @param WP_REST_Request $request Request Object.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_sureforms( $request ) {

		if ( ! $this->is_sure_form_active ) {
			return new \WP_Error( 'sureforms_not_active', __( 'Sureforms plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$paged    = 1;
		$per_page = 50;
		$forms    = array();

		do {
			$query = new WP_Query(
				array(
					'post_type'      => 'sureforms_form',
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

		$sure_forms = array();

		if ( empty( $forms ) ) {
			return new WP_Error( 'sureforms_empty', __( 'No Sureforms on the site. Please create one', 'godam' ), array( 'status' => 404 ) );
		}

		foreach ( $forms as $form ) {
			$sure_forms[] = array(
				'id'          => $form->ID,
				'title'       => $form->post_title,
				'description' => $form->post_excerpt,
				'content'     => $form->post_content,
			);
		}

		return new WP_REST_Response( $sure_forms );
	}

	/**
	 * Get a single Sure Form.
	 *
	 * @param WP_REST_Request $request Request Object.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_sureform( $request ) {

		if ( ! $this->is_sure_form_active ) {
			return new WP_Error( 'sureforms_not_active', __( 'Sureforms plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$form_id = $request->get_param( 'id' );

		if ( empty( $form_id ) ) {
			return new WP_Error( 'invalid_form_id', __( 'Invalid form ID.', 'godam' ), array( 'status' => 404 ) );
		}

		$sure_form = do_shortcode( "[sureforms id='{$form_id}']" );

		return new WP_REST_Response( $sure_form );
	}
}
