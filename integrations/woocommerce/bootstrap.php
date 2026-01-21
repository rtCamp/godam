<?php
/**
 * WooCommerce Integration Bootstrap
 *
 * This file bootstraps the WooCommerce integration module.
 * Only loads if WooCommerce is active.
 *
 * @package GoDAM
 * @since 1.5.0
 */

namespace RTGODAM\Integrations\WooCommerce;

defined( 'ABSPATH' ) || exit;

// Check if WooCommerce is active.
if ( ! class_exists( 'WooCommerce' ) ) {
	return;
}

// Define module constants.
if ( ! defined( 'RTGODAM_WC_MODULE_PATH' ) ) {
	define( 'RTGODAM_WC_MODULE_PATH', plugin_dir_path( __FILE__ ) );
}

if ( ! defined( 'RTGODAM_WC_MODULE_URL' ) ) {
	define( 'RTGODAM_WC_MODULE_URL', plugin_dir_url( __FILE__ ) );
}

if ( ! defined( 'RTGODAM_WC_MODULE_ASSETS_BUILD_PATH' ) ) {
	define( 'RTGODAM_WC_MODULE_ASSETS_BUILD_PATH', RTGODAM_PATH . 'assets/build/integrations/woocommerce/' );
}

/**
 * Autoload WooCommerce integration classes.
 *
 * @param string $class_name The class name.
 */
function autoload_woocommerce_classes( $class_name ) {
	// Only autoload classes from the WooCommerce namespace.
	if ( strpos( $class_name, 'RTGODAM\Inc\WooCommerce\\' ) !== 0 ) {
		return;
	}

	// Convert class name to file name.
	$class_name = str_replace( 'RTGODAM\Inc\WooCommerce\\', '', $class_name );
	$class_name = str_replace( '_', '-', strtolower( $class_name ) );
	$file_path  = RTGODAM_WC_MODULE_PATH . 'classes/class-' . $class_name . '.php';

	if ( file_exists( $file_path ) ) {
		require_once $file_path;
	}
}

spl_autoload_register( __NAMESPACE__ . '\autoload_woocommerce_classes' );

/**
 * Initialize WooCommerce Integration Module
 *
 * @since 1.5.0
 */
class Module {

	/**
	 * Instance of this class.
	 *
	 * @var Module
	 */
	private static $instance = null;

	/**
	 * Get instance of this class.
	 *
	 * @return Module
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	private function __construct() {
		$this->load_dependencies();
		$this->init_hooks();
	}

	/**
	 * Load module dependencies.
	 */
	private function load_dependencies() {
		// Ensure REST API Base class is loaded (from main plugin).
		if ( ! class_exists( 'RTGODAM\Inc\REST_API\Base' ) ) {
			require_once RTGODAM_PATH . 'inc/classes/rest-api/class-base.php';
		}

		// Load GoDAM Product Gallery shortcode (WooCommerce-dependent).
		if ( ! class_exists( 'RTGODAM\Inc\Shortcodes\GoDAM_Product_Gallery' ) ) {
			require_once RTGODAM_WC_MODULE_PATH . 'classes/shortcodes/class-godam-product-gallery.php';
		}

		// Load REST API class.
		require_once RTGODAM_WC_MODULE_PATH . 'classes/class-wc.php';

		// Load WooCommerce integration classes.
		require_once RTGODAM_WC_MODULE_PATH . 'classes/class-wc-product-video-gallery.php';
		require_once RTGODAM_WC_MODULE_PATH . 'classes/class-wc-featured-video-gallery.php';
		require_once RTGODAM_WC_MODULE_PATH . 'classes/class-wc-woocommerce-layer.php';
		require_once RTGODAM_WC_MODULE_PATH . 'classes/class-wc-product-gallery-video-markup.php';
		require_once RTGODAM_WC_MODULE_PATH . 'classes/class-wc-utility.php';
	}

