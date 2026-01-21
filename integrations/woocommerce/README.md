# WooCommerce Integration Module

## Overview

The WooCommerce integration module is a modular add-on for GoDAM that extends WordPress video functionality with WooCommerce-specific features. This module is **only loaded when WooCommerce is active**, ensuring optimal performance on non-WooCommerce sites.

**Module Location**: `/wp-content/plugins/godam/integrations/woocommerce/`

---

## Directory Structure

```
integrations/woocommerce/
├── bootstrap.php                          # Module initialization (conditional loader)
├── README.md                              # This file
│
├── classes/                               # PHP business logic
│   ├── class-wc.php                       # REST API endpoints for WC products
│   ├── class-wc-product-video-gallery.php # Product video gallery display
│   ├── class-wc-featured-video-gallery.php# Featured video support
│   ├── class-wc-woocommerce-layer.php     # WC hotspots/layers management
│   ├── class-wc-product-gallery-video-markup.php # Video markup rendering
│   └── class-wc-utility.php               # Helper utilities
│
├── blocks/                                # Gutenberg blocks
│   └── godam-product-gallery/             # Product gallery block
│       ├── block.json                     # Block configuration
│       ├── index.js                       # Block registration
│       ├── edit.js                        # Block editor
│       ├── editor.scss                    # Editor styles
│       └── render.php                     # Server-side rendering
│
└── assets/                                # Frontend & admin assets
    ├── js/                                # JavaScript (source)
    │   ├── admin/                         # Admin panel scripts
    │   │   ├── wc-product-video-gallery.js
    │   │   ├── wc-add-to-product.js
    │   │   └── wc-admin-featured-video-gallery.js
    │   ├── featured-video/                # Featured video scripts
    │   │   └── wc-featured-video-gallery.js
    │   ├── single-product-story/          # Product page scripts
    │   │   └── wc-video-carousel.js
    │   ├── woocommerce-layer/             # Layer/hotspot scripts
    │   │   └── wc-woo-layer-cart-url-editor.js
    │   └── godam-product-gallery/         # Gallery feature scripts
    │       ├── godam-product-gallery.js
    │       ├── slider.js
    │       ├── modal.js
    │       ├── cart.js
    │       ├── sidebar.js
    │       └── autoplay.js
    │
    └── images/                            # SVG & image assets
        └── product-tag.svg
```

---

## Features

### 1. **Product Video Gallery** (`class-wc-product-video-gallery.php`)
- Attach GoDAM videos to WooCommerce products
- Display video gallery on single product pages
- Video slider with thumbnail navigation
- Video preview before purchase

### 2. **Featured Video Support** (`class-wc-featured-video-gallery.php`)
- Set a featured video for product galleries
- Custom metabox for product edit screen
- Auto-replace WooCommerce image gallery with video gallery

### 3. **WooCommerce Hotspots/Layers** (`class-wc-woocommerce-layer.php`)
- Interactive hotspots on product videos
- Product information overlays
- Click-to-buy functionality from video
- Real-time product data synchronization

### 4. **REST API Endpoints** (`class-wc.php`)
```
GET    /wp-json/godam/v1/wcproducts        # List all products
GET    /wp-json/godam/v1/wcproduct?id=123  # Get single product
POST   /wp-json/godam/v1/wcproduct         # Attach video to product
DELETE /wp-json/godam/v1/wcproduct         # Remove video from product
```

### 5. **Product Gallery Block**
- Gutenberg block for displaying video galleries
- Configurable layout and styling
- Mobile-responsive design

---

## Build Process

### Source Files → Compiled Assets

All WooCommerce JavaScript and CSS is built via webpack into a dedicated output folder:

```
Source:                          →    Compiled Output:
integrations/woocommerce/       →    assets/build/integrations/woocommerce/
├── assets/js/                  →    ├── js/
│   ├── admin/                  →    │   ├── admin/
│   │   └── *.js                →    │   │   └── *.min.js
│   ├── featured-video/         →    │   ├── featured-video/
│   │   └── *.js                →    │   │   └── *.min.js
│   └── woocommerce-layer/      →    │   └── woocommerce-layer/
│       └── *.js                →    │       └── *.min.js
└── assets/css/                 →    └── css/
    └── *.scss                  →        └── *.css
```

### Webpack Configuration

The main `webpack.config.js` includes a dedicated WooCommerce build configuration:

```javascript
const woocommerceIntegration = {
    entry: {
        // Admin scripts
        'admin/wc-product-video-gallery': '...',
        'admin/wc-add-to-product': '...',

        // Frontend scripts
        'wc-video-carousel': '...',
        'wc-featured-video-gallery': '...',
        // ... more entries
    },
    output: {
        path: 'assets/build/integrations/woocommerce/js'
    }
};
```

### Build Commands

```bash
# Development build (unminified, source maps)
npm run build:dev

# Production build (minified, optimized)
npm run build:prod

# Watch mode during development
npm start
```

---

## Integration Points

### With Main Plugin
- **REST API Base**: Extends `RTGODAM\Inc\REST_API\Base`
- **Asset Enqueueing**: Uses `RTGODAM_PATH` and `RTGODAM_VERSION` constants
- **Namespace**: Uses `RTGODAM\Inc\WooCommerce\` namespace

### With WooCommerce
- **Hooks**: `woocommerce_single_product_summary`, `woocommerce_update_product`
- **Meta Boxes**: Custom metabox for featured video selector
- **Classes**: Uses `WooCommerce` class and WC functions
- **REST API**: Extends WC REST endpoints with custom fields

### With Frontend Assets
- **Blocks**: `godam-product-gallery` Gutenberg block
- **JavaScript**: Multiple feature modules for different functionality
- **Styles**: SCSS/CSS compiled with main plugin assets

---

## Development Workflow

### Adding a New WooCommerce Feature

1. **Create PHP class** in `classes/`
   ```php
   namespace RTGODAM\Inc\WooCommerce;

   class My_Feature {
       use Singleton;

       public function __construct() {
           // Hook setup
       }
   }
   ```

2. **Load in bootstrap.php**
   ```php
   private function load_dependencies() {
       require_once RTGODAM_WC_MODULE_PATH . 'classes/class-my-feature.php';
   }

   public function init_woocommerce_integration() {
       \RTGODAM\Inc\WooCommerce\My_Feature::get_instance();
   }
   ```

3. **Add JavaScript** in `assets/js/`
   ```javascript
   // myfeature/my-feature.js
   export default class MyFeature { ... }
   ```

4. **Add to webpack.config.js**
   ```javascript
   const woocommerceIntegration = {
       entry: {
           'my-feature': 'integrations/woocommerce/assets/js/myfeature/my-feature.js',
       }
   };
   ```

5. **Build and test**
   ```bash
   npm run build:prod
   ```

## License

GPLv2 or later - Part of GoDAM WordPress Plugin

---

**For support, bugs, or feature requests**: https://github.com/rtcamp/godam/issues
