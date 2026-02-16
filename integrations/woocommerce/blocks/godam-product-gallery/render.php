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
	'view'                    => '9-16',
	'products'                => array(),
	'categories'              => array(),
	'selectedVideos'          => array(),
	'orderBy'                 => 'date_desc',
	'align'                   => '',
		'autoplay'                => '',
		'playButtonEnabled'       => false,
		'playButtonBgColor'       => 'rgba(0, 0, 0, 0.76)',
		'playButtonIconColor'     => 'rgba(255, 255, 255, 1)',
		'playButtonSize'          => 50,
		'playButtonBorderRadius'  => 50,
		'unmuteButtonEnabled'     => false,
		'unmuteButtonBgColor'     => 'rgba(0,0,0,0.4)',
		'unmuteButtonIconColor'   => 'rgba(255, 255, 255, 1)',
		'cardWidth'               => array(
			'desktop' => 16.5,
			'tablet'  => 35.5,
			'mobile'  => 59.5,
		),
		'arrowBgColor'            => 'rgba(250, 146, 0, 1)',
		'arrowIconColor'          => 'rgba(255, 255, 255, 1)',
		'arrowSize'               => 35,
		'arrowBorderRadius'       => 30,
		'arrowVisibility'         => 'always',
		'gridColumns'             => array(
			'desktop' => 4,
			'tablet'  => 3,
			'mobile'  => 2,
		),
		'gridRowGap'              => 1,
		'gridColumnGap'           => 1,
		'ctaEnabled'              => false,
		'ctaDisplayPosition'      => 'below-inside',
		'ctaBgColor'              => 'rgba(255, 255, 255, 1)',
		'ctaProductNameFontSize'  => 0.9,
		'ctaProductPriceFontSize' => 0.8,
		'ctaProductNameColor'     => 'rgba(0, 0, 0, 1)',
		'ctaProductPriceColor'    => array(
			'primary'   => 'rgba(66, 66, 66, 1)',
			'secondary' => 'rgba(230, 134, 0, 1)',
			'tertiary'  => 'rgba(143, 143, 143, 1)',
		),
		'ctaCart'                 => array(
			'bgColor'      => 'rgba(28, 28, 28, 1)',
			'iconColor'    => 'rgba(255, 255, 255, 1)',
			'border'       => array(
				'color' => 'rgba(224, 224, 224, 1)',
				'style' => 'solid',
				'width' => '1px',
			),
			'borderRadius' => 8,
			'action'       => 'mini-cart',
		),
		'ctaDropdown'             => array(
			'bgColor'      => 'rgba(255, 255, 255, 1)',
			'iconColor'    => 'rgba(28, 28, 28, 1)',
			'border'       => array(
				'color' => 'rgba(224, 224, 224, 1)',
				'style' => 'solid',
				'width' => '1px',
			),
			'borderRadius' => 8,
		),
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

$godam_product_gallery_cta_cart     = $attributes['ctaCart'] ?? array();
$godam_product_gallery_cta_dropdown = $attributes['ctaDropdown'] ?? array();

$godam_product_gallery_cta_cart_border     = $godam_product_gallery_cta_cart['border'] ?? array();
$godam_product_gallery_cta_dropdown_border = $godam_product_gallery_cta_dropdown['border'] ?? array();