	/**
	 * Initialize hooks.
	 */
	private function init_hooks() {
		add_action( 'init', array( $this, 'init_woocommerce_integration' ), 20 );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_frontend_assets' ), 20 );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ), 20 );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_video_editor_assets' ), 5 ); // Priority 5 to load before video-editor at 10
	}

	/**
	 * Initialize WooCommerce integration classes.
	 */
	public function init_woocommerce_integration() {
		// Register WooCommerce product gallery block from built assets if available.
		$wc_block_path = RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'blocks/godam-product-gallery/';
		if ( file_exists( $wc_block_path . 'block.json' ) ) {
			register_block_type( $wc_block_path );
		}

		// Initialize REST API.
		\RTGODAM\Inc\REST_API\WC::get_instance();

		// Initialize WooCommerce-dependent shortcode.
		\RTGODAM\Inc\Shortcodes\GoDAM_Product_Gallery::get_instance();

		// Initialize WooCommerce classes.
		\RTGODAM\Inc\WooCommerce\WC_Product_Video_Gallery::get_instance();
		\RTGODAM\Inc\WooCommerce\WC_Featured_Video_Gallery::get_instance();
		\RTGODAM\Inc\WooCommerce\WC_Woocommerce_Layer::get_instance();
	}

	/**
	 * Enqueue frontend assets for WooCommerce integration.
	 */
	public function enqueue_frontend_assets() {
		// Only enqueue WooCommerce frontend integration assets on WooCommerce pages.
		// Loading these globally causes unnecessary weight and can trigger JS that expects WC context.
		if ( ! function_exists( 'is_woocommerce' ) ) {
			return;
		}

		if ( ! ( is_woocommerce() || is_cart() || is_checkout() || is_account_page() ) ) {
			return;
		}

		// Check if WooCommerce assets exist in the build folder.
		$wc_js_path  = RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'js/';
		$wc_css_path = RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'css/';

		if ( file_exists( $wc_js_path ) ) {
			// Enqueue WooCommerce specific JS.
			$js_files = glob( $wc_js_path . '*.min.js' );
			foreach ( $js_files as $js_file ) {
				$handle = 'godam-wc-' . basename( $js_file, '.min.js' );
				wp_enqueue_script(
					$handle,
					RTGODAM_URL . 'assets/build/integrations/woocommerce/js/' . basename( $js_file ),
					array( 'jquery' ),
					RTGODAM_VERSION,
					true
				);
			}
		}

		if ( file_exists( $wc_css_path ) ) {
			// Enqueue WooCommerce specific CSS.
			$css_files = glob( $wc_css_path . '*.css' );
			foreach ( $css_files as $css_file ) {
				$handle = 'godam-wc-' . basename( $css_file, '.css' );
				wp_enqueue_style(
					$handle,
					RTGODAM_URL . 'assets/build/integrations/woocommerce/css/' . basename( $css_file ),
					array(),
					RTGODAM_VERSION
				);
			}
		}
	}

	/**
	 * Enqueue admin assets for WooCommerce integration.
	 */
	public function enqueue_admin_assets() {
		$screen = get_current_screen();

		// Only load on product edit screen.
		if ( ! $screen || 'product' !== $screen->id ) {
			return;
		}

		// Enqueue admin assets if they exist.
		$admin_js_path = RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'js/admin/';
		if ( file_exists( $admin_js_path ) ) {
			$js_files = glob( $admin_js_path . '*.min.js' );
			foreach ( $js_files as $js_file ) {
				$handle = 'godam-wc-admin-' . basename( $js_file, '.min.js' );
				wp_enqueue_script(
					$handle,
					RTGODAM_URL . 'assets/build/integrations/woocommerce/js/admin/' . basename( $js_file ),
					array( 'jquery' ),
					RTGODAM_VERSION,
					true
				);
			}
		}
	}

	/**
	 * Enqueue WooCommerce layer registration for video editor.
	 *
	 * This script registers the WooCommerce layer component using WordPress hooks,
	 * allowing the integration to extend the video editor without direct dependency.
	 * This must load BEFORE the video-editor.min.js to properly register the layer type.
	 */
	public function enqueue_video_editor_assets() {
		// Only load on video editor page.
		if ( ! isset( $_GET['page'] ) || 'rtgodam_video_editor' !== $_GET['page'] ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}

		// Enqueue wc-layer-registration with proper dependencies and make video-editor depend on it.
		$layer_registration_path  = RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'js/wc-layer-registration.min.js';
		$layer_registration_asset = RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'js/wc-layer-registration.min.asset.php';

		if ( file_exists( $layer_registration_path ) ) {
			// Base dependencies for hooks system
			$dependencies = array( 'wp-hooks', 'wp-element', 'react' );
			$version      = RTGODAM_VERSION;

			// Load asset file if it exists for proper dependencies.
			if ( file_exists( $layer_registration_asset ) ) {
				$asset_data   = require $layer_registration_asset;
				$dependencies = $asset_data['dependencies'] ?? $dependencies;
				$version      = $asset_data['version'] ?? $version;
			}

			// Add dependencies to ensure this loads before video-editor
			$dependencies = array_merge( $dependencies, array( 'rtgodam-script', 'easydam-media-library' ) );

			// Register the script first
			wp_register_script(
				'godam-wc-layer-registration',
				RTGODAM_URL . 'assets/build/integrations/woocommerce/js/wc-layer-registration.min.js',
				$dependencies,
				$version,
				false // Load in footer but before video-editor
			);

			// Enqueue it
			wp_enqueue_script( 'godam-wc-layer-registration' );
		}
	}
}

// Initialize the module.
Module::get_instance();
