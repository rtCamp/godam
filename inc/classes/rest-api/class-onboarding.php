<?php
/**
 * REST API class for onboarding / product-guide state.
 *
 * Persists per-user product-guide progress (the Video Editor guided tour) in
 * user meta so the "Get Started" welcome modal only auto-shows until the user
 * has either completed or dismissed the guide. State is per-user (not per-
 * browser) so it stays consistent across devices.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use WP_REST_Server;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class Onboarding
 */
class Onboarding extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'onboarding';

	/**
	 * User meta key storing the product-guide state.
	 *
	 * @var string
	 */
	const PRODUCT_GUIDE_META_KEY = 'rtgodam_product_guide_state';

	/**
	 * Allowed product-guide states.
	 *
	 * @var string[]
	 */
	const PRODUCT_GUIDE_STATES = array( 'pending', 'completed', 'dismissed' );

	/**
	 * Get the stored product-guide state for a user, falling back to "pending".
	 *
	 * @param int $user_id User ID. Defaults to the current user.
	 * @return string One of self::PRODUCT_GUIDE_STATES.
	 */
	public static function get_product_guide_state( $user_id = 0 ) {
		$user_id = $user_id ? $user_id : get_current_user_id();
		$state   = get_user_meta( $user_id, self::PRODUCT_GUIDE_META_KEY, true );

		return in_array( $state, self::PRODUCT_GUIDE_STATES, true ) ? $state : 'pending';
	}

	/**
	 * Register REST routes for onboarding.
	 *
	 * @return array Array of registered REST API routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/product-guide',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_product_guide' ),
						'permission_callback' => array( $this, 'permissions_check' ),
					),
					array(
						'methods'             => WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'update_product_guide' ),
						'permission_callback' => array( $this, 'permissions_check' ),
						'args'                => array(
							'status' => array(
								'type'     => 'string',
								'required' => true,
								'enum'     => self::PRODUCT_GUIDE_STATES,
							),
						),
					),
				),
			),
		);
	}

	/**
	 * Permission check — same capability the Video Editor page requires.
	 *
	 * @return bool Whether the current user can manage their onboarding state.
	 */
	public function permissions_check() {
		return current_user_can( 'upload_files' );
	}

	/**
	 * GET handler — return the current user's product-guide state.
	 *
	 * @return WP_REST_Response Response with the current state.
	 */
	public function get_product_guide() {
		return new WP_REST_Response(
			array( 'status' => self::get_product_guide_state() ),
			200
		);
	}

	/**
	 * POST handler — persist the current user's product-guide state.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response Response with the saved state.
	 */
	public function update_product_guide( WP_REST_Request $request ) {
		$status = $request->get_param( 'status' );

		update_user_meta( get_current_user_id(), self::PRODUCT_GUIDE_META_KEY, $status );

		return new WP_REST_Response( array( 'status' => $status ), 200 );
	}
}
