<?php
/**
 * Minimal WP_REST_Request stand-in for the pure (no-WordPress) unit suite.
 *
 * The Analytics proxy methods type-hint WP_REST_Request and read their inputs
 * through get_param(). This stub holds a plain param map so a test can build a
 * request without a WordPress install. Guarded so a real WP test bootstrap wins.
 *
 * @package GoDAM
 */

if ( ! class_exists( 'WP_REST_Request' ) ) {

	/**
	 * Holds a param map and returns from it.
	 */
	class WP_REST_Request {

		/**
		 * Request params.
		 *
		 * @var array<string, mixed>
		 */
		private $params;

		/**
		 * HTTP method.
		 *
		 * @var string
		 */
		private $method;

		/**
		 * @param array<string, mixed> $params Request params.
		 * @param string               $method HTTP method.
		 */
		public function __construct( array $params = array(), $method = 'GET' ) {
			$this->params = $params;
			$this->method = $method;
		}

		/**
		 * @return string The HTTP method.
		 */
		public function get_method() {
			return $this->method;
		}

		/**
		 * @param string $key Param name.
		 * @return mixed Null when the param was not supplied.
		 */
		public function get_param( $key ) {
			return array_key_exists( $key, $this->params ) ? $this->params[ $key ] : null;
		}
	}
}
