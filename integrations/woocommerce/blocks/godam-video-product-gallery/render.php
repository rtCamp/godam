<?php
/**
 * Server-side rendering of the `godam/video-product-gallery` block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'godam_vpg_get_matching_product_ids' ) ) {

	/**
	 * Resolve the query item limit for video product gallery.
	 *
	 * @param array $attributes Block attributes.
	 * @return int
	 */
	function godam_vpg_get_query_limit( $attributes ) {
		$query_limit = (int) apply_filters( 'rtgodam_video_product_gallery_query_limit', 100, $attributes );
		$query_limit = max( 1, min( 100, $query_limit ) );
		$count       = isset( $attributes['count'] ) ? absint( $attributes['count'] ) : 12;

		return $count > 0 ? min( $count, $query_limit ) : $query_limit;
	}

	/**
	 * Resolve product IDs for query mode.
	 *
	 * @param array $attributes Block attributes.
	 * @return int[]
	 */
	function godam_vpg_get_matching_product_ids( $attributes ) {
		$selected_product_ids = isset( $attributes['products'] ) && is_array( $attributes['products'] )
			? array_filter( array_map( 'absint', $attributes['products'] ) )
			: array();
		$category_ids         = isset( $attributes['categories'] ) && is_array( $attributes['categories'] )
			? array_filter( array_map( 'absint', $attributes['categories'] ) )
			: array();
		$query_limit          = godam_vpg_get_query_limit( $attributes );

		$product_query_args = array(
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'fields'         => 'ids',
			'posts_per_page' => $query_limit,
			'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
				array(
					'key'     => '_rtgodam_product_video_gallery_ids',
					'compare' => 'EXISTS',
				),
			),
		);

		if ( ! empty( $category_ids ) ) {
			$product_query_args['tax_query'] = array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
				array(
					'taxonomy' => 'product_cat',
					'field'    => 'term_id',
					'terms'    => $category_ids,
					'operator' => 'IN',
				),
			);
		}

		if ( ! empty( $selected_product_ids ) ) {
			$product_query_args['post__in'] = $selected_product_ids;
			$product_query_args['orderby']  = 'post__in';
		}

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts
		return get_posts( $product_query_args );
	}
}

if ( ! function_exists( 'godam_vpg_get_product_data' ) ) {

	/**
	 * Get fresh product data from WooCommerce.
	 *
	 * @param int $product_id The product ID.
	 * @return array|null Product data array or null if not found.
	 */
	function godam_vpg_get_product_data( $product_id ) {
		if ( empty( $product_id ) || ! function_exists( 'wc_get_product' ) ) {
			return null;
		}

		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			return null;
		}

		$product_data = array(
			'id'              => $product->get_id(),
			'name'            => $product->get_name(),
			'price'           => $product->get_price_html(),
			'price_raw'       => $product->get_price(),
			'permalink'       => $product->get_permalink(),
			'image'           => '',
			'image_id'        => $product->get_image_id(),
			'type'            => $product->get_type(),
			'in_stock'        => $product->is_in_stock(),
			'add_to_cart_url' => $product->add_to_cart_url(),
		);

		// Get product image.
		$image_id = $product->get_image_id();
		if ( $image_id ) {
			$product_data['image'] = wp_get_attachment_image_url( $image_id, 'woocommerce_thumbnail' );
		} else {
			$product_data['image'] = wc_placeholder_img_src( 'woocommerce_thumbnail' );
		}

		return $product_data;
	}
}

