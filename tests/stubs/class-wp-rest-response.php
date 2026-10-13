<?php
/**
 * Minimal WP_REST_Response stand-in for the pure (no-WordPress) unit suite.
 *
 * The Analytics proxy methods return WP_REST_Response( $data, $status ). This
 * stub captures both so a test can assert on the response body and status code
 * without a WordPress install. Guarded so a real WP test bootstrap wins.
 *
 * @package GoDAM
 */

if ( ! class_exists( 'WP_REST_Response' ) ) {

	/**
	 * Captures the data + status the proxy returns.
	 */
	class WP_REST_Response {

		/**
		 * Response body.
		 *
		 * @var mixed
		 */
		private $data;

		/**
		 * HTTP status.
		 *
		 * @var int
		 */
		private $status;

		/**
		 * @param mixed $data   Response body.
		 * @param int   $status HTTP status.
		 */
		public function __construct( $data = null, $status = 200 ) {
			$this->data   = $data;
			$this->status = $status;
		}

		/**
		 * @return mixed
		 */
		public function get_data() {
			return $this->data;
		}

		/**
		 * @return int
		 */
		public function get_status() {
			return $this->status;
		}
	}
}
