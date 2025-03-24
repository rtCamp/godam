<?php
/**
 * Error_Handler class.
 * 
 * A Centralized class to throw all the plugin exceptions.
 *
 * @package transcoder
 */

namespace RTGODAM\Inc\Providers\Handlers;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;
use RTGODAM\Inc\Providers\Exceptions\EasyDamException;

/**
 * Class Error_Handler
 * 
 * A custom class to also handle the exception messages and show notices.
 */
class Error_Handler {

	use Singleton;

	/**
	 * Notices array.
	 *
	 * @var array
	 */
	private $notices = array();

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	public function setup_hooks() {
		add_action( 'admin_notices', array( $this, 'show_admin_notices' ) );
	}

	/**
	 * Show admin notices.
	 *
	 * @return void
	 */
	public function show_admin_notices() {
		if ( empty( $this->notices ) ) {
			return;
		}
	
		foreach ( $this->notices as $notice ) {
			$type    = isset( $notice['type'] ) ? $notice['type'] : 'info';
			$message = isset( $notice['message'] ) ? $notice['message'] : '';
	
			printf(
				'<div class="notice notice-%1$s is-dismissible"><p>%2$s</p></div>',
				esc_html( $type ),
				esc_html( $message )
			);
		}
	}

	/**
	 * Handle EasyDAMException.
	 *
	 * @param \EasyDAMException $exception The exception to handle.
	 * @param bool              $return_rest_response Whether to send a REST response.
	 */
	public static function handle_exception( EasyDAMException $exception, $return_rest_response = false ) {

		$error_handler = self::get_instance();

		/**
		 * Only log the exception message in debug mode.
		 * 
		 * TODO: maybe add a setting to enable/disable logging.
		 */
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
			error_log( $exception->getMessage() ); // phpcs:ignore
		}

		if ( $exception->should_show_notice() ) {
			$error_handler->add_notice( $exception->get_notice_type(), $exception->get_notice_message() );
		}

		if ( $return_rest_response ) {
			return $error_handler->return_rest_response( $exception );
		}
	}

	/**
	 * Add a notice to be displayed in the admin area.
	 *
	 * @param string $type    The type of notice (e.g., 'error', 'success').
	 * @param string $message The message to display in the notice.
	 */
	private function add_notice( $type, $message ) {
		$this->notices[] = array(
			'type'    => $type,
			'message' => $message,
		);
	}

	/**
	 * Send a REST response for an exception.
	 *
	 * @param EasyDAMException $exception The exception to send a response for.
	 */
	private function return_rest_response( EasyDAMException $exception ) {

		$response_data = array(
			'status'  => 'error',
			'message' => $exception->getMessage(),
		);

		return new \WP_REST_Response( $response_data, $exception->getCode() );
	}
}
