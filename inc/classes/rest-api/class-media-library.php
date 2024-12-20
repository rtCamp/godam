<?php
/**
 * REST API class for Media Library Pages.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\REST_API;

/**
 * Class Media_Library
 */
class Media_Library extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'media-library';

	/**
	 * Register custom REST API routes for Settings Pages.
	 *
	 * @return array Array of registered REST API routes
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/assign-folder',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'assign_images_to_folder' ),
					'permission_callback' => function () {
						return current_user_can( 'edit_posts' );
					},
					'args'                => array(
						'attachment_ids' => array(
							'required' => true,
							'type'     => 'array',
							'items'    => array( 'type' => 'integer' ),
							'description' => 'Array of attachment IDs to associate.',
						),
						'folder_term_id' => array(
							'required' => true,
							'type'     => 'integer',
							'description' => 'ID of the folder term to associate with the attachments.',
						),
					),
			
				),
			)
		);
	}

	/**
	 * Verify the license key using external API.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response
	 */
	function assign_images_to_folder( $request ) {
		$attachment_ids = $request->get_param( 'attachment_ids' );
		$folder_term_id = $request->get_param( 'folder_term_id' );
	
		$term = get_term( $folder_term_id, 'media-folder' );

		if ( ! $term || is_wp_error( $term ) ) {
			return new \WP_Error( 'invalid_term', 'Invalid folder term ID.', array( 'status' => 400 ) );
		}
	
		foreach ( $attachment_ids as $attachment_id ) {
			if ( get_post_type( $attachment_id ) !== 'attachment' ) {
				return new \WP_Error( 'invalid_attachment', 'Invalid attachment ID.', array( 'status' => 400 ) );
			}
	
			$return = wp_set_object_terms( $attachment_id, $folder_term_id, 'media-folder' );
	
			if ( is_wp_error( $return ) ) {
				return new \WP_Error( 'term_assignment_failed', 'Failed to associate attachments with the folder.', array( 'status' => 500 ) );
			}
		}
	
		return rest_ensure_response( array(
			'success' => true,
			'message' => 'Attachments successfully associated with the folder.',
		) );
	}
}
