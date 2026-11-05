<?php
/**
 * Layer API: loads GoDAM's core layer types (#2295).
 *
 * Each core type lives in its own folder, like a core block in Gutenberg's
 * block-library: `assets/src/layers/<type>/` holds `layer.json`, `<type>.php`
 * (its render callback and registration), `editor.js`, `edit.js` and
 * `view.js`. The build copies `layer.json` and the PHP to
 * `assets/build/layers/<type>/` beside the built `view.js`, and this loader
 * registers each type from there, through the same API add-ons use.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Layers;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Core_Layer_Types
 */
class Core_Layer_Types {

	use Singleton;

	/**
	 * The core layer types, in the editor's "Add layer" order.
	 *
	 * @var string[]
	 */
	const TYPES = array( 'cta', 'form', 'poll', 'hotspot', 'ad' );

	/**
	 * Register on `godam_init`, before add-ons (priority 10).
	 */
	final protected function __construct() {
		add_action( 'godam_init', array( $this, 'register' ), 5 );
		// After add-ons (priority 10), so an add-on that registers its own type wins.
		add_action( 'godam_init', array( Legacy_Layer_Types::class, 'register' ), 100 );
	}

	/**
	 * Load each core type's PHP and register it. Skips a type something already registered.
	 *
	 * @param string|null $layers_dir Folder holding the layer folders. Defaults to
	 *                                `assets/build/layers` when built, else `assets/src/layers`.
	 * @return void
	 */
	public function register( $layers_dir = null ) {
		$layers_dir = $layers_dir ? $layers_dir : self::get_layers_dir();
		$registry   = Layer_Type_Registry::get_instance();

		foreach ( self::TYPES as $type ) {
			$file = trailingslashit( $layers_dir ) . $type . '/' . $type . '.php';
			if ( null !== $registry->get( $type ) || ! file_exists( $file ) ) {
				continue;
			}
			// phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingVariable -- path built from the plugin's layer folder and the fixed TYPES list.
			require_once $file;
			$register = __NAMESPACE__ . '\\Core\\register_' . $type;
			if ( function_exists( $register ) ) {
				$register();
			}
		}
	}

	/**
	 * Where the core layer folders are: the build, or the source when the plugin isn't built.
	 *
	 * Only one of them is ever loaded per request, since both declare the same functions.
	 *
	 * @return string The folder.
	 */
	public static function get_layers_dir() {
		$build = RTGODAM_PATH . 'assets/build/layers';
		return file_exists( $build . '/cta/cta.php' ) ? $build : RTGODAM_PATH . 'assets/src/layers';
	}

	/**
	 * The `<div id="layer-…" class="easydam-layer hidden">` every player layer sits in.
	 *
	 * @param array  $layer       Saved layer.
	 * @param string $instance_id Player instance id.
	 * @param string $inner_html  Markup inside the container (already escaped).
	 * @param array  $args        {
	 *     Optional.
	 *
	 *     @type string $class            Extra classes.
	 *     @type bool   $default_bg_color Use the default background when the layer sets none. Default true.
	 * }
	 * @return string The container.
	 */
	public static function container( $layer, $instance_id, $inner_html, $args = array() ) {
		$args     = array_merge(
			array(
				'class'            => '',
				'default_bg_color' => true,
			),
			$args
		);
		$bg_color = ! empty( $layer['bg_color'] ) ? $layer['bg_color'] : ( $args['default_bg_color'] ? '#FFFFFFB3' : '' );

		return sprintf(
			'<div id="%1$s" class="%2$s"%3$s>%4$s</div>',
			esc_attr( 'layer-' . $instance_id . '-' . ( $layer['id'] ?? '' ) ),
			esc_attr( trim( 'easydam-layer hidden ' . $args['class'] ) ),
			'' !== $bg_color ? ' style="' . esc_attr( 'background-color: ' . $bg_color ) . '"' : '',
			$inner_html
		);
	}

	/**
	 * `is_plugin_active()`, loading it outside the admin.
	 *
	 * @param string $plugin Plugin basename.
	 * @return bool
	 */
	public static function is_plugin_active( $plugin ) {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			include_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		return is_plugin_active( $plugin );
	}
}
