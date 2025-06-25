<?php
/**
 * Register REST API endpoints for player preview.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

/**
 * Class Polls
 */
class Player_Preview extends Base {

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes(): array {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/player-preview/(?P<id>\d+)',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'generate_player_preview' ),
						'permission_callback' => '__return_true',
						'args'                =>
							array(
								'id' => array(
									'description'       => __( 'The ID of the media attachment.', 'godam' ),
									'type'              => 'integer',
									'required'          => true,
									'sanitize_callback' => 'absint',
								),
							),
					),
				),
			),
		);
	}

	/**
	 * Get player preview html for a media attachment.
	 *
	 * @param \WP_REST_Request $request The request object.
	 *
	 * @return \WP_REST_Response |\WP_Error
	 */
	public function generate_player_preview( \WP_REST_Request $request ) {

		$attachment_id = $request->get_param( 'id' );

		if ( empty( $attachment_id ) ) {
			return new \WP_Error( 'invalid_attachment_id', __( 'Invalid media attachment ID.', 'godam' ), array( 'status' => 404 ) );
		}

		$attrs = array(
			'id' => $attachment_id,
		);

		$block = array(
			'blockName'    => 'godam/video',
			'attrs'        => $attrs,
			'innerBlocks'  => array(),
			'innerHTML'    => '',
			'innerContent' => array(),
		);

		$block_content = render_block( $block );

		$return_object = array(
			'html' => $block_content,
			'id'   => $attachment_id,
		);

		return rest_ensure_response( $return_object );
	}
}
