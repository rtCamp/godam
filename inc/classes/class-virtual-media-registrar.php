<?php
/**
 * Register virtual media sites with GoDAM Central.
 *
 * @since 1.11.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Virtual_Media_Registrar.
 *
 * @since 1.11.0
 */
class Virtual_Media_Registrar {

	use Singleton;

	/**
	 * Meta key where the virtual job id is stored.
	 *
	 * @var string
	 */
	const META_ORIGINAL_ID = '_godam_original_id';

	/**
	 * Meta flag to avoid repeated registrations.
	 *
	 * @var string
	 */
	const META_REGISTERED = '_godam_virtual_site_registered';

	/**
	 * Construct method.
	 *
	 * @since 1.11.0
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Boot hooks.
	 *
	 * @since 1.11.0
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		add_action( 'added_post_meta', array( $this, 'maybe_register_from_meta_change' ), 10, 3 );
		add_action( 'updated_post_meta', array( $this, 'maybe_register_from_meta_change' ), 10, 3 );
		add_action( 'delete_attachment', array( $this, 'maybe_remove_virtual_media_site_on_delete' ) );

		// Async handlers dispatched by Action Scheduler.
		add_action( 'godam_async_register_virtual_media_site', array( $this, 'async_register_virtual_media_site' ), 10, 2 );
		add_action( 'godam_async_remove_virtual_media_site', array( $this, 'async_remove_virtual_media_site' ), 10, 2 );
	}

	/**
	 * If _godam_original_id meta is added/updated, attempt registration.
	 *
	 * @since 1.11.0
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

		$this->schedule_register_virtual_media_site( $post_id );
	}

	/**
	 * Enqueue an async Action Scheduler task to register the virtual media site.
	 * Guards against duplicate enqueues using the idempotency meta and AS pending-action check.
	 *
	 * @since 1.11.0
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return void
	 */
	private function schedule_register_virtual_media_site( int $attachment_id ) {
		$job_name = get_post_meta( $attachment_id, self::META_ORIGINAL_ID, true );
		// Bail early if there is nothing to register.
		if ( empty( $job_name ) ) {
			return;
		}

		// Already successfully registered — nothing to do.
		if ( get_post_meta( $attachment_id, self::META_REGISTERED, true ) ) {
			return;
		}

		if ( function_exists( 'as_enqueue_async_action' ) ) {
			// Avoid stacking duplicate pending actions for the same attachment.
			if ( ! as_has_scheduled_action( 'godam_async_register_virtual_media_site', array( $attachment_id, $job_name ) ) ) {
				as_enqueue_async_action( 'godam_async_register_virtual_media_site', array( $attachment_id, $job_name ) );
			}
		} else {
			// Action Scheduler unavailable — call synchronously.
			$this->async_register_virtual_media_site( $attachment_id, $job_name );
		}
	}

	/**
	 * Async Action Scheduler handler: perform the HTTP registration call.
	 *
	 * @since 1.11.0
	 *
	 * @param int    $attachment_id Attachment ID passed by Action Scheduler.
	 * @param string $job_name The original job name associated with this virtual media site.
	 *
	 * @return void
	 */
	public function async_register_virtual_media_site( $attachment_id, $job_name ) {
		$attachment_id = (int) $attachment_id;
		$result        = $this->register_site_for_attachment_if_needed( $attachment_id, $job_name );

		if ( is_wp_error( $result ) ) {
			error_log( // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
				sprintf(
					'GoDAM: Failed to register virtual media site for attachment %d (job: %s). Error: %s',
					$attachment_id,
					$job_name,
					$result->get_error_message()
				)
			);
		}
	}

	/**
	 * Register this site as a virtual media site for the attachment job if needed.
	 *
	 * @since 1.11.0
	 *
	 * @param int    $attachment_id Attachment ID.
	 * @param string $job_name The original job name associated with this virtual media site.
	 *
	 * @return true|\WP_Error True if registration is successful or not needed, WP_Error if registration fails.
	 */
	public function register_site_for_attachment_if_needed( $attachment_id, $job_name ) {

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

		// Invalidate the cached job ids.
		delete_transient( 'rtgodam_virtual_media_job_ids' );

		return true;
	}

	/**
	 * When an attachment is deleted, if it has a _godam_original_id meta, call Central to remove the virtual media site.
	 *
	 * @since 1.11.0
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

		if ( function_exists( 'as_enqueue_async_action' ) ) {
			if ( ! as_has_scheduled_action( 'godam_async_remove_virtual_media_site', array( $job_name, $post_id ) ) ) {
				as_enqueue_async_action( 'godam_async_remove_virtual_media_site', array( $job_name, $post_id ) );
			}
		} else {
			// Action Scheduler unavailable — call synchronously through the same handler.
			$this->async_remove_virtual_media_site( $job_name, $post_id );
		}
	}

	/**
	 * Async Action Scheduler handler: perform the HTTP removal call.
	 * Receives job_name directly because post meta is already gone when this runs.
	 *
	 * @since 1.11.0
	 *
	 * @param string $job_name The original job name passed by Action Scheduler.
	 * @param int    $post_id Optional attachment ID for richer fallback logging.
	 *
	 * @return void
	 */
	public function async_remove_virtual_media_site( $job_name, $post_id = 0 ) {
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
	 * @since 1.11.0
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

		// Invalidate the cached job ids.
		delete_transient( 'rtgodam_virtual_media_job_ids' );

		return true;
	}
}
