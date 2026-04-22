<?php
/**
 * REST API endpoints for Product Gallery Block.
 *
 * @package GoDAM_Woo
 * @since 1.0.0
 */

namespace GoDAM_Woo\Classes;

defined( 'ABSPATH' ) || exit;

/**
 * Product Gallery REST API endpoints.
 */
class Product_Gallery_Rest extends \RTGODAM\Inc\REST_API\Base {

	/**
	 * Route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'product-gallery';

	/**
	 * Get REST routes.
	 *
	 * @return array
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/products',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_products_with_videos' ),
						'permission_callback' => array( $this, 'check_permission' ),
						'args'                => array(
							'search'     => array(
								'description'       => __( 'Search products by title.', 'godam-woo' ),
								'type'              => 'string',
								'sanitize_callback' => 'sanitize_text_field',
							),
							'include'    => array(
								'description'       => __( 'Comma-separated product IDs to include.', 'godam-woo' ),
								'type'              => 'string',
								'sanitize_callback' => 'sanitize_text_field',
							),
							'categories' => array(
								'description'       => __( 'Comma-separated category IDs to filter products.', 'godam-woo' ),
								'type'              => 'string',
								'sanitize_callback' => 'sanitize_text_field',
							),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/categories',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_product_categories' ),
						'permission_callback' => array( $this, 'check_permission' ),
					),
				),
			),
		);
	}

	/**
	 * Check permission.
	 *
	 * @return bool
	 */
	public function check_permission() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Get products that have GoDAM videos.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function get_products_with_videos( $request ) {
		$search     = $request->get_param( 'search' );
		$include    = $request->get_param( 'include' );
		$categories = $request->get_param( 'categories' );

		$args = array(
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => 50,
			'fields'         => 'ids',
			'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
				array(
					'key'     => '_rtgodam_product_video_gallery_ids',
					'compare' => 'EXISTS',
				),
			),
		);

		if ( ! empty( $search ) ) {
			$args['s'] = $search;
		}

		if ( ! empty( $include ) ) {
			$include_ids = array_filter( array_map( 'absint', explode( ',', $include ) ) );
			if ( ! empty( $include_ids ) ) {
				$args['post__in'] = $include_ids;
				$args['orderby']  = 'post__in';
			}
		}

		if ( ! empty( $categories ) && empty( $include ) ) {
			$category_ids = array_filter( array_map( 'absint', explode( ',', $categories ) ) );
			if ( ! empty( $category_ids ) ) {
				$args['tax_query'] = array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
					array(
						'taxonomy' => 'product_cat',
						'field'    => 'term_id',
						'terms'    => $category_ids,
						'operator' => 'IN',
					),
				);
			}
		}

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts
		$product_ids = get_posts( $args );

		$products = array();
		foreach ( $product_ids as $product_id ) {
			$product = wc_get_product( $product_id );
			if ( ! $product ) {
				continue;
			}

			$thumbnail_id = $product->get_image_id();
			$thumbnail    = $thumbnail_id ? wp_get_attachment_image_url( $thumbnail_id, 'thumbnail' ) : wc_placeholder_img_src();

			$products[] = array(
				'id'        => $product_id,
				'title'     => $product->get_name(),
				'thumbnail' => $thumbnail,
			);
		}

		return rest_ensure_response( $products );
	}

	/**
	 * Get product categories hierarchically.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function get_product_categories( $request ) {
		$categories = get_terms(
			array(
				'taxonomy'   => 'product_cat',
				'hide_empty' => false,
				'orderby'    => 'name',
				'order'      => 'ASC',
			)
		);

		if ( is_wp_error( $categories ) ) {
			return rest_ensure_response( array() );
		}

		return rest_ensure_response( $this->format_categories_hierarchical( $categories ) );
	}

	/**
	 * Format categories hierarchically.
	 *
	 * @param array $categories Term objects.
	 * @param int   $parent_id  Parent ID.
	 * @param int   $level      Depth level.
	 * @return array
	 */
	private function format_categories_hierarchical( $categories, $parent_id = 0, $level = 0 ) {
		$result = array();

		foreach ( $categories as $category ) {
			if ( $category->parent !== $parent_id ) {
				continue;
			}

			$prefix   = str_repeat( '- ', $level );
			$result[] = array(
				'id'    => $category->term_id,
				'name'  => $prefix . $category->name,
				'label' => $prefix . $category->name,
				'value' => $category->term_id,
				'level' => $level,
			);

			$children = $this->format_categories_hierarchical( $categories, $category->term_id, $level + 1 );
			if ( ! empty( $children ) ) {
				$result = array_merge( $result, $children );
			}
		}

		return $result;
	}
}
