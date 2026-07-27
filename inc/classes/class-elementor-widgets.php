<?php
/**
 * To load all classes that register elementor widget.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use RTGODAM\Inc\Elementor_Controls\Godam_Media;
use RTGODAM\Inc\Elementor_Widgets\Godam_Audio;
use RTGODAM\Inc\Elementor_Widgets\Godam_Gallery;
use RTGODAM\Inc\Elementor_Widgets\Godam_Image;
use RTGODAM\Inc\Elementor_Widgets\GoDAM_Video;
use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Elementor Widgets.
 */
class Elementor_Widgets {
	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * To setup action/filter.
	 *
	 * @return void
	 */
	public function setup_hooks() {
		/**
		 * Actions.
		 */
		add_action( 'elementor/widgets/register', array( $this, 'widgets_registered' ) );
		add_action( 'elementor/elements/categories_registered', array( $this, 'add_elementor_widget_categories' ) );
		add_action( 'elementor/controls/controls_registered', array( $this, 'widgets_controls' ) );
		add_action( 'elementor/editor/before_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'register_scripts' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'preload_image_layers_in_editor' ) );
	}

	/**
	 * Preload the GoDAM Image layers front-end assets in the Elementor editor.
	 *
	 * The editor preview renders inside an iframe and re-renders a widget on edit
	 * via AJAX, which doesn't inject newly enqueued scripts into the running
	 * preview. So a just-added GoDAM Image's hotspot/product layers wouldn't draw
	 * (and even a saved one only draws if the script happened to be present).
	 * Loading the layers script + hotspot styles up front in the preview lets the
	 * editor-scoped re-init in godam-image-layers/frontend.js draw the layers in
	 * the canvas. Editor-only; the published front end is unaffected (render.php
	 * enqueues these lazily there).
	 *
	 * @return void
	 */
	public function preload_image_layers_in_editor() {
		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return;
		}

		$plugin = \Elementor\Plugin::$instance;
		if ( ! isset( $plugin->preview ) || ! $plugin->preview->is_preview_mode() ) {
			return;
		}

		if ( ! wp_script_is( 'godam-image-layers-frontend', 'registered' ) ) {
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

		wp_enqueue_script( 'godam-image-layers-frontend' );
		wp_enqueue_style( 'godam-image-style' );
		wp_enqueue_style( 'godam-player-style' );
	}

	/**
	 * Scripts for elementor frontend rendering.
	 * 
	 * @return void
	 */
	public function enqueue_scripts() {
		/**
		 * The below script is only required in elementor editor experience.
		 */
		wp_enqueue_script( 'godam-elementor-frontend' );

		// Editor-only stylesheet for control-panel polish (e.g. SELECT2 width).
		// Registered inline here because register_scripts() is hooked to
		// wp_enqueue_scripts (frontend) and the editor hook runs in admin,
		// where that registration never fires.
		// Source: assets/src/css/godam-elementor-editor.scss.
		wp_register_style(
			'godam-elementor-editor-style',
			RTGODAM_URL . 'assets/build/css/godam-elementor-editor.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/godam-elementor-editor.css' )
		);
		wp_enqueue_style( 'godam-elementor-editor-style' );

		// Use the same brand SVGs as the Gutenberg blocks / WPBakery elements for
		// the widget panel icons. Elementor renders the icon as <i class="…">, so
		// each class is backed by the SVG via background-image (absolute URLs, so
		// no build-time url() resolution is needed).
		$godam_icon_css = sprintf(
			'.godam-eicon-video,.godam-eicon-gallery,.godam-eicon-audio,.godam-eicon-image{display:inline-block;width:1em;height:1em;vertical-align:middle;background-size:contain;background-repeat:no-repeat;background-position:center;}' .
			'.godam-eicon-video{background-image:url(%1$s);}' .
			'.godam-eicon-gallery{background-image:url(%2$s);}' .
			'.godam-eicon-audio{background-image:url(%3$s);}' .
			'.godam-eicon-image{background-image:url(%4$s);}',
			esc_url( RTGODAM_URL . 'assets/images/godam-video-filled.svg' ),
			esc_url( RTGODAM_URL . 'assets/images/godam-gallery-filled.svg' ),
			esc_url( RTGODAM_URL . 'assets/images/godam-audio-filled.svg' ),
			// The image icon only ships under assets/src/images (same path the
			// WPBakery element uses); there is no assets/images/ copy.
			esc_url( RTGODAM_URL . 'assets/src/images/godam-image-filled.svg' )
		);
		wp_add_inline_style( 'godam-elementor-editor-style', $godam_icon_css );
	}

	/**
	 * Registers required scripts and styles.
	 *
	 * @return void
	 */
	public function register_scripts() {

		/**
		 * Styles.
		 */
		wp_register_style(
			'elementor-godam-audio-style',
			RTGODAM_URL . 'assets/build/css/godam-audio.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/godam-audio.css' )
		);
		

		wp_register_script(
			'godam-elementor-frontend',
			RTGODAM_URL . 'assets/build/js/godam-elementor-frontend.min.js',
			array(
				'jquery',
				'wp-i18n',
				'godam-player-frontend-script',
			),
			filemtime( RTGODAM_PATH . 'assets/build/js/godam-elementor-frontend.min.js' ),
			true
		);
	}

	/**
	 * Get the available menus.
	 *
	 * @access private
	 * @return array
	 */
	public function get_available_menus() {
		$menus = wp_get_nav_menus();

		$options = array(
			'none' => 'None',
		);

		foreach ( $menus as $menu ) {
			$options[ $menu->slug ] = $menu->name;
		}

		return $options;
	}

	/**
	 * Register Controls.
	 */
	public function widgets_controls() {
		\Elementor\Plugin::$instance->controls_manager->register( new Godam_Media(), 'godam-media' );
	}

	/**
	 * Register Widgets.
	 */
	public function widgets_registered() {
		\Elementor\Plugin::$instance->widgets_manager->register( new GoDAM_Video() );
		\Elementor\Plugin::$instance->widgets_manager->register( new Godam_Gallery() );
		\Elementor\Plugin::$instance->widgets_manager->register( new Godam_Audio() );
		\Elementor\Plugin::$instance->widgets_manager->register( new Godam_Image() );
	}

	/**
	 * Add custom category.
	 *
	 * @param object $elements_manager Elements Manager Object.
	 */
	public function add_elementor_widget_categories( $elements_manager ) {

		$elements_manager->add_category(
			'godam',
			array(
				'title' => __( 'GoDAM', 'godam' ),
				'icon'  => 'fa fa-plug',
			)
		);
	}
}
