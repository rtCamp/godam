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
		add_action( 'wp_enqueue_scripts', array( $this, 'preload_wpbakery_editor_assets' ) );
	}

	/**
	 * Register the shared image-layers front-end script (idempotent).
	 *
	 * Single registrar reused by the shortcode/WPBakery path and the Elementor
	 * editor preload, so the handle, deps filter, and version live in one place.
	 * Mirrors the lazy registration in the block's render.php (kept separate there
	 * so the template stays self-contained in block context). Bails if the built
	 * script is missing so callers never enqueue a 404 with empty dependencies.
	 *
	 * @return void
	 */
	public static function register_image_layers_script() {
		if ( wp_script_is( 'godam-image-layers-frontend', 'registered' ) ) {
			return;
		}

		// The build directory is gitignored / created at build time; skip cleanly
		// if the compiled script isn't present rather than registering a broken URL.
		if ( ! file_exists( RTGODAM_PATH . 'assets/build/js/godam-image-layers-frontend.min.js' ) ) {
			return;
		}

		$asset_path = RTGODAM_PATH . 'assets/build/js/godam-image-layers-frontend.min.asset.php';
		$asset      = file_exists( $asset_path )
			// phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingVariable -- file path is a plugin constant + hardcoded build filename.
			? include $asset_path
			: array(
				'dependencies' => array(),
				'version'      => RTGODAM_VERSION,
			);

		$deps = apply_filters( 'godam_image_layers_frontend_dependencies', $asset['dependencies'] );

		wp_register_script(
			'godam-image-layers-frontend',
			RTGODAM_URL . 'assets/build/js/godam-image-layers-frontend.min.js',
			$deps,
			$asset['version'],
			true
		);
	}

	/**
	 * Preload the image-layers assets in the WPBakery inline editor.
	 *
	 * WPBakery adds/updates an element via AJAX and does NOT inject newly
	 * enqueued scripts into the running editor page. So when a GoDAM Image is
	 * added for the first time and saved, the layers script wouldn't be present
	 * yet — the hotspot / product layers only appeared after a full reload. Load
	 * the script (and hotspot styles) up front in the inline editor so the
	 * editor-scoped re-init in frontend.js can draw a just-added image's layers
	 * immediately, without a refresh. Editor-only; nothing changes on the front end.
	 *
	 * @return void
	 */
	public function preload_wpbakery_editor_assets() {
		if ( ! function_exists( 'vc_is_inline' ) || ! vc_is_inline() ) {
			return;
		}

		self::register_image_layers_script();
		if ( wp_script_is( 'godam-image-layers-frontend', 'registered' ) ) {
			wp_enqueue_script( 'godam-image-layers-frontend' );
		}
		wp_enqueue_style( 'godam-image-style' );
		wp_enqueue_style( 'godam-player-style' );
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
		// Normalize the attachment ID to an int (shortcode atts arrive as strings)
		// so it matches how core attachment APIs and the block attribute expect it.
		$attributes = array(
			'id'              => absint( $atts['id'] ),
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
