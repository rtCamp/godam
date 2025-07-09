<?php
/**
 * Render template for the GoDAM Product Gallery Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$attributes = wp_parse_args(
	$attributes,
	array(
		'layout'                  => 'carousel',
		'view'                    => '4-3',
		'product'                 => '',
		'align'                   => '',
		'autoplay'                => '',
		'playButtonEnabled'       => false,
		'playButtonBgColor'       => '#000000',
		'playButtonIconColor'     => '#ffffff',
		'playButtonSize'          => 40,
		'playButtonBorderRadius'  => 50,
		'unmuteButtonEnabled'     => false,
		'unmuteButtonBgColor'     => 'rgba(0,0,0,0.4)',
		'unmuteButtonIconColor'   => '#ffffff',
		'arrowBgColor'            => 'rgba(0,0,0,0.5)',
		'arrowIconColor'          => '#ffffff',
		'arrowSize'               => 32,
		'arrowBorderRadius'       => 4,
		'arrowVisibility'         => 'always',
		'ctaEnabled'              => false,
		'ctaDisplayPosition'      => 'below',
		'ctaButtonBgColor'        => '#000000',
		'ctaButtonIconColor'      => '#ffffff',
		'ctaButtonBorderRadius'   => 30,
		'ctaProductNameFontSize'  => 16,
		'ctaProductPriceFontSize' => 14,
		'ctaProductNameColor'     => '#000000',
		'ctaProductPriceColor'    => '#333333',
	)
);

if ( ! function_exists( 'sanitize_rgba_color' ) ) {

	function sanitize_rgba_color( $color ) {
		if ( empty( $color ) || is_array( $color ) ) {
			return '';
		}

		$color = trim( $color );

		// 8-digit hex.
		if ( preg_match( '/^#([A-Fa-f0-9]{8})$/', $color ) ) {
			return $color;
		}

		// 6-digit hex.
		if ( preg_match( '/^#([A-Fa-f0-9]{6})$/', $color ) ) {
			return $color;
		}

		// rgba().
		if ( preg_match( '/^rgba\((\d{1,3}), ?(\d{1,3}), ?(\d{1,3}), ?(0|1|0?\.\d+)\)$/', $color ) ) {
			return $color;
		}

		return '';
	}
}

// Build the shortcode attributes.
$shortcode_atts = array(
	'layout'                      => sanitize_text_field( $attributes['layout'] ),
	'view'                        => sanitize_text_field( $attributes['view'] ),
	'product'                     => sanitize_text_field( $attributes['product'] ),
	'align'                       => sanitize_text_field( $attributes['align'] ),
	'autoplay'                    => filter_var( $attributes['autoplay'], FILTER_VALIDATE_BOOLEAN ),
	'play_button_enabled'         => filter_var( $attributes['playButtonEnabled'], FILTER_VALIDATE_BOOLEAN ),
	'play_button_bg_color'        => sanitize_rgba_color( $attributes['playButtonBgColor'] ),
	'play_button_icon_color'      => sanitize_hex_color( $attributes['playButtonIconColor'] ),
	'play_button_size'            => intval( $attributes['playButtonSize'] ),
	'play_button_radius'          => intval( $attributes['playButtonBorderRadius'] ),
	'unmute_button_enabled'       => filter_var( $attributes['unmuteButtonEnabled'], FILTER_VALIDATE_BOOLEAN ),
	'unmute_button_bg_color'      => sanitize_rgba_color( $attributes['unmuteButtonBgColor'] ),
	'unmute_button_icon_color'    => sanitize_hex_color( $attributes['unmuteButtonIconColor'] ),
	'arrow_bg_color'              => sanitize_rgba_color( $attributes['arrowBgColor'] ),
	'arrow_icon_color'            => sanitize_hex_color( $attributes['arrowIconColor'] ),
	'arrow_size'                  => intval( $attributes['arrowSize'] ),
	'arrow_border_radius'         => intval( $attributes['arrowBorderRadius'] ),
	'arrow_visibility'            => sanitize_text_field( $attributes['arrowVisibility'] ),
	'cta_enabled'                 => filter_var( $attributes['ctaEnabled'], FILTER_VALIDATE_BOOLEAN ),
	'cta_display_position'        => sanitize_text_field( $attributes['ctaDisplayPosition'] ),
	'cta_button_bg_color'         => sanitize_rgba_color( $attributes['ctaButtonBgColor'] ),
	'cta_button_icon_color'       => sanitize_hex_color( $attributes['ctaButtonIconColor'] ),
	'cta_button_border_radius'    => intval( $attributes['ctaButtonBorderRadius'] ),
	'cta_product_name_font_size'  => intval( $attributes['ctaProductNameFontSize'] ),
	'cta_product_price_font_size' => intval( $attributes['ctaProductPriceFontSize'] ),
	'cta_product_name_color'      => sanitize_hex_color( $attributes['ctaProductNameColor'] ),
	'cta_product_price_color'     => sanitize_hex_color( $attributes['ctaProductPriceColor'] ),
);

// Convert attributes to shortcode string.
$shortcode_atts_string = '';
foreach ( $shortcode_atts as $key => $value ) {
	$shortcode_atts_string .= sprintf( ' %s="%s"', $key, esc_attr( $value ) );
}

// Output the shortcode.
echo do_shortcode( '[godam_product_gallery' . $shortcode_atts_string . ']' );
