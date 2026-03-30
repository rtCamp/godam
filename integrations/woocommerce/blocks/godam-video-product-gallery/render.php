<?php
/**
 * Server-side rendering of the `godam/video-product-gallery` block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
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
			'variants'        => array(),
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

		// Get variants for variable products.
		if ( $product->is_type( 'variable' ) && $product instanceof WC_Product_Variable ) {
			$variations = $product->get_available_variations();
			$attributes = $product->get_variation_attributes();

			$product_data['variants'] = array(
				'attributes'  => array(),
				'variations'  => array(),
				'price_range' => array(
					'min' => $product->get_variation_price( 'min' ),
					'max' => $product->get_variation_price( 'max' ),
				),
			);

			// Get attribute labels and options.
			foreach ( $attributes as $attribute_name => $options ) {
				$attribute_label                          = wc_attribute_label( $attribute_name );
				$product_data['variants']['attributes'][] = array(
					'name'    => $attribute_name,
					'label'   => $attribute_label,
					'options' => $options,
				);
			}

			// Get variation details (limit to first 10 for performance).
			$variation_count = 0;
			foreach ( $variations as $variation ) {
				if ( $variation_count >= 10 ) {
					break;
				}
				$variation_obj = wc_get_product( $variation['variation_id'] );
				if ( $variation_obj ) {
					$product_data['variants']['variations'][] = array(
						'id'         => $variation['variation_id'],
						'price'      => $variation_obj->get_price_html(),
						'price_raw'  => $variation_obj->get_price(),
						'attributes' => $variation['attributes'],
						'in_stock'   => $variation_obj->is_in_stock(),
						'image'      => ! empty( $variation['image']['url'] ) ? $variation['image']['url'] : '',
					);
				}
				++$variation_count;
			}
		}

		return $product_data;
	}
}

// Block attributes.
$block_id   = isset( $attributes['blockId'] ) ? 'godam-vpg-' . esc_attr( $attributes['blockId'] ) : wp_unique_id( 'godam-vpg-' );
$layout     = isset( $attributes['layout'] ) ? esc_attr( $attributes['layout'] ) : 'carousel';
$view_ratio = isset( $attributes['viewRatio'] ) ? esc_attr( $attributes['viewRatio'] ) : '9:16';
$item_width = isset( $attributes['itemWidth'] ) ? absint( $attributes['itemWidth'] ) : 180;
$autoplay   = ! empty( $attributes['autoplay'] );

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

// Convert ratio to CSS class format.
$ratio_class = str_replace( ':', '-', $view_ratio );

// Collect all inner block data.
$gallery_items = array();

if ( ! empty( $block->inner_blocks ) ) {
	foreach ( $block->inner_blocks as $inner_block ) {
		if ( 'godam/video-product-gallery-item' === $inner_block->name ) {
			$item_attrs = $inner_block->attributes;

			$video_id   = isset( $item_attrs['videoId'] ) ? absint( $item_attrs['videoId'] ) : 0;
			$product_id = isset( $item_attrs['productId'] ) ? absint( $item_attrs['productId'] ) : 0;

			// Skip items without video.
			if ( ! $video_id ) {
				continue;
			}

			// Get fresh product data.
			$product_data = null;
			if ( $product_id ) {
				$product_data = godam_vpg_get_product_data( $product_id );
			}

			$gallery_items[] = array(
				'videoId'     => $video_id,
				'productId'   => $product_id,
				'productData' => $product_data,
			);
		}
	}
}

// Skip rendering if no items.
if ( empty( $gallery_items ) ) {
	return '';
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
			'godam-video-product-gallery godam-video-product-gallery--%s godam-video-product-gallery--ratio-%s',
			$layout,
			$ratio_class
		),
		'style'                 => $inline_styles,
		'data-block-id'         => $block_id,
		'data-layout'           => $layout,
		'data-ratio'            => $view_ratio,
		'data-autoplay'         => $autoplay ? 'true' : 'false',
		'data-show-add-to-cart' => $show_add_to_cart ? 'true' : 'false',
		'data-ajax-url'         => admin_url( 'admin-ajax.php' ),
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
