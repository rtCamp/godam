<?php
/**
 * Render template for the GoDAM Reel Pops Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Return if WooCommerce is not Active.
if ( ! is_plugin_active( 'woocommerce/woocommerce.php' ) ) {
	return;
}

// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- WordPress core variable.
$attributes = wp_parse_args(
	$attributes,
	array(
		'blockId'           => '',
		'videos'            => array(),
		'aspectRatio'       => '9-16',
		'position'          => 'bottom-right',
		'animation'         => 'slide-up',
		'animationDuration' => 500,
		'durationSeconds'   => 5,
		'initialDelay'      => 3,
		'closePersistence'  => 'show_again',
		'enableAutoplay'    => true,
		'popupWidth'        => 120,
		'bottomSpacing'     => 20,
		'sideSpacing'       => 20,
	)
);

// Return if no videos selected.
if ( empty( $attributes['videos'] ) || ! is_array( $attributes['videos'] ) ) {
	return;
}

// Filter out invalid videos.
$valid_videos = array_filter(
	$attributes['videos'],
	function( $video ) {
		return ! empty( $video['videoId'] ) && is_numeric( $video['videoId'] );
	}
);

if ( empty( $valid_videos ) ) {
	return;
}

// Convert block attributes to shortcode attributes.
$video_ids          = array();
$product_ids_groups = array();

foreach ( $valid_videos as $video ) {
	$video_ids[] = absint( $video['videoId'] );

	// Build product IDs string for this video.
	$product_ids          = ! empty( $video['productIds'] ) ? sanitize_text_field( $video['productIds'] ) : '';
	$product_ids_groups[] = $product_ids;
}

// Build shortcode attributes.
$shortcode_atts = array(
	'video_ids'          => implode( ',', $video_ids ),
	'product_ids'        => implode( '|', $product_ids_groups ),
	'aspect_ratio'       => sanitize_text_field( $attributes['aspectRatio'] ),
	'position'           => sanitize_text_field( $attributes['position'] ),
	'animation'          => sanitize_text_field( $attributes['animation'] ),
	'animation_duration' => absint( $attributes['animationDuration'] ),
	'duration_seconds'   => absint( $attributes['durationSeconds'] ),
	'initial_delay'      => absint( $attributes['initialDelay'] ),
	'close_persistence'  => sanitize_text_field( $attributes['closePersistence'] ),
	'enable_autoplay'    => $attributes['enableAutoplay'] ? 'true' : 'false',
	'popup_width'        => absint( $attributes['popupWidth'] ),
	'bottom_spacing'     => absint( $attributes['bottomSpacing'] ),
	'side_spacing'       => absint( $attributes['sideSpacing'] ),
	'block_id'           => ! empty( $attributes['blockId'] ) ? sanitize_html_class( $attributes['blockId'] ) : '',
);

// Build shortcode string.
$shortcode_parts = array();
foreach ( $shortcode_atts as $key => $value ) {
	if ( '' !== $value ) {
		$shortcode_parts[] = sprintf( '%s="%s"', $key, esc_attr( $value ) );
	}
}

$shortcode = '[godam_video_reel_pops ' . implode( ' ', $shortcode_parts ) . ']';

// Render via shortcode.
echo do_shortcode( $shortcode ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
