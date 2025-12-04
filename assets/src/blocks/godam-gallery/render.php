<?php
/**
 * Render template for the GoDAM Gallery Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- WordPress core variable.
$attributes = wp_parse_args(
	$attributes,
	array(
		'columns'         => 3,
		'count'           => -1,
		'orderby'         => 'date',
		'order'           => 'DESC',
		'layout'          => 'grid',
		'infiniteScroll'  => false,
		'category'        => '',
		'tag'             => '',
		'author'          => 0,
		'dateRange'       => '',
		'customDateStart' => '',
		'customDateEnd'   => '',
		'include'         => '',
		'search'          => '',
		'showTitle'       => true,
		'align'           => '',
		'engagements'     => true,
	)
);

// Build the shortcode attributes.
$godam_shortcode_atts = array(
	'columns'           => intval( $attributes['columns'] ),
	'count'             => intval( $attributes['count'] ),
	'orderby'           => sanitize_text_field( $attributes['orderby'] ),
	'order'             => sanitize_text_field( $attributes['order'] ),
	'layout'            => sanitize_text_field( $attributes['layout'] ),
	'infinite_scroll'   => ! empty( $attributes['infiniteScroll'] ),
	'category'          => sanitize_text_field( $attributes['category'] ),
	'tag'               => sanitize_text_field( $attributes['tag'] ),
	'author'            => intval( $attributes['author'] ),
	'date_range'        => sanitize_text_field( $attributes['dateRange'] ),
	'custom_date_start' => sanitize_text_field( $attributes['customDateStart'] ),
	'custom_date_end'   => sanitize_text_field( $attributes['customDateEnd'] ),
	'include'           => sanitize_text_field( $attributes['include'] ),
	'search'            => sanitize_text_field( $attributes['search'] ),
	'show_title'        => ! empty( $attributes['showTitle'] ),
	'align'             => sanitize_text_field( $attributes['align'] ),
	'engagements'       => ! empty( $attributes['engagements'] ),
);

// Convert attributes to shortcode string.
$godam_shortcode_atts_string = '';
foreach ( $godam_shortcode_atts as $godam_key => $godam_value ) {
	$godam_shortcode_atts_string .= sprintf( ' %s="%s"', $godam_key, esc_attr( $godam_value ) );
}

// Output the shortcode.
echo do_shortcode( '[godam_video_gallery' . $godam_shortcode_atts_string . ']' );
