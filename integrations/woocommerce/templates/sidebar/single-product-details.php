<?php
/**
 * Single Product Details Template
 *
 * @var WC_Product $product
 * 
 * @package godam
 */

if ( ! isset( $product ) ) {
	return;
}

$product_images = array();

// Get the main product image first.
$main_image_id = $product->get_image_id();
if ( $main_image_id ) {
	$main_image_url = wp_get_attachment_image_url( $main_image_id, 'full' );
	if ( $main_image_url ) {
		$product_images[] = $main_image_url;
	}
}

// Get all gallery images.
$gallery_image_ids = $product->get_gallery_image_ids();
foreach ( $gallery_image_ids as $gallery_image_id ) {
	$gallery_image_url = wp_get_attachment_image_url( $gallery_image_id, 'full' );
	if ( $gallery_image_url ) {
		$product_images[] = $gallery_image_url;
	}
}

// Fallback to placeholder if no images found.
if ( empty( $product_images ) ) {
	$product_images[] = wc_placeholder_img_src( 'full' );
}

$average      = $product->get_average_rating();
$rating_count = $product->get_rating_count();

$full_star_svg  = sprintf(
	'<img src="%s" alt="%s" width="16" height="16" style="vertical-align:middle;" />',
	esc_url( RTGODAM_URL . 'assets/src/images/rating-full-star.svg' ),
	esc_attr__( 'Full Star', 'godam' )
);
$empty_star_svg = sprintf(
	'<img src="%s" alt="%s" width="16" height="16" style="vertical-align:middle;" />',
	esc_url( RTGODAM_URL . 'assets/src/images/rating-empty-star.svg' ),
	esc_attr__( 'Empty Star', 'godam' )
);

$allowed_svg = array(
	'svg'            => array(
		'xmlns'   => true,
		'width'   => true,
		'height'  => true,
		'viewBox' => true,
	),
	'defs'           => array(),
	'linearGradient' => array(
		'id' => true,
		'x1' => true,
		'y1' => true,
		'x2' => true,
		'y2' => true,
	),
	'stop'           => array(
		'offset'     => true,
		'stop-color' => true,
	),
	'path'           => array(
		'd'    => true,
		'fill' => true,
	),
);

?>

<div class="godam-image-gallery is-collapsed">
	<!-- main image display -->
	<div class="godam-main-image">
		<img src="<?php echo esc_url( $product_images[0] ); ?>" alt="<?php echo esc_attr( $product->get_name() ); ?>" />
	</div>

	<!-- thumbnail carousel with horizontal scroll -->
	<div class="godam-thumbnail-carousel">
		<button class="godam-thumbnail-nav godam-thumbnail-prev" aria-label="<?php echo esc_attr__( 'Previous thumbnails', 'godam' ); ?>">
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="fill: rgba(0, 0, 0, 1);"><path d="M15 19V5l-8 7z"></path></svg>
		</button>

		<div class="godam-thumbnail-container">
			<div class="godam-thumbnail-track">
				<?php foreach ( $product_images as $index => $image_url ) : ?>
					<div class="godam-thumbnail-item <?php echo ( 0 === $index ) ? 'active' : ''; ?>" data-index="<?php echo esc_attr( $index ); ?>">
						<?php // translators: %d refers to the image index (1-based). ?>
						<img class="godam-thumbnail-image" src="<?php echo esc_url( $image_url ); ?>" alt="<?php echo esc_attr( sprintf( __( 'Image %d', 'godam' ), $index + 1 ) ); ?>">
					</div>
				<?php endforeach; ?>
			</div>
		</div>

		<button class="godam-thumbnail-nav godam-thumbnail-next" aria-label="<?php echo esc_attr__( 'Next thumbnails', 'godam' ); ?>">
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="fill: rgba(0, 0, 0, 1);"><path d="m9 19 8-7-8-7z"></path></svg>
		</button>
	</div>
</div>
<div class="godam-single-product-sidebar-content is-collapsed">
	<div class="godam-sidebar-product-title">
		<h3><?php echo esc_html( $product->get_name() ); ?></h3>
	</div>
	<p class="godam-sidebar-product-price"><?php echo wp_kses_post( $product->get_price_html() ); ?></p>

	<div class="godam-sidebar-product-rating">
		<?php
		// Always render 5 stars.
		for ( $i = 1; $i <= 5; $i++ ) {
			if ( 0 === $rating_count ) {
				// No reviews → show all empty stars.
				echo wp_kses_post( $empty_star_svg );
			} elseif ( $average >= $i ) {
					echo wp_kses_post( $full_star_svg ); // Full star.
			} elseif ( $average > $i - 1 ) {
				$partial = ( $average - ( $i - 1 ) ) * 100; // % fill for partial star.
				echo $utility->get_partial_star_svg( $partial ); /* phpcs:ignore */
			} else {
				echo wp_kses_post( $empty_star_svg ); // Empty star.

			}
		}
		?>
	</div>

	<p class="godam-sidebar-product-description"><?php echo wp_kses_post( $product->get_description() ); ?></p>
</div>

<div class="godam-single-sidebar-small-cart-button">
	<?php if ( $product->is_type( array( 'variable', 'grouped', 'external' ) ) || ! $product->is_in_stock() ) : ?>
		<a class="godam-product-sidebar-view-product-button godam-small-cart-icon"
			href="<?php echo esc_url( $product_url ); ?>"
			target="_blank">
			<span class="godam-add-to-cart-icon">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
					<path d="M12 5V19M5 12H19"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"/>
				</svg>
			</span>
		</a>
	<?php else : ?>
		<button class="godam-product-sidebar-add-to-cart-button godam-small-cart-icon" data-product-id="<?php echo esc_attr( $product->get_id() ); ?>">
			<span class="godam-add-to-cart-icon">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
					<path d="M12 5V19M5 12H19"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"/>
				</svg>
			</span>
		</button>
	<?php endif; ?>
</div>
