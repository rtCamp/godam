<?php
/**
 * REST API endpoints for Product Gallery Block.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Product Gallery REST API endpoints.
 */
class Product_Gallery_Rest extends Base {

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
								'description'       => __( 'Search products by title.', 'godam' ),
								'type'              => 'string',
								'sanitize_callback' => 'sanitize_text_field',
							),
							'include'    => array(
								'description'       => __( 'Comma-separated product IDs to include.', 'godam' ),
								'type'              => 'string',
								'sanitize_callback' => 'sanitize_text_field',
							),
							'categories' => array(
								'description'       => __( 'Comma-separated category IDs to filter products.', 'godam' ),
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
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/videos',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_videos_by_products' ),
						'permission_callback' => array( $this, 'check_permission' ),
						'args'                => array(
							'product_ids' => array(
								'description'       => __( 'Comma-separated product IDs.', 'godam' ),
								'type'              => 'string',
								'sanitize_callback' => 'sanitize_text_field',
								'required'          => true,
							),
						),
					),
				),
			),
		);
	}

	/**
	 * Check permission for endpoints.
	 *
	 * @return bool
	 */
	public function check_permission() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Get products that have GoDAM videos.
	 *
	 * @param \WP_REST_Request $request Request object.
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

		// Add category filtering if categories are provided.
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
	 * Get product categories in hierarchical format.
	 *
	 * @param \WP_REST_Request $request Request object.
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

		$formatted_categories = $this->format_categories_hierarchical( $categories );

		return rest_ensure_response( $formatted_categories );
	}

	/**
	 * Format categories in hierarchical structure.
	 *
	 * @param array $categories Array of term objects.
	 * @param int   $parent_id  Parent category ID.
	 * @param int   $level      Current level depth.
	 * @return array
	 */
	private function format_categories_hierarchical( $categories, $parent_id = 0, $level = 0 ) {
		$result = array();

		foreach ( $categories as $category ) {
			if ( $category->parent !== $parent_id ) {
				continue;
			}

			$prefix = str_repeat( '- ', $level );

			$result[] = array(
				'id'    => $category->term_id,
				'name'  => $prefix . $category->name,
				'label' => $prefix . $category->name,
				'value' => $category->term_id,
				'level' => $level,
			);

			// Recursively add children.
			$children = $this->format_categories_hierarchical( $categories, $category->term_id, $level + 1 );
			if ( ! empty( $children ) ) {
				$result = array_merge( $result, $children );
			}
		}

		return $result;
	}

	/**
	 * Get videos by product IDs.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response
	 */
	public function get_videos_by_products( $request ) {
		$product_ids_string = $request->get_param( 'product_ids' );
		$product_ids        = array_filter( array_map( 'absint', explode( ',', $product_ids_string ) ) );

		if ( empty( $product_ids ) ) {
			return rest_ensure_response( array() );
		}

		$args = array(
			'post_type'      => 'attachment',
			'post_mime_type' => 'video',
			'post_status'    => 'inherit',
			'posts_per_page' => -1,
			'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
				array(
					'key'     => '_video_parent_product_id',
					'value'   => $product_ids,
					'compare' => 'IN',
				),
			),
		);

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts
		$video_posts = get_posts( $args );

		$videos = array();
		foreach ( $video_posts as $video ) {
			$video_id             = $video->ID;
			$custom_thumbnail     = get_post_meta( $video_id, 'rtgodam_media_video_thumbnail', true );
			$fallback_thumb       = RTGODAM_URL . 'assets/src/images/video-thumbnail-default.png';
			$thumbnail            = $custom_thumbnail ?: $fallback_thumb;
			$duration             = get_post_meta( $video_id, 'rtgodam_media_video_duration', true );
			$attached_product_ids = get_post_meta( $video_id, '_video_parent_product_id', false );

			// Format duration if available.
			$duration_formatted = '';
			if ( ! empty( $duration ) ) {
				$duration_seconds   = intval( $duration );
				$minutes            = floor( $duration_seconds / 60 );
				$seconds            = $duration_seconds % 60;
				$duration_formatted = sprintf( '%d:%02d', $minutes, $seconds );
			}

			$title_with_duration = $video->post_title;
			if ( ! empty( $duration_formatted ) ) {
				$title_with_duration .= ' (' . $duration_formatted . ')';
			}

			$videos[] = array(
				'id'                => $video_id,
				'title'             => $video->post_title,
				'titleWithDuration' => $title_with_duration,
				'thumbnail'         => $thumbnail,
				'duration'          => $duration_formatted,
				'productIds'        => array_map( 'intval', $attached_product_ids ),
			);
		}

		return rest_ensure_response( $videos );
	}
}
