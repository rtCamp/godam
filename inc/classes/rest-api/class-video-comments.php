<?php
/**
 * Register REST API endpoints for any Assets file endpoints.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\REST_API;

/**
 * Class LocationAPI
 */
class Video_Comments extends Base {

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/video-reactions',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'add_video_reaction' ),
						'permission_callback' => array( $this, 'reaction_permissions_check' ),
						'args'                => $this->get_collection_params(),
					),
				),
			),
		);
	}

	/**
	 * Get all Gravity Forms.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function add_video_reaction( $request ) {

		$attachment_id   = $request->get_param( 'attachment_id' );
		$reaction        = $request->get_param( 'reaction' );
		$video_timestamp = $request->get_param( 'reaction_time' );


		$new_comment = wp_insert_comment(
			array(
				'comment_post_ID'       => $attachment_id,
				'comment_content'       => $reaction,
				'comment_author'        => get_current_user_id(),
				'comment_author_email'  => get_userdata( get_current_user_id() )->user_email,
				'comment_author_url'    => '',
				'comment_type'          => 'video_reaction',
				'comment_parent'        => 0,
				'comment_author_IP'     => $_SERVER['REMOTE_ADDR'],
				'comment_agent'         => $_SERVER['HTTP_USER_AGENT'],
				'comment_date'          => current_time( 'mysql' ),
				'comment_date_gmt'      => current_time( 'mysql', 1 ),
				'comment_approved'      => 1,
				'comment_karma'         => 0,
			)
		);

		if ( $new_comment ) {
			add_comment_meta( $new_comment, '_godam_reaction_time', $video_timestamp );
			
			return new \WP_REST_Response(
				array(
					'success'     => true,
					'message'     => 'Reaction added successfully.',
					'reaction_id' => $new_comment,
				),
				200
			);
		}
		else {
			return new \WP_REST_Response(
				array(
					'success'     => false,
					'message'     => 'New reaction comment was not created.',
				),
				400
			);
		}

	}

	/**
	 * New reaction creation permissions check.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return bool
	 */
	public function reaction_permissions_check( $request ) {
		return true;
	}
}
