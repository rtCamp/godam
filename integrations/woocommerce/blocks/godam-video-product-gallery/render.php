<?php
/**
 * Server-side rendering of the `godam/video-product-gallery` block.
 *
 * @package GoDAM
 */

// Block attributes.
$block_id   = isset( $attributes['blockId'] ) ? esc_attr( $attributes['blockId'] ) : '';
$layout     = isset( $attributes['layout'] ) ? esc_attr( $attributes['layout'] ) : 'carousel';
$view_ratio = isset( $attributes['viewRatio'] ) ? esc_attr( $attributes['viewRatio'] ) : '9:16';
$item_width = isset( $attributes['itemWidth'] ) ? absint( $attributes['itemWidth'] ) : 180;
$gap        = isset( $attributes['gap'] ) ? absint( $attributes['gap'] ) : 16;

// Convert ratio to CSS class format.
$ratio_class = str_replace( ':', '-', $view_ratio );

// Build inline styles for CSS custom properties.
$inline_styles = sprintf(
	'--godam-gallery-item-width: %dpx; --godam-gallery-gap: %dpx;',
	$item_width,
	$gap
);

// Build wrapper attributes.
$wrapper_attributes = get_block_wrapper_attributes(
	array(
		'class'         => sprintf(
			'godam-video-product-gallery godam-video-product-gallery--%s godam-video-product-gallery--ratio-%s',
			$layout,
			$ratio_class
		),
		'style'         => $inline_styles,
		'data-block-id' => $block_id,
		'data-layout'   => $layout,
		'data-ratio'    => $view_ratio,
	)
);

?>
<div <?php echo $wrapper_attributes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
	<?php echo $content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
</div>
