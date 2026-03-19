<?php
/**
 * Multiple Products List Template
 *
 * @var array $products (array of WC_Product objects)
 * 
 * @package godam
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( empty( $products ) ) {
	return;
}
?>

<div class="godam-sidebar-multiple-list is-collapsed godam-product-sidebar-list">

	<?php foreach ( $products as $product ) : ?>

		<div class="godam-sidebar-product-item">

			<div class="godam-sidebar-product-image">
				<?php echo wp_kses_post( $product->get_image() ); ?>
			</div>

			<div class="godam-sidebar-product-content">
				<div class="godam-sidebar-product-title"><?php echo esc_html( $product->get_name() ); ?></div>

				<div class="godam-sidebar-product-price">
					<?php echo wp_kses_post( $product->get_price_html() ); ?>
				</div>

				<?php
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
			</div>

			<div class="godam-multiple-sidebar-small-cart-button">
				<?php
				$item_type             = $product->get_type();
				$item_variations_json  = '';
				$item_attributes_json  = '';
				$item_preselected_json = '';

				if ( 'variable' === $item_type ) {
					$item_available_variations = $product->get_available_variations();
					$item_var_map              = array();
					foreach ( $item_available_variations as $variation ) {
						$item_var_map[] = array(
							'id'         => $variation['variation_id'],
							'attributes' => $variation['attributes'],
							'in_stock'   => $variation['is_in_stock'],
							'price_html' => $variation['price_html'],
						);
					}
					$item_variations_json = wp_json_encode( $item_var_map );

					$item_attr_data = array();
					foreach ( $product->get_variation_attributes() as $attribute_slug => $attribute_values ) {
						$options = array();
						foreach ( $attribute_values as $value ) {
							$attr_term = get_term_by( 'slug', $value, $attribute_slug );
							$options[] = array(
								'value' => $value,
								'label' => $attr_term ? $attr_term->name : ucfirst( str_replace( '-', ' ', $value ) ),
							);
						}
						$item_attr_data[] = array(
							'slug'    => $attribute_slug,
							'label'   => wc_attribute_label( $attribute_slug ),
							'options' => $options,
						);
					}
					$item_attributes_json = wp_json_encode( $item_attr_data );

					// Look up admin-configured preselected attrs for this video first;
					// fall back to WooCommerce product default attributes.
					$item_video_id_ref = isset( $video_id ) ? absint( $video_id ) : 0;
					$item_preselected  = array();
					if ( $item_video_id_ref ) {
						$item_video_variations = get_post_meta( $product->get_id(), '_rtgodam_product_video_variations', true );
						$item_video_variations = is_array( $item_video_variations ) ? $item_video_variations : array();
						if ( isset( $item_video_variations[ $item_video_id_ref ] ) ) {
							$item_preselected = $item_video_variations[ $item_video_id_ref ];
						}
					}
					if ( empty( $item_preselected ) ) {
						$item_preselected = $product->get_default_attributes();
					}
					$item_preselected_json = ! empty( $item_preselected ) ? wp_json_encode( $item_preselected ) : '';
				}
				?>

				<?php if ( 'variable' === $item_type && $product->is_in_stock() ) : ?>
					<button class="godam-product-sidebar-add-to-cart-button godam-small-cart-icon"
						data-product-id="<?php echo esc_attr( $product->get_id() ); ?>"
						data-product-type="variable"
						data-product-url="<?php echo esc_url( get_permalink( $product->get_id() ) ); ?>"
						data-variations="<?php echo esc_attr( $item_variations_json ); ?>"
						data-variation-attributes="<?php echo esc_attr( $item_attributes_json ); ?>"
						data-preselected-attrs="<?php echo esc_attr( $item_preselected_json ); ?>">
						<span class="godam-add-to-cart-icon">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
								<path d="M12 5V19M5 12H19"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"/>
							</svg>
						</span>
					</button>
				<?php elseif ( $product->is_type( array( 'grouped', 'external' ) ) || ! $product->is_in_stock() ) : ?>
					<a class="godam-product-sidebar-view-product-button godam-small-cart-icon"
						href="<?php echo esc_url( get_permalink( $product->get_id() ) ); ?>"
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

		</div>

	<?php endforeach; ?>

</div>
