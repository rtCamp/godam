<?php
/**
 * Render template for the GoDAM Product Gallery Block.
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
		'blockId'                 => '',
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
		'cardWidth'               => array(
			'desktop' => 21.5,
			'tablet'  => 41.5,
			'mobile'  => 66.5,
		),
		'arrowBgColor'            => 'rgba(0,0,0,0.5)',
		'arrowIconColor'          => '#ffffff',
		'arrowSize'               => 32,
		'arrowBorderRadius'       => 4,
		'arrowVisibility'         => 'always',
		'gridColumns'             => array(
			'desktop' => 4,
			'tablet'  => 3,
			'mobile'  => 2,
		),
		'gridRowGap'              => 16,
		'gridColumnGap'           => 16,
		'ctaEnabled'              => false,
		'ctaDisplayPosition'      => 'below-inside',
		'ctaBgColor'              => '#ffffff',
		'ctaButtonBgColor'        => '#000000',
		'ctaButtonIconColor'      => '#ffffff',
		'ctaButtonBorderRadius'   => 30,
		'ctaProductNameFontSize'  => 16,
		'ctaProductPriceFontSize' => 14,
		'ctaProductNameColor'     => '#000000',
		'ctaProductPriceColor'    => '#333333',
		'ctaCartAction'           => 'mini-cart',
	)
);

if ( ! function_exists( 'godam_sanitize_rgba_color' ) ) {

	/**
	 * Sanitizes a color value to ensure it is a valid RGBA or HEX color string.
	 *
	 * This function accepts 8-digit hex (`#RRGGBBAA`), 6-digit hex (`#RRGGBB`),
	 * and `rgba(R, G, B, A)` formats. If the input is invalid or an array,
	 * it returns an empty string.
	 *
	 * @param string $color The color value to sanitize.
	 *
	 * @return string Sanitized color string if valid, otherwise an empty string.
	 */
	function godam_sanitize_rgba_color( $color ) {
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

		// rgba data.
		if ( preg_match( '/^rgba\((\d{1,3}), ?(\d{1,3}), ?(\d{1,3}), ?(0|1|0?\.\d+)\)$/', $color ) ) {
			return $color;
		}

		return '';
	}
}

// Build the shortcode attributes.
$godam_product_gallery_shortcode_atts = array(
	'block_id'                    => sanitize_html_class( $attributes['blockId'] ),
	'layout'                      => sanitize_text_field( $attributes['layout'] ),
	'view'                        => sanitize_text_field( $attributes['view'] ),
	'product'                     => sanitize_text_field( $attributes['product'] ),
	'align'                       => sanitize_text_field( $attributes['align'] ),
	'autoplay'                    => wp_validate_boolean( $attributes['autoplay'] ),
	'play_button_enabled'         => wp_validate_boolean( $attributes['playButtonEnabled'] ),
	'play_button_bg_color'        => godam_sanitize_rgba_color( $attributes['playButtonBgColor'] ),
	'play_button_icon_color'      => sanitize_hex_color( $attributes['playButtonIconColor'] ),
	'play_button_size'            => intval( $attributes['playButtonSize'] ),
	'play_button_radius'          => intval( $attributes['playButtonBorderRadius'] ),
	'unmute_button_enabled'       => wp_validate_boolean( $attributes['unmuteButtonEnabled'] ),
	'unmute_button_bg_color'      => godam_sanitize_rgba_color( $attributes['unmuteButtonBgColor'] ),
	'unmute_button_icon_color'    => sanitize_hex_color( $attributes['unmuteButtonIconColor'] ),
	'dektop_card_width'           => floatval( $attributes['cardWidth']['desktop'] ?? 21.5 ),
	'tablet_card_width'           => floatval( $attributes['cardWidth']['tablet'] ?? 41.5 ),
	'mobile_card_width'           => floatval( $attributes['cardWidth']['mobile'] ?? 66.5 ),
	'arrow_bg_color'              => godam_sanitize_rgba_color( $attributes['arrowBgColor'] ),
	'arrow_icon_color'            => sanitize_hex_color( $attributes['arrowIconColor'] ),
	'arrow_size'                  => intval( $attributes['arrowSize'] ),
	'arrow_border_radius'         => intval( $attributes['arrowBorderRadius'] ),
	'arrow_visibility'            => sanitize_text_field( $attributes['arrowVisibility'] ),
	'grid_columns_desktop'        => max( 1, intval( $attributes['gridColumns']['desktop'] ?? 4 ) ),
	'grid_columns_tablet'         => max( 1, intval( $attributes['gridColumns']['tablet'] ?? 3 ) ),
	'grid_columns_mobile'         => max( 1, intval( $attributes['gridColumns']['mobile'] ?? 2 ) ),
	'grid_row_gap'                => intval( $attributes['gridRowGap'] ),
	'grid_column_gap'             => intval( $attributes['gridColumnGap'] ),
	'cta_enabled'                 => wp_validate_boolean( $attributes['ctaEnabled'] ),
	'cta_display_position'        => sanitize_text_field( $attributes['ctaDisplayPosition'] ),
	'cta_bg_color'                => godam_sanitize_rgba_color( $attributes['ctaBgColor'] ),
	'cta_button_bg_color'         => godam_sanitize_rgba_color( $attributes['ctaButtonBgColor'] ),
	'cta_button_icon_color'       => sanitize_hex_color( $attributes['ctaButtonIconColor'] ),
	'cta_button_border_radius'    => intval( $attributes['ctaButtonBorderRadius'] ),
	'cta_product_name_font_size'  => intval( $attributes['ctaProductNameFontSize'] ),
	'cta_product_price_font_size' => intval( $attributes['ctaProductPriceFontSize'] ),
	'cta_product_name_color'      => sanitize_hex_color( $attributes['ctaProductNameColor'] ),
	'cta_product_price_color'     => sanitize_hex_color( $attributes['ctaProductPriceColor'] ),
	'cta_cart_action'             => sanitize_text_field( $attributes['ctaCartAction'] ),
);

// Convert attributes to shortcode string.
$godam_product_gallery_shortcode_atts_string = '';
foreach ( $godam_product_gallery_shortcode_atts as $godam_key => $godam_value ) {
	$godam_product_gallery_shortcode_atts_string .= sprintf( ' %s="%s"', $godam_key, esc_attr( $godam_value ) );
}

// Output the shortcode.
echo do_shortcode( '[godam_product_gallery' . $godam_product_gallery_shortcode_atts_string . ']' );