if ( ! function_exists( 'godam_vpg_build_gallery_items' ) ) {

	/**
	 * Build gallery items for the current block mode.
	 *
	 * @param array         $attributes Block attributes.
	 * @param WP_Block|null $block      Parsed block instance.
	 * @return array
	 */
	function godam_vpg_build_gallery_items( $attributes, $block ) {
		$gallery_mode  = isset( $attributes['mode'] ) ? sanitize_key( $attributes['mode'] ) : 'handpicked';
		$gallery_items = array();

		if ( 'query' !== $gallery_mode ) {
			if ( empty( $block->inner_blocks ) ) {
				return array();
			}

			foreach ( $block->inner_blocks as $inner_block ) {
				if ( 'godam/video-product-gallery-item' !== $inner_block->name ) {
					continue;
				}

				$item_attrs = $inner_block->attributes;
				$video_id   = isset( $item_attrs['videoId'] ) ? absint( $item_attrs['videoId'] ) : 0;
				$product_id = isset( $item_attrs['productId'] ) ? absint( $item_attrs['productId'] ) : 0;

				if ( ! $video_id ) {
					continue;
				}

				$gallery_items[] = array(
					'videoId'     => $video_id,
					'productId'   => $product_id,
					'productData' => $product_id ? godam_vpg_get_product_data( $product_id ) : null,
				);
			}

			return $gallery_items;
		}

		$product_ids        = godam_vpg_get_matching_product_ids( $attributes );
		$has_active_filters = ! empty( $attributes['products'] ) || ! empty( $attributes['categories'] );
		$query_limit        = godam_vpg_get_query_limit( $attributes );

		if ( $has_active_filters && empty( $product_ids ) ) {
			return array();
		}

		$video_query_args = array(
			'post_type'      => 'attachment',
			'post_mime_type' => 'video',
			'post_status'    => 'inherit',
			'posts_per_page' => $query_limit,
			'orderby'        => 'date',
			'order'          => 'DESC',
			'meta_query'     => array(), // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
		);

		if ( ! empty( $product_ids ) ) {
			$video_query_args['meta_query'][] = array(
				'key'     => '_video_parent_product_id',
				'value'   => $product_ids,
				'compare' => 'IN',
				'type'    => 'NUMERIC',
			);
		} else {
			$video_query_args['meta_query'][] = array(
				'key'     => '_video_parent_product_id',
				'compare' => 'EXISTS',
			);
		}

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts
		$video_posts  = get_posts( $video_query_args );
		$category_ids = isset( $attributes['categories'] ) && is_array( $attributes['categories'] )
			? array_filter( array_map( 'absint', $attributes['categories'] ) )
			: array();

		foreach ( $video_posts as $video_post ) {
			$attached_product_ids = get_post_meta( $video_post->ID, '_video_parent_product_id', false );
			$resolved_product_id  = 0;

			foreach ( $attached_product_ids as $attached_product_id ) {
				$attached_product_id = absint( $attached_product_id );

				if ( ! $attached_product_id || 'publish' !== get_post_status( $attached_product_id ) || 'product' !== get_post_type( $attached_product_id ) ) {
					continue;
				}

				if ( ! empty( $product_ids ) && ! in_array( $attached_product_id, $product_ids, true ) ) {
					continue;
				}

				if ( ! empty( $category_ids ) && ! has_term( $category_ids, 'product_cat', $attached_product_id ) ) {
					continue;
				}

				$resolved_product_id = $attached_product_id;
				break;
			}

			if ( ! $resolved_product_id ) {
				continue;
			}

			$product_data = godam_vpg_get_product_data( $resolved_product_id );

			if ( ! $product_data ) {
				continue;
			}

			$gallery_items[] = array(
				'videoId'     => absint( $video_post->ID ),
				'productId'   => $resolved_product_id,
				'productData' => $product_data,
			);
		}

		return $gallery_items;
	}
}

// Block attributes.
$block_id         = isset( $attributes['blockId'] ) ? 'godam-vpg-' . esc_attr( $attributes['blockId'] ) : wp_unique_id( 'godam-vpg-' );
$gallery_mode_raw = isset( $attributes['mode'] ) ? sanitize_key( $attributes['mode'] ) : 'handpicked';
$allowed_modes    = array( 'handpicked', 'query' );
$gallery_mode     = in_array( $gallery_mode_raw, $allowed_modes, true ) ? $gallery_mode_raw : 'handpicked';
$layout           = isset( $attributes['layout'] ) ? esc_attr( $attributes['layout'] ) : 'carousel';
$view_ratio       = isset( $attributes['viewRatio'] ) ? esc_attr( $attributes['viewRatio'] ) : '9:16';
$item_width       = isset( $attributes['itemWidth'] ) ? absint( $attributes['itemWidth'] ) : 180;
$autoplay         = ! empty( $attributes['autoplay'] );

// Read blockGap from native spacing support (Dimensions > Block spacing).
$block_gap_raw = isset( $attributes['style']['spacing']['blockGap'] ) ? $attributes['style']['spacing']['blockGap'] : '16px';

// Convert preset spacing values (e.g. "var:preset|spacing|50") to CSS var().
if ( is_string( $block_gap_raw ) && str_starts_with( $block_gap_raw, 'var:preset|spacing|' ) ) {
	$slug      = str_replace( 'var:preset|spacing|', '', $block_gap_raw );
	$block_gap = 'var(--wp--preset--spacing--' . $slug . ')';
} else {
	$block_gap = $block_gap_raw;
}
$show_add_to_cart = isset( $attributes['showAddToCart'] ) ? (bool) $attributes['showAddToCart'] : true;
$wc_ajax_url      = class_exists( 'WC_AJAX' ) ? WC_AJAX::get_endpoint( '%%endpoint%%' ) : '';

// Convert ratio to CSS class format.
$ratio_class = str_replace( ':', '-', $view_ratio );

$gallery_items = godam_vpg_build_gallery_items( $attributes, $block );

// Skip rendering if no items.
if ( empty( $gallery_items ) ) {
	return '<p>' . esc_html__( 'No video products found.', 'godam' ) . '</p>';
}

// Build inline styles for CSS custom properties.
$inline_styles = sprintf(
	'--godam-gallery-item-width: %dpx; --godam-gallery-gap: %s;',
	$item_width,
	$block_gap
);

