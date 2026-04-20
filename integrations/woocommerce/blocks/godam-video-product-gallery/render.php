<?php
/**
 * Server-side rendering of the `godam/video-product-gallery` block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Premium block: hide frontend output when API key is invalid.
if ( ! rtgodam_is_api_key_valid() ) {
	return;
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
	 * Build gallery items from the block's inner blocks.
	 *
	 * @param array    $attributes Block attributes (unused, kept for future extensibility).
	 * @param WP_Block $block      Parsed block instance containing inner blocks.
	 * @return array List of gallery item arrays with videoId, productId, and productData.
	 */
	function godam_vpg_build_gallery_items( $attributes, $block ) {
		$gallery_items = array();

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
				'productId'   => $product_id ? array( $product_id ) : array(),
				'productData' => $product_id ? array( godam_vpg_get_product_data( $product_id ) ) : array(),
			);
		}

		return $gallery_items;
	}
}

// Block attributes.
$block_id        = isset( $attributes['blockId'] ) ? 'godam-vpg-' . esc_attr( $attributes['blockId'] ) : wp_unique_id( 'godam-vpg-' );
$gallery_mode    = 'handpicked';
$layout          = isset( $attributes['layout'] ) ? esc_attr( $attributes['layout'] ) : 'carousel';
$view_ratio      = isset( $attributes['viewRatio'] ) ? esc_attr( $attributes['viewRatio'] ) : '9:16';
$item_width_size = isset( $attributes['itemWidth'] ) ? $attributes['itemWidth'] : 'M';
$item_width_map  = array(
	'S' => 220,
	'M' => 260,
	'L' => 300,
);
$item_width      = isset( $item_width_map[ $item_width_size ] ) ? $item_width_map[ $item_width_size ] : 220;
$autoplay        = ! empty( $attributes['autoplay'] );

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
$show_play_button = isset( $attributes['showPlayButton'] ) ? (bool) $attributes['showPlayButton'] : true;
$wc_ajax_url      = class_exists( 'WC_AJAX' ) ? WC_AJAX::get_endpoint( '%%endpoint%%' ) : '';

// Convert ratio to CSS class format.
$ratio_class = str_replace( ':', '-', $view_ratio );

$gallery_items = godam_vpg_build_gallery_items( $attributes, $block );

// Skip rendering if no items.
if ( empty( $gallery_items ) ) {
	$empty_wrapper_attrs = get_block_wrapper_attributes(
		array(
			'id'    => $block_id,
			'class' => sprintf(
				'godam-video-product-gallery godam-video-product-gallery--%s godam-video-product-gallery--%s',
				$layout,
				$gallery_mode
			),
		)
	);
	return '<div ' . wp_kses_data( $empty_wrapper_attrs ) . '><p class="godam-video-product-gallery__empty">' . esc_html__( 'No video products found.', 'godam' ) . '</p></div>';
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
		'data-show-play-button' => $show_play_button ? 'true' : 'false',
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
				data-product-id="<?php echo esc_attr( implode( ',', $item['productId'] ) ); ?>"
				data-index="<?php echo esc_attr( $index ); ?>"
			>
				<!-- Video Section + Dropdown section(if available) -->
				<div class="godam-gallery-item__video-and-dropdown">
					<div class="godam-gallery-item__video-wrapper">
					<?php if ( $show_play_button ) : ?>
					<div class="godam-gallery-item__play-icon" aria-hidden="true">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
							<path d="M8 5v14l11-7z"/>
						</svg>
					</div>
					<?php endif; ?>
						<?php
						// Render the video using the godam_video shortcode.
						echo do_shortcode(
							sprintf(
								'[godam_video id="%d" muted="true" loop="false" autoplay="%s" controls="true" aspect_ratio="%s" godam_context="godam-video-product-gallery" preload="none"]',
								$item['videoId'],
								'false',
								esc_attr( $view_ratio )
							)
						);
						?>
					</div>

					<!-- Multiple products dropdown -->
					<?php if ( count( $item['productId'] ) > 1 ) : ?>
						<div class="cta-wrapper">
							<div class="cta-dropdown" data-gallery-id="<?php echo esc_attr( $block_id ); ?>">
								<?php foreach ( $item['productData'] as $cta_product ) : ?>
									<div class="cta-dropdown-item">
										<a href="<?php echo esc_url( $cta_product['permalink'] ); ?>" class="cta-dropdown-link">
											<?php if ( ! empty( $cta_product['image'] ) ) : ?>
												<img
													src="<?php echo esc_url( $cta_product['image'] ); ?>"
													alt="<?php echo esc_attr( $cta_product['name'] ); ?>"
													class="cta-dropdown-image"
													loading="lazy"
												/>
											<?php endif; ?>
											<div class="cta-dropdown-details">
												<p class="cta-dropdown-name"><?php echo esc_html( $cta_product['name'] ); ?></p>
												<p class="cta-dropdown-price"><?php echo wp_kses_post( $cta_product['price'] ); ?></p>
											</div>
										</a>
										<?php if ( $show_add_to_cart && $cta_product['in_stock'] ) : ?>
											<?php if ( 'variable' === $cta_product['type'] ) : ?>
												<a
													href="<?php echo esc_url( $cta_product['permalink'] ); ?>"
													target="_blank"
													rel="noopener noreferrer"
													class="cta-dropdown-add-to-cart wp-element-button"
													<?php /* translators: %s: product name */ ?>
													aria-label="<?php echo esc_attr( sprintf( __( 'Select options for %s', 'godam' ), $cta_product['name'] ) ); ?>"
												>
													<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
														<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
													</svg>
												</a>
											<?php else : ?>
												<button
													type="button"
													class="cta-dropdown-add-to-cart wp-element-button"
													data-product-id="<?php echo esc_attr( $cta_product['id'] ); ?>"
													data-product-type="<?php echo esc_attr( $cta_product['type'] ); ?>"
													data-product-permalink="<?php echo esc_url( $cta_product['permalink'] ); ?>"
													<?php /* translators: %s: product name */ ?>
													aria-label="<?php echo esc_attr( sprintf( __( 'Add %s to cart', 'godam' ), $cta_product['name'] ) ); ?>"
												>
													<svg class="cta-dropdown-add-to-cart-icon" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
														<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
													</svg>
													<svg class="cta-dropdown-add-to-cart-spinner" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" style="display:none;">
														<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
													</svg>
													<svg class="cta-dropdown-add-to-cart-check" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true" style="display:none;">
														<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
													</svg>
												</button>
											<?php endif; ?>
										<?php endif; ?>
									</div>
								<?php endforeach; ?>
							</div>
						</div>
					<?php endif; ?>
				</div>

				<!-- Product Section -->
				<?php
				if ( ! empty( $item['productData'] ) ) : 
					$product = $item['productData'][0];
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

						<?php if ( count( $item['productId'] ) === 1 ) : ?>
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
						<?php else : ?>
							<!-- show dropdown for multiple products attached to the same video and the dropdown should open upwards if the item is in the bottom half of the gallery. -->
							<?php
							$dropdown_class = 'godam-gallery-item__product-dropdown';
							?>
							<div class="<?php echo esc_attr( $dropdown_class ); ?>">
								<button class="godam-gallery-item__product-dropdown-toggle" type="button" aria-haspopup="true" aria-expanded="false">
									<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M6 14L12 8L18 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
									</svg>
								</button>
							</div>			
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
