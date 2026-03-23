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
					// Server side validation - Strip premium layers from save payload when API key is not valid.
					// Data integrity: already-saved premium layers are preserved in existing meta;
					// we only prevent NEW premium layers from being added without a license.
					if ( ! rtgodam_is_api_key_valid() && ! empty( $value['layers'] ) && is_array( $value['layers'] ) ) {
						$premium_types   = rtgodam_get_premium_layer_types();
						$existing_meta   = get_post_meta( $post->ID, 'rtgodam_meta', true );
						$existing_layers = ! empty( $existing_meta['layers'] ) ? $existing_meta['layers'] : array();

						// Build a set of already-saved premium layer IDs so we can preserve them.
						$existing_premium_ids = array();
						foreach ( $existing_layers as $layer ) {
							if ( isset( $layer['type'], $layer['id'] ) && in_array( $layer['type'], $premium_types, true ) ) {
								$existing_premium_ids[] = $layer['id'];
							}
						}

						// Filter: keep free layers, and only keep premium layers that already existed.
						$value['layers'] = array_values(
							array_filter(
								$value['layers'],
								function ( $layer ) use ( $premium_types, $existing_premium_ids ) {
									if ( ! isset( $layer['type'] ) || ! in_array( $layer['type'], $premium_types, true ) ) {
										return true; // Free layer — always allow.
									}
									// Premium layer — only allow if it was already saved (preserve existing data).
									return isset( $layer['id'] ) && in_array( $layer['id'], $existing_premium_ids, true );
								}
							)
						);
					}

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

		register_post_meta(
			'attachment',
			'rtgodam_hls_transcoded_url',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
				'get_callback'  => function ( $post ) {
					return rtgodam_get_hls_transcoded_url_from_attachment( $post->ID );
				},
			)
		);
	}
}
