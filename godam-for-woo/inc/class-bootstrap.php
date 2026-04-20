<?php
/**
 * WooCommerce Integration Bootstrap for GoDAM for Woo.
 *
 * @package GoDAM_Woo
 * @since 1.0.0
 */

namespace GoDAM_Woo;

use GoDAM_Woo\Classes\WC_Utility;
use WP_Block_Editor_Context;
use WP_Block_Type_Registry;

defined( 'ABSPATH' ) || exit;

/**
 * Bootstraps the WooCommerce integration add-on.
 *
 * @since 1.0.0
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
		if ( ! defined( 'GODAM_WOO_MODULE_PATH' ) ) {
			define( 'GODAM_WOO_MODULE_PATH', GODAM_WOO_PATH );
		}

		if ( ! defined( 'GODAM_WOO_MODULE_URL' ) ) {
			define( 'GODAM_WOO_MODULE_URL', GODAM_WOO_URL );
		}

		if ( ! defined( 'GODAM_WOO_ASSETS_BUILD_PATH' ) ) {
			define( 'GODAM_WOO_ASSETS_BUILD_PATH', GODAM_WOO_PATH . 'assets/build/' );
		}
	}

	/**
	 * Load helper functions.
	 */
	private function load_helpers() {
		require_once GODAM_WOO_PATH . 'inc/helpers/functions.php';
	}

	/**
	 * Register WooCommerce integration class autoloader.
	 */
	private function register_autoloader() {
		spl_autoload_register( array( $this, 'autoload_classes' ) );
	}

	/**
	 * Autoload add-on classes.
	 *
	 * @param string $class_name The class name.
	 */
	private function autoload_classes( $class_name ) {
		$namespace = 'GoDAM_Woo\\Classes\\';

		if ( strpos( $class_name, $namespace ) !== 0 ) {
			return;
		}

		$class_name = str_replace( $namespace, '', $class_name );
		$class_name = str_replace( '_', '-', strtolower( $class_name ) );
		$file_path  = GODAM_WOO_PATH . 'inc/classes/class-' . $class_name . '.php';

		if ( file_exists( $file_path ) ) {
			require_once $file_path;
		}
	}

	/**
	 * Load module dependencies.
	 */
	private function load_dependencies() {
		// Ensure REST API Base class is loaded (from main GoDAM plugin).
		if ( ! class_exists( 'RTGODAM\\Inc\\REST_API\\Base' ) ) {
			require_once RTGODAM_PATH . 'inc/classes/rest-api/class-base.php';
		}

		// Load REST API classes.
		require_once GODAM_WOO_PATH . 'inc/classes/class-product-gallery-rest.php';
		require_once GODAM_WOO_PATH . 'inc/classes/class-wc-rest.php';

		// Load WooCommerce integration classes.
		require_once GODAM_WOO_PATH . 'inc/classes/class-wc-product-video-gallery.php';
		require_once GODAM_WOO_PATH . 'inc/classes/class-wc-featured-video-gallery.php';
		require_once GODAM_WOO_PATH . 'inc/classes/class-wc-utility.php';

		// Initialize the Utility Helper class.
		$this->utility_instance = WC_Utility::get_instance();
	}

	/**
	 * Initialize hooks.
	 */
	private function init_hooks() {
		add_action( 'init', array( $this, 'init_woocommerce_integration' ), 20 );
		add_filter( 'allowed_block_types_all', array( $this, 'filter_premium_blocks_for_inserter' ), 10, 2 );

		// Enqueue global Woo Script.
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_global_woo_script' ), 25 );

		// Register WooCommerce layer via PHP filters.
		add_filter( 'godam_video_editor_layer_options', array( $this, 'register_woocommerce_layer_option' ), 10 );
		add_filter( 'godam_video_editor_layer_components', array( $this, 'register_woocommerce_layer_component' ), 10 );

		// Provide WooCommerce status and cart URL to easydamMediaLibrary JS data.
		add_filter( 'godam_easydam_media_library_data', array( $this, 'add_woo_media_library_data' ) );

		// Add WooCommerce flag to frontend plugin dependencies.
		add_filter( 'godam_plugin_dependencies', array( $this, 'add_woo_plugin_dependency' ) );

		// Enqueue product gallery block editor settings.
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_product_gallery_block_settings' ) );

		// Register ajax hooks for sidebar.
		add_action( 'wp_ajax_godam_get_single_sidebar_product_html', array( $this->utility_instance, 'godam_get_single_sidebar_product_html_callback' ) );
		add_action( 'wp_ajax_nopriv_godam_get_single_sidebar_product_html', array( $this->utility_instance, 'godam_get_single_sidebar_product_html_callback' ) );

		// Register integration settings tab.
		add_filter( 'godam_integration_settings_tabs', array( $this, 'register_settings_tab' ) );

		// Enqueue video editor layer scripts.
		add_action( 'godam_enqueue_video_editor_scripts', array( $this, 'enqueue_video_editor_scripts' ) );

		// Enqueue settings page scripts.
		add_action( 'godam_enqueue_settings_page_scripts', array( $this, 'enqueue_settings_page_scripts' ) );

		// ── Frontend player hooks ──

		// Register WooCommerce player contexts for the player template.
		add_filter( 'godam_player_woocommerce_contexts', array( $this, 'register_woocommerce_contexts' ) );

		// Set WooCommerce skin for player in WooCommerce contexts.
		add_filter( 'godam_player_woocommerce_skin', array( $this, 'get_woocommerce_skin' ), 10, 2 );

		// Render mini-cart HTML inside the player.
		add_action( 'godam_player_render_mini_cart', array( $this, 'render_mini_cart' ), 10, 2 );

		// Render WooCommerce layer container in the player template.
		add_action( 'godam_player_render_layer', array( $this, 'render_woocommerce_layer' ), 10, 2 );

		// Add wc-blocks-data-store as a frontend player dependency.
		add_filter( 'godam_player_frontend_dependencies', array( $this, 'add_player_woo_dependencies' ) );

		// Provide WooCommerce settings data to the frontend.
		add_filter( 'godam_addon_settings_data', array( $this, 'provide_woo_settings_data' ) );

		// Enqueue WooCommerce layer frontend script and styles (early priority so it's available as a dependency).
		add_action( 'wp_enqueue_scripts', array( $this, 'register_woo_layer_frontend_assets' ), 5 );
		add_action( 'admin_enqueue_scripts', array( $this, 'register_woo_admin_assets' ), 5 );

		// Auto-enqueue WooCommerce player CSS when the player style is loaded.
		add_action( 'wp_footer', array( $this, 'maybe_enqueue_woo_player_style' ) );
	}

	/**
	 * Hide premium Woo blocks from inserter when API key is invalid.
	 *
	 * @param bool|array<string>      $allowed_block_types Allowed block types.
	 * @param WP_Block_Editor_Context $editor_context      Editor context.
	 *
	 * @return bool|array<string>
	 */
	public function filter_premium_blocks_for_inserter( $allowed_block_types, $editor_context ) {
		unset( $editor_context );

		if ( rtgodam_is_api_key_valid() ) {
			return $allowed_block_types;
		}

		$disallowed_blocks = array(
			'godam/video-product-gallery',
		);

		if ( ! is_array( $allowed_block_types ) || empty( $allowed_block_types ) ) {
			$registered_blocks   = WP_Block_Type_Registry::get_instance()->get_all_registered();
			$allowed_block_types = array_keys( $registered_blocks );
		}

		return array_values(
			array_filter(
				$allowed_block_types,
				function ( $block_name ) use ( $disallowed_blocks ) {
					return ! in_array( $block_name, $disallowed_blocks, true );
				}
			)
		);
	}

	/**
	 * Initialize WooCommerce integration classes.
	 */
	public function init_woocommerce_integration() {

		// Register GoDAM Video Product Gallery block.
		$video_product_gallery_path = GODAM_WOO_ASSETS_BUILD_PATH . 'blocks/godam-video-product-gallery/';
		if ( file_exists( $video_product_gallery_path . 'block.json' ) ) {
			register_block_type( $video_product_gallery_path );
		}

		// Register GoDAM Video Product Gallery Item block.
		$video_product_gallery_item_path = GODAM_WOO_ASSETS_BUILD_PATH . 'blocks/godam-video-product-gallery-item/';
		if ( file_exists( $video_product_gallery_item_path . 'block.json' ) ) {
			register_block_type( $video_product_gallery_item_path );
		}

		// Initialize REST API.
		\GoDAM_Woo\Classes\WC_REST::get_instance();
		\GoDAM_Woo\Classes\Product_Gallery_Rest::get_instance();

		// Initialize WooCommerce classes.
		\GoDAM_Woo\Classes\WC_Product_Video_Gallery::get_instance();
		\GoDAM_Woo\Classes\WC_Featured_Video_Gallery::get_instance();
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
			'title'          => __( 'WooCommerce', 'godam-woo' ),
			'layerText'      => __( 'WooCommerce', 'godam-woo' ),
			'description'    => __( 'Display products using hotspots', 'godam-woo' ),
			'image'          => GODAM_WOO_URL . 'assets/images/Hotspot.png',
			'formIcon'       => GODAM_WOO_URL . 'assets/images/woo.svg',
			'iconUrl'        => GODAM_WOO_URL . 'assets/images/woo.svg',
			'type'           => 'woo',
			'requiresWoo'    => true,
			'isRequired'     => true,
			'isActive'       => true, // We're already loaded, so WooCommerce is active.
			'requireMessage' => sprintf(
				'<a class="godam-link" target="_blank" href="https://wordpress.org/plugins/woocommerce/">%s</a> %s',
				__( 'WooCommerce', 'godam-woo' ),
				__( 'plugin is required to use WooCommerce layer', 'godam-woo' )
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
	 * Enqueue global WooCommerce styles.
	 *
	 * @return void
	 */
	public function enqueue_global_woo_script() {
		// Register WooCommerce Reels specific skin.
		wp_register_style(
			'godam-player-reels-skin-css',
			GODAM_WOO_URL . 'assets/build/css/godam-reels-skin.css',
			array(),
			godam_woo_get_asset_version( GODAM_WOO_ASSETS_BUILD_PATH . 'css/godam-reels-skin.css' )
		);
	}

	/**
	 * Register WooCommerce settings tab for GoDAM Integrations page.
	 *
	 * @param array $tabs Existing integration tabs.
	 * @return array Modified tabs.
	 */
	public function register_settings_tab( $tabs ) {
		$tabs[] = array(
			'name'      => 'woocommerce',
			'title'     => __( 'WooCommerce', 'godam-woo' ),
			'pro'       => true,
			'component' => 'WooCommerceSettings',
		);
		return $tabs;
	}

	/**
	 * Enqueue video editor scripts for WooCommerce layer.
	 *
	 * @return void
	 */
	public function enqueue_video_editor_scripts() {
		$asset_path = GODAM_WOO_ASSETS_BUILD_PATH . 'pages/woo-layer-component.min.js';
		if ( file_exists( $asset_path ) ) {
			wp_enqueue_script(
				'godam-woo-layer-component',
				GODAM_WOO_URL . 'assets/build/pages/woo-layer-component.min.js',
				array( 'wp-element', 'wp-components', 'wp-i18n' ),
				godam_woo_get_asset_version( $asset_path ),
				true
			);
		}
	}

	/**
	 * Enqueue WooCommerce settings component on the GoDAM settings page.
	 *
	 * @return void
	 */
	public function enqueue_settings_page_scripts() {
		$asset_path = GODAM_WOO_ASSETS_BUILD_PATH . 'pages/woo-settings-component.min.js';
		if ( file_exists( $asset_path ) ) {
			wp_enqueue_script(
				'godam-woo-settings-component',
				GODAM_WOO_URL . 'assets/build/pages/woo-settings-component.min.js',
				array( 'wp-element', 'wp-components', 'wp-i18n' ),
				godam_woo_get_asset_version( $asset_path ),
				true
			);
		}
	}

	// ──────────────────────────────────
	// Frontend player integration hooks
	// ──────────────────────────────────

	/**
	 * Register allowed WooCommerce contexts for the GoDAM player template.
	 *
	 * @param array $contexts Existing allowed contexts.
	 * @return array
	 */
	public function register_woocommerce_contexts( $contexts ) {
		return array_merge(
			$contexts,
			array(
				'godam-woo-product-page-reels',
				'godam-featured-video-gallery',
				'godam-video-product-gallery',
			) 
		);
	}

	/**
	 * Return the correct player skin for a WooCommerce context.
	 *
	 * @param string $skin    Default skin.
	 * @param string $context The godam_context attribute value.
	 * @return string
	 */
	public function get_woocommerce_skin( $skin, $context ) {
		if ( in_array( $context, array( 'godam-woo-product-page-reels', 'godam-video-product-gallery' ), true ) ) {
			return 'reels';
		}
		return 'reels';
	}

	/**
	 * Render the WooCommerce mini-cart block inside the GoDAM player.
	 *
	 * @param array $layers             Player layers configuration.
	 * @param bool  $is_gallery_context Whether the player is inside a gallery iframe.
	 */
	public function render_mini_cart( $layers, $is_gallery_context ) {

		if ( ! rtgodam_is_api_key_valid() ) {
			return;
		}

		foreach ( $layers as $layer ) {
			if ( isset( $layer['miniCart'] ) ) {
				$hidden = ( ! $layer['miniCart'] || $is_gallery_context );
				?>
				<div class="godam-video--cart-basket<?php echo $hidden ? ' godam-mini-cart-hidden' : ''; ?>">
					<?php echo do_blocks( '<!-- wp:woocommerce/mini-cart /-->' ); // phpcs:ignore ?>
				</div>
				<?php
				break;
			}
		}
	}

	/**
	 * Render WooCommerce layer container in the player template.
	 *
	 * @param array  $layer       Layer configuration.
	 * @param string $instance_id Player instance ID.
	 */
	public function render_woocommerce_layer( $layer, $instance_id ) {
		if ( ! isset( $layer['type'] ) || 'woo' !== $layer['type'] ) {
			return;
		}

		if ( ! rtgodam_is_api_key_valid() ) {
			return;
		}
		
		?>
		<div
			id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>"
			class="easydam-layer hidden hotspot-layer"
			<?php if ( ! empty( $layer['bg_color'] ) ) : ?>
				style="background-color: <?php echo esc_attr( $layer['bg_color'] ); ?>"
			<?php endif; ?>
		>
		</div>
		<?php
	}

	/**
	 * Add WooCommerce Blocks data store and layer frontend as player script dependencies.
	 *
	 * @param array $dependencies Existing script dependencies.
	 * @return array
	 */
	public function add_player_woo_dependencies( $dependencies ) {
		if ( ! in_array( 'wc-blocks-data-store', $dependencies, true ) ) {
			$dependencies[] = 'wc-blocks-data-store';
		}
		if ( ! in_array( 'godam-woo-layer-frontend', $dependencies, true ) ) {
			$dependencies[] = 'godam-woo-layer-frontend';
		}
		return $dependencies;
	}

	/**
	 * Provide WooCommerce settings data to the frontend.
	 *
	 * @param array $settings Existing settings.
	 * @return array
	 */
	public function provide_woo_settings_data( $settings ) {
		$settings['woo'] = array(
			'url' => function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : '',
		);
		return $settings;
	}

	/**
	 * Add WooCommerce-specific data to the easydamMediaLibrary JS object.
	 *
	 * @param array $data Existing data.
	 * @return array
	 */
	public function add_woo_media_library_data( $data ) {
		$data['isWooActive'] = true; // If this add-on is active, WooCommerce is active.
		$data['wooCartURL']  = function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : '';
		return $data;
	}

	/**
	 * Add WooCommerce flag to the frontend plugin dependencies.
	 *
	 * @param array $dependencies Existing plugin dependencies.
	 * @return array
	 */
	public function add_woo_plugin_dependency( $dependencies ) {
		$dependencies['woocommerce'] = true;
		return $dependencies;
	}

	/**
	 * Enqueue inline settings for product gallery blocks in the editor.
	 *
	 * @return void
	 */
	public function enqueue_product_gallery_block_settings() {
		$block_settings = array( 'isWooActive' => true );
		$inline_script  = 'window.RTGoDAMProductGalleryBlockSettings = ' . wp_json_encode( $block_settings ) . ';';

		$editor_script_handles = array(
			'godam-video-product-gallery-editor-script',
			'godam-product-gallery-editor-script',
		);

		foreach ( $editor_script_handles as $handle ) {
			if ( wp_script_is( $handle, 'registered' ) ) {
				wp_add_inline_script( $handle, $inline_script, 'before' );
				break;
			}
		}
	}

	/**
	 * Register and enqueue the WooCommerce layer Admin script and CSS.
	 */
	public function register_woo_admin_assets() {
		$asset_path = GODAM_WOO_ASSETS_BUILD_PATH . 'css/godam-woo-admin.css';
		if ( file_exists( $asset_path ) ) {
			wp_enqueue_style(
				'godam-woo-admin-style',
				GODAM_WOO_URL . 'assets/build/css/godam-woo-admin.css',
				array(),
				godam_woo_get_asset_version( $asset_path )
			);
		}

		$css_path = GODAM_WOO_ASSETS_BUILD_PATH . 'css/godam-woo-player.css';
		if ( file_exists( $css_path ) ) {
			wp_register_style(
				'godam-woo-player-style',
				GODAM_WOO_URL . 'assets/build/css/godam-woo-player.css',
				array( 'godam-player-style' ),
				godam_woo_get_asset_version( $css_path )
			);
			wp_enqueue_style( 'godam-woo-player-style' );
		}
	}

	/**
	 * Register and enqueue the WooCommerce layer frontend script and CSS.
	 */
	public function register_woo_layer_frontend_assets() {
		$js_path = GODAM_WOO_ASSETS_BUILD_PATH . 'js/woo-layer-frontend.min.js';
		if ( file_exists( $js_path ) ) {
			wp_register_script(
				'godam-woo-layer-frontend',
				GODAM_WOO_URL . 'assets/build/js/woo-layer-frontend.min.js',
				array( 'wp-i18n', 'wp-data', 'wp-api-fetch' ),
				godam_woo_get_asset_version( $js_path ),
				true
			);
		}

		$css_path = GODAM_WOO_ASSETS_BUILD_PATH . 'css/godam-woo-player.css';
		if ( file_exists( $css_path ) ) {
			wp_register_style(
				'godam-woo-player-style',
				GODAM_WOO_URL . 'assets/build/css/godam-woo-player.css',
				array( 'godam-player-style' ),
				godam_woo_get_asset_version( $css_path )
			);
		}
	}

	/**
	 * Auto-enqueue WooCommerce player CSS when the player style is loaded.
	 */
	public function maybe_enqueue_woo_player_style() {
		if ( wp_style_is( 'godam-player-style', 'enqueued' ) ) {
			wp_enqueue_style( 'godam-woo-player-style' );
		}
	}
}
