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
	 * Try to match a search string against several taxonomies.
	 * Always return an array with the keys we need.
	 *
	 * @param string   $search_term Search string to look up.
	 * @param string[] $taxonomies  Array of taxonomy slugs to search in.
	 * @return array{term_id:int,taxonomy:string}|false Array with term ID and taxonomy, or false when no match
	 */
	public function godam_find_term( $search_term, array $taxonomies ) {
		foreach ( $taxonomies as $tax ) {
			$found = term_exists( $search_term, $tax );

			if ( ! $found ) {
				continue;
			}

			// Normalise every possible return type.
			if ( is_int( $found ) ) {
				return array(
					'term_id'  => $found,
					'taxonomy' => $tax,
				);
			}

			if ( $found instanceof \WP_Term ) { 
				return array(
					'term_id'  => $found->term_id,
					'taxonomy' => $found->taxonomy,
				);
			}

			if ( is_array( $found ) ) {
				return array(
					'term_id'  => (int) $found['term_id'],
					'taxonomy' => $tax,
				);
			}
		}

		return false; // Nothing matched.
	}

	/**
	 * Get all WooCommerce products.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_products( $request ) {
		$search     = sanitize_text_field( $request->get_param( 'search' ) );
		$is_numeric = is_numeric( $search );
		$term_info  = $this->godam_find_term( $search, array( 'product_cat', 'product_tag', 'product_brand' ) );
	
		$args = array(
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => 20,
		);
	
		// Allow numeric search by ID.
		if ( $is_numeric ) {
			$args['post__in'] = array( (int) $search );
		} elseif ( $term_info ) {
			$args['tax_query'] = array( // phpcs:ignore
				'relation' => 'OR',
				array(
					'taxonomy' => $term_info['taxonomy'],
					'field'    => 'slug',
					'terms'    => array( $search ),
					'operator' => 'IN',
				),
				array(
					'taxonomy' => $term_info['taxonomy'],
					'field'    => 'name',
					'terms'    => $search,
					'operator' => 'LIKE',
				),
			);
		} else {
			$args['s'] = $search;
		}
	
		$query = new \WP_Query( $args );
	
		$products = array_map(
			function ( $post ) {
				$product = wc_get_product( $post );

				$type         = $product->get_type();
				$name_display = $product->get_name();

				if ( 'variable' === $type ) {

					// Get variation prices.
					$min_price = $product->get_variation_price( 'min', true );
					$max_price = $product->get_variation_price( 'max', true );
	
					if ( $min_price === $max_price ) {
						$price_display = wc_price( $min_price );
					} else {
						$price_display = wc_price( $min_price ) . ' - ' . wc_price( $max_price );
					}           
				} elseif ( 'grouped' === $type ) {
	
					$child_ids   = $product->get_children();
					$child_count = count( $child_ids );
	
					// Get all child prices.
					$child_prices = array_map(
						function ( $child_id ) {
							$child_product = wc_get_product( $child_id );
							return $child_product ? $child_product->get_price() : null;
						},
						$child_ids 
					);
	
					$child_prices = array_filter( $child_prices );
					$min_price    = count( $child_prices ) ? min( $child_prices ) : 0;
	
					// Format name and price.
					$name_display  = $product->get_name() . " ({$child_count} items)";
					$price_display = $min_price > 0 ? 'From: ' . wc_price( $min_price ) . ' + more' : 'N/A';
	
				} else {
	
					$price_display = wc_price( $product->get_price() );
				}

				$categories = array_map(
					function ( $term ) {
						return array(
							'name' => $term->name,
							'slug' => $term->slug,
						);
					},
					wp_get_post_terms(
						$product->get_id(),
						'product_cat',
						array( 'fields' => 'all' )
					)
				);
				
				$tags = array_map(
					function ( $term ) {
						return array(
							'name' => $term->name,
							'slug' => $term->slug,
						);
					},
					wp_get_post_terms(
						$product->get_id(),
						'product_tag',
						array( 'fields' => 'all' )
					)
				);
				
				$brands = array_map(
					function ( $term ) {
						return array(
							'name' => $term->name,
							'slug' => $term->slug,
						);
					},
					wp_get_post_terms(
						$product->get_id(),
						'product_brand',
						array( 'fields' => 'all' )
					)
				);

				return array(
					'id'         => $product->get_id(),
					'name'       => $name_display,
					'price'      => $price_display,
					'type'       => $product->get_type(),
					'link'       => get_permalink( $product->get_id() ),
					'image'      => wp_get_attachment_url( $product->get_image_id() ) ?: wc_placeholder_img_src(),
					'categories' => $categories,
					'tags'       => $tags,
					'brands'     => $brands,
				);
			},
			$query->posts 
		);
	
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

		$type         = $product->get_type();
		$name_display = $product->get_name();

		if ( 'variable' === $type ) {

			// Get variation prices.
			$min_price = $product->get_variation_price( 'min', true );
			$max_price = $product->get_variation_price( 'max', true );

			if ( $min_price === $max_price ) {
				$price_display = wc_price( $min_price );
			} else {
				$price_display = wc_price( $min_price ) . ' - ' . wc_price( $max_price );
			}       
		} elseif ( 'grouped' === $type ) {

			$child_ids   = $product->get_children();
			$child_count = count( $child_ids );
		
			// Get all child prices.
			$child_prices = array_map(
				function ( $child_id ) {
					$child_product = wc_get_product( $child_id );
					return $child_product ? $child_product->get_price() : null;
				},
				$child_ids 
			);
		
			$child_prices = array_filter( $child_prices );
			$min_price    = count( $child_prices ) ? min( $child_prices ) : 0;
		
			// Format name and price.
			$name_display  = $product->get_name() . " ({$child_count} items)";
			$price_display = $min_price > 0 ? 'From: ' . wc_price( $min_price ) . ' + more' : 'N/A';

		} else {

			$price_display = wc_price( $product->get_price() );
		}

		$categories = array_map(
			function ( $term ) {
				return array(
					'name' => $term->name,
					'slug' => $term->slug,
				);
			},
			wp_get_post_terms(
				$product->get_id(),
				'product_cat',
				array( 'fields' => 'all' )
			)
		);
		
		$tags = array_map(
			function ( $term ) {
				return array(
					'name' => $term->name,
					'slug' => $term->slug,
				);
			},
			wp_get_post_terms(
				$product->get_id(),
				'product_tag',
				array( 'fields' => 'all' )
			)
		);
		
		$brands = array_map(
			function ( $term ) {
				return array(
					'name' => $term->name,
					'slug' => $term->slug,
				);
			},
			wp_get_post_terms(
				$product->get_id(),
				'product_brand',
				array( 'fields' => 'all' )
			)
		);

		$data = array(
			'id'         => $product->get_id(),
			'name'       => $name_display,
			'price'      => $price_display,
			'type'       => $product->get_type(),
			'link'       => get_permalink( $product->get_id() ),
			'image'      => wp_get_attachment_url( $product->get_image_id() ) ?: wc_placeholder_img_src(),
			'categories' => $categories,
			'tags'       => $tags,
			'brands'     => $brands,
		);

		return rest_ensure_response( $data );
	}
}
