<?php
/**
 * GoDAM Image Shortcode Class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Shortcodes;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class GoDAM_Image.
 *
 * Handles the [godam_image] shortcode, which powers the WPBakery "GoDAM Image"
 * element by reusing the Image block's render template.
 */
class GoDAM_Image {
	use Singleton;

	/**
	 * Constructor.
	 */
	final protected function __construct() {
		add_shortcode( 'godam_image', array( $this, 'render' ) );
	}

	/**
	 * Render the GoDAM image shortcode.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output of the image (with hotspot/product layers).
	 */
	public function render( $atts ) {
		$atts = shortcode_atts(
			array(
				'id'                => '',
				'url'               => '',
				'alt'               => '',
				'show_image_layers' => true,
				'css'               => '',
			),
			$atts,
			'godam_image'
		);

		// A GoDAM Image needs either an attachment ID or a source URL.
		if ( empty( $atts['id'] ) && empty( $atts['url'] ) ) {
			return '';
		}

		// Map the flat shortcode atts to the block attribute shape render.php reads.
		$attributes = array(
			'id'              => $atts['id'],
			'url'             => $atts['url'],
			'alt'             => $atts['alt'],
			'showImageLayers' => filter_var( $atts['show_image_layers'], FILTER_VALIDATE_BOOLEAN ),
		);

		// Get WPBakery Design Options CSS class if available.
		$godam_css_class = '';
		if ( ! empty( $atts['css'] ) && function_exists( 'vc_shortcode_custom_css_class' ) ) {
			$godam_css_class = vc_shortcode_custom_css_class( $atts['css'], ' ' );
		}

		// The block's hotspot stylesheet is attached via wp_enqueue_block_style()
		// (see class-blocks.php), which only fires in block context. Enqueue the
		// image block style + the shared hotspot styles for the shortcode path.
		wp_enqueue_style( 'godam-image-style' );
		wp_enqueue_style( 'godam-player-style' );

		// Tells the shared render.php it runs outside block context.
		$godam_is_shortcode = true;

		ob_start();
		require RTGODAM_PATH . 'assets/build/blocks/godam-image/render.php';
		return ob_get_clean();
	}
}