// Build the shortcode attributes.
$godam_product_gallery_shortcode_atts = array(
	'block_id'                          => sanitize_html_class( $attributes['blockId'] ),
	'layout'                            => sanitize_text_field( $attributes['layout'] ),
	'view'                              => sanitize_text_field( $attributes['view'] ),
	'products'                          => is_array( $attributes['products'] ) ? implode( ',', array_map( 'absint', $attributes['products'] ) ) : '',
	'categories'                        => is_array( $attributes['categories'] ) ? implode( ',', array_map( 'absint', $attributes['categories'] ) ) : '',
	'selected_videos'                   => is_array( $attributes['selectedVideos'] ) ? implode( ',', array_map( 'absint', $attributes['selectedVideos'] ) ) : '',
	'order_by'                          => sanitize_text_field( $attributes['orderBy'] ),
	'align'                             => sanitize_text_field( $attributes['align'] ),
	'autoplay'                          => wp_validate_boolean( $attributes['autoplay'] ),
	'play_button_enabled'               => wp_validate_boolean( $attributes['playButtonEnabled'] ),
	'play_button_bg_color'              => godam_sanitize_rgba_color( $attributes['playButtonBgColor'] ),
	'play_button_icon_color'            => godam_sanitize_rgba_color( $attributes['playButtonIconColor'] ),
	'play_button_size'                  => intval( $attributes['playButtonSize'] ),
	'play_button_radius'                => intval( $attributes['playButtonBorderRadius'] ),
	'unmute_button_enabled'             => wp_validate_boolean( $attributes['unmuteButtonEnabled'] ),
	'unmute_button_bg_color'            => godam_sanitize_rgba_color( $attributes['unmuteButtonBgColor'] ),
	'unmute_button_icon_color'          => godam_sanitize_rgba_color( $attributes['unmuteButtonIconColor'] ),
	'desktop_card_width'                => floatval( $attributes['cardWidth']['desktop'] ?? 16.5 ),
	'tablet_card_width'                 => floatval( $attributes['cardWidth']['tablet'] ?? 35.5 ),
	'mobile_card_width'                 => floatval( $attributes['cardWidth']['mobile'] ?? 59.5 ),
	'arrow_bg_color'                    => godam_sanitize_rgba_color( $attributes['arrowBgColor'] ),
	'arrow_icon_color'                  => godam_sanitize_rgba_color( $attributes['arrowIconColor'] ),
	'arrow_size'                        => intval( $attributes['arrowSize'] ),
	'arrow_border_radius'               => intval( $attributes['arrowBorderRadius'] ),
	'arrow_visibility'                  => sanitize_text_field( $attributes['arrowVisibility'] ),
	'grid_columns_desktop'              => max( 1, intval( $attributes['gridColumns']['desktop'] ?? 4 ) ),
	'grid_columns_tablet'               => max( 1, intval( $attributes['gridColumns']['tablet'] ?? 3 ) ),
	'grid_columns_mobile'               => max( 1, intval( $attributes['gridColumns']['mobile'] ?? 2 ) ),
	'grid_row_gap'                      => floatval( $attributes['gridRowGap'] ),
	'grid_column_gap'                   => floatval( $attributes['gridColumnGap'] ),
	'cta_enabled'                       => wp_validate_boolean( $attributes['ctaEnabled'] ),
	'cta_display_position'              => sanitize_text_field( $attributes['ctaDisplayPosition'] ),
	'cta_bg_color'                      => godam_sanitize_rgba_color( $attributes['ctaBgColor'] ),
	'cta_product_name_font_size'        => floatval( $attributes['ctaProductNameFontSize'] ),
	'cta_product_price_font_size'       => floatval( $attributes['ctaProductPriceFontSize'] ),
	'cta_product_name_color'            => godam_sanitize_rgba_color( $attributes['ctaProductNameColor'] ),
	'cta_product_price_color_primary'   => godam_sanitize_rgba_color( $attributes['ctaProductPriceColor']['primary'] ?? 'rgba(66, 66, 66, 1)' ),
	'cta_product_price_color_secondary' => godam_sanitize_rgba_color( $attributes['ctaProductPriceColor']['secondary'] ?? 'rgba(230, 134, 0, 1)' ),
	'cta_product_price_color_tertiary'  => godam_sanitize_rgba_color( $attributes['ctaProductPriceColor']['tertiary'] ?? 'rgba(143, 143, 143, 1)' ),
	// Cart.
	'cta_cart_bg_color'                 => godam_sanitize_rgba_color( $godam_product_gallery_cta_cart['bgColor'] ?? '' ),
	'cta_cart_icon_color'               => godam_sanitize_rgba_color( $godam_product_gallery_cta_cart['iconColor'] ?? '' ),
	'cta_cart_border_color'             => godam_sanitize_rgba_color( $godam_product_gallery_cta_cart_border['color'] ?? '' ),
	'cta_cart_border_style'             => sanitize_text_field( $godam_product_gallery_cta_cart_border['style'] ?? '' ),
	'cta_cart_border_width'             => sanitize_text_field( $godam_product_gallery_cta_cart_border['width'] ?? '' ),
	'cta_cart_border_radius'            => intval( $godam_product_gallery_cta_cart['borderRadius'] ?? 0 ),
	'cta_cart_action'                   => sanitize_text_field( $godam_product_gallery_cta_cart['action'] ?? 'mini-cart' ),
	// Dropdown.
	'cta_dropdown_bg_color'             => godam_sanitize_rgba_color( $godam_product_gallery_cta_dropdown['bgColor'] ?? '' ),
	'cta_dropdown_icon_color'           => godam_sanitize_rgba_color( $godam_product_gallery_cta_dropdown['iconColor'] ?? '' ),
	'cta_dropdown_border_color'         => godam_sanitize_rgba_color( $godam_product_gallery_cta_dropdown_border['color'] ?? '' ),
	'cta_dropdown_border_style'         => sanitize_text_field( $godam_product_gallery_cta_dropdown_border['style'] ?? '' ),
	'cta_dropdown_border_width'         => sanitize_text_field( $godam_product_gallery_cta_dropdown_border['width'] ?? '' ),
	'cta_dropdown_border_radius'        => intval( $godam_product_gallery_cta_dropdown['borderRadius'] ?? 0 ),
);

// Convert attributes to shortcode string.
$godam_product_gallery_shortcode_atts_string = '';
foreach ( $godam_product_gallery_shortcode_atts as $godam_key => $godam_value ) {
	$godam_product_gallery_shortcode_atts_string .= sprintf( ' %s="%s"', $godam_key, esc_attr( $godam_value ) );
}

// Output the shortcode.
echo do_shortcode( '[godam_product_gallery' . $godam_product_gallery_shortcode_atts_string . ']' );
