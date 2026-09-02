<?php
/**
 * Render template for the GoDAM Image block.
 *
 * Renders the image and, when "Show image layers" is on and the attachment has
 * authored layers, a SINGLE shared overlay element that the front-end script
 * fills with every hotspot / product-hotspot from every layer. One overlay =
 * one stacking context, avoiding z-index conflicts between layers.
 *
 * @package GoDAM
 *
 * @var array $attributes Block attributes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$godam_attachment_id = ! empty( $attributes['id'] ) ? intval( $attributes['id'] ) : 0;
$godam_src           = ! empty( $attributes['url'] ) ? $attributes['url'] : '';
$godam_alt           = isset( $attributes['alt'] ) ? $attributes['alt'] : '';
$godam_width         = ! empty( $attributes['width'] ) ? intval( $attributes['width'] ) : 0;
$godam_height        = ! empty( $attributes['height'] ) ? intval( $attributes['height'] ) : 0;

// The toggle defaults to on when the attribute is absent.
$godam_show_layers = ! array_key_exists( 'showImageLayers', $attributes ) || ! empty( $attributes['showImageLayers'] );

// Fall back to the attachment's own URL / alt / dimensions when not stored on
// the block (e.g. a copied block that carries only the id).
if ( $godam_attachment_id ) {
	if ( '' === $godam_src ) {
		$godam_src = (string) wp_get_attachment_image_url( $godam_attachment_id, 'full' );
	}
	if ( '' === $godam_alt ) {
		$godam_alt = (string) get_post_meta( $godam_attachment_id, '_wp_attachment_image_alt', true );
	}
	if ( ! $godam_width || ! $godam_height ) {
		$godam_img_meta = wp_get_attachment_metadata( $godam_attachment_id );
		if ( is_array( $godam_img_meta ) ) {
			$godam_width  = $godam_width ? $godam_width : ( isset( $godam_img_meta['width'] ) ? intval( $godam_img_meta['width'] ) : 0 );
			$godam_height = $godam_height ? $godam_height : ( isset( $godam_img_meta['height'] ) ? intval( $godam_img_meta['height'] ) : 0 );
		}
	}
}

if ( empty( $godam_src ) ) {
	return '';
}

// Collect the authored hotspot / product-hotspot layers. Images have no
// timeline, so all layers are always visible.
$godam_layers = array();
if ( $godam_show_layers && $godam_attachment_id ) {
	$godam_meta       = get_post_meta( $godam_attachment_id, 'rtgodam_meta', true );
	$godam_all_layers = ( is_array( $godam_meta ) && ! empty( $godam_meta['layers'] ) ) ? $godam_meta['layers'] : array();
	foreach ( $godam_all_layers as $godam_layer ) {
		if ( ! is_array( $godam_layer ) || empty( $godam_layer['type'] ) ) {
			continue;
		}
		if ( 'hotspot' === $godam_layer['type'] && ! empty( $godam_layer['hotspots'] ) ) {
			$godam_layers[] = $godam_layer;
		} elseif ( 'woo' === $godam_layer['type'] && ! empty( $godam_layer['productHotspots'] ) ) {
			$godam_layers[] = $godam_layer;
		}
	}
}

$godam_has_layers = ! empty( $godam_layers );

// Enqueue the shared image-layers front-end renderer (+ its analytics runtime)
// only when there are layers to draw. Registered lazily here as footer scripts,
// so the Woo add-on's `godam_image_layers_frontend_dependencies` hook (added on
// wp_enqueue_scripts) is already in place.
if ( $godam_has_layers ) {
	// Layer-analytics runtime: registers `window.GoDAM.addLayerInteraction` + the
	// page-hide flush WITHOUT the video player (image pages never load
	// `godam-player-analytics.min.js`). Without it every emit in the shared hotspot
	// managers is a guarded no-op. Registered FIRST and made a DEPENDENCY of the
	// renderer below, so `window.GoDAM` exists before the renderer's DOMContentLoaded
	// handler fires the parent-layer 'viewed' impression beacon on render.
	$godam_la_asset_path = RTGODAM_PATH . 'assets/build/js/godam-layer-analytics.min.asset.php';
	$godam_la_asset      = file_exists( $godam_la_asset_path )
		// phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingVariable -- file path is a plugin constant + hardcoded build filename.
		? include $godam_la_asset_path
		: array(
			'dependencies' => array(),
			'version'      => RTGODAM_VERSION,
		);

	if ( ! wp_script_is( 'godam-layer-analytics-script', 'registered' ) ) {
		wp_register_script(
			'godam-layer-analytics-script',
			RTGODAM_URL . 'assets/build/js/godam-layer-analytics.min.js',
			$godam_la_asset['dependencies'],
			$godam_la_asset['version'],
			true
		);
	}

	$godam_img_asset_path = RTGODAM_PATH . 'assets/build/js/godam-image-layers-frontend.min.asset.php';
	$godam_img_asset      = file_exists( $godam_img_asset_path )
		// phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingVariable -- file path is a plugin constant + hardcoded build filename.
		? include $godam_img_asset_path
		: array(
			'dependencies' => array(),
			'version'      => RTGODAM_VERSION,
		);

	if ( ! wp_script_is( 'godam-image-layers-frontend', 'registered' ) ) {
		// Depend on the analytics runtime so `window.GoDAM.addLayerInteraction` is
		// registered before the renderer runs and fires the 'viewed' beacon.
		$godam_img_deps   = apply_filters( 'godam_image_layers_frontend_dependencies', $godam_img_asset['dependencies'] );
		$godam_img_deps[] = 'godam-layer-analytics-script';
		wp_register_script(
			'godam-image-layers-frontend',
			RTGODAM_URL . 'assets/build/js/godam-image-layers-frontend.min.js',
			$godam_img_deps,
			$godam_img_asset['version'],
			true
		);
	}

	// Enqueue the runtime explicitly too (in case the renderer was pre-registered
	// without the dependency), then the renderer, which pulls the runtime first.
	wp_enqueue_script( 'godam-layer-analytics-script' );
	wp_enqueue_script( 'godam-image-layers-frontend' );

	// The hotspot stylesheet (`godam-player-style`) is tied to this block via
	// wp_enqueue_block_style() in class-blocks.php, so WordPress prints it
	// whenever the block renders (reliable on block themes / FSE, unlike a late
	// wp_enqueue_style() here), so nothing else needs enqueuing here.
}

$godam_instance_id = 'img_' . bin2hex( random_bytes( 8 ) );

// Critical layout is inlined so the overlay stays glued to the image box even
// when the block stylesheet is deferred/not printed (e.g. block themes / FSE).
// A definite frame width (capped at the image's natural width) + `width:100%`
// image avoids the shrink-to-fit collapse some themes trigger with an
// `img { width: 100% }` rule inside an inline-block wrapper.
$godam_frame_style = $godam_width
	? sprintf( 'position:relative;display:block;width:100%%;max-width:%dpx;line-height:0;', $godam_width )
	: 'position:relative;display:inline-block;max-width:100%;line-height:0;';

// Block-support wrapper attributes (align / spacing / anchor + our hook class).
// The [godam_image] shortcode (WPBakery element) sets $godam_is_shortcode and
// runs outside a block, where get_block_wrapper_attributes() would warn, so it
// gets the stable hook class plus any WPBakery Design Options CSS class.
if ( empty( $godam_is_shortcode ) ) {
	$godam_wrapper_attributes = get_block_wrapper_attributes( array( 'class' => 'godam-image' ) );
} else {
	$godam_shortcode_class    = trim( 'godam-image ' . ( isset( $godam_css_class ) ? $godam_css_class : '' ) );
	$godam_wrapper_attributes = 'class="' . esc_attr( $godam_shortcode_class ) . '"';
}
?>
<figure data-test-id="godam-image-render" <?php echo wp_kses_data( $godam_wrapper_attributes ); ?>>
	<div
		class="godam-image__frame"
		style="<?php echo esc_attr( $godam_frame_style ); ?>"
		<?php if ( $godam_has_layers ) : ?>
			data-id="<?php echo esc_attr( (string) $godam_attachment_id ); ?>"
			data-instance-id="<?php echo esc_attr( $godam_instance_id ); ?>"
			data-block-source="godam-image"
			data-godam-image-layers="<?php echo esc_attr( wp_json_encode( $godam_layers ) ); ?>"
		<?php endif; ?>
	>
		<img
			class="godam-image__img"
			data-test-id="godam-image-render-img"
			style="display:block;width:100%;height:auto;"
			src="<?php echo esc_url( $godam_src ); ?>"
			alt="<?php echo esc_attr( $godam_alt ); ?>"
			<?php echo $godam_width ? 'width="' . esc_attr( (string) $godam_width ) . '"' : ''; ?>
			<?php echo $godam_height ? 'height="' . esc_attr( (string) $godam_height ) . '"' : ''; ?>
			loading="lazy"
			decoding="async"
		/>
		<?php if ( $godam_has_layers ) : ?>
			<div id="layer-<?php echo esc_attr( $godam_instance_id ); ?>-all" class="easydam-layer hotspot-layer godam-image-layer" data-test-id="godam-image-render-layers"></div>
		<?php endif; ?>
	</div>
</figure>
