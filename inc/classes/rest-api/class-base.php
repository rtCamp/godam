<?php
/**
 * Abstract class for REST API endpoints with register_meta support.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Base class for REST API endpoints with register_meta support.
 */
abstract class Base extends \WP_REST_Controller {

	use Singleton;

	/**
	 * Endpoint namespace.
	 *
	 * @var string
	 */
	protected $namespace = 'godam/v1';

	/**
	 * Route base.
	 *
	 * @var string
	 */
	protected $rest_base = '';

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks and initialization.
	 */
	protected function setup_hooks() {
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
	}

	/**
	 * Response for a read that cannot go ahead because the site has no origin.
	 *
	 * An empty site_url makes the analytics service aggregate across every site on
	 * the account, so a handler with no origin must refuse to ask rather than widen
	 * the read.
	 *
	 * @param int $http_status HTTP status for the response.
	 * @return \WP_REST_Response
	 */
	protected function site_origin_unavailable_response( $http_status = 200 ) {
		return new \WP_REST_Response(
			array(
				'status'    => 'error',
				'message'   => __( 'This site\'s address could not be determined, so analytics were not requested. Check the Site Address in Settings > General.', 'godam' ),
				'errorType' => 'site_origin_unavailable',
			),
			$http_status
		);
	}

	/**
	 * Register REST routes.
	 */
	public function register_rest_routes() {
		$routes = $this->get_rest_routes();

		foreach ( $routes as $route ) {
			register_rest_route(
				$route['namespace'],
				$route['route'],
				$route['args']
			);
		}
	}

	/**
	 * Get REST routes.
	 */
	abstract public function get_rest_routes();

	/**
	 * Sets up the proper HTTP status code for authorization.
	 *
	 * @return int The HTTP status code.
	 */
	public function authorization_status_code() {
		$status = 401;

		if ( is_user_logged_in() ) {
			$status = 403;
		}

		return $status;
	}
}
