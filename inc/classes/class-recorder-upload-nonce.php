<?php
/**
 * Hand out a fresh upload nonce to the Fluent Forms and Ninja Forms recorder fields.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Recorder_Upload_Nonce
 *
 * The recorder fields print their upload nonce into the page. A full-page cache
 * (Nginx, Cloudflare, WordPress VIP) can serve that page for longer than a nonce
 * lives (one to two days), and then every upload from the cached copy fails its
 * nonce check. So the recorder asks this route for a fresh nonce right before it
 * uploads. admin-ajax.php is never page cached, so the nonce is made for the
 * visitor who is uploading, signed in or not.
 *
 * The nonce actions are the ones the upload handlers already check, so the
 * handlers do not change.
 *
 * @since n.e.x.t
 */
class Recorder_Upload_Nonce {

	use Singleton;

	/**
	 * The admin-ajax action that returns the nonce.
	 */
	const AJAX_ACTION = 'godam_recorder_upload_nonce';

	/**
	 * Register the admin-ajax action, for signed-in and signed-out visitors.
	 */
	protected function __construct() {
		add_action( 'wp_ajax_' . self::AJAX_ACTION, array( $this, 'send_nonce' ) );
		add_action( 'wp_ajax_nopriv_' . self::AJAX_ACTION, array( $this, 'send_nonce' ) );
	}

	/**
	 * The nonce action a recorder upload is checked against.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $form     'fluentforms' or 'ninja-forms'.
	 * @param int    $field_id Ninja Forms field ID. Not used for Fluent Forms.
	 *
	 * @return string The nonce action, or an empty string for an unknown form.
	 */
	public static function get_nonce_action( $form, $field_id ) {
		if ( 'fluentforms' === $form ) {
			// Checked in Fluent Forms Recorder_Field::upload_file_to_temp().
			return 'recorder-fluentforms';
		}

		if ( 'ninja-forms' === $form && $field_id > 0 ) {
			// Checked in Ninja_Forms_Field_Godam_Recorder::ajax_upload().
			return 'godam_recorder_' . $field_id;
		}

		return '';
	}

	/**
	 * Send a fresh nonce for the requested recorder field.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function send_nonce() {
		// phpcs:disable WordPress.Security.NonceVerification.Missing -- This route hands out the nonce, so there is none to check yet. It is the same nonce the form page prints for this visitor.
		$form     = isset( $_POST['form'] ) ? sanitize_key( wp_unslash( $_POST['form'] ) ) : '';
		$field_id = isset( $_POST['field_id'] ) ? absint( wp_unslash( $_POST['field_id'] ) ) : 0;
		// phpcs:enable WordPress.Security.NonceVerification.Missing

		$action = self::get_nonce_action( $form, $field_id );

		if ( '' === $action ) {
			wp_send_json_error( __( 'Unknown recorder field.', 'godam' ), 400 );
		}

		nocache_headers();

		wp_send_json_success( array( 'nonce' => wp_create_nonce( $action ) ) );
	}
}
