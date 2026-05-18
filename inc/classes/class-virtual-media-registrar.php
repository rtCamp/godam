<?php
/**
 * Register virtual media sites with GoDAM Central.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Virtual_Media_Registrar.
 */
class Virtual_Media_Registrar {

	use Singleton;

	/**
	 * Meta flag to avoid repeated registrations.
	 *
	 * @var string
	 */
	const META_REGISTERED = '_godam_virtual_site_registered';

	/**
	 * Meta key where the virtual job id is stored.
	 *
	 * @var string
	 */
	const META_ORIGINAL_ID = '_godam_original_id';

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Boot hooks.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		add_action( 'added_post_meta', array( $this, 'maybe_register_from_meta_change' ), 10, 3 );
		add_action( 'updated_post_meta', array( $this, 'maybe_register_from_meta_change' ), 10, 3 );
		add_action( 'add_attachment', array( $this, 'maybe_register_from_attachment' ), 22, 1 );
		add_action( 'delete_attachment', array( $this, 'maybe_remove_virtual_media_site_on_delete' ) );
	}

	/**
	 * If _godam_original_id meta is added/updated, attempt registration.
	 *
	 * @param int    $meta_id    Meta ID.
	 * @param int    $post_id    Post ID.
	 * @param string $meta_key   Meta key.
	 *
	 * @return void
	 */
	public function maybe_register_from_meta_change( $meta_id, $post_id, $meta_key ) {
		if ( self::META_ORIGINAL_ID !== $meta_key ) {
			return;
		}

		if ( 'attachment' !== get_post_type( $post_id ) ) {
			return;
		}

		$this->register_site_for_attachment_if_needed( (int) $post_id );
	}

	/**
	 * Fallback handler when attachment is created.
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return void
	 */
	public function maybe_register_from_attachment( $attachment_id ) {
		$this->register_site_for_attachment_if_needed( (int) $attachment_id );
	}

	/**
	 * Register this site as a virtual media site for the attachment job if needed.
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return true|\WP_Error True if registration is successful or not needed, WP_Error if registration fails.
	 */
	public function register_site_for_attachment_if_needed( $attachment_id ) {
		$job_name = get_post_meta( $attachment_id, self::META_ORIGINAL_ID, true );

		if ( empty( $job_name ) ) {
			return true;
		}

		$already_registered = get_post_meta( $attachment_id, self::META_REGISTERED, true );

		if ( ! empty( $already_registered ) ) {
			return true;
		}

		$api_key = get_option( 'rtgodam-api-key' );

		if ( empty( $api_key ) ) {
			return new \WP_Error( 'godam_missing_api_key', __( 'GoDAM API key is not configured on this site.', 'godam' ) );
		}

		if ( class_exists( '\\RTGODAM_Transcoder_Rest_Routes' ) ) {
			$callback_url = \RTGODAM_Transcoder_Rest_Routes::get_callback_url();
		} else {
			$callback_url = rest_url( 'godam/v1/transcoder-callback' );
		}

		$payload = array(
			'job_name'     => $job_name,
			'site_url'     => get_site_url(),
			'callback_url' => $callback_url,
			'api_key'      => $api_key,
		);

		if ( ! defined( 'RTGODAM_API_BASE' ) || empty( RTGODAM_API_BASE ) ) {
			return new \WP_Error( 'godam_missing_api_base', __( 'RTGODAM_API_BASE is not defined.', 'godam' ) );
		}

		$endpoint = trailingslashit( RTGODAM_API_BASE ) . 'api/method/godam_core.api.transcoder_job.add_virtual_media_site';

		$response = wp_remote_post(
			$endpoint,
			array(
				'method'  => 'POST',
				'timeout' => 10,  // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
				'headers' => array(
					'Content-Type' => 'application/json',
				),
				'body'    => wp_json_encode( $payload ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return new \WP_Error(
				'godam_virtual_site_register_failed',
				__( 'Failed to connect to GoDAM Central.', 'godam' ),
				array(
					'error' => $response->get_error_message(),
				)
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( 200 !== $code ) {
			return new \WP_Error(
				'godam_virtual_site_register_failed',
				__( 'Failed to register virtual media site with GoDAM Central.', 'godam' ),
				array(
					'http_code' => $code,
					'response'  => $body,
				)
			);
		}

		update_post_meta( $attachment_id, self::META_REGISTERED, 1 );

		return true;
	}

	/**
	 * When an attachment is deleted, if it has a _godam_original_id meta, call Central to remove the virtual media site.
	 *
	 * @param int $post_id Post ID.
	 *
	 * @return void
	 */
	public function maybe_remove_virtual_media_site_on_delete( $post_id ) {
		$post_id = (int) $post_id;

		// Only for virtual media attachments.
		$job_name = get_post_meta( $post_id, self::META_ORIGINAL_ID, true );
		if ( empty( $job_name ) ) {
			return;
		}

		$job_name = (string) $job_name;

		// If the virtual media registration meta is not present, we can skip the API call.
		$meta_registered = get_post_meta( $post_id, self::META_REGISTERED, true );
		if ( empty( $meta_registered ) ) {
			return;
		}

		// Call Central to remove the association.
		$result = $this->remove_virtual_media_site( $job_name );

		if ( is_wp_error( $result ) ) {
			error_log( // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
				sprintf(
					'GoDAM: Failed to remove virtual media site for job %s on delete of attachment %d. Error: %s',
					$job_name,
					$post_id,
					$result->get_error_message()
				)
			);
		}
	}

	/**
	 * Call GoDAM Central: remove_virtual_media_site
	 *
	 * @param string $job_name The original job name associated with this virtual media site.
	 * @return true|\WP_Error True if removal is successful, WP_Error if it fails.
	 */
	private function remove_virtual_media_site( string $job_name ) {
		$api_key = get_option( 'rtgodam-api-key' );
		if ( empty( $api_key ) ) {
			return new \WP_Error( 'godam_missing_api_key', __( 'GoDAM API key is not configured on this site.', 'godam' ) );
		}

		if ( ! defined( 'RTGODAM_API_BASE' ) || empty( RTGODAM_API_BASE ) ) {
			return new \WP_Error( 'godam_missing_api_base', __( 'RTGODAM_API_BASE is not defined.', 'godam' ) );
		}

		$endpoint = trailingslashit( RTGODAM_API_BASE ) . 'api/method/godam_core.api.transcoder_job.remove_virtual_media_site';

		$payload = array(
			'job_name' => $job_name,
			'site_url' => get_site_url(),
			'api_key'  => $api_key,
		);

		$response = wp_remote_post(
			$endpoint,
			array(
				'method'  => 'POST',
				'timeout' => 5,  // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
				'headers' => array(
					'Content-Type' => 'application/json',
				),
				'body'    => wp_json_encode( $payload ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( 200 !== $code ) {
			return new \WP_Error(
				'godam_virtual_site_remove_failed',
				__( 'Failed to remove virtual media site from GoDAM Central.', 'godam' ),
				array(
					'http_code' => $code,
					'response'  => $body,
				)
			);
		}

		return true;
	}
}
