<?php
/**
 * Abstract class for REST API endpoints with register_meta support.
 *
 * @since 1.0.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Base class for REST API endpoints with register_meta support.
 *
 * @since 1.0.0
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
	 *
	 * @since 1.0.0
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks and initialization.
	 *
	 * @since 1.0.0
	 */
	protected function setup_hooks() {
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
	}

	/**
	 * Register REST routes.
	 *
	 * @since 1.0.0
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
	 *
	 * @since 1.0.0
	 */
	abstract public function get_rest_routes();

	/**
	 * Sets up the proper HTTP status code for authorization.
	 *
	 * @since 1.0.0
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
