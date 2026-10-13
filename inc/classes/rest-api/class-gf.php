<?php
/**
 * Register REST API endpoints for Gravity Forms.
 *
 * Get all Gravity Forms and a single Gravity Form.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class GF
 */
class GF extends Base {

	/**
	 * Fields the form collection is allowed to expose.
	 *
	 * A Gravity Forms form object also carries notifications, confirmations and
	 * any settings an add-on has persisted into form meta. None of that may
	 * reach the REST response, so the collection is narrowed to the three
	 * fields the Video Editor's form picker actually renders.
	 *
	 * @var string[]
	 */
	public const ALLOWED_FORM_FIELDS = array( 'id', 'title', 'description' );

	/**
	 * Permission check — same capability the Video Editor page requires.
	 *
	 * @return bool
	 */
	public function forms_permissions_check() {
		return current_user_can( 'upload_files' );
	}

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/gforms',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_gforms' ),
						'permission_callback' => array( $this, 'forms_permissions_check' ),
						'args'                => $this->get_collection_params(),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/gform',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_gform' ),
						'permission_callback' => array( $this, 'forms_permissions_check' ),
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							array(
								'id'    => array(
									'description'       => __( 'The ID of the Gravity Form.', 'godam' ),
									'type'              => 'integer',
									'required'          => true,
									'sanitize_callback' => 'absint',
								),
								'theme' => array(
									'description'       => __( 'The theme to be applied to the Gravity Form.', 'godam' ),
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
	 * Get all Gravity Forms.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_gforms( $request ) {
		// Check if Gravity Forms plugin is active.
		if ( ! class_exists( 'GFAPI' ) ) {
			return new \WP_Error( 'gravity_forms_not_active', __( 'Gravity Forms plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		// Get all forms.
		$gforms = \GFAPI::get_forms();

		$fields = self::resolve_requested_fields( $request->get_param( 'fields' ) );

		$gforms = array_map(
			function ( $gform ) use ( $fields ) {
				return array_intersect_key( $gform, array_flip( $fields ) );
			},
			$gforms
		);

		return rest_ensure_response( $gforms );
	}

	/**
	 * Narrow a caller-supplied `fields` list to the allowlist.
	 *
	 * Applied unconditionally: an omitted or unrecognised `fields` value must
	 * never widen the response, so the caller can only ever narrow what the
	 * allowlist already permits.
	 *
	 * @param string|null $requested Comma-separated field list from the request.
	 * @return string[]
	 */
	public static function resolve_requested_fields( $requested ) {
		if ( empty( $requested ) || ! is_string( $requested ) ) {
			return self::ALLOWED_FORM_FIELDS;
		}

		$fields = array_unique( array_map( 'trim', explode( ',', $requested ) ) );
		$fields = array_values( array_intersect( $fields, self::ALLOWED_FORM_FIELDS ) );

		// Naming only disallowed fields would otherwise yield a list of empty
		// objects; fall back so the response is always usable. Narrowing to the
		// allowlist can never widen it.
		return empty( $fields ) ? self::ALLOWED_FORM_FIELDS : $fields;
	}

	/**
	 * Get a single Gravity Form.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_gform( $request ) {
		// Check if Gravity Forms plugin is active.
		if ( ! class_exists( 'GFAPI' ) ) {
			return new \WP_Error( 'gravity_forms_not_active', __( 'Gravity Forms plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$form_id = $request->get_param( 'id' );
		$theme   = $request->get_param( 'theme' );
		$form_id = absint( $form_id );

		if ( empty( $form_id ) ) {
			return new \WP_Error( 'invalid_form_id', __( 'Invalid form ID.', 'godam' ), array( 'status' => 404 ) );
		}

		$gform = do_shortcode( "[gravityform id='{$form_id}' title='false' description='false' ajax='true' theme='{$theme}']" );

		return rest_ensure_response( $gform );
	}
}
