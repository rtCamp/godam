<?php
/**
 * Server-side rendering of the `godam/video-product-gallery-item` block.
 *
 * @package GoDAM
 */

// Block attributes.
$video_id        = isset( $attributes['videoId'] ) ? absint( $attributes['videoId'] ) : 0;
$video_url       = isset( $attributes['videoUrl'] ) ? esc_url( $attributes['videoUrl'] ) : '';
$video_thumbnail = isset( $attributes['videoThumbnail'] ) ? esc_url( $attributes['videoThumbnail'] ) : '';
$video_title     = isset( $attributes['videoTitle'] ) ? esc_attr( $attributes['videoTitle'] ) : '';
$product_id      = isset( $attributes['productId'] ) ? absint( $attributes['productId'] ) : 0;
$product_name    = isset( $attributes['productName'] ) ? esc_html( $attributes['productName'] ) : '';
$product_price   = isset( $attributes['productPrice'] ) ? esc_html( $attributes['productPrice'] ) : '';
$product_image   = isset( $attributes['productImage'] ) ? esc_url( $attributes['productImage'] ) : '';

// Get context from parent block.
$layout     = isset( $block->context['godam/videoProductGallery/layout'] ) ? esc_attr( $block->context['godam/videoProductGallery/layout'] ) : 'carousel';
$view_ratio = isset( $block->context['godam/videoProductGallery/viewRatio'] ) ? esc_attr( $block->context['godam/videoProductGallery/viewRatio'] ) : '9:16';

// Convert ratio to CSS class format.
$ratio_class = str_replace( ':', '-', $view_ratio );

// Skip rendering if no video selected.
if ( ! $video_id ) {
	return;
}

// Build wrapper attributes.
$wrapper_attributes = get_block_wrapper_attributes(
	array(
		'class'           => sprintf(
			'godam-video-product-gallery-item godam-video-product-gallery-item--ratio-%s',
			$ratio_class
		),
		'data-video-id'   => $video_id,
		'data-product-id' => $product_id,
	)
);

?>
<div <?php echo $wrapper_attributes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
	<div class="godam-gallery-item__video-wrapper">
		<?php if ( $video_thumbnail ) : ?>
			<img
				src="<?php echo esc_url( $video_thumbnail ); ?>"
				alt="<?php echo esc_attr( $video_title ); ?>"
				class="godam-gallery-item__thumbnail"
				loading="lazy"
			/>
		<?php endif; ?>
		<button class="godam-gallery-item__play-button" aria-label="<?php esc_attr_e( 'Play video', 'godam' ); ?>">
			<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
				<path d="M8 5v14l11-7z" />
			</svg>
		</button>
	</div>

	<?php if ( $product_id ) : ?>
		<div class="godam-gallery-item__product">
			<?php if ( $product_image ) : ?>
				<img
					src="<?php echo esc_url( $product_image ); ?>"
					alt="<?php echo esc_attr( $product_name ); ?>"
					class="godam-gallery-item__product-image"
					loading="lazy"
				/>
			<?php endif; ?>
			<div class="godam-gallery-item__product-details">
				<?php if ( $product_name ) : ?>
					<p class="godam-gallery-item__product-name"><?php echo esc_html( $product_name ); ?></p>
				<?php endif; ?>
				<?php if ( $product_price ) : ?>
					<p class="godam-gallery-item__product-price"><?php echo esc_html( $product_price ); ?></p>
				<?php endif; ?>
			</div>
		</div>
	<?php endif; ?>
</div>
