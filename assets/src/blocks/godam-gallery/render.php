<?php
/**
 * Render template for the GoDAM Gallery Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$attributes = wp_parse_args(
	$attributes,
	array(
		'columns' => 3,
		'count'   => -1,
		'orderby' => 'date',
		'order'   => 'DESC',
		'layout'  => 'grid',
	)
);

// Build the shortcode attributes.
$shortcode_atts = array(
	'columns' => intval( $attributes['columns'] ),
	'count'   => intval( $attributes['count'] ),
	'orderby' => sanitize_text_field( $attributes['orderby'] ),
	'order'   => sanitize_text_field( $attributes['order'] ),
	'layout'  => sanitize_text_field( $attributes['layout'] ),
);

// Convert attributes to shortcode string.
$shortcode_atts_string = '';
foreach ( $shortcode_atts as $key => $value ) {
	$shortcode_atts_string .= sprintf( ' %s="%s"', $key, esc_attr( $value ) );
}

// Output the shortcode.
echo do_shortcode( '[godam_video_gallery' . $shortcode_atts_string . ']' );
