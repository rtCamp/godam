# WooCommerce Integration

## Overview

This integration extends GoDAM with WooCommerce-specific features (product video galleries, featured video support, product layers/hotspots, and REST endpoints).

The integration lives in `integrations/woocommerce/` and is auto-loaded by the main plugin’s integrations loader. The bootstrap itself is responsible for **conditionally booting only when WooCommerce is available**.

## Loading

- Auto-discovery is handled by `RTGODAM\Inc\Integrations` (see `inc/classes/class-integrations.php`).
- The loader `require_once`s `integrations/*/class-bootstrap.php` on `plugins_loaded`.
- This integration’s entry point is `integrations/woocommerce/class-bootstrap.php`.

Important: bootstrap files must never output anything (no `echo`, `var_dump`, etc.) because they run during requests that may expect JSON (REST/AJAX).

## Current directory structure

```
integrations/woocommerce/
├── class-bootstrap.php                    # Integration entry point (conditional bootstrap)
├── README.md                              # This file
├── helpers/                               # Helper functions
├── classes/                               # PHP business logic (WooCommerce dependent)
│   ├── class-wc.php                       # REST API endpoints for WooCommerce products
│   ├── class-wc-product-video-gallery.php # Product video gallery display
│   ├── class-wc-featured-video-gallery.php# Featured video support
│   ├── class-wc-woocommerce-layer.php     # WC hotspots/layers management
│   ├── class-wc-product-gallery-video-markup.php # Video markup rendering
│   ├── class-wc-utility.php               # Helper utilities
│   └── shortcodes/
│       └── class-godam-product-gallery.php
├── blocks/
│   └── godam-product-gallery/             # Block source (block.json, editor assets)
├── assets/
│   ├── css/                               # SCSS sources
│   ├── js/                                # JS sources
│   └── images/
└── pages/                                 # Admin/editor UI components used by layers
```

## Features

- Product video gallery for single product pages.
- Featured video support for WooCommerce product galleries.
- WooCommerce layer/hotspot support in the GoDAM video editor.
- REST endpoints under `/wp-json/godam/v1/...` for WooCommerce product data.
- `godam-product-gallery` block and shortcode for embedding product galleries.

## Build output

Compiled assets are emitted under `assets/build/`.

- WooCommerce integration bundle output:
  - `assets/build/integrations/woocommerce/js/*.min.js`
  - `assets/build/integrations/woocommerce/css/*.css`
- Product gallery bundle (entry: `godam-product-gallery`) output:
  - `assets/build/js/godam-product-gallery.min.js`
  - `assets/build/js/godam-product-gallery.min.asset.php`
- Block build output:
  - `assets/build/integrations/woocommerce/blocks/godam-product-gallery/`

The entry points and output folders are defined in `webpack.config.js`.

## Development workflow

### Adding a new WooCommerce feature

1. Create a new class in `integrations/woocommerce/classes/` using the existing namespace pattern (`RTGODAM\Inc\WooCommerce`).
2. Include the class from `integrations/woocommerce/class-bootstrap.php` (dependency loading) and initialize it on the integration init hook.
3. If you add new JS/CSS, add it as an entry in `webpack.config.js` (prefer the existing `woocommerceIntegration` config for Woo-specific bundles).
4. Build:

```bash
npm run build:dev
# or
npm run build:prod
```
