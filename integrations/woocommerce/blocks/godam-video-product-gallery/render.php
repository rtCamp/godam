<?php
/**
 * Server-side rendering of the `godam/video-product-gallery` block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'godam_vpg_get_video_sources' ) ) {

	/**
	 * Get video sources from attachment metadata.
	 *
	 * @param int $video_id The video attachment ID.
	 * @return array Array of video sources with type and src.
	 */
	function godam_vpg_get_video_sources( $video_id ) {
		if ( empty( $video_id ) ) {
			return array();
		}

		$sources = array();

		// DASH source (MPD).
		$dash_url = get_post_meta( $video_id, 'rtgodam_transcoded_url', true );
		if ( ! empty( $dash_url ) ) {
			$sources[] = array(
				'src'  => esc_url( rtgodam_convert_to_https_url( $dash_url ) ),
				'type' => 'application/dash+xml',
			);
		}

		// HLS source.
		$hls_url = get_post_meta( $video_id, 'rtgodam_hls_transcoded_url', true );
		if ( ! empty( $hls_url ) ) {
			$sources[] = array(
				'src'  => esc_url( rtgodam_convert_to_https_url( $hls_url ) ),
				'type' => 'application/x-mpegURL',
			);
		}

		// MP4 source.
		$mp4_url = get_post_meta( $video_id, 'rtgodam_mp4_transcoded_url', true );
		if ( ! empty( $mp4_url ) ) {
			$sources[] = array(
				'src'  => esc_url( rtgodam_convert_to_https_url( $mp4_url ) ),
				'type' => 'video/mp4',
			);
		}

		// Fallback to original attachment URL.
		$original_url = wp_get_attachment_url( $video_id );
		if ( ! empty( $original_url ) ) {
			$mime_type = get_post_mime_type( $video_id );
			$sources[] = array(
				'src'  => esc_url( rtgodam_convert_to_https_url( $original_url ) ),
				'type' => $mime_type ? $mime_type : 'video/mp4',
			);
		}

		return $sources;
	}
}

if ( ! function_exists( 'godam_vpg_get_video_thumbnail' ) ) {

	/**
	 * Get video thumbnail/poster from attachment.
	 *
	 * @param int    $video_id        The video attachment ID.
	 * @param string $saved_thumbnail The saved thumbnail URL from block attributes.
	 * @return string The thumbnail URL.
	 */
	function godam_vpg_get_video_thumbnail( $video_id, $saved_thumbnail = '' ) {
		// First check for GoDAM generated thumbnail.
		$godam_thumbnail = get_post_meta( $video_id, 'rtgodam_thumbnail_url', true );
		if ( ! empty( $godam_thumbnail ) ) {
			return esc_url( rtgodam_convert_to_https_url( $godam_thumbnail ) );
		}

		// Check for WordPress generated thumbnail.
		$wp_thumbnail = get_post_meta( $video_id, '_thumbnail_id', true );
		if ( ! empty( $wp_thumbnail ) ) {
			$thumbnail_url = wp_get_attachment_image_url( $wp_thumbnail, 'large' );
			if ( ! empty( $thumbnail_url ) ) {
				return esc_url( $thumbnail_url );
			}
		}

		// Fallback to saved thumbnail from block attributes.
		if ( ! empty( $saved_thumbnail ) ) {
			return esc_url( $saved_thumbnail );
		}

		return '';
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

			// Get fresh video sources.
			$video_sources   = godam_vpg_get_video_sources( $video_id );
			$video_thumbnail = godam_vpg_get_video_thumbnail(
				$video_id,
				isset( $item_attrs['videoThumbnail'] ) ? $item_attrs['videoThumbnail'] : ''
			);
			$video_title     = get_the_title( $video_id );

			// Get fresh product data.
			$product_data = null;
			if ( $product_id ) {
				$product_data = godam_vpg_get_product_data( $product_id );
			}

			$gallery_items[] = array(
				'videoId'        => $video_id,
				'videoSources'   => $video_sources,
				'videoThumbnail' => $video_thumbnail,
				'videoTitle'     => $video_title,
				'productId'      => $product_id,
				'productData'    => $product_data,
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
					<video
						id="<?php echo esc_attr( $block_id . '-video-' . $index ); ?>"
						class="godam-gallery-item__video"
						<?php if ( $item['videoThumbnail'] ) : ?>
							poster="<?php echo esc_url( $item['videoThumbnail'] ); ?>"
						<?php endif; ?>
						playsinline
						muted
						loop
						<?php if ( $autoplay ) : ?>
							autoplay
						<?php endif; ?>
						preload="<?php echo $autoplay ? 'auto' : 'metadata'; ?>"
						data-sources="<?php echo esc_attr( wp_json_encode( $item['videoSources'] ) ); ?>"
					>
						<?php foreach ( $item['videoSources'] as $source ) : ?>
							<source src="<?php echo esc_url( $source['src'] ); ?>" type="<?php echo esc_attr( $source['type'] ); ?>">
						<?php endforeach; ?>
					</video>

					<!-- Custom Video Controls -->
					<div class="godam-gallery-item__controls">
						<!-- Top-left: Mute + Fullscreen -->
						<div class="godam-gallery-item__controls-top">
							<button class="godam-gallery-item__btn godam-gallery-item__btn--mute" aria-label="<?php esc_attr_e( 'Mute', 'godam' ); ?>">
								<!-- Muted icon -->
								<svg class="godam-icon godam-icon--muted" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
								<!-- Unmuted icon -->
								<svg class="godam-icon godam-icon--unmuted" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
							</button>
							<button class="godam-gallery-item__btn godam-gallery-item__btn--fullscreen" aria-label="<?php esc_attr_e( 'Fullscreen', 'godam' ); ?>">
								<!-- Enter fullscreen icon -->
								<svg class="godam-icon godam-icon--enter-fs" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
								<!-- Exit fullscreen icon -->
								<svg class="godam-icon godam-icon--exit-fs" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
							</button>
						</div>

						<!-- Center: Play/Pause -->
						<button class="godam-gallery-item__btn godam-gallery-item__btn--playpause" aria-label="<?php esc_attr_e( 'Play', 'godam' ); ?>">
							<!-- Play icon -->
							<svg class="godam-icon godam-icon--play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
							<!-- Pause icon -->
							<svg class="godam-icon godam-icon--pause" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
						</button>

						<!-- Bottom: Progress bar -->
						<div class="godam-gallery-item__progress">
							<div class="godam-gallery-item__progress-bar">
								<div class="godam-gallery-item__progress-fill"></div>
							</div>
						</div>
					</div>
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
