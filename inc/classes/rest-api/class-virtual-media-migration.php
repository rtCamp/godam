<?php
/**
 * Register REST API endpoints for Virtual Media Migration.
 *
 * This class handles the migration of virtual media.
 *
 * @since 1.11.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

use RTGODAM\Inc\Virtual_Media_Registrar;

defined( 'ABSPATH' ) || exit;

/**
 * Class Virtual_Media_Migration
 *
 * @since 1.11.0
 */
class Virtual_Media_Migration extends Base {

	/**
	 * Get REST routes.
	 *
	 * @since 1.11.0
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/virtual-media-migration',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'migrate_virtual_media' ),
						'permission_callback' => array( $this, 'verify_permission' ),
						'args'                => array(
							'api_key' => array(
								'required'          => true,
								'type'              => 'string',
								'description'       => __( 'API key used to authenticate the request from the GoDAM app.', 'godam' ),
								'sanitize_callback' => 'sanitize_text_field',
							),
						),
					),
				),
			),
		);
	}

	/**
	 * Permission check for virtual media migration.
	 *
	 * @since 1.11.0
	 *
	 * @param \WP_REST_Request $request The REST request.
	 *
	 * @return bool|\WP_Error True if permission is granted, WP_Error otherwise.
	 */
	public function verify_permission( $request ) {

		// Check API Key.
		$incoming_api_key = $request->get_param( 'api_key' ) ?? '';
		$stored_api_key   = get_option( 'rtgodam-api-key', '' );

		if ( empty( $stored_api_key ) || ! hash_equals( $stored_api_key, $incoming_api_key ) ) {
			return new \WP_Error( 'forbidden', __( 'Invalid API Key.', 'godam' ), array( 'status' => 403 ) );
		}

		return true;
	}

	/**
	 * Migrate virtual media.
	 *
	 * @since 1.11.0
	 *
	 * @param \WP_REST_Request $request The REST request.
	 *
	 * @return \WP_REST_Response
	 */
	public function migrate_virtual_media( $request ) {
		// Ensure the transcoder callback URL is defined.
		if ( defined( 'RTGODAM_TRANSCODER_CALLBACK_URL' ) && ! empty( RTGODAM_TRANSCODER_CALLBACK_URL ) ) {
			$transcoder_callback_url = RTGODAM_TRANSCODER_CALLBACK_URL;
		} else {
			include_once RTGODAM_PATH . 'admin/class-rtgodam-transcoder-rest-routes.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
			$transcoder_callback_url = \RTGODAM_Transcoder_Rest_Routes::get_callback_url();
		}

		return new \WP_REST_Response(
			array(
				'success'      => true,
				'site_url'     => site_url(),
				'callback_url' => $transcoder_callback_url,
				'job_ids'      => $this->get_job_ids_for_migration(),
			),
			200
		);
	}

	/**
	 * Get the list of job ids from the meta of attachment posts.
	 *
	 * @since 1.11.0
	 *
	 * @return array Array of job ids.
	 */
	private function get_job_ids_for_migration() {

		$job_ids = get_transient( 'rtgodam_virtual_media_job_ids' );

		if ( false === $job_ids ) {
			global $wpdb;
			$job_ids = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$wpdb->prepare(
					"SELECT DISTINCT meta_value FROM {$wpdb->postmeta} pm
					INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
					WHERE pm.meta_key = %s AND pm.meta_value != ''
					AND p.post_type = 'attachment'",
					Virtual_Media_Registrar::META_ORIGINAL_ID,
				)
			);
			set_transient( 'rtgodam_virtual_media_job_ids', $job_ids, HOUR_IN_SECONDS );
		}

		return $job_ids;
	}
}
