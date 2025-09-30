<?php
/**
 * WooCommerce Layer Integration
 *
 * This class is responsible for synchronizing WooCommerce product data 
 * with video hotspots stored in attachments. Whenever a product is 
 * updated or its stock changes, the relevant product details in all 
 * related video hotspots are updated automatically.
 *
 * @package RTGODAM
 */

namespace RTGODAM\Inc\WooCommerce;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class WC_Woocommerce_Layer
 */
class WC_Woocommerce_Layer {

	use Singleton;

	/**
	 * Constructor - hook into product update.
	 */
	public function __construct() {
		add_action( 'woocommerce_update_product', array( $this, 'update_hotspot_product_details' ), 10, 1 );
	}

	/**
	 * Update all hotspots whenever a WooCommerce product is updated.
	 *
	 * @param int $post_id The product ID.
	 */
	public function update_hotspot_product_details( $post_id ) {
		if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) ) {
			return;
		}

		$request = new \WP_REST_Request( 'GET', '/godam/v1/wcproduct' );
		$request->set_param( 'id', $post_id );

		$response = rest_do_request( $request );

		if ( $response->is_error() ) {
			$error = $response->as_error();

			// phpcs:ignore
			error_log(
				sprintf(
					'Updating hotspot_product_details failed (code: %s) - %s',
					$error->get_error_code(),
					$error->get_error_message()
				) 
			);
			
			return;
		}

		$data = $response->get_data();

		if ( empty( $data ) || ! is_array( $data ) ) {
			return;
		}

		$product_data = $data;

		// Find all attachments that may contain hotspots.
		$attachments = get_posts(
			array(
				'post_type'      => 'attachment',
				'posts_per_page' => -1,
				'meta_key'       => 'rtgodam_meta',
				'post_mime_type' => 'video/mp4',
			) 
		);

		foreach ( $attachments as $attachment ) {
			$meta = get_post_meta( $attachment->ID, 'rtgodam_meta', true );

			if ( empty( $meta ) || ! is_array( $meta ) ) {
				continue;
			}

			// Only proceed if 'layers' exists and is not empty.
			if ( empty( $meta['layers'] ) || ! is_array( $meta['layers'] ) ) {
				continue;
			}

			$updated = false;

			foreach ( $meta['layers'] as &$layer ) {
				// Only for type = woo.
				if ( 'woo' === isset( $layer['type'] ) && $layer['type'] ) {

					if ( ! empty( $layer['productHotspots'] ) && is_array( $layer['productHotspots'] ) ) {
						foreach ( $layer['productHotspots'] as &$hotspot ) {
							if (
								isset( $hotspot['productDetails']['id'] )
								&& intval( $hotspot['productDetails']['id'] ) === $post_id
							) {
								$hotspot['productDetails'] = $product_data;
								$updated                   = true;
							}
						}
					}
				}
			}

			// Save back if anything changed.
			if ( $updated ) {
				update_post_meta( $attachment->ID, 'rtgodam_meta', $meta );
			}
		}
	}
}
