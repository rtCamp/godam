<?php
/**
 * Sidebar Hero Product Template
 *
 * @var WC_Product $product
 * @var string     $toggle_label
 * 
 * @package godam
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! isset( $product ) || ! $product instanceof WC_Product ) {
	return;
}

$product_url  = get_permalink( $product->get_id() );
$product_name = $product->get_name();
$product_img  = wp_get_attachment_image_url( $product->get_image_id(), 'full' );

$product_type     = $product->get_type();
$variations_json  = '';
$attributes_json  = '';
$preselected_json = '';

if ( 'variable' === $product_type ) {
	$available_variations = $product->get_available_variations();
	$var_map              = array();
	foreach ( $available_variations as $variation ) {
		$var_map[] = array(
			'id'         => $variation['variation_id'],
			'attributes' => $variation['attributes'],
			'in_stock'   => $variation['is_in_stock'],
			'price_html' => $variation['price_html'],
		);
	}
	$variations_json = wp_json_encode( $var_map );

	$attr_data = array();
	foreach ( $product->get_variation_attributes() as $attribute_slug => $attribute_values ) {
		$options = array();
		foreach ( $attribute_values as $value ) {
			$attr_term = get_term_by( 'slug', $value, $attribute_slug );
			$options[] = array(
				'value' => $value,
				'label' => $attr_term ? $attr_term->name : ucfirst( str_replace( '-', ' ', $value ) ),
			);
		}
		$attr_data[] = array(
			'slug'    => $attribute_slug,
			'label'   => wc_attribute_label( $attribute_slug ),
			'options' => $options,
		);
	}
	$attributes_json = wp_json_encode( $attr_data );

	// Look up admin-configured preselected attrs for this video first;
	// fall back to WooCommerce product default attributes.
	$video_id_ref      = isset( $video_id ) ? absint( $video_id ) : 0;
	$preselected_attrs = array();
	if ( $video_id_ref ) {
		$video_variations = get_post_meta( $product->get_id(), '_rtgodam_product_video_variations', true );
		$video_variations = is_array( $video_variations ) ? $video_variations : array();
		if ( isset( $video_variations[ $video_id_ref ] ) ) {
			$preselected_attrs = $video_variations[ $video_id_ref ];
		}
	}
	if ( empty( $preselected_attrs ) ) {
		$preselected_attrs = $product->get_default_attributes();
	}
	if ( ! empty( $preselected_attrs ) ) {
		$preselected_json = wp_json_encode( $preselected_attrs );
	}
}
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
	<?php if ( 'variable' === $product_type && $product->is_in_stock() ) : ?>
		<button class="godam-product-sidebar-add-to-cart-button"
				data-product-id="<?php echo esc_attr( $product->get_id() ); ?>"
				data-product-type="variable"
				data-product-url="<?php echo esc_url( $product_url ); ?>"
				data-variations="<?php echo esc_attr( $variations_json ); ?>"
				data-variation-attributes="<?php echo esc_attr( $attributes_json ); ?>"
				data-preselected-attrs="<?php echo esc_attr( $preselected_json ); ?>">
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
	<?php elseif ( $product->is_type( array( 'grouped', 'external' ) ) || ! $product->is_in_stock() ) : ?>
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