// Build wrapper attributes.
$wrapper_attributes = get_block_wrapper_attributes(
	array(
		'id'                    => $block_id,
		'class'                 => sprintf(
			'godam-video-product-gallery godam-video-product-gallery--%s godam-video-product-gallery--ratio-%s godam-video-product-gallery--%s',
			$layout,
			$ratio_class,
			$gallery_mode
		),
		'style'                 => esc_attr( $inline_styles ),
		'data-block-id'         => $block_id,
		'data-mode'             => $gallery_mode,
		'data-layout'           => $layout,
		'data-ratio'            => $view_ratio,
		'data-autoplay'         => $autoplay ? 'true' : 'false',
		'data-show-add-to-cart' => $show_add_to_cart ? 'true' : 'false',
		'data-ajax-url'         => admin_url( 'admin-ajax.php' ),
		'data-wc-ajax-url'      => $wc_ajax_url,
		'data-product-nonce'    => wp_create_nonce( 'godam_get_single_sidebar_product_html' ),
	)
);

?>
<div <?php echo wp_kses_data( $wrapper_attributes ); ?>>
	<div class="godam-video-product-gallery__container">
		<?php foreach ( $gallery_items as $index => $item ) : ?>
			<div 
				class="godam-video-product-gallery-item godam-video-product-gallery-item--ratio-<?php echo esc_attr( $ratio_class ); ?>"
				data-video-id="<?php echo esc_attr( $item['videoId'] ); ?>"
				data-product-id="<?php echo esc_attr( $item['productId'] ); ?>"
				data-index="<?php echo esc_attr( $index ); ?>"
			>
				<!-- Video Section -->
				<div class="godam-gallery-item__video-wrapper">
					<?php
					// Render the video using the godam_video shortcode.
					echo do_shortcode(
						sprintf(
							'[godam_video id="%d" muted="true" loop="true" autoplay="%s" controls="true" aspect_ratio="%s" godam_context="godam-video-product-gallery" showShareButton="1"]',
							$item['videoId'],
							$autoplay ? 'true' : 'false',
							esc_attr( $view_ratio )
						)
					);
					?>
				</div>

				<!-- Product Section -->
				<?php
				if ( ! empty( $item['productData'] ) ) : 
					$product = $item['productData'];
					?>
					<div class="godam-gallery-item__product">
						<a href="<?php echo esc_url( $product['permalink'] ); ?>" class="godam-gallery-item__product-link">
							<?php if ( ! empty( $product['image'] ) ) : ?>
								<img
									src="<?php echo esc_url( $product['image'] ); ?>"
									alt="<?php echo esc_attr( $product['name'] ); ?>"
									class="godam-gallery-item__product-image"
									loading="lazy"
								/>
							<?php endif; ?>
							<div class="godam-gallery-item__product-details">
								<p class="godam-gallery-item__product-name"><?php echo esc_html( $product['name'] ); ?></p>
								<p class="godam-gallery-item__product-price"><?php echo wp_kses_post( $product['price'] ); ?></p>
							</div>
						</a>

						<?php if ( $show_add_to_cart && $product['in_stock'] ) : ?>
							<?php if ( 'variable' === $product['type'] ) : ?>
								<a
									href="<?php echo esc_url( $product['permalink'] ); ?>"
									target="_blank"
									class="godam-gallery-item__add-to-cart wp-element-button"
									<?php /* translators: %s: product name */ ?>
									aria-label="<?php echo esc_attr( sprintf( __( 'Select options for %s', 'godam' ), $product['name'] ) ); ?>"
								>
									<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
										<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
									</svg>
								</a>
							<?php else : ?>
								<button
									type="button"
									class="godam-gallery-item__add-to-cart wp-element-button"
									data-product-id="<?php echo esc_attr( $product['id'] ); ?>"
									data-product-type="<?php echo esc_attr( $product['type'] ); ?>"
									data-product-permalink="<?php echo esc_url( $product['permalink'] ); ?>"
									<?php /* translators: %s: product name */ ?>
									aria-label="<?php echo esc_attr( sprintf( __( 'Add %s to cart', 'godam' ), $product['name'] ) ); ?>"
								>
									<svg class="godam-gallery-item__add-to-cart-icon" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
										<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
									</svg>
									<svg class="godam-gallery-item__add-to-cart-spinner" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" style="display:none;">
										<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
									</svg>
									<svg class="godam-gallery-item__add-to-cart-check" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true" style="display:none;">
										<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
									</svg>
								</button>
							<?php endif; ?>
						<?php endif; ?>
					</div>
				<?php endif; ?>
			</div>
		<?php endforeach; ?>
	</div>

	<?php if ( 'carousel' === $layout && count( $gallery_items ) > 1 ) : ?>
		<button class="godam-video-product-gallery__nav godam-video-product-gallery__nav--prev" aria-label="<?php esc_attr_e( 'Previous', 'godam' ); ?>">
			<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
				<path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
			</svg>
		</button>
		<button class="godam-video-product-gallery__nav godam-video-product-gallery__nav--next" aria-label="<?php esc_attr_e( 'Next', 'godam' ); ?>">
			<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
				<path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
			</svg>
		</button>
	<?php endif; ?>
</div>
