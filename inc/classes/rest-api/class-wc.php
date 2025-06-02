<?php
/**
 * Register REST API endpoints for WooCommerce Products.
 *
 * Get all WooCommerce Products and a single Product.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class LocationAPI
 */
class WC extends Base {

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/wcproducts',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_products' ),
						'permission_callback' => '__return_true',
						'args'                => $this->get_collection_params(),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/wcproduct',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_product' ),
						'permission_callback' => '__return_true',
						'args'                => array(
							'id' => array(
								'description'       => 'The ID of the product.',
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
	 * Get all WooCommerce products.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_products( $request ) {
		$search = sanitize_text_field( $request->get_param( 'search' ) );
	
		$args = [
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => 20,
			's'              => $search,
			'tax_query'      => [
				'relation' => 'OR',
				[
					'taxonomy' => 'product_cat',
					'field'    => 'name',
					'terms'    => $search,
					'operator' => 'LIKE',
				],
				[
					'taxonomy' => 'product_tag',
					'field'    => 'name',
					'terms'    => $search,
					'operator' => 'LIKE',
				],
				[
					'taxonomy' => 'product_brand',
					'field'    => 'name',
					'terms'    => $search,
					'operator' => 'LIKE',
				],
			],
		];
	
		// Allow numeric search by ID.
		if ( is_numeric( $search ) ) {
			$args['post__in'] = [ intval( $search ) ];
		}
	
		$query = new \WP_Query( $args );
	
		$products = array_map( function ( $post ) {
			$product = wc_get_product( $post );

			$type = $product->get_type();
			$name_display = $product->get_name();

			if ( $type === 'variable' ) {

				// Get variation prices.
				$min_price = $product->get_variation_price( 'min', true );
				$max_price = $product->get_variation_price( 'max', true );
	
				if ( $min_price === $max_price ) {
					$price_display = wc_price( $min_price );
				} else {
					$price_display = wc_price( $min_price ) . ' - ' . wc_price( $max_price );
				}
	
			} else if ( $type === 'grouped' ) {
	
				$child_ids = $product->get_children();
				$child_count = count( $child_ids );
			
				// Get all child prices.
				$child_prices = array_map( function( $child_id ) {
					$child_product = wc_get_product( $child_id );
					return $child_product ? $child_product->get_price() : null;
				}, $child_ids );
			
				$child_prices = array_filter( $child_prices );
				$min_price = count( $child_prices ) ? min( $child_prices ) : 0;
			
				// Format name and price.
				$name_display = $product->get_name() . " ({$child_count} items)";
				$price_display = $min_price > 0 ? 'From: ' . wc_price( $min_price ) . ' + more' : 'N/A';
	
			} else {
	
				$price_display = wc_price( $product->get_price() );
			}

			return [
				'id'    => $product->get_id(),
				'name'  => $name_display,
				'price' => $price_display,
				'type'  => $product->get_type(),
				'link'  => get_permalink( $product->get_id() ),
				'image' => wp_get_attachment_url( $product->get_image_id() ) ?: wc_placeholder_img_src(),
			];
		}, $query->posts );
	
		return rest_ensure_response( $products );
	}	

	/**
	 * Get a single WooCommerce product.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_product( $request ) {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return new \WP_Error( 'woocommerce_not_active', 'WooCommerce plugin is not active.', array( 'status' => 404 ) );
		}

		$product_id = absint( $request->get_param( 'id' ) );

		if ( empty( $product_id ) ) {
			return new \WP_Error( 'invalid_product_id', 'Invalid product ID.', array( 'status' => 404 ) );
		}

		$product = wc_get_product( $product_id );

		if ( ! $product ) {
			return new \WP_Error( 'product_not_found', 'Product not found.', array( 'status' => 404 ) );
		}

		$type = $product->get_type();
		$name_display = $product->get_name();

		if ( $type === 'variable' ) {

			// Get variation prices.
			$min_price = $product->get_variation_price( 'min', true );
			$max_price = $product->get_variation_price( 'max', true );

			if ( $min_price === $max_price ) {
				$price_display = wc_price( $min_price );
			} else {
				$price_display = wc_price( $min_price ) . ' - ' . wc_price( $max_price );
			}

		} else if ( $type === 'grouped' ) {

			$child_ids = $product->get_children();
			$child_count = count( $child_ids );
		
			// Get all child prices.
			$child_prices = array_map( function( $child_id ) {
				$child_product = wc_get_product( $child_id );
				return $child_product ? $child_product->get_price() : null;
			}, $child_ids );
		
			$child_prices = array_filter( $child_prices );
			$min_price = count( $child_prices ) ? min( $child_prices ) : 0;
		
			// Format name and price.
			$name_display = $product->get_name() . " ({$child_count} items)";
			$price_display = $min_price > 0 ? 'From: ' . wc_price( $min_price ) . ' + more' : 'N/A';

		} else {

			$price_display = wc_price( $product->get_price() );
		}

		$data = array(
			'id'    => $product->get_id(),
			'name'  => $name_display,
			'price' => $price_display,
			'type'  => $product->get_type(),
			'link'  => get_permalink( $product->get_id() ),
			'image' => wp_get_attachment_url( $product->get_image_id() ) ?: wc_placeholder_img_src(),
		);

		return rest_ensure_response( $data );
	}
}
