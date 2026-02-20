<?php
/**
 * WooCommerce Integration Bootstrap.
 *
 * @package GoDAM
 * @since 1.5.0
 */

namespace RTGODAM\Integrations\WooCommerce;

use RTGODAM\Inc\WooCommerce\WC_Utility;

defined( 'ABSPATH' ) || exit;

/**
 * Bootstraps the WooCommerce integration.
 *
 * Kept as a single class file to satisfy PHPCS rules around class/file naming
 * and to avoid mixing standalone function declarations with OO structures.
 *
 * @since 1.5.0
 */
class Bootstrap {

	/**
	 * Instance of this class.
	 *
	 * @var Bootstrap|null
	 */
	private static $instance = null;

	/**
	 * Holds the utility instance.
	 *
	 * @var WC_Utility
	 */
	private $utility_instance;

	/**
	 * Get instance of this class.
	 *
	 * @return Bootstrap
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
		// Only load if WooCommerce is active.
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		$this->define_constants();
		$this->load_helpers();
		$this->register_autoloader();
		$this->load_dependencies();
		$this->init_hooks();
	}

	/**
	 * Define module constants.
	 */
	private function define_constants() {
		if ( ! defined( 'RTGODAM_WC_MODULE_PATH' ) ) {
			define( 'RTGODAM_WC_MODULE_PATH', plugin_dir_path( __FILE__ ) );
		}

		if ( ! defined( 'RTGODAM_WC_MODULE_URL' ) ) {
			define( 'RTGODAM_WC_MODULE_URL', plugin_dir_url( __FILE__ ) );
		}

		if ( ! defined( 'RTGODAM_WC_MODULE_ASSETS_BUILD_PATH' ) ) {
			define( 'RTGODAM_WC_MODULE_ASSETS_BUILD_PATH', RTGODAM_PATH . 'assets/build/integrations/woocommerce/' );
		}
	}

	/**
	 * Load helper functions.
	 */
	private function load_helpers() {
		require_once RTGODAM_WC_MODULE_PATH . 'helpers/functions.php';
	}

	/**
	 * Register WooCommerce integration class autoloader.
	 */
	private function register_autoloader() {
		spl_autoload_register( array( $this, 'autoload_woocommerce_classes' ) );
	}

	/**
	 * Autoload WooCommerce integration classes.
	 *
	 * @param string $class_name The class name.
	 */
	private function autoload_woocommerce_classes( $class_name ) {
		// Only autoload classes from the WooCommerce namespace.
		if ( strpos( $class_name, 'RTGODAM\\Inc\\WooCommerce\\' ) !== 0 ) {
			return;
		}

		// Convert class name to file name.
		$class_name = str_replace( 'RTGODAM\\Inc\\WooCommerce\\', '', $class_name );
		$class_name = str_replace( '_', '-', strtolower( $class_name ) );
		$file_path  = RTGODAM_WC_MODULE_PATH . 'classes/class-' . $class_name . '.php';

		if ( file_exists( $file_path ) ) {
			require_once $file_path;
		}
	}

