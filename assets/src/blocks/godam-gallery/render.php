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
		// phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_exclude
		'exclude'         => '',
		'include'         => '',
		'search'          => '',
		'showTitle'       => true,
	)
);

// Build the shortcode attributes.
$shortcode_atts = array(
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
	// phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_exclude
	'exclude'           => sanitize_text_field( $attributes['exclude'] ),
	'include'           => sanitize_text_field( $attributes['include'] ),
	'search'            => sanitize_text_field( $attributes['search'] ),
	'show_title'        => ! empty( $attributes['showTitle'] ),
);

// Convert attributes to shortcode string.
$shortcode_atts_string = '';
foreach ( $shortcode_atts as $key => $value ) {
	$shortcode_atts_string .= sprintf( ' %s="%s"', $key, esc_attr( $value ) );
}

// Output the shortcode.
echo do_shortcode( '[godam_video_gallery' . $shortcode_atts_string . ']' );
