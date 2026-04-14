<?php
/**
 * Register REST API endpoints for Virtual Media Migration.
 *
 * This class handles the migration of virtual media.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class Virtual_Media_Migration
 */
class Virtual_Media_Migration extends Base {

	/**
	 * Get REST routes.
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
	 * @return array Array of job ids.
	 */
	private function get_job_ids_for_migration() {
		$job_ids        = array();
		$current_page   = 1;
		$posts_per_page = 100;

		do {
			$query = new \WP_Query(
				array(
					'post_type'      => 'attachment',
					'post_status'    => 'inherit',
					'fields'         => 'ids',
					'posts_per_page' => $posts_per_page,
					'paged'          => $current_page,
					'orderby'        => 'ID',
					'order'          => 'ASC',
					'meta_query'     => array(  // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
						'relation' => 'AND',
						array(
							'key'     => '_godam_original_id',
							'compare' => 'EXISTS',
						),
						array(
							'key'     => '_godam_original_id',
							'value'   => '',
							'compare' => '!=',
						),
					),
				)
			);

			$query_count = count( $query->posts );

			if ( empty( $query_count ) ) {
				break;
			}

			foreach ( $query->posts as $attachment_id ) {
				$job_id = get_post_meta( $attachment_id, '_godam_original_id', true );

				if ( '' !== $job_id ) {
					$job_ids[] = $job_id;
				}
			}

			++$current_page;
		} while ( $query_count === $posts_per_page );

		return array_values( array_unique( $job_ids ) );
	}
}
