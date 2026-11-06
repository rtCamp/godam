<?php
/**
 * The CTA layer type: an HTML CTA or a card (image) CTA over the video.
 *
 * Registered like an add-on's layer type, from this folder's layer.json.
 * Built to `assets/build/layers/cta/`, where GoDAM loads it from.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Layers\Core;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Layers\Core_Layer_Types;

/**
 * Register the CTA layer type.
 *
 * @return void
 */
function register_cta() {
	godam_register_layer_type(
		__DIR__ . '/layer.json',
		array(
			'render_callback'            => __NAMESPACE__ . '\\render_cta',
			// Escapes its own output (the CTA HTML goes through wp_kses_post()).
			'supports'                   => array( 'rawHtml' => true ),
			// layer.json doesn't list every attribute a CTA saves yet.
			'keep_undeclared_attributes' => true,
		)
	);
}

/**
 * The CTA layer's container.
 *
 * Only HTML and card CTAs are supported. Legacy "text" CTAs (and any other
 * type) render nothing: an empty box would pause playback with no content,
 * and the player skips a layer whose element is missing.
 *
 * @param array  $layer       Saved layer.
 * @param string $instance_id Player instance id.
 * @return string Markup.
 */
function render_cta( $layer, $instance_id ) {
	$cta_type = $layer['cta_type'] ?? '';

	if ( 'html' === $cta_type && ! empty( $layer['html'] ) ) {
		$cta_html = do_shortcode( $layer['html'] );

		/**
		 * Filters the rendered CTA HTML content for a video layer, after
		 * shortcode expansion and before final sanitization.
		 *
		 * @since 2.2.0
		 *
		 * @param string $cta_html The CTA HTML content after shortcode expansion.
		 * @param array  $layer    The layer configuration array.
		 */
		$cta_html = apply_filters( 'rtgodam_cta_html_content', $cta_html, $layer );

		return Core_Layer_Types::container( $layer, $instance_id, '<div class="easydam-layer--cta-html">' . wp_kses_post( $cta_html ) . '</div>' );
	}

	if ( 'image' === $cta_type && function_exists( 'rtgodam_image_cta_html' ) ) {
		return Core_Layer_Types::container( $layer, $instance_id, wp_kses_post( rtgodam_image_cta_html( $layer ) ) );
	}

	return '';
}
