<?php
/**
 * Register REST API endpoints for WooCommerce Products.
 *
 * @package GoDAM_Woo
 * @since 1.0.0
 */

namespace GoDAM_Woo\Classes;

defined( 'ABSPATH' ) || exit;

/**
 * Class WC_REST
 *
 * Extends the main GoDAM REST API Base class to provide WooCommerce product endpoints.
 */
class WC_REST extends \RTGODAM\Inc\REST_API\Base {

	/**
	 * Constructor.
	 */
	protected function __construct() {
		parent::__construct();

		// Clear cache when products are saved or deleted.
		add_action( 'save_post_product', array( $this, 'clear_product_cache' ), 10, 1 );
		add_action( 'delete_post', array( $this, 'clear_product_cache' ), 10, 1 );

		// Clear search cache when taxonomy terms are edited.
		add_action( 'edited_product_cat', array( $this, 'clear_search_cache' ) );
		add_action( 'edited_product_tag', array( $this, 'clear_search_cache' ) );
		add_action( 'edited_product_brand', array( $this, 'clear_search_cache' ) );
	}

	/**
	 * Get REST routes.
	 *
	 * @return array
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
								'description'       => __( 'Attachment (video) ID.', 'godam-woo' ),
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
							'meta_key'   => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
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
	 * Format a single product into a response array.
	 *
	 * @param \WC_Product $product The product object.
	 * @return array
	 */
	private function format_product_data( $product ) {
		$type         = $product->get_type();
		$name_display = $product->get_name();

		$regular_price = $product->get_regular_price();
		$sale_price    = $product->get_sale_price();
		$price_display = '';

		if ( 'variable' === $type ) {
			if ( $product instanceof \WC_Product_Variable ) {
				$min_price = $product->get_variation_price( 'min', true );
				$max_price = $product->get_variation_price( 'max', true );
			} else {
				$min_price = 0;
				$max_price = 0;
			}

			$price_display = ( $min_price === $max_price )
				? wc_price( $min_price )
				: wc_price( $min_price ) . ' - ' . wc_price( $max_price );
		} elseif ( 'grouped' === $type ) {
			$child_ids    = $product->get_children();
			$child_count  = count( $child_ids );
			$child_prices = array_filter(
				array_map(
					function ( $child_id ) {
						$child_product = wc_get_product( $child_id );
						return $child_product ? $child_product->get_price() : null;
					},
					$child_ids
				)
			);

			$min_price = count( $child_prices ) ? min( $child_prices ) : 0;
			/* translators: %s: formatted number of items */
			$items_label  = sprintf( _n( '%s item', '%s items', $child_count, 'godam-woo' ), number_format_i18n( $child_count ) );
			$name_display = $product->get_name() . ' (' . $items_label . ')';
			/* translators: %s: formatted minimum price */
			$price_display = $min_price > 0 ? sprintf( __( 'From: %s + more', 'godam-woo' ), wc_price( $min_price ) ) : __( 'N/A', 'godam-woo' );
		} elseif ( 'external' === $type || 'simple' === $type ) {
			$price_display = ( $sale_price && $sale_price < $regular_price )
				? wc_format_sale_price( $regular_price, $sale_price )
				: wc_price( $regular_price );
		}

		$get_terms = function ( $taxonomy ) use ( $product ) {
			return array_map(
				function ( $term ) {
					return array(
						'name' => $term->name,
						'slug' => $term->slug,
					);
				},
				wp_get_post_terms( $product->get_id(), $taxonomy, array( 'fields' => 'all' ) )
			);
		};

		return array(
			'id'         => $product->get_id(),
			'name'       => $name_display,
			'price'      => $price_display,
			'type'       => $product->get_type(),
			'link'       => get_permalink( $product->get_id() ),
			'image'      => wp_get_attachment_url( $product->get_image_id() ) ?: wc_placeholder_img_src(),
			'categories' => $get_terms( 'product_cat' ),
			'tags'       => $get_terms( 'product_tag' ),
			'brands'     => $get_terms( 'product_brand' ),
			'in_stock'   => $product->is_in_stock(),
		);
	}

