<?php
/**
 * Register REST API endpoints for meta fields.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\REST_API;

use Transcoder\Inc\Traits\Singleton;


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
			'easydam_meta',
			array(
				'get_callback'    => function ( $post ) {
					return get_post_meta( $post['id'], 'easydam_meta', true );
				},
				'update_callback' => function ( $value, $post ) {
					return update_post_meta( $post->ID, 'easydam_meta', $value );
				},
			)
		);

		register_rest_field(
			'attachment',
			'easydam_analytics',
			array(
				'get_callback'    => function ( $post ) {
					return get_post_meta( $post['id'], 'easydam_analytics', true );
				},
				'update_callback' => function ( $value, $post ) {
					return update_post_meta( $post->ID, 'easydam_analytics', $value );
				},
			)
		);
	}
}
