<?php
/**
 * Error_Handler class.
 * 
 * A Centralized class to throw all the plugin exceptions.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\Providers\Handlers;

use Transcoder\Inc\Traits\Singleton;
use Transcoder\Inc\Providers\Exceptions\EasyDamException;

/**
 * Class Error_Handler
 * 
 * A custom class to also handle the exception messages and show notices.
 */
class Error_Handler {

	use Singleton;

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
		foreach ( $this->notices as $notice ) {
			ob_start();
			?>
			<div class="notice notice-<?php echo esc_html( $notice['type'] ); ?> is-dismissible">
				<p><?php echo esc_html( $notice['message'] ); ?></p>
			</div>
			<?php
			echo ob_get_clean();
		}
	}

	/**
	 * Handle EasyDAMException.
	 *
	 * @param \EasyDAMException $exception The exception to handle.
	 */
	public static function handle_exception(EasyDAMException $exception) {

		$error_handler = self::get_instance();

		/**
		 * Only log the exception message in debug mode.
		 * 
		 * TODO: maybe add a setting to enable/disable logging.
		 */
		if( WP_DEBUG ) {
			error_log( $exception->getMessage() );
		}

		if ( $exception->should_show_notice() ) {
			$error_handler->add_notice( $exception->get_notice_type(), $exception->get_notice_message() );
		}
	}

	/**
	 * Add a notice to be displayed in the admin area.
	 *
	 * @param string $type    The type of notice (e.g., 'error', 'success').
	 * @param string $message The message to display in the notice.
	 */
	public function add_notice( $type, $message ) {
		$this->notices[] = array(
			'type'    => $type,
			'message' => $message,
		);
	}
}
