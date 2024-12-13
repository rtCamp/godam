<?php
/**
 * REST API class.
 *
 * @package transcoder
 */

namespace Transcoder\Inc;

use Transcoder\Inc\Traits\Singleton;

/**
 * Class Rest_API
 */
class Rest_API {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup action/filter hooks.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register custom REST API routes.
	 *
	 * @return void
	 */
	public function register_routes() {
	}
}
