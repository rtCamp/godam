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
							return current_user_can( 'edit_products' ); // phpcs:ignore
						},
						'args'                => array(
							'id' => array(
								'description'       => __( 'Attachment (video) ID.', 'godam' ),
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
				'route'     => '/' . $this->rest_base . '/unlink-video',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'unlink_video_from_product' ),
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
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/save-product-meta',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'save_product_meta' ),
						'permission_callback' => function ( \WP_REST_Request $req ) {
							$product_id = (int) $req->get_param( 'product_id' );
							return current_user_can( 'edit_post', $product_id );
						},
						'args'                => array(
							'product_id' => array(
								'required'          => true,
								'type'              => 'integer',
								'sanitize_callback' => 'absint',
							),
							'meta_key'   => array(
								'required'          => true,
								'type'              => 'string',
								'sanitize_callback' => 'sanitize_text_field',
							),
							'meta_value' => array( // phpcs:ignore
								'required'          => true,
								'type'              => 'string',
								'sanitize_callback' => 'sanitize_text_field',
							),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/get-product-meta',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_product_meta' ),
						'permission_callback' => '__return_true',
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
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/wcproducts-by-ids',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'get_products_by_ids' ),
						'permission_callback' => '__return_true',
						'args'                => array(
							'ids' => array(
								'type'              => 'array',
								'required'          => true,
								'sanitize_callback' => function ( $param ) {
									return array_map( 'absint', (array) $param );
								},
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
		$matches = array();
	
		foreach ( $taxonomies as $tax ) {
			$found = term_exists( $search_term, $tax );
	
			if ( ! $found ) {
				continue;
			}
	
			if ( is_int( $found ) ) {
				$matches[] = array(
					'term_id'  => $found,
					'taxonomy' => $tax,
				);
			} elseif ( $found instanceof \WP_Term ) {
				$matches[] = array(
					'term_id'  => $found->term_id,
					'taxonomy' => $found->taxonomy,
				);
			} elseif ( is_array( $found ) ) {
				$matches[] = array(
					'term_id'  => (int) $found['term_id'],
					'taxonomy' => $tax,
				);
			}
		}
	
		return ! empty( $matches ) ? $matches : false;
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
		$term_info  = $is_numeric ? false : $this->godam_find_term( $search, array( 'product_cat', 'product_tag', 'product_brand' ) );
	
		$args = array(
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => 20,
		);

		$taxonomy_query = array();
	
		// Allow numeric search by ID.
		if ( $is_numeric ) {
			$args['post__in'] = array( (int) $search );
		} elseif ( is_array( $term_info ) && ! empty( $term_info ) ) {
			$tax_query = array( 'relation' => 'OR' );
		
			foreach ( $term_info as $term ) {
				if ( ! isset( $term['taxonomy'] ) ) {
					continue;
				}
		
				$tax_query[] = array(
					'taxonomy' => $term['taxonomy'],
					'field'    => 'slug',
					'terms'    => array( $search ),
					'operator' => 'IN',
				);
		
				$tax_query[] = array(
					'taxonomy' => $term['taxonomy'],
					'field'    => 'name',
					'terms'    => $search,
					'operator' => 'LIKE',
				);
			}
			$args['tax_query'] = $tax_query; // phpcs:ignore

			$taxonomy_query = new \WP_Query( $args );

			unset( $args['tax_query'] );
			$args['s'] = $search;

		} else {
			$args['s'] = $search;
		}
	
		$query = new \WP_Query( $args );

		$all_posts = $query->posts;

		if ( $taxonomy_query instanceof \WP_Query ) {
			$existing_ids = wp_list_pluck( $all_posts, 'ID' );

			foreach ( $taxonomy_query->posts as $post ) {
				if ( ! in_array( $post->ID, $existing_ids, true ) ) {
					$all_posts[] = $post;
				}
			}
		}
	
		$products = array_map(
			function ( $post ) {
				$product = wc_get_product( $post );

				$type         = $product->get_type();
				$name_display = $product->get_name();

				$regular_price = $product->get_regular_price();
				$sale_price    = $product->get_sale_price();
				$price_display = '';

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
	
				} elseif ( 'external' === $type || 'simple' === $type ) {
	
					// Simple and External product.
					if ( $sale_price && $sale_price < $regular_price ) {
						$price_display = wc_format_sale_price( $regular_price, $sale_price );
					} else {
						$price_display = wc_price( $regular_price );
					}
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
					'in_stock'   => $product->is_in_stock(),
				);

				/**
				 * Filter the formatted product array before adding to response.
				 *
				 * @param array $data Product data.
				 * @param \WC_Product $product Product object.
				 */
				return apply_filters( 'godam_rest_product_response_data', $data, $product );
			},
			$all_posts 
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

		$regular_price = $product->get_regular_price();
		$sale_price    = $product->get_sale_price();
		$price_display = '';

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
		
			/* translators: %s: formatted number of items */
			$items_label  = sprintf( _n( '%s item', '%s items', $child_count, 'godam' ), number_format_i18n( $child_count ) );
			$name_display = $product->get_name() . ' (' . $items_label . ')';
			/* translators: %s: formatted minimum price */
			$price_display = $min_price > 0 ? sprintf( __( 'From: %s + more', 'godam' ), wc_price( $min_price ) ) : __( 'N/A', 'godam' );
		} elseif ( 'external' === $type || 'simple' === $type ) {

			// Simple and External product.
			if ( $sale_price && $sale_price < $regular_price ) {
				$price_display = wc_format_sale_price( $regular_price, $sale_price );
			} else {
				$price_display = wc_price( $regular_price );
			}
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
			'in_stock'   => $product->is_in_stock(),
		);

		/**
		 * Filter the final product response data before sending it.
		 *
		 * @param array $data Array of product response data.
		 * @param \WC_Product $product Product object.
		 * @param \WP_REST_Request $request The request object.
		 */
		$data = apply_filters( 'godam_rest_single_product_response_data', $data, $product, $request );

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
			return new \WP_Error( 'missing_params', __( 'Required parameters missing.', 'godam' ), array( 'status' => 400 ) );
		}

		/* ---- 1. update product's video and video_ids meta ---- */
		$ids  = get_post_meta( $product_id, '_rtgodam_product_video_gallery_ids', true ) ?: array();
		$urls = get_post_meta( $product_id, '_rtgodam_product_video_gallery', true ) ?: array();

		if ( ! in_array( $attachment_id, $ids, true ) ) {
			$ids[]  = $attachment_id;
			$urls[] = $url;

			/**
			 * Action before video meta is saved.
			 *
			 * @param int    $product_id    Product ID.
			 * @param int    $attachment_id Attachment (video) ID.
			 * @param string $url           Video URL.
			 */
			do_action( 'rtgodam_before_link_video', $product_id, $attachment_id, $url );

			update_post_meta( $product_id, '_rtgodam_product_video_gallery_ids', $ids );
			update_post_meta( $product_id, '_rtgodam_product_video_gallery', $urls );

			/**
			 * Action after video is successfully linked to product.
			 * 
			 * @param int    $product_id    Product ID.
			 * @param int    $attachment_id Attachment (video) ID.
			 * @param string $url           Video URL.
			 */
			do_action( 'rtgodam_after_link_video', $product_id, $attachment_id, $url );
		}

		/* ---- 2. update attachment's product parent meta ---- */
		$parent_meta_key = '_video_parent_product_id';
		
		foreach ( $ids as $attachment_id ) {
			$existing = get_post_meta( $attachment_id, $parent_meta_key, false );

			// If the value is not present, create a new meta‑row.
			if ( ! in_array( $product_id, array_map( 'intval', $existing ), true ) ) {
				add_post_meta( $attachment_id, $parent_meta_key, $product_id, false );

				/**
				 * Fires when attachment is linked to a product.
				 */
				do_action( 'rtgodam_link_attachment_to_product', $attachment_id, $product_id );
			}
		}

		/**
		 * Filter the REST response for video-to-product linking.
		 *
		 * @param array $response REST response array.
		 * @param int   $product_id Product ID.
		 * @param int   $attachment_id Attachment ID.
		 * @param string $url Video URL.
		 */
		$response = apply_filters(
			'rtgodam_link_video_to_product_response',
			array( 'success' => true ),
			$product_id,
			$attachment_id,
			$url
		);

		return rest_ensure_response( $response );
	}

	/**
	 * Return how many products already use this video in their gallery.
	 *
	 * @param \WP_REST_Request $request { id: <attachment_id> }.
	 * @return \WP_REST_Response A REST response confirming success.
	 */
	public function get_video_product_count( \WP_REST_Request $request ) {
		$attachment_id = absint( $request->get_param( 'id' ) );

		if ( ! $attachment_id ) {
			return new \WP_Error( 'invalid_id', 'Invalid attachment ID.', array( 'status' => 400 ) );
		}

		$product_ids = get_post_meta( $attachment_id, '_video_parent_product_id', false );

		$linked_products = array_map(
			function ( $pid ) {
				$thumb_id      = get_post_thumbnail_id( $pid );
					$thumb_url = $thumb_id
						? wp_get_attachment_image_url( $thumb_id, 'woocommerce_thumbnail' )
						: wc_placeholder_img_src();
					
					$product_data = array(
						'id'    => (int) $pid,
						'name'  => get_the_title( $pid ),
						'image' => $thumb_url,
					);

				/**
				 * Filter individual linked product data.
				 *
				 * @param array $product_data
				 * @param int   $pid Product ID
				 */
				return apply_filters( 'rtgodam_video_linked_product_data', $product_data, $pid );
			},
			$product_ids
		);

		return rest_ensure_response(
			array(
				'count'  => count( $product_ids ),
				'linked' => $linked_products,
			)
		);
	}

	/**
	 * Unlink a video from a WooCommerce product.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function unlink_video_from_product( \WP_REST_Request $request ) {
		$product_id    = (int) $request->get_param( 'product_id' );
		$attachment_id = (int) $request->get_param( 'attachment_id' );

		if ( ! $product_id || ! $attachment_id ) {
			return new \WP_Error( 'missing_params', __( 'Required parameters missing.', 'godam' ), array( 'status' => 400 ) );
		}

		/**
		 * Allow modification or validation before unlinking a video.
		 *
		 * @param bool $proceed Whether to continue with unlinking.
		 * @param int  $product_id
		 * @param int  $attachment_id
		 */
		$proceed = apply_filters( 'rtgodam_allow_unlink_video', true, $product_id, $attachment_id );
		if ( ! $proceed ) {
			return new \WP_Error( 'unlink_disallowed', 'Unlinking was prevented by a filter.', array( 'status' => 403 ) );
		}

		/* ---- 1. update product meta ---- */
		$ids  = get_post_meta( $product_id, '_rtgodam_product_video_gallery_ids', true ) ?: array();
		$urls = get_post_meta( $product_id, '_rtgodam_product_video_gallery', true ) ?: array();

		$index = array_search( $attachment_id, $ids, true );

		if ( false !== $index ) {

			/**
			 * Action before video is unlinked from the product.
			 */
			do_action( 'rtgodam_before_unlink_video', $product_id, $attachment_id );

			unset( $ids[ $index ] );
			unset( $urls[ $index ] );

			update_post_meta( $product_id, '_rtgodam_product_video_gallery_ids', array_values( $ids ) );
			update_post_meta( $product_id, '_rtgodam_product_video_gallery', array_values( $urls ) );

			/**
			 * Action after product meta is updated and video is unlinked.
			 */
			do_action( 'rtgodam_after_unlink_video', $product_id, $attachment_id );
		}

		/* ---- 2. update attachment meta ---- */
		delete_post_meta( $attachment_id, '_video_parent_product_id', $product_id );

		/**
		 * Filter to add additional cleanup logic or custom meta deletion from product or attachment.
		 *
		 * @param int $product_id
		 * @param int $attachment_id
		 */
		do_action( 'rtgodam_cleanup_unlinked_video_meta', $product_id, $attachment_id );

		/**
		 * Filter the final REST response after unlinking.
		 *
		 * @param array $response
		 * @param int   $product_id
		 * @param int   $attachment_id
		 */
		$response = apply_filters(
			'rtgodam_unlink_video_from_product_response',
			array( 'success' => true ),
			$product_id,
			$attachment_id
		);

		return rest_ensure_response( $response );
	}

	/**
	 * Save timestamp meta for a product.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function save_product_meta( \WP_REST_Request $request ) {
		$product_id = (int) $request->get_param( 'product_id' );
		$meta_key   = sanitize_text_field( $request->get_param( 'meta_key' ) );
		$meta_value = sanitize_text_field( $request->get_param( 'meta_value' ) );

		if ( empty( $product_id ) || empty( $meta_key ) ) {
			return new \WP_Error( 'missing_params', __( 'Product ID and meta key are required.', 'godam' ), array( 'status' => 400 ) );
		}

		/**
		 * Allow short-circuiting the meta update logic.
		 * Returning a non-null value here will skip update_post_meta().
		 * 
		 * @hook godam_rest_pre_save_product_meta
		 *
		 * @param mixed           $pre         Default null. If not null, short-circuits the meta save.
		 * @param int             $product_id  ID of the product being updated.
		 * @param string          $meta_key    Meta key to update.
		 * @param mixed           $meta_value  Meta value to save.
		 * @param \WP_REST_Request $request    The REST API request object.
		 *
		 * @return mixed|null Custom response or null to proceed with default logic.
		 */
		$pre = apply_filters( 'godam_rest_pre_save_product_meta', null, $product_id, $meta_key, $meta_value, $request );
		if ( null !== $pre ) {
			return rest_ensure_response( $pre );
		}

		update_post_meta( $product_id, $meta_key, $meta_value );

		/**
		* Fires after product meta is successfully saved.
		*
		* @hook godam_rest_product_meta_saved
		*
		* @param int             $product_id  ID of the product that was updated.
		* @param string          $meta_key    Meta key that was updated.
		* @param mixed           $meta_value  Meta value that was saved.
		* @param \WP_REST_Request $request    The REST API request object.
		*/
		do_action( 'godam_rest_product_meta_saved', $product_id, $meta_key, $meta_value, $request );

		return rest_ensure_response(
			array(
				'success' => true,
				'message' => 'Meta saved successfully.',
			) 
		);
	}

	/**
	 * Save timestamp meta for a product.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_product_meta( \WP_REST_Request $request ) {
		$product_id    = (int) $request->get_param( 'product_id' );
		$attachment_id = (int) $request->get_param( 'attachment_id' );

		/**
		 * Action hook before getting product meta.
		 *
		 * @hook godam_before_get_product_meta
		 * @param int $product_id
		 * @param int $attachment_id
		 */
		do_action( 'godam_before_get_product_meta', $product_id, $attachment_id );
	
		if ( empty( $product_id ) || empty( $attachment_id ) ) {
			return new \WP_Error( 'missing_params', __( 'Product ID and meta key are required.', 'godam' ), array( 'status' => 400 ) );
		}

		$meta_key = 'godam_product_timestamp_meta_' . $attachment_id;
	
		$meta_value = get_post_meta( $product_id, $meta_key, true );

		/**
		 * Action hook after getting product meta.
		 *
		 * @hook godam_after_get_product_meta
		 * @param int    $product_id
		 * @param int    $attachment_id
		 * @param string $meta_key
		 * @param mixed  $meta_value
		 */
		do_action( 'godam_after_get_product_meta', $product_id, $attachment_id, $meta_key, $meta_value );
	
		return rest_ensure_response(
			array(
				'product_meta_value' => $meta_value,
			) 
		);
	}

	/**
	 * Get multiple products by an array of IDs.
	 *
	 * @param \WP_REST_Request $request REST request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_products_by_ids( \WP_REST_Request $request ) {
		$ids = $request->get_param( 'ids' );
	
		if ( ! is_array( $ids ) || empty( $ids ) ) {
			return new \WP_Error( 'invalid_ids', 'Invalid or missing IDs.', array( 'status' => 400 ) );
		}
	
		$products = array(); 
		foreach ( $ids as $id ) {
			$product = wc_get_product( $id );

			if ( ! $product ) {
				continue;
			}

			$type         = $product->get_type();
			$name_display = $product->get_name();

			if ( 'grouped' === $type ) {
	
				$child_ids   = $product->get_children();
				$child_count = count( $child_ids );
			
				// Format name.
				$name_display = $product->get_name() . ' (' . $child_count . ' ' . _n( 'item', 'items', $child_count, 'godam' ) . ')';
			}

			if ( $product ) {
				$product_data = array(
					'id'                    => $product->get_id(),
					'name'                  => $name_display,
					'type'                  => $type,
					'price'                 => $product->get_price_html(),
					'image'                 => $product->get_image(),
					'link'                  => get_permalink( $product->get_id() ),
					'rating_customer_count' => $product->get_rating_count(),
					'rating_average'        => $product->get_average_rating(),
					'in_stock'              => $product->is_in_stock(),
				);

				/**
				 * Filter the final product response data.
				 *
				 * @param array $product_data Product data to be returned.
				 * @param \WC_Product $product Product object.
				 */
				$product_data = apply_filters( 'godam_rest_product_by_id_response_data', $product_data, $product );

				$products[] = $product_data;
			}
		}
	
		return rest_ensure_response( $products );
	}
}