	/**
	 * Load module dependencies.
	 */
	private function load_dependencies() {
		// Ensure REST API Base class is loaded (from main plugin).
		if ( ! class_exists( 'RTGODAM\\Inc\\REST_API\\Base' ) ) {
			require_once RTGODAM_PATH . 'inc/classes/rest-api/class-base.php';
		}

		// Load Product Gallery REST API class.
		if ( ! class_exists( 'RTGODAM\\Inc\\REST_API\\Product_Gallery_Rest' ) ) {
			require_once RTGODAM_WC_MODULE_PATH . 'classes/class-product-gallery-rest.php';
		}

		// Load GoDAM Product Gallery shortcode (WooCommerce-dependent).
		if ( ! class_exists( 'RTGODAM\\Inc\\Shortcodes\\GoDAM_Product_Gallery' ) ) {
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

		// Initialize the Utility Helper class.
		$this->utility_instance = WC_Utility::get_instance();
	}

	/**
	 * Initialize hooks.
	 */
	private function init_hooks() {
		add_action( 'init', array( $this, 'init_woocommerce_integration' ), 20 );

		// Enqueue global Woo variables.
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_global_woo_css_variables' ), 20 );

		// Enqueue global Woo Script.
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_global_woo_script' ), 25 );

		// Register WooCommerce layer via PHP filters.
		add_filter( 'godam_video_editor_layer_options', array( $this, 'register_woocommerce_layer_option' ), 10 );
		add_filter( 'godam_video_editor_layer_components', array( $this, 'register_woocommerce_layer_component' ), 10 );

		// Register ajax hooks for sidebar.
		add_action( 'wp_ajax_godam_get_single_sidebar_product_html', array( $this->utility_instance, 'godam_get_single_sidebar_product_html_callback' ) );
		add_action( 'wp_ajax_nopriv_godam_get_single_sidebar_product_html', array( $this->utility_instance, 'godam_get_single_sidebar_product_html_callback' ) );
		add_action( 'wp_ajax_godam_get_multiple_sidebar_product_html', array( $this->utility_instance, 'godam_get_multiple_sidebar_product_html_callback' ) );
		add_action( 'wp_ajax_nopriv_godam_get_multiple_sidebar_product_html', array( $this->utility_instance, 'godam_get_multiple_sidebar_product_html_callback' ) );
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
		\RTGODAM\Inc\REST_API\Product_Gallery_Rest::get_instance();

		// Initialize WooCommerce-dependent shortcode.
		\RTGODAM\Inc\Shortcodes\GoDAM_Product_Gallery::get_instance();

		// Initialize WooCommerce classes.
		\RTGODAM\Inc\WooCommerce\WC_Product_Video_Gallery::get_instance();
		\RTGODAM\Inc\WooCommerce\WC_Featured_Video_Gallery::get_instance();
		\RTGODAM\Inc\WooCommerce\WC_Woocommerce_Layer::get_instance();
	}

	/**
	 * Register WooCommerce layer option via PHP filter.
	 *
	 * @param array $layers Existing layer options.
	 * @return array Modified layer options.
	 */
	public function register_woocommerce_layer_option( $layers ) {
		$layers[] = array(
			'id'             => 15,
			'title'          => __( 'WooCommerce', 'godam' ),
			'description'    => __( 'Display products using hotspots', 'godam' ),
			'image'          => RTGODAM_WC_MODULE_URL . 'pages/components/images/Hotspot.png',
			'formIcon'       => RTGODAM_WC_MODULE_URL . 'pages/components/images/woo.svg',
			'type'           => 'woo',
			'requiresWoo'    => true,
			'isRequired'     => true,
			'isActive'       => $this->is_woocommerce_plugin_active(),
			'requireMessage' => sprintf(
				'<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/woocommerce/">%s</a> %s',
				__( 'WooCommerce', 'godam' ),
				__( 'plugin is required to use WooCommerce layer', 'godam' )
			),
		);
		return $layers;
	}

	/**
	 * Register WooCommerce layer component via PHP filter.
	 *
	 * @param array $components Existing layer components.
	 * @return array Modified layer components.
	 */
	public function register_woocommerce_layer_component( $components ) {
		$components['woo'] = 'WoocommerceLayer';
		return $components;
	}

	/**
	 * Check whether the WooCommerce plugin is active.
	 *
	 * @return bool
	 */
	private function is_woocommerce_plugin_active() {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		return function_exists( 'is_plugin_active' )
			? is_plugin_active( 'woocommerce/woocommerce.php' )
			: class_exists( 'WooCommerce' );
	}

	/**
	 * Enqueue global WooCommerce CSS variables.
	 *
	 * Makes Woo-related CSS variables available on all pages
	 * when WooCommerce is active.
	 *
	 * @return void
	 */
	public function enqueue_global_woo_css_variables() {

		$css = $this->utility_instance->get_woocommerce_video_modal_css_variables();

		if ( empty( $css ) ) {
			return;
		}

		// Register dummy handle if needed.
		wp_register_style( 'rtgodam-woo-video-modal-global', false, array(), RTGODAM_VERSION, 'all' );
		wp_enqueue_style( 'rtgodam-woo-video-modal-global' );

		wp_add_inline_style( 'rtgodam-woo-video-modal-global', $css );
	}

	/**
	 * Enqueue global WooCommerce JS (Escape Manager + shared logic).
	 *
	 * Loads only on product pages.
	 *
	 * @return void
	 */
	public function enqueue_global_woo_script() {

		wp_enqueue_script(
			'rtgodam-wc-woo-global-script',
			RTGODAM_URL . 'assets/build/integrations/woocommerce/js/wc-woo-global-script.min.js',
			array(),
			rtgodam_wc_get_asset_version( RTGODAM_PATH . 'assets/build/integrations/woocommerce/wc-woo-global-script.min.js' ),
			true 
		);

		wp_localize_script(
			'rtgodam-wc-woo-global-script',
			'godamWooVars',
			array(
				'namespaceRoot'                => '/godam/v1',
				'videoShortcodeEP'             => '/video-shortcode',
				'productByIdsEP'               => '/wcproducts-by-ids',
				'addToCartAjax'                => 'wc/store/cart',
				'ajaxUrl'                      => admin_url( 'admin-ajax.php' ),
				'getSingleProductHtmlAction'   => 'godam_get_single_sidebar_product_html',
				'getSingleProductHtmlNonce'    => wp_create_nonce( 'godam_get_single_sidebar_product_html' ),
				'getMultipleProductHtmlAction' => 'godam_get_multiple_sidebar_product_html',
				'getMultipleProductHtmlNonce'  => wp_create_nonce( 'godam_get_multiple_sidebar_product_html' ),
				'api_nonce'                    => wp_create_nonce( 'wc_store_api' ),
			)
		);

		// Register WooCommerce Reels specific skin.
		wp_register_style(
			'godam-player-reels-skin-css',
			RTGODAM_URL . 'assets/build/integrations/woocommerce/css/godam-reels-skin.css',
			array(),
			rtgodam_wc_get_asset_version( RTGODAM_PATH . 'assets/build/integrations/woocommerce/css/godam-reels-skin.css' )
		);
	}
}

Bootstrap::get_instance();
