# Integrations

## Overview

GoDAM supports optional integrations that live under `integrations/`. Each integration is responsible for bootstrapping itself and for guarding any third-party dependencies (WooCommerce, form plugins, etc.).

Integrations are automatically discovered and loaded by `RTGODAM\Inc\Integrations`.

## Auto-loading rules

- The main plugin loads `RTGODAM\Inc\Integrations` during initialization.
- On `plugins_loaded` (priority 20), it `require_once`s any file matching:
  - `integrations/*/class-bootstrap.php`
- Each integration’s `class-bootstrap.php` should:
  - Perform dependency checks (e.g. `class_exists( 'WooCommerce' )`).
  - Register hooks and load its own classes/files.
  - Avoid doing heavy work immediately on file load.

Important: bootstrap files must never print output (no `echo`, `var_dump`, `print_r`, etc.). Output can break REST/AJAX requests that expect JSON.

## Creating a new integration

### 1) Create a folder

Example:

```
integrations/my-integration/
├── class-bootstrap.php
├── classes/
├── assets/
└── README.md
```

### 2) Add `class-bootstrap.php`

Recommended pattern:

- One bootstrap class per integration (keeps PHPCS happy and avoids mixing global functions + OO in one file).
- The bootstrap class does dependency checks and wires hooks.

Skeleton:

```php
<?php
/**
 * My Integration bootstrap.
 *
 * @package GoDAM
 */

namespace RTGODAM\Integrations\MyIntegration;

defined( 'ABSPATH' ) || exit;

final class Bootstrap {
	private static $instance = null;

	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		// Dependency guard.
		if ( ! class_exists( 'Some_Third_Party_Class' ) ) {
			return;
		}

		add_action( 'init', array( $this, 'init' ) );
	}

	public function init() {
		// require_once __DIR__ . '/classes/class-my-feature.php';
		// \RTGODAM\Inc\MyNamespace\My_Feature::get_instance();
	}
}

Bootstrap::get_instance();
```

Notes:

- Keep any helper functions in separate files (e.g. `helpers/functions.php`) to avoid mixing global functions and class declarations in the same file.
- If you need autoloading inside an integration, prefer an autoloader method on the bootstrap class or explicit `require_once` statements.

### 3) Assets (optional)

- If the integration needs JS/CSS, add source files under `integrations/<slug>/assets/`.
- Add webpack entries in `webpack.config.js` and emit to `assets/build/integrations/<slug>/...` to keep integration output grouped.

## Troubleshooting

- If an integration isn’t loading, confirm the bootstrap file is named exactly `class-bootstrap.php` and lives directly under `integrations/<slug>/`.
- If REST/AJAX starts returning HTML instead of JSON, check for accidental output in bootstrap or early hooks.
