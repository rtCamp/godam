<?php
/**
 * Register REST API endpoints for Gravity Forms.
 *
 * Get all Gravity Forms and a single Gravity Form.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class GF
 */
class Engagement extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'engagement';

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/likes',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_likes' ),
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							array(
								'video_id' => array(
									'description'       => __( 'The ID of the video.', 'godam' ),
									'type'              => 'integer',
									'required'          => true,
									'sanitize_callback' => 'absint',
								),
								'site_url' => array(
									'required'          => true,
									'type'              => 'string',
									'description'       => __( 'The Site URL associated with the video.', 'godam' ),
									'sanitize_callback' => 'esc_url_raw',
								),
							)
						),
					),
				),
			),
		);
	}

	/**
	 * Get total likes for a video.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_likes( $request ) {

		return $request->get_params();
	}
}
