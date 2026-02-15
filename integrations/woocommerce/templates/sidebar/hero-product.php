<?php
/**
 * Sidebar Hero Product Template
 *
 * @var WC_Product $product
 * @var string     $toggle_label
 * 
 * @package godam
 */

if ( ! isset( $product ) || ! $product instanceof WC_Product ) {
	return;
}

$product_url  = get_permalink( $product->get_id() );
$product_name = $product->get_name();
$product_img  = wp_get_attachment_image_url( $product->get_image_id(), 'full' );
?>

<div class="godam-sidebar-hero">

	<div class="godam-sidebar-hero__media">
		<img src="<?php echo esc_url( $product_img ); ?>" alt="<?php echo esc_attr( $product_name ); ?>" />
	</div>

	<div class="godam-sidebar-hero__content">
		<div class="godam-sidebar-hero__title">
			<h3><?php echo esc_html( $product_name ); ?></h3>
		</div>

		<div class="godam-sidebar-hero__price">
			<?php echo wp_kses_post( $product->get_price_html() ); ?>
		</div>
	</div>
</div>

<div class="godam-sidebar-hero__actions">
	<?php if ( $product->is_type( array( 'variable', 'grouped', 'external' ) ) || ! $product->is_in_stock() ) : ?>
		<a class="godam-product-sidebar-view-product-button"
			href="<?php echo esc_url( $product_url ); ?>"
			target="_blank">
			<?php esc_html_e( 'View Product', 'godam' ); ?>
		</a>
	<?php else : ?>
		<button class="godam-product-sidebar-add-to-cart-button"
				data-product-id="<?php echo esc_attr( $product->get_id() ); ?>">
			<span class="godam-add-to-cart-icon">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
					<path d="M12 5V19M5 12H19"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"/>
				</svg>
			</span>
			<span><?php esc_html_e( 'Add to Cart', 'godam' ); ?></span>
		</button>
	<?php endif; ?>
</div>

<hr class="godam-sidebar-divider" />

<div class="godam-sidebar-product-toggle" data-expanded="false">
	<div class="godam-sidebar-product-toggle__header">
		<span><?php echo esc_html( $toggle_label ); ?></span>

		<span class="godam-toggle-icon" aria-hidden="true">
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M6 9L12 15L18 9"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</span>
	</div>
</div>
