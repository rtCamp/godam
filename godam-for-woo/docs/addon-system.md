# GoDAM Add-on System Documentation

> **GoDAM Version:** 1.8.0+  
> **Last Updated:** April 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [How to Create a New Add-on (Step-by-Step)](#how-to-create-a-new-add-on-step-by-step)
4. [Abstract_Addon API Reference](#abstract_addon-api-reference)
5. [Addon_Registry API Reference](#addon_registry-api-reference)
6. [Available Hooks & Filters](#available-hooks--filters)
7. [GoDAM for Woo — Complete Documentation](#godam-for-woo--complete-documentation)

---

## Overview

GoDAM uses a **registry-based add-on system** introduced in version 1.8.0. Add-ons are standalone WordPress plugins that extend GoDAM's functionality. They register themselves with GoDAM's central `Addon_Registry` via the `godam_register_addons` action hook.

**Key design principles:**

- Each add-on is a **separate WordPress plugin** (its own directory, plugin header, activation/deactivation hooks).
- Add-ons extend the `Abstract_Addon` base class provided by GoDAM core.
- The registry handles **version compatibility checks** and **dependency validation** before booting any add-on.
- Add-ons integrate with GoDAM via well-defined **action and filter hooks**.

---

## Architecture

### Boot Sequence

```
WordPress loads plugins
    │
    ├── GoDAM core loads (godam.php)
    │     ├── Autoloader registered (spl_autoload_register)
    │     └── Plugin::get_instance() → Addon_Registry::get_instance()
    │
    ├── Add-on plugin loads (e.g., godam-for-woo.php)
    │     └── add_action('godam_register_addons', callback)
    │
    └── plugins_loaded (priority 15)
          └── Addon_Registry::init()
                ├── do_action('godam_register_addons', $registry)
                │     └── Each add-on calls $registry->register(new MyAddon())
                │
                └── $registry->boot_addons()
                      └── For each registered add-on:
                            ├── Check: is_godam_version_compatible()
                            │     └── Fail → admin notice, skip
                            ├── Check: dependencies_met()
                            │     └── Fail → admin notice per missing dep, skip
                            └── Pass → $addon->boot()
                                  ├── do_action('godam_addon_booted', $addon)
                                  └── do_action('godam_addon_{slug}_booted', $addon)
```

### File Locations (Core)

| File | Purpose |
|------|---------|
| `godam/inc/classes/addons/class-abstract-addon.php` | Base class all add-ons must extend |
| `godam/inc/classes/addons/class-addon-registry.php` | Central singleton registry |
| `godam/inc/classes/class-plugin.php` | Main plugin orchestrator that initializes the registry |

---

## How to Create a New Add-on (Step-by-Step)

### Step 1: Create the Plugin Directory & Main File

Create a new WordPress plugin in `wp-content/plugins/`. For example, `godam-my-addon/`:

```
godam-my-addon/
├── godam-my-addon.php          ← Plugin entry point
├── inc/
│   ├── class-my-addon.php      ← Extends Abstract_Addon
│   └── class-bootstrap.php     ← Core logic (loaded on boot)
└── assets/
    └── build/                  ← Compiled JS/CSS (if needed)
```

### Step 2: Write the Main Plugin File

```php
<?php
/**
 * Plugin Name: GoDAM My Addon
 * Description: My custom add-on for GoDAM.
 * Version: 1.0.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Requires Plugins: godam
 * Text Domain: godam-my-addon
 * Author: Your Name
 */

defined( 'ABSPATH' ) || exit;

// Define constants.
define( 'GODAM_MY_ADDON_VERSION', '1.0.0' );
define( 'GODAM_MY_ADDON_PATH', plugin_dir_path( __FILE__ ) );
define( 'GODAM_MY_ADDON_URL', plugin_dir_url( __FILE__ ) );
define( 'GODAM_MY_ADDON_MIN_GODAM_VERSION', '1.8.0' );

/**
 * Register the add-on with GoDAM.
 *
 * @param \RTGODAM\Inc\Addons\Addon_Registry $registry
 */
function godam_my_addon_register( $registry ) {
    require_once GODAM_MY_ADDON_PATH . 'inc/class-my-addon.php';
    $registry->register( new \GoDAM_My_Addon\My_Addon() );
}
add_action( 'godam_register_addons', 'godam_my_addon_register' );

/**
 * Fallback notice when GoDAM core is not active.
 */
function godam_my_addon_missing_godam_notice() {
    if ( ! class_exists( 'RTGODAM\Inc\Addons\Addon_Registry' ) ) {
        printf(
            '<div class="notice notice-error"><p>%s</p></div>',
            esc_html__( 'GoDAM My Addon requires the GoDAM plugin to be installed and activated.', 'godam-my-addon' )
        );
    }
}
add_action( 'admin_notices', 'godam_my_addon_missing_godam_notice' );
```

**Key points:**
- Use `Requires Plugins: godam` header for WordPress 6.5+ dependency management.
- Hook into `godam_register_addons` to register your add-on instance.
- Always add a fallback admin notice in case GoDAM core is not active.

### Step 3: Implement the Add-on Class (Extends Abstract_Addon)

```php
<?php
// File: inc/class-my-addon.php

namespace GoDAM_My_Addon;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Addons\Abstract_Addon;

class My_Addon extends Abstract_Addon {

    /**
     * Unique slug for this add-on.
     */
    public function get_slug() {
        return 'godam-my-addon';
    }

    /**
     * Human-readable name.
     */
    public function get_name() {
        return __( 'GoDAM My Addon', 'godam-my-addon' );
    }

    /**
     * Add-on version.
     */
    public function get_version() {
        return GODAM_MY_ADDON_VERSION;
    }

    /**
     * Absolute filesystem path (with trailing slash).
     */
    public function get_path() {
        return GODAM_MY_ADDON_PATH;
    }

    /**
     * URL to add-on root (with trailing slash).
     */
    public function get_url() {
        return GODAM_MY_ADDON_URL;
    }

    /**
     * Minimum GoDAM version required.
     */
    public function get_minimum_godam_version() {
        return GODAM_MY_ADDON_MIN_GODAM_VERSION;
    }

    /**
     * (Optional) Declare external dependencies.
     *
     * Each entry must have:
     *   - 'name'    => string  — human-readable name
     *   - 'check'   => callable — returns true if dependency is met
     *   - 'message' => string  — admin notice HTML if missing
     */
    public function get_dependencies() {
        return array(
            // Example: require a third-party plugin
            // array(
            //     'name'    => 'Some Plugin',
            //     'check'   => function() { return class_exists('SomePlugin'); },
            //     'message' => '<strong>GoDAM My Addon</strong> requires Some Plugin.',
            // ),
        );
    }

    /**
     * Bootstrap the add-on. Called only after all checks pass.
     *
     * Load your files, register hooks, initialize classes here.
     */
    public function boot() {
        require_once GODAM_MY_ADDON_PATH . 'inc/class-bootstrap.php';
        Bootstrap::get_instance();
    }
}
```

### Step 4: Implement the Bootstrap Class

```php
<?php
// File: inc/class-bootstrap.php

namespace GoDAM_My_Addon;

defined( 'ABSPATH' ) || exit;

class Bootstrap {

    private static $instance = null;

    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->init_hooks();
    }

    private function init_hooks() {
        // Register your hooks, filters, and functionality here.
        // Examples:

        // Add a layer to the video editor:
        // add_filter( 'godam_video_editor_layer_options', array( $this, 'register_layer' ) );

        // Add a settings tab:
        // add_filter( 'godam_integration_settings_tabs', array( $this, 'register_settings_tab' ) );

        // Add frontend player dependencies:
        // add_filter( 'godam_player_frontend_dependencies', array( $this, 'add_dependencies' ) );

        // Render custom layer in the player template:
        // add_action( 'godam_player_render_layer', array( $this, 'render_layer' ), 10, 2 );
    }
}
```

### Step 5: Optional — Settings Integration

To add a settings tab to GoDAM's Integration settings page:

```php
// In your Bootstrap class:

add_filter( 'godam_integration_settings_tabs', array( $this, 'register_settings_tab' ) );

public function register_settings_tab( $tabs ) {
    $tabs[] = array(
        'name'      => 'my-addon',        // Unique tab slug
        'title'     => __( 'My Addon', 'godam-my-addon' ),
        'pro'       => false,             // true if premium feature
        'component' => 'MyAddonSettings', // React component name
    );
    return $tabs;
}

// Enqueue the React component for your settings tab:
add_action( 'godam_enqueue_settings_page_scripts', array( $this, 'enqueue_settings_scripts' ) );

public function enqueue_settings_scripts() {
    wp_enqueue_script(
        'godam-my-addon-settings',
        GODAM_MY_ADDON_URL . 'assets/build/settings-component.min.js',
        array( 'wp-element', 'wp-components', 'wp-i18n' ),
        GODAM_MY_ADDON_VERSION,
        true
    );
}
```

### Step 6: Optional — Video Editor Layer Integration

To add a custom layer type to GoDAM's video editor:

```php
// Register the layer option (appears in layer picker UI):
add_filter( 'godam_video_editor_layer_options', array( $this, 'register_layer_option' ) );

public function register_layer_option( $layers ) {
    $layers[] = array(
        'id'          => 20,                  // Unique numeric ID
        'title'       => 'My Layer',
        'layerText'   => 'My Layer',
        'description' => 'Description of what this layer does',
        'image'       => GODAM_MY_ADDON_URL . 'assets/images/layer-icon.png',
        'type'        => 'my-layer-type',     // Unique type identifier
        'isActive'    => true,
    );
    return $layers;
}

// Map layer type to a React component name:
add_filter( 'godam_video_editor_layer_components', array( $this, 'register_layer_component' ) );

public function register_layer_component( $components ) {
    $components['my-layer-type'] = 'MyLayerComponent';
    return $components;
}

// Enqueue the React component JS in the video editor:
add_action( 'godam_enqueue_video_editor_scripts', array( $this, 'enqueue_editor_scripts' ) );

public function enqueue_editor_scripts() {
    wp_enqueue_script(
        'godam-my-addon-layer',
        GODAM_MY_ADDON_URL . 'assets/build/my-layer-component.min.js',
        array( 'wp-element', 'wp-components', 'wp-i18n' ),
        GODAM_MY_ADDON_VERSION,
        true
    );
}

// Render the layer container on the frontend player:
add_action( 'godam_player_render_layer', array( $this, 'render_layer' ), 10, 2 );

public function render_layer( $layer, $instance_id ) {
    if ( ! isset( $layer['type'] ) || 'my-layer-type' !== $layer['type'] ) {
        return;
    }
    ?>
    <div
        id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>"
        class="easydam-layer hidden my-custom-layer"
    ></div>
    <?php
}
```

---

## Abstract_Addon API Reference

All add-ons must extend `RTGODAM\Inc\Addons\Abstract_Addon`.

| Method | Type | Description |
|--------|------|-------------|
| `get_slug()` | **abstract** | Return a unique string identifier (e.g., `'godam-woo'`). Used as the registry key. |
| `get_name()` | **abstract** | Return a human-readable name (e.g., `'GoDAM for Woo'`). Used in admin notices. |
| `get_version()` | **abstract** | Return the add-on's semantic version string. |
| `get_path()` | **abstract** | Return the absolute filesystem path to the add-on root (with trailing `/`). |
| `get_url()` | **abstract** | Return the URL to the add-on root (with trailing `/`). |
| `boot()` | **abstract** | Bootstrap the add-on. Called only after all checks pass. Register hooks, load files here. |
| `get_dependencies()` | virtual | Return an array of dependency descriptors. Default: empty array. |
| `dependencies_met()` | concrete | Runs all dependency checks. Returns `true` if all pass. |
| `get_missing_dependency_messages()` | concrete | Returns an array of failure message strings for unmet dependencies. |
| `get_minimum_godam_version()` | virtual | Return minimum required GoDAM version. Default: `'1.7.0'`. |
| `is_godam_version_compatible()` | concrete | Compares `RTGODAM_VERSION` against minimum. Returns `bool`. |

### Dependency Descriptor Format

```php
array(
    'name'    => 'WooCommerce',                           // Human-readable name
    'check'   => function() { return class_exists('WooCommerce'); }, // Callable → bool
    'message' => '<strong>My Addon</strong> requires WooCommerce.', // Admin notice HTML
)
```

---

## Addon_Registry API Reference

Singleton at `RTGODAM\Inc\Addons\Addon_Registry`.

| Method | Description |
|--------|-------------|
| `get_instance()` | Get the singleton instance. |
| `register( Abstract_Addon $addon )` | Register an add-on. Returns `false` on duplicate slug. |
| `get( string $slug )` | Get a registered add-on by slug, or `null`. |
| `get_all()` | Get all registered add-ons (slug → instance). |
| `is_active( string $slug )` | Check if an add-on is registered **and** booted. |

---

## Available Hooks & Filters

### Registration & Lifecycle

| Hook | Type | When | Parameters |
|------|------|------|------------|
| `godam_register_addons` | action | `plugins_loaded` (p15) | `Addon_Registry $registry` |
| `godam_addon_booted` | action | After any add-on boots | `Abstract_Addon $addon` |
| `godam_addon_{slug}_booted` | action | After a specific add-on boots | `Abstract_Addon $addon` |

### Video Editor

| Hook | Type | Purpose |
|------|------|---------|
| `godam_video_editor_layer_options` | filter | Add layer types to the video editor layer picker |
| `godam_video_editor_layer_components` | filter | Map layer type → React component name |
| `godam_enqueue_video_editor_scripts` | action | Enqueue JS for custom video editor layers |

### Settings Page

| Hook | Type | Purpose |
|------|------|---------|
| `godam_integration_settings_tabs` | filter | Add tabs to GoDAM Integration settings |
| `godam_enqueue_settings_page_scripts` | action | Enqueue JS for custom settings tabs |

### Frontend Player

| Hook | Type | Purpose |
|------|------|---------|
| `godam_player_render_layer` | action | Render custom layer HTML in the player template |
| `godam_player_render_mini_cart` | action | Render mini-cart inside the player |
| `godam_player_frontend_dependencies` | filter | Add JS dependencies for the frontend player |
| `godam_player_woocommerce_contexts` | filter | Register contexts that trigger WooCommerce skin |
| `godam_player_woocommerce_skin` | filter | Set the player skin for a given context |
| `godam_addon_settings_data` | filter | Inject add-on data into frontend JS settings object |

### Media Library & Dependencies

| Hook | Type | Purpose |
|------|------|---------|
| `godam_easydam_media_library_data` | filter | Add data to the `easydamMediaLibrary` JS object |
| `godam_plugin_dependencies` | filter | Declare plugin dependency flags for the frontend |

---

## GoDAM for Woo — Complete Documentation

### Overview

**GoDAM for Woo** (`godam-for-woo`) is the official WooCommerce integration add-on for GoDAM. It adds:

- **Product Reels** — video carousel on WooCommerce product pages
- **Featured Video Gallery** — replace/augment the standard WC product image gallery with videos
- **WooCommerce Hotspot Layer** — interactive product hotspots in GoDAM video player
- **Video Product Gallery Block** — Gutenberg block to display products with video reels
- **Mini-Cart Integration** — WooCommerce mini-cart inside the video player
- **REST API** — endpoints for product search, video-product linking, and gallery data

### Plugin Header & Constants

```
Plugin Name: GoDAM for Woo
Version: 1.0.0
Requires Plugins: godam, woocommerce
```

| Constant | Value |
|----------|-------|
| `GODAM_WOO_VERSION` | `'1.0.0'` |
| `GODAM_WOO_PATH` | Absolute path to `godam-for-woo/` |
| `GODAM_WOO_URL` | URL to `godam-for-woo/` |
| `GODAM_WOO_BASE_NAME` | `'godam-for-woo/godam-for-woo.php'` |
| `GODAM_WOO_MIN_GODAM_VERSION` | `'1.7.0'` |
| `GODAM_WOO_MODULE_PATH` | Same as `GODAM_WOO_PATH` (set in Bootstrap) |
| `GODAM_WOO_MODULE_URL` | Same as `GODAM_WOO_URL` (set in Bootstrap) |
| `GODAM_WOO_ASSETS_BUILD_PATH` | `GODAM_WOO_PATH . 'assets/build/'` |

### Directory Structure

```
godam-for-woo/
├── godam-for-woo.php                     # Plugin entry point
├── inc/
│   ├── class-godam-woo-addon.php         # Abstract_Addon implementation
│   ├── class-bootstrap.php               # Core orchestrator — hooks, init, assets
│   ├── classes/
│   │   ├── class-wc-product-video-gallery.php   # "Product Reels" metabox & carousel
│   │   ├── class-wc-featured-video-gallery.php  # Featured video in WC product gallery
│   │   ├── class-wc-rest.php                    # REST API for WC products/video linking
│   │   ├── class-product-gallery-rest.php       # REST API for product gallery block
│   │   └── class-wc-utility.php                 # SVG helpers, AJAX sidebar product
│   └── helpers/
│       └── functions.php                 # godam_woo_get_asset_version() helper
├── templates/
│   └── sidebar/
│       ├── hero-product.php              # Sidebar hero product template
│       └── single-product-details.php    # Single product detail sidebar template
├── pages/                                # React components source
│   ├── register-layer.js                 # WooCommerce layer registration
│   ├── register-settings.js              # WooCommerce settings tab registration
│   ├── components/                       # React UI components
│   └── utils/                            # JS utilities
└── assets/
    ├── src/
    │   ├── js/
    │   │   ├── admin/                    # Admin JS (metabox, gallery)
    │   │   ├── featured-video/           # Featured video gallery JS
    │   │   ├── godam-player/             # Player integration JS
    │   │   └── single-product-story/     # Single product story JS
    │   ├── css/                          # Source CSS
    │   ├── blocks/                       # Gutenberg blocks source
    │   │   ├── godam-video-product-gallery/
    │   │   └── godam-video-product-gallery-item/
    │   └── images/
    └── build/                            # Compiled output
```

### Complete Boot Flow

```
1. WordPress loads godam-for-woo.php
   ├── Define constants (GODAM_WOO_VERSION, GODAM_WOO_PATH, etc.)
   ├── add_action('godam_register_addons', 'godam_woo_register_addon')
   └── add_action('admin_notices', fallback notice if GoDAM is missing)

2. GoDAM fires 'godam_register_addons' at plugins_loaded (p15)
   └── godam_woo_register_addon($registry) is called
       ├── require_once class-godam-woo-addon.php
       └── $registry->register(new Godam_Woo_Addon())

3. Addon_Registry runs checks on Godam_Woo_Addon:
   ├── is_godam_version_compatible()
   │   └── RTGODAM_VERSION >= '1.7.0'
   └── dependencies_met()
       └── class_exists('WooCommerce') === true

4. Godam_Woo_Addon::boot() is called
   ├── Reads 'rtgodam-settings' option
   ├── Checks integrations.woocommerce.enable !== false
   └── Loads Bootstrap::get_instance()

5. Bootstrap constructor runs:
   ├── define_constants()       → GODAM_WOO_MODULE_PATH, etc.
   ├── load_helpers()           → inc/helpers/functions.php
   ├── register_autoloader()    → spl_autoload_register for GoDAM_Woo\Classes\*
   ├── load_dependencies()      → Require REST + WC integration classes, init WC_Utility
   └── init_hooks()             → Register all 25+ hooks (see below)

6. On 'init' (priority 20):
   ├── Register Gutenberg blocks (godam/video-product-gallery, godam/video-product-gallery-item)
   ├── WC_REST::get_instance()
   ├── Product_Gallery_Rest::get_instance()
   ├── WC_Product_Video_Gallery::get_instance()
   └── WC_Featured_Video_Gallery::get_instance()
```

### Complete Hook Map

#### Admin / Editor Hooks

| Hook | Priority | Method | What It Does |
|------|----------|--------|--------------|
| `init` | 20 | `init_woocommerce_integration` | Register blocks, init REST APIs, init WC classes |
| `allowed_block_types_all` | 10 | `filter_premium_blocks_for_inserter` | Hide `godam/video-product-gallery` block if no valid API key |
| `enqueue_block_editor_assets` | default | `enqueue_product_gallery_block_settings` | Inline `RTGoDAMProductGalleryBlockSettings` JS object |
| `admin_enqueue_scripts` | 5 | `register_woo_admin_assets` | Enqueue admin CSS + player CSS |
| `godam_enqueue_video_editor_scripts` | default | `enqueue_video_editor_scripts` | Enqueue `woo-layer-component.min.js` |
| `godam_enqueue_settings_page_scripts` | default | `enqueue_settings_page_scripts` | Enqueue `woo-settings-component.min.js` |
| `godam_video_editor_layer_options` | 10 | `register_woocommerce_layer_option` | Add WooCommerce layer to video editor picker |
| `godam_video_editor_layer_components` | 10 | `register_woocommerce_layer_component` | Map `'woo'` → `'WoocommerceLayer'` React component |
| `godam_integration_settings_tabs` | default | `register_settings_tab` | Add "WooCommerce" tab to GoDAM integration settings |
| `godam_easydam_media_library_data` | default | `add_woo_media_library_data` | Inject `isWooActive` + `wooCartURL` |
| `godam_plugin_dependencies` | default | `add_woo_plugin_dependency` | Add `woocommerce: true` flag |
| `wp_ajax_godam_get_single_sidebar_product_html` | default | WC_Utility callback | AJAX: return sidebar product HTML |
| `wp_ajax_nopriv_godam_get_single_sidebar_product_html` | default | WC_Utility callback | Same for non-logged-in users |

#### Frontend Player Hooks

| Hook | Priority | Method | What It Does |
|------|----------|--------|--------------|
| `wp_enqueue_scripts` | 5 | `register_woo_layer_frontend_assets` | Register `godam-woo-layer-frontend` JS + `godam-woo-player-style` CSS |
| `wp_enqueue_scripts` | 25 | `enqueue_global_woo_script` | Register `godam-player-reels-skin-css` |
| `wp_footer` | default | `maybe_enqueue_woo_player_style` | Auto-enqueue WC player CSS when GoDAM player is loaded |
| `godam_player_woocommerce_contexts` | default | `register_woocommerce_contexts` | Register 3 WC contexts: `godam-woo-product-page-reels`, `godam-featured-video-gallery`, `godam-video-product-gallery` |
| `godam_player_woocommerce_skin` | 10 | `get_woocommerce_skin` | Return `'reels'` skin for WC contexts |
| `godam_player_render_mini_cart` | 10 | `render_mini_cart` | Render WC mini-cart block (`<!-- wp:woocommerce/mini-cart /-->`) in player |
| `godam_player_render_layer` | 10 | `render_woocommerce_layer` | Render hotspot layer container `<div>` for `type: woo` layers |
| `godam_player_frontend_dependencies` | default | `add_player_woo_dependencies` | Add `wc-blocks-data-store` + `godam-woo-layer-frontend` as player dependencies |
| `godam_addon_settings_data` | default | `provide_woo_settings_data` | Inject `woo.url` (cart URL) into frontend settings |

### Core Classes

#### WC_Product_Video_Gallery

**File:** `inc/classes/class-wc-product-video-gallery.php`

Adds a **"Product Reels"** metabox to WooCommerce product edit pages, allowing store owners to attach video galleries to products.

- **Admin:** Renders a metabox with a video selector UI on the product edit screen
- **Post Meta:**
  - `_rtgodam_product_video_gallery` — serialized video gallery data (URLs, thumbnails)
  - `_rtgodam_product_video_gallery_ids` — array of attachment/video IDs
- **Frontend:** Hooks into `woocommerce_single_product_summary` (priority 70) to render a video carousel (product reels) below the product summary
- **Assets:** Enqueues `product-reels-carousel.min.js` and related CSS on product pages

#### WC_Featured_Video_Gallery

**File:** `inc/classes/class-wc-featured-video-gallery.php`

**Replaces** the default WooCommerce product image gallery metabox to support videos alongside images in the main product gallery.

- **Admin:** Modifies the WC product gallery metabox to allow adding video attachments
- **Frontend:** Filters `woocommerce_single_product_image_thumbnail_html` to render GoDAM player embeds for video attachments instead of image thumbnails
- **Assets:** Enqueues `wc-featured-video-gallery.min.js` for frontend gallery interactivity, `wc-admin-featured-video-gallery.min.js` for admin

#### WC_REST

**File:** `inc/classes/class-wc-rest.php`

REST API endpoints for WooCommerce integration. Extends GoDAM's `RTGODAM\Inc\REST_API\Base`.

**Endpoints (under `godam/v1/` namespace):**

- Search WooCommerce products (for hotspot product picker)
- Link/unlink videos to products
- Save/get product video meta

#### Product_Gallery_Rest

**File:** `inc/classes/class-product-gallery-rest.php`

REST API endpoints for the Video Product Gallery block.

- Fetch products with their video reels data
- Fetch product categories for filtering

#### WC_Utility

**File:** `inc/classes/class-wc-utility.php`

Utility class providing:

- Star rating SVG generation
- SVG `wp_kses` whitelist (`wp_kses_allowed_html` filter)
- AJAX callback for sidebar product HTML (uses templates in `templates/sidebar/`)

### Frontend JavaScript Architecture

| Script Handle | File | Purpose |
|---------------|------|---------|
| `godam-woo-layer-frontend` | `js/woo-layer-frontend.min.js` | Registers `WooCommerceLayerManager` to `window.godamLayerManagers.woo` — handles hotspot rendering, product sidebar, add-to-cart |
| `godam-woo-layer-component` | `pages/woo-layer-component.min.js` | React component for WooCommerce layer in the video editor |
| `godam-woo-settings-component` | `pages/woo-settings-component.min.js` | React component for WooCommerce settings tab |
| `godam-wc-featured-video-gallery` | `js/wc-featured-video-gallery.min.js` | Frontend featured video gallery interactivity |
| `godam-product-reels-carousel` | `js/product-reels-carousel.min.js` | Product reels video carousel on product pages |
| `godam-wc-product-video-gallery` | `js/wc-product-video-gallery.min.js` | Admin metabox for product video gallery |
| `godam-wc-admin-featured-video-gallery` | `js/wc-admin-featured-video-gallery.min.js` | Admin featured video gallery management |
| `godam-player-reels-skin-css` | `css/godam-reels-skin.css` | Reels skin CSS for the GoDAM player |
| `godam-woo-player-style` | `css/godam-woo-player.css` | WooCommerce-specific player styles |

### Gutenberg Blocks

| Block | Directory | Description |
|-------|-----------|-------------|
| `godam/video-product-gallery` | `assets/src/blocks/godam-video-product-gallery/` | Container block — displays a grid/gallery of products with video reels. **Premium** (requires valid API key). |
| `godam/video-product-gallery-item` | `assets/src/blocks/godam-video-product-gallery-item/` | Individual product item within the gallery block. |

### Settings Integration

The WooCommerce add-on is controlled by the `rtgodam-settings` WordPress option:

```php
$settings = get_option( 'rtgodam-settings' );
// Path: $settings['integrations']['woocommerce']['enable']
// true (default) = enabled, false = disabled
```

When disabled, `Godam_Woo_Addon::boot()` returns early without loading Bootstrap, effectively deactivating all WooCommerce features while keeping the plugin active.

### Data Flow: Video Hotspot → Add to Cart

```
1. Admin creates a video with WooCommerce hotspot layer in GoDAM Video Editor
   └── Selects products, positions hotspots, configures timing

2. Video is embedded on a page using GoDAM player shortcode/block

3. Frontend player loads:
   ├── godam-woo-layer-frontend.js registers WooCommerceLayerManager
   ├── wc-blocks-data-store is loaded as a dependency
   └── Player renders hotspot layer containers (godam_player_render_layer)

4. User interacts with hotspot during video playback:
   ├── WooCommerceLayerManager shows product sidebar
   │   └── AJAX call: godam_get_single_sidebar_product_html
   │       └── Returns rendered template (hero-product.php / single-product-details.php)
   └── User clicks "Add to Cart"
       └── Uses WC Blocks data store / WC AJAX to add product to cart
           └── Mini-cart updates (rendered via wp:woocommerce/mini-cart block)
```

### Data Flow: Product Reels on Product Page

```
1. Admin attaches videos to a WC product via "Product Reels" metabox
   └── Video IDs saved to _rtgodam_product_video_gallery_ids post meta

2. Customer visits WooCommerce single product page

3. woocommerce_single_product_summary (priority 70):
   └── WC_Product_Video_Gallery renders video carousel
       ├── Each video renders as a GoDAM player with context 'godam-woo-product-page-reels'
       ├── Player skin set to 'reels' via godam_player_woocommerce_skin filter
       └── Reels skin CSS (godam-player-reels-skin-css) is enqueued
```

### Data Flow: Featured Video Gallery

```
1. Admin adds video to WC product gallery (via modified gallery metabox)

2. Customer visits WooCommerce single product page

3. WC_Featured_Video_Gallery filters woocommerce_single_product_image_thumbnail_html:
   └── For video attachments, replaces <img> with GoDAM player embed
       └── Context: 'godam-featured-video-gallery'
```
