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
	final protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks and initialization.
	 */
	protected function setup_hooks() {
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
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