	/**
	 * Try to match a search string against several taxonomies.
	 *
	 * @param string   $search_term Search string.
	 * @param string[] $taxonomies  Taxonomy slugs to search.
	 * @return array|false
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
		$search = sanitize_text_field( $request->get_param( 'search' ) );

		$cache_key = 'godam_wc_search_' . md5( $search );
		$cached    = get_transient( $cache_key );

		if ( false !== $cached ) {
			return rest_ensure_response( $cached );
		}

		$is_numeric = is_numeric( $search );
		$term_info  = $is_numeric ? false : $this->godam_find_term( $search, array( 'product_cat', 'product_tag', 'product_brand' ) );

		$args = array(
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => 20,
		);

		$taxonomy_query = array();

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
			$taxonomy_query    = new \WP_Query( $args );

			unset( $args['tax_query'] );
			$args['s'] = $search;
		} else {
			$args['s'] = $search;
		}

		$query     = new \WP_Query( $args );
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
				$data    = $this->format_product_data( $product );
				return apply_filters( 'godam_rest_product_response_data', $data, $product );
			},
			$all_posts
		);

		set_transient( $cache_key, $products, 5 * MINUTE_IN_SECONDS );

		$search_keys = get_option( 'godam_wc_search_cache_keys', array() );
		if ( ! in_array( $cache_key, $search_keys, true ) ) {
			$search_keys[] = $cache_key;
			update_option( 'godam_wc_search_cache_keys', $search_keys, false );
		}

		return rest_ensure_response( $products );
	}

	/**
	 * Get a single WooCommerce product.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_product( $request ) {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return new \WP_Error( 'woocommerce_not_active', 'WooCommerce plugin is not active.', array( 'status' => 404 ) );
		}

		$product_id = absint( $request->get_param( 'id' ) );
		if ( empty( $product_id ) ) {
			return new \WP_Error( 'invalid_product_id', 'Invalid product ID.', array( 'status' => 404 ) );
		}

		$cache_key = 'godam_wc_product_' . $product_id;
		$cached    = get_transient( $cache_key );

		if ( false !== $cached ) {
			return rest_ensure_response( $cached );
		}

		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			return new \WP_Error( 'product_not_found', 'Product not found.', array( 'status' => 404 ) );
		}

		$data = $this->format_product_data( $product );
		$data = apply_filters( 'godam_rest_single_product_response_data', $data, $product, $request );

		set_transient( $cache_key, $data, 15 * MINUTE_IN_SECONDS );

		return rest_ensure_response( $data );
	}

	/**
	 * Link a video to a WooCommerce product.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function link_video_to_product( \WP_REST_Request $request ) {
		$product_id    = (int) $request->get_param( 'product_id' );
		$attachment_id = (int) $request->get_param( 'attachment_id' );
		$url           = esc_url_raw( $request->get_param( 'url' ) );

		if ( ! $product_id || ! $attachment_id || ! $url ) {
			return new \WP_Error( 'missing_params', __( 'Required parameters missing.', 'godam-woo' ), array( 'status' => 400 ) );
		}

		$ids  = get_post_meta( $product_id, '_rtgodam_product_video_gallery_ids', true ) ?: array();
		$urls = get_post_meta( $product_id, '_rtgodam_product_video_gallery', true ) ?: array();

		if ( ! in_array( $attachment_id, $ids, true ) ) {
			$ids[]  = $attachment_id;
			$urls[] = $url;

			do_action( 'rtgodam_before_link_video', $product_id, $attachment_id, $url );

			update_post_meta( $product_id, '_rtgodam_product_video_gallery_ids', $ids );
			update_post_meta( $product_id, '_rtgodam_product_video_gallery', $urls );

			do_action( 'rtgodam_after_link_video', $product_id, $attachment_id, $url );
		}

		$parent_meta_key = '_video_parent_product_id';

		foreach ( $ids as $att_id ) {
			$existing = get_post_meta( $att_id, $parent_meta_key, false );
			if ( ! in_array( $product_id, array_map( 'intval', $existing ), true ) ) {
				add_post_meta( $att_id, $parent_meta_key, $product_id, false );
				do_action( 'rtgodam_link_attachment_to_product', $att_id, $product_id );
			}
		}

		$response = apply_filters( 'rtgodam_link_video_to_product_response', array( 'success' => true ), $product_id, $attachment_id, $url );

		return rest_ensure_response( $response );
	}

	/**
	 * Return how many products already use this video.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
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

				$product_data = array(
					'id'    => (int) $pid,
					'name'  => get_the_title( $pid ),
					'image' => $thumb_url,
				);

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
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function unlink_video_from_product( \WP_REST_Request $request ) {
		$product_id    = (int) $request->get_param( 'product_id' );
		$attachment_id = (int) $request->get_param( 'attachment_id' );

		if ( ! $product_id || ! $attachment_id ) {
			return new \WP_Error( 'missing_params', __( 'Required parameters missing.', 'godam-woo' ), array( 'status' => 400 ) );
		}

		$proceed = apply_filters( 'rtgodam_allow_unlink_video', true, $product_id, $attachment_id );
		if ( ! $proceed ) {
			return new \WP_Error( 'unlink_disallowed', 'Unlinking was prevented by a filter.', array( 'status' => 403 ) );
		}

		$ids  = get_post_meta( $product_id, '_rtgodam_product_video_gallery_ids', true ) ?: array();
		$urls = get_post_meta( $product_id, '_rtgodam_product_video_gallery', true ) ?: array();

		$index = array_search( $attachment_id, $ids, true );

		if ( false !== $index ) {
			do_action( 'rtgodam_before_unlink_video', $product_id, $attachment_id );

			unset( $ids[ $index ] );
			unset( $urls[ $index ] );

			update_post_meta( $product_id, '_rtgodam_product_video_gallery_ids', array_values( $ids ) );
			update_post_meta( $product_id, '_rtgodam_product_video_gallery', array_values( $urls ) );

			do_action( 'rtgodam_after_unlink_video', $product_id, $attachment_id );
		}

		delete_post_meta( $attachment_id, '_video_parent_product_id', $product_id );
		do_action( 'rtgodam_cleanup_unlinked_video_meta', $product_id, $attachment_id );

		$response = apply_filters( 'rtgodam_unlink_video_from_product_response', array( 'success' => true ), $product_id, $attachment_id );

		return rest_ensure_response( $response );
	}

	/**
	 * Save product meta.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function save_product_meta( \WP_REST_Request $request ) {
		$product_id = (int) $request->get_param( 'product_id' );
		$meta_key   = sanitize_text_field( $request->get_param( 'meta_key' ) );
		$meta_value = sanitize_text_field( $request->get_param( 'meta_value' ) );

		if ( empty( $product_id ) || empty( $meta_key ) ) {
			return new \WP_Error( 'missing_params', __( 'Product ID and meta key are required.', 'godam-woo' ), array( 'status' => 400 ) );
		}

		$pre = apply_filters( 'godam_rest_pre_save_product_meta', null, $product_id, $meta_key, $meta_value, $request );
		if ( null !== $pre ) {
			return rest_ensure_response( $pre );
		}

		update_post_meta( $product_id, $meta_key, $meta_value );
		do_action( 'godam_rest_product_meta_saved', $product_id, $meta_key, $meta_value, $request );

		return rest_ensure_response(
			array(
				'success' => true,
				'message' => 'Meta saved successfully.',
			) 
		);
	}

	/**
	 * Get product meta.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_product_meta( \WP_REST_Request $request ) {
		$product_id    = (int) $request->get_param( 'product_id' );
		$attachment_id = (int) $request->get_param( 'attachment_id' );

		do_action( 'godam_before_get_product_meta', $product_id, $attachment_id );

		if ( empty( $product_id ) || empty( $attachment_id ) ) {
			return new \WP_Error( 'missing_params', __( 'Product ID and meta key are required.', 'godam-woo' ), array( 'status' => 400 ) );
		}

		$meta_key   = 'godam_product_timestamp_meta_' . $attachment_id;
		$meta_value = get_post_meta( $product_id, $meta_key, true );

		do_action( 'godam_after_get_product_meta', $product_id, $attachment_id, $meta_key, $meta_value );

		return rest_ensure_response( array( 'product_meta_value' => $meta_value ) );
	}

	/**
	 * Get multiple products by IDs.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_products_by_ids( \WP_REST_Request $request ) {
		$ids = $request->get_param( 'ids' );

		if ( ! is_array( $ids ) || empty( $ids ) ) {
			return new \WP_Error( 'invalid_ids', 'Invalid or missing IDs.', array( 'status' => 400 ) );
		}

		$cache_key = 'godam_wc_products_batch_' . md5( implode( ',', $ids ) );
		$cached    = get_transient( $cache_key );

		if ( false !== $cached ) {
			return rest_ensure_response( $cached );
		}

		$products = array();
		foreach ( $ids as $id ) {
			$product = wc_get_product( $id );
			if ( ! $product ) {
				continue;
			}

			$product_data               = $this->format_product_data( $product );
			$product_data['image_html'] = $product->get_image();
			$product_data               = apply_filters( 'godam_rest_product_by_id_response_data', $product_data, $product );

			$products[] = $product_data;
		}

		set_transient( $cache_key, $products, 15 * MINUTE_IN_SECONDS );

		$batch_keys = get_option( 'godam_wc_batch_cache_keys', array() );
		if ( ! in_array( $cache_key, $batch_keys, true ) ) {
			$batch_keys[] = $cache_key;
			update_option( 'godam_wc_batch_cache_keys', $batch_keys, false );
		}

		return rest_ensure_response( $products );
	}

	/**
	 * Clear product cache.
	 *
	 * @param int $post_id Post ID.
	 */
	public function clear_product_cache( $post_id ) {
		if ( 'product' !== get_post_type( $post_id ) ) {
			return;
		}

		delete_transient( 'godam_wc_product_' . $post_id );
		$this->clear_search_cache();
		$this->clear_batch_caches();
	}

	/**
	 * Clear all search caches.
	 */
	public function clear_search_cache() {
		$search_keys = get_option( 'godam_wc_search_cache_keys', array() );

		if ( empty( $search_keys ) ) {
			return;
		}

		foreach ( $search_keys as $cache_key ) {
			delete_transient( $cache_key );
		}

		delete_option( 'godam_wc_search_cache_keys' );
	}

	/**
	 * Clear all batch product caches.
	 */
	private function clear_batch_caches() {
		$batch_keys = get_option( 'godam_wc_batch_cache_keys', array() );

		if ( empty( $batch_keys ) ) {
			return;
		}

		foreach ( $batch_keys as $cache_key ) {
			delete_transient( $cache_key );
		}

		delete_option( 'godam_wc_batch_cache_keys' );
	}
}
