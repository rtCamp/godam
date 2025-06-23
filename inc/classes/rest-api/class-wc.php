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
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/link-video',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'link_video_to_product' ),
						'permission_callback' => function ( \WP_REST_Request $req ) {
							$product_id = (int) $req->get_param( 'product_id' );
							return current_user_can( 'edit_post', $product_id );
						},
						'args'                => array(
							'product_id'    => array(
								'required'          => true,
								'type'              => 'integer',
								'sanitize_callback' => 'absint',
							),
							'attachment_id' => array(
								'required'          => true,
								'type'              => 'integer',
								'sanitize_callback' => 'absint',
							),
							'url'           => array(
								'required'          => true,
								'type'              => 'string',
								'sanitize_callback' => 'esc_url_raw',
							),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/video-product-count/(?P<id>\d+)',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_video_product_count' ),
						'permission_callback' => function () {
							return current_user_can( 'edit_products' );
						},
						'args'                => array(
							'id' => array(
								'description'       => 'Attachment (video) ID.',
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

	/**
	 * Link a video to a WooCommerce product (and vice versa).
	 *
	 * If the video is already linked, the endpoint ensures no duplication occurs.
	 *
	 * @param \WP_REST_Request $request The REST request containing product_id, attachment_id, and url.
	 * @return \WP_REST_Response|\WP_Error A REST response confirming success, or an error if parameters are missing.
	 */
	public function link_video_to_product( \WP_REST_Request $request ) {

		$product_id    = (int) $request->get_param( 'product_id' );
		$attachment_id = (int) $request->get_param( 'attachment_id' );
		$url           = esc_url_raw( $request->get_param( 'url' ) );

		if ( ! $product_id || ! $attachment_id || ! $url ) {
			return new \WP_Error( 'missing_params', 'Required parameters missing.', array( 'status' => 400 ) );
		}

		/* ---- 1. update product meta ---- */
		$ids  = get_post_meta( $product_id, '_rtgodam_product_video_gallery_ids', true ) ?: array();
		$urls = get_post_meta( $product_id, '_rtgodam_product_video_gallery', true ) ?: array();

		if ( ! in_array( $attachment_id, $ids, true ) ) {
			$ids[]  = $attachment_id;
			$urls[] = $url;
			update_post_meta( $product_id, '_rtgodam_product_video_gallery_ids', $ids );
			update_post_meta( $product_id, '_rtgodam_product_video_gallery', $urls );
		}

		/* ---- 2. update attachment meta ---- */
		$parent_meta_key = '_video_parent_product_id';
		
		foreach ( $ids as $attachment_id ) {
			$existing = get_post_meta( $attachment_id, $parent_meta_key, false );

			// If the value is not present, create a new meta‑row.
			if ( ! in_array( $product_id, array_map( 'intval', $existing ), true ) ) {
				add_post_meta( $attachment_id, $parent_meta_key, $product_id, false );
			}
		}

		return rest_ensure_response( array( 'success' => true ) );
	}

	/**
	 * Return how many products already use this video in their gallery.
	 *
	 * @param \WP_REST_Request $request { id: <attachment_id> }
	 * @return \WP_REST_Response
	 */
	public function get_video_product_count( \WP_REST_Request $request ) {
		$attachment_id = absint( $request->get_param( 'id' ) );

		if ( ! $attachment_id ) {
			return new \WP_Error( 'invalid_id', 'Invalid attachment ID.', array( 'status' => 400 ) );
		}

		$product_ids = get_post_meta( $attachment_id, '_video_parent_product_id', false );

		$linked_products = array_map(
			function ( $pid ) {
				$thumb_id  = get_post_thumbnail_id( $pid );
					$thumb_url = $thumb_id
						? wp_get_attachment_image_url( $thumb_id, 'woocommerce_thumbnail' )
						: wc_placeholder_img_src();
					
                    return array(
                        'id'   => (int) $pid,
                        'name' => get_the_title( $pid ),
						'image' => $thumb_url,
                    );
			},
			$product_ids
		);

		return rest_ensure_response(
			array(
				'count'   => count( $product_ids ),
				'linked'  => $linked_products,
			)
		);
	}

}
