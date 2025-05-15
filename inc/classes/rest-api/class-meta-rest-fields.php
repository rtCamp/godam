<?php
/**
 * Register REST API endpoints for meta fields.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;


/**
 * Modify Rest fields.
 */
class Meta_Rest_Fields {

	use Singleton;

	/**
	 * Construct method.
	 */
	final protected function __construct() {
		add_action( 'rest_api_init', array( $this, 'add_meta_rest_fields' ), 10, 3 );
	}

	/**
	 * Modify the response to include the 'post-related-posts' field.
	 *
	 * @return void
	 */
	public function add_meta_rest_fields() {
		register_rest_field(
			'attachment',
			'rtgodam_meta',
			array(
				'get_callback'    => function ( $post ) {
					return get_post_meta( $post['id'], 'rtgodam_meta', true );
				},
				'update_callback' => function ( $value, $post ) {
					return update_post_meta( $post->ID, 'rtgodam_meta', $value );
				},
			)
		);

		register_rest_field(
			'attachment',
			'rtgodam_analytics',
			array(
				'get_callback'    => function ( $post ) {
					return get_post_meta( $post['id'], 'rtgodam_analytics', true );
				},
				'update_callback' => function ( $value, $post ) {
					return update_post_meta( $post->ID, 'rtgodam_analytics', $value );
				},
			)
		);

		register_post_meta(
			'attachment',
			'rtgodam_media_video_thumbnail',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);

		register_post_meta(
			'attachment',
			'rtgodam_transcoding_job_id',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);
	}
}
