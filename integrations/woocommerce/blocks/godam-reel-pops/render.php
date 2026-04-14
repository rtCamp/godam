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
if ( ! class_exists( 'WooCommerce' ) ) {
	return;
}

// Premium block: hide frontend output when API key is invalid.
if ( ! rtgodam_is_api_key_valid() ) {
	return;
}

if ( ! isset( $attributes ) || ! is_array( $attributes ) ) {
	$attributes = array();
}

// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- WordPress core variable.
$attributes = wp_parse_args(
	$attributes,
	array(
		'blockId'          => '',
		'videos'           => array(),
		'aspectRatio'      => '9-16',
		'position'         => 'bottom-right',
		'animation'        => 'slide-up',
		'durationSeconds'  => 5,
		'initialDelay'     => 3,
		'closePersistence' => 'show_again',
	)
);

// Return if no videos selected.
if ( empty( $attributes['videos'] ) || ! is_array( $attributes['videos'] ) ) {
	return;
}


// Filter out invalid video IDs.
$valid_videos = array_filter(
	$attributes['videos'],
	function ( $video_id ) {
		return is_numeric( $video_id ) && absint( $video_id ) > 0;
	}
);

if ( empty( $valid_videos ) ) {
	return;
}

// Convert block attributes to shortcode attributes.
$video_ids = array();

foreach ( $valid_videos as $video_id ) {
	$video_ids[] = absint( $video_id );
}

// Build shortcode attributes.
$shortcode_atts = array(
	'video_ids'         => implode( ',', $video_ids ),
	'aspect_ratio'      => sanitize_text_field( $attributes['aspectRatio'] ),
	'position'          => sanitize_text_field( $attributes['position'] ),
	'animation'         => sanitize_text_field( $attributes['animation'] ),
	'duration_seconds'  => absint( $attributes['durationSeconds'] ),
	'initial_delay'     => absint( $attributes['initialDelay'] ),
	'close_persistence' => sanitize_text_field( $attributes['closePersistence'] ),
	'block_id'          => ! empty( $attributes['blockId'] ) ? sanitize_html_class( $attributes['blockId'] ) : '',
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
