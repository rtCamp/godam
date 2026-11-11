<?php
/**
 * Layer API: the PHP layer type registry (#2295).
 *
 * The server-side half of a layer type: its `layer.json` metadata, how it
 * renders its container in the player (`render_callback`), whether it can run
 * on this site (`is_available`) and, for the Form type, one variation per form
 * plugin. Register a type with `godam_register_layer_type()` on the
 * `godam_init` action.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Layers;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Layer_Type_Registry
 */
class Layer_Type_Registry {

	use Singleton;

	/**
	 * GoDAM version that deprecated the add-on hooks the Layer API replaces (#2296).
	 * They are removed two minor releases later, in 2.10.0.
	 *
	 * @var string
	 */
	const HOOKS_DEPRECATED_SINCE = '2.8.0';

	/**
	 * The handle suffix of each asset key a `layer.json` can name, as core names block asset handles.
	 *
	 * @var array<string, string>
	 */
	const ASSET_HANDLE_SUFFIXES = array(
		'editorScript' => 'editor-script',
		'viewScript'   => 'view-script',
		'style'        => 'style',
		'viewStyle'    => 'view-style',
		'editorStyle'  => 'editor-style',
	);

	/**
	 * The translatable `layer.json` strings and their gettext contexts, as core's
	 * `get_block_metadata_i18n_schema()` gives them for `block.json`.
	 *
	 * @var array<string, mixed>
	 */
	const I18N_SCHEMA = array(
		'title'       => 'layer title',
		'description' => 'layer description',
		'variations'  => array(
			array(
				'title'       => 'layer variation title',
				'description' => 'layer variation description',
			),
		),
	);

	/**
	 * Registered layer types, keyed by name, in registration order.
	 *
	 * @var array<string, array>
	 */
	private $types = array();

	/**
	 * Variations registered before their type, keyed by type name.
	 *
	 * @var array<string, array>
	 */
	private $pending_variations = array();

	/**
	 * Fire `godam_init` once WordPress is ready, so layer types register before anything renders.
	 */
	final protected function __construct() {
		add_action( 'init', array( $this, 'fire_init' ), 5 );
	}

	/**
	 * Fire `godam_init` once.
	 *
	 * @return void
	 */
	public function fire_init() {
		if ( did_action( 'godam_init' ) ) {
			return;
		}

		$this->register_runtime_script();

		/**
		 * Fires when layer types should register. Call `godam_register_layer_type()` here.
		 *
		 * @since 2.9.0
		 */
		do_action( 'godam_init' );
	}

	/**
	 * Register a layer type.
	 *
	 * @param string|array $path_or_metadata Path to a `layer.json` (or its folder), or the metadata array.
	 * @param array        $args             {
	 *     Optional. Server-side settings, merged over the metadata.
	 *
	 *     @type callable $render_callback `( $layer, $instance_id, $context ) => string` container markup for the player.
	 *     @type callable $is_available    `( $layer = null ) => bool` whether the type can run on this site.
	 *     @type callable $should_render   `( $layer, $context ) => bool` whether a saved layer is worth sending, e.g. it has content.
	 *     @type array    $variations      Variations (see `register_variation()`).
	 * }
	 * @return array|false The registered type, or false when it was rejected.
	 */
	public function register( $path_or_metadata, $args = array() ) {
		$metadata = is_array( $path_or_metadata ) ? $path_or_metadata : $this->read_metadata( $path_or_metadata );
		if ( is_array( $metadata ) && ! is_array( $path_or_metadata ) ) {
			$metadata['file'] = is_dir( $path_or_metadata ) ? trailingslashit( $path_or_metadata ) . 'layer.json' : $path_or_metadata;
		}
		if ( ! is_array( $metadata ) ) {
			$this->notice( __FUNCTION__, __( 'Layer type metadata could not be read.', 'godam' ) );
			return false;
		}

		/**
		 * Filters a layer type's metadata before it registers.
		 *
		 * @since 2.9.0
		 *
		 * @param array $metadata Metadata from `layer.json`.
		 */
		$metadata = apply_filters( 'godam_layer_type_metadata', $metadata );
		$name     = isset( $metadata['name'] ) && is_string( $metadata['name'] ) ? $metadata['name'] : '';

		// Translate the metadata's strings with the type's text domain, as core
		// translates block.json, so `$args` needn't repeat them translated.
		if ( ! empty( $metadata['textdomain'] ) && is_string( $metadata['textdomain'] ) ) {
			$metadata = $this->translate_metadata( self::I18N_SCHEMA, $metadata, $metadata['textdomain'] );
		}

		if ( '' === $name ) {
			$this->notice( __FUNCTION__, __( 'A layer type needs a name.', 'godam' ) );
			return false;
		}

		if ( isset( $this->types[ $name ] ) ) {
			/* translators: %s: layer type name. */
			$this->notice( __FUNCTION__, sprintf( __( 'Layer type "%s" is already registered.', 'godam' ), $name ) );
			return false;
		}

		$type = array_merge(
			array(
				'title'      => $name,
				'attributes' => array(),
				'variations' => array(),
			),
			$metadata,
			$args,
			array( 'name' => $name )
		);

		$type['supports'] = array_merge(
			array( 'media' => array( 'video' ) ),
			isset( $metadata['supports'] ) && is_array( $metadata['supports'] ) ? $metadata['supports'] : array(),
			isset( $args['supports'] ) && is_array( $args['supports'] ) ? $args['supports'] : array()
		);

		$type['editor_script_handles'] = $this->register_scripts( $type, 'editorScript', array( 'godam-layers', 'godam-layer-editor' ) );
		$type['view_script_handles']   = $this->register_scripts( $type, 'viewScript', array( 'godam-layer-runtime' ) );
		$type['style_handles']         = $this->register_styles( $type, 'style' );
		$type['view_style_handles']    = $this->register_styles( $type, 'viewStyle' );
		$type['editor_style_handles']  = $this->register_styles( $type, 'editorStyle' );

		$variations         = array_merge( (array) $type['variations'], $this->pending_variations[ $name ] ?? array() );
		$type['variations'] = array();
		unset( $this->pending_variations[ $name ] );
		$this->types[ $name ] = $type;

		foreach ( $variations as $variation ) {
			$this->register_variation( $name, $variation );
		}

		return $this->types[ $name ];
	}

	/**
	 * Remove a layer type.
	 *
	 * @param string $name Layer type name.
	 * @return array|false The removed type, or false when it wasn't registered.
	 */
	public function unregister( $name ) {
		if ( ! isset( $this->types[ $name ] ) ) {
			return false;
		}
		$type = $this->types[ $name ];
		unset( $this->types[ $name ] );
		return $type;
	}

	/**
	 * Add a variation to a layer type, e.g. a form provider to the Form type.
	 *
	 * @param string $name      Layer type name.
	 * @param array  $variation {
	 *     The variation.
	 *
	 *     @type string   $name            Required. Variation name, matched against the type's `variationAttribute`.
	 *     @type string   $title           Label.
	 *     @type callable $render_callback `( $layer, $instance_id, $context ) => string`.
	 *     @type callable $is_available    `() => bool`.
	 *     @type string   $dependency_key  Key reporting `is_available` to the player in `godamPluginDependencies`.
	 * }
	 * @return array|false The variation, or false when it was rejected.
	 */
	public function register_variation( $name, $variation ) {
		if ( ! is_array( $variation ) || empty( $variation['name'] ) || ! is_string( $variation['name'] ) ) {
			/* translators: %s: layer type name. */
			$this->notice( __FUNCTION__, sprintf( __( 'A variation of layer type "%s" needs a name.', 'godam' ), $name ) );
			return false;
		}

		if ( ! isset( $this->types[ $name ] ) ) {
			$this->pending_variations[ $name ][] = $variation;
			return $variation;
		}

		foreach ( $this->types[ $name ]['variations'] as $existing ) {
			if ( $existing['name'] === $variation['name'] ) {
				/* translators: 1: variation name, 2: layer type name. */
				$this->notice( __FUNCTION__, sprintf( __( 'Variation "%1$s" of layer type "%2$s" is already registered.', 'godam' ), $variation['name'], $name ) );
				return false;
			}
		}

		$attribute = $this->types[ $name ]['variationAttribute'] ?? '';
		if ( empty( $variation['attributes'] ) && '' !== $attribute ) {
			$variation['attributes'] = array( $attribute => $variation['name'] );
		}

		$this->types[ $name ]['variations'][] = $variation;
		return $variation;
	}

	/**
	 * Remove every registration. Used by tests.
	 *
	 * @return void
	 */
	public function reset() {
		$this->types              = array();
		$this->pending_variations = array();
	}

	/**
	 * A registered layer type.
	 *
	 * @param string $name Layer type name.
	 * @return array|null The type.
	 */
	public function get( $name ) {
		return is_string( $name ) && isset( $this->types[ $name ] ) ? $this->types[ $name ] : null;
	}

	/**
	 * Every registered layer type, in registration order.
	 *
	 * @return array<string, array>
	 */
	public function get_all() {
		return $this->types;
	}

	/**
	 * The variation a saved layer uses: the one whose attributes all match the layer.
	 *
	 * When the layer sets none of the type's variation attribute, the type's
	 * default (from its `attributes`) selects the variation, so old form layers
	 * saved without a `form_type` still use Gravity Forms.
	 *
	 * @param array $type  Layer type.
	 * @param array $layer Saved layer.
	 * @return array|null The variation.
	 */
	public function get_layer_variation( $type, $layer ) {
		$attribute = $type['variationAttribute'] ?? '';
		if ( '' !== $attribute && empty( $layer[ $attribute ] ) && isset( $type['attributes'][ $attribute ]['default'] ) ) {
			$layer[ $attribute ] = $type['attributes'][ $attribute ]['default'];
		}

		foreach ( $type['variations'] as $variation ) {
			$matches = true;
			foreach ( (array) ( $variation['attributes'] ?? array() ) as $key => $value ) {
				if ( ! isset( $layer[ $key ] ) || $layer[ $key ] !== $value ) {
					$matches = false;
					break;
				}
			}
			if ( $matches ) {
				return $variation;
			}
		}
		return null;
	}

	/**
	 * Whether a layer type (or one of its variations) can run on this site.
	 *
	 * @param array      $type      Layer type, or variation.
	 * @param array|null $layer     Saved layer, if checking one.
	 * @return bool True when it has no `is_available`, or it says yes.
	 */
	public function is_available( $type, $layer = null ) {
		if ( empty( $type['is_available'] ) || ! is_callable( $type['is_available'] ) ) {
			return true;
		}
		return (bool) call_user_func( $type['is_available'], $layer );
	}

	/**
	 * Whether a layer type runs on a kind of media.
	 *
	 * @param array  $type  Layer type.
	 * @param string $media `video` or `image`.
	 * @return bool
	 */
	public function supports_media( $type, $media ) {
		return in_array( $media, (array) ( $type['supports']['media'] ?? array() ), true );
	}

	/**
	 * The container markup for one saved layer in the player.
	 *
	 * A registered type renders through its `render_callback`; the output goes
	 * through `wp_kses_post()` unless the type sets `supports.rawHtml` (RFC D3).
	 * A type with no PHP registration fires the older
	 * `godam_player_render_layer` action, so add-ons built on it keep working.
	 *
	 * @param mixed  $layer       Saved layer.
	 * @param string $instance_id Player instance id.
	 * @param array  $context     `{ media: 'video' | 'image' }`.
	 * @return string The markup.
	 */
	public function render( $layer, $instance_id, $context = array() ) {
		if ( ! is_array( $layer ) || empty( $layer['type'] ) || ! is_string( $layer['type'] ) ) {
			return '';
		}

		$context = array_merge( array( 'media' => 'video' ), (array) $context );
		$type    = $this->get( $layer['type'] );

		if ( null === $type ) {
			return 'video' === $context['media'] ? self::render_with_legacy_action( $layer, $instance_id ) : '';
		}

		if ( ! $this->supports_media( $type, $context['media'] ) || empty( $type['render_callback'] ) || ! is_callable( $type['render_callback'] ) ) {
			return '';
		}

		$html = (string) call_user_func( $type['render_callback'], $layer, $instance_id, $context );
		if ( '' !== $html ) {
			$this->enqueue_view_scripts( $type );
		}
		return empty( $type['supports']['rawHtml'] ) ? wp_kses_post( $html ) : $html;
	}

	/**
	 * A layer's container from the older `godam_player_render_layer` action, for
	 * types with no PHP registration and the legacy Woo type.
	 *
	 * The deprecation is reported before output is buffered, so a notice printed
	 * under `WP_DEBUG` goes to the page rather than into the layer's markup.
	 *
	 * @since 2.9.0
	 *
	 * @param array  $layer       Saved layer.
	 * @param string $instance_id Player instance id.
	 * @return string Markup.
	 */
	public static function render_with_legacy_action( $layer, $instance_id ) {
		if ( ! has_action( 'godam_player_render_layer' ) ) {
			return '';
		}

		_deprecated_hook( 'godam_player_render_layer', esc_html( self::HOOKS_DEPRECATED_SINCE ), 'godam_register_layer_type()' );

		ob_start();
		/**
		 * Renders the container of a layer type that has no PHP registration.
		 *
		 * @deprecated 2.8.0 Use `godam_register_layer_type()` with a `render_callback` instead.
		 *
		 * @param array  $layer       Layer configuration.
		 * @param string $instance_id Player instance ID.
		 */
		do_action( 'godam_player_render_layer', $layer, $instance_id );
		return (string) ob_get_clean();
	}

	/**
	 * The saved layers worth sending for a kind of media, in saved order.
	 *
	 * Keeps layers of registered types that support the media and whose
	 * `should_render` (if any) says yes. Used by the `godam/image` block.
	 *
	 * @param array  $layers Saved layers.
	 * @param string $media  `video` or `image`.
	 * @return array The layers.
	 */
	public function filter_layers_for_media( $layers, $media ) {
		$kept = array();
		foreach ( (array) $layers as $layer ) {
			$type = is_array( $layer ) && ! empty( $layer['type'] ) ? $this->get( $layer['type'] ) : null;
			if ( null === $type || ! $this->supports_media( $type, $media ) ) {
				continue;
			}
			if ( ! empty( $type['should_render'] ) && is_callable( $type['should_render'] ) && ! call_user_func( $type['should_render'], $layer, array( 'media' => $media ) ) ) {
				continue;
			}
			$this->enqueue_view_scripts( $type );
			$kept[] = $this->get_public_layer( $layer );
		}
		return $kept;
	}

	/**
	 * The saved layers whose type has a support flag, e.g. `adTag`.
	 *
	 * @param array  $layers  Saved layers.
	 * @param string $feature Support key.
	 * @return array The layers.
	 */
	public function filter_layers_by_support( $layers, $feature ) {
		return array_values(
			array_filter(
				(array) $layers,
				function ( $layer ) use ( $feature ) {
					$type = is_array( $layer ) && ! empty( $layer['type'] ) ? $this->get( $layer['type'] ) : null;
					return null !== $type && ! empty( $type['supports'][ $feature ] );
				}
			)
		);
	}

	/**
	 * Availability flags for the player (`window.godamPluginDependencies`), from
	 * every type and variation that sets a `dependency_key`.
	 *
	 * @return array<string, bool>
	 */
	public function get_dependency_flags() {
		$flags = array();
		foreach ( $this->types as $type ) {
			foreach ( array_merge( array( $type ), $type['variations'] ) as $item ) {
				if ( ! empty( $item['dependency_key'] ) ) {
					$flags[ $item['dependency_key'] ] = $this->is_available( $item );
				}
			}
		}
		return $flags;
	}

	/**
	 * A saved layer without the attributes its type marks `"private": true`, for the page.
	 *
	 * @param mixed $layer Saved layer.
	 * @return mixed The layer as the browser may see it.
	 */
	public function get_public_layer( $layer ) {
		$type = is_array( $layer ) && ! empty( $layer['type'] ) ? $this->get( $layer['type'] ) : null;
		if ( null === $type ) {
			return $layer;
		}
		foreach ( (array) ( $type['attributes'] ?? array() ) as $key => $schema ) {
			if ( ! empty( $schema['private'] ) ) {
				unset( $layer[ $key ] );
			}
		}
		return $layer;
	}

	/**
	 * Clean saved layers against their types' declared attributes (RFC D3).
	 *
	 * @param mixed $layers Saved layers.
	 * @return mixed The cleaned layers.
	 */
	public function sanitize_layers( $layers ) {
		return Layer_Sanitizer::sanitize_layers( $layers, $this );
	}

	/**
	 * What the video editor needs from PHP: each type's metadata (merged into
	 * `registerLayerType()` the way Gutenberg merges server block metadata) and
	 * whether each type and variation can run here.
	 *
	 * @return array `{ layerTypes: { [name]: metadata }, layerAvailability: { [name]: { available, variations } } }`.
	 */
	public function get_editor_settings() {
		$types        = array();
		$availability = array();

		foreach ( $this->types as $name => $type ) {
			$types[ $name ] = array_intersect_key(
				$type,
				array_flip( array( 'apiVersion', 'name', 'title', 'description', 'icon', 'iconUrl', 'color', 'category', 'supports', 'attributes', 'variationAttribute', 'textdomain' ) )
			);

			$variations = array();
			foreach ( $type['variations'] as $variation ) {
				$variations[ $variation['name'] ] = $this->is_available( $variation );
			}
			$availability[ $name ] = array(
				'available'  => $this->is_available( $type ),
				'variations' => (object) $variations,
			);
		}

		return array(
			'layerTypes'        => (object) $types,
			'layerAvailability' => (object) $availability,
		);
	}

	/**
	 * Enqueue every registered type's `editorScript`, `editorStyle` and `style`.
	 * Called on the video editor page.
	 *
	 * @return void
	 */
	public function enqueue_editor_scripts() {
		foreach ( $this->types as $type ) {
			$this->enqueue_styles( array_merge( $type['style_handles'] ?? array(), $type['editor_style_handles'] ?? array() ) );
			foreach ( $type['editor_script_handles'] ?? array() as $handle ) {
				wp_enqueue_script( $handle );
			}
		}
	}

	/**
	 * Enqueue the view scripts and styles of every type that runs on a kind of media.
	 *
	 * For places that draw layers without the page rendering them: the block
	 * editor's godam/image preview, and page-builder editors that render
	 * previews over AJAX (where assets enqueued during the render never print).
	 *
	 * @param string|null $media `video`, `image`, or null for any.
	 * @return void
	 */
	public function enqueue_view_scripts_for_media( $media = null ) {
		foreach ( $this->types as $type ) {
			if ( null === $media || $this->supports_media( $type, $media ) ) {
				$this->enqueue_view_scripts( $type );
			}
		}
	}

	/**
	 * Enqueue the `style` and `viewStyle` of every type that runs on a kind of media.
	 *
	 * For the block editor canvas, an iframe that gets the styles enqueued on
	 * `enqueue_block_assets` but not the editor window's scripts.
	 *
	 * @since 2.9.0
	 *
	 * @param string|null $media `video`, `image`, or null for any.
	 * @return void
	 */
	public function enqueue_view_styles_for_media( $media = null ) {
		foreach ( $this->types as $type ) {
			if ( null === $media || $this->supports_media( $type, $media ) ) {
				$this->enqueue_view_styles( $type );
			}
		}
	}

	/**
	 * Enqueue a type's `viewScript`, `style` and `viewStyle`, so they load only on
	 * pages that show its layers.
	 *
	 * @param array $type Layer type.
	 * @return void
	 */
	private function enqueue_view_scripts( $type ) {
		$this->enqueue_view_styles( $type );
		foreach ( $type['view_script_handles'] ?? array() as $handle ) {
			wp_enqueue_script( $handle );
		}
	}

	/**
	 * Enqueue a type's `style` and `viewStyle`.
	 *
	 * @param array $type Layer type.
	 * @return void
	 */
	private function enqueue_view_styles( $type ) {
		$this->enqueue_styles( array_merge( $type['style_handles'] ?? array(), $type['view_style_handles'] ?? array() ) );
	}

	/**
	 * Enqueue style handles.
	 *
	 * @param string[] $handles Handles.
	 * @return void
	 */
	private function enqueue_styles( $handles ) {
		foreach ( array_unique( $handles ) as $handle ) {
			wp_enqueue_style( $handle );
		}
	}

	/**
	 * Register the scripts a `layer.json` names under a key.
	 *
	 * A value is a registered script handle, or `file:./path.js` relative to the
	 * `layer.json`, registered with the dependencies from its `*.asset.php` (as
	 * `@wordpress/scripts` builds it) plus `$extra_deps`.
	 *
	 * @param array  $type       Layer type.
	 * @param string $key        `editorScript` or `viewScript`.
	 * @param array  $extra_deps Handles the script always depends on.
	 * @return string[] Handles.
	 */
	private function register_scripts( $type, $key, $extra_deps ) {
		$handles = array();
		foreach ( array_filter( (array) ( $type[ $key ] ?? array() ), 'is_string' ) as $index => $script ) {
			if ( 0 !== strpos( $script, 'file:' ) ) {
				$handles[] = $script;
				continue;
			}

			$path = $this->get_asset_path( $type, $script );
			// Only a built script (with the `*.asset.php` `@wordpress/scripts`
			// writes beside it) is registered, never a source file.
			$asset_file = $path ? preg_replace( '/\.js$/', '.asset.php', $path ) : '';
			if ( ! $path || ! $asset_file || $asset_file === $path || ! file_exists( $asset_file ) ) {
				continue;
			}

			// phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingVariable -- the build's `*.asset.php` beside a registered layer.json, checked to exist above.
			$asset  = include $asset_file;
			$handle = $this->get_asset_handle( $type, $key, $index );

			wp_register_script(
				$handle,
				plugins_url( basename( $path ), $path ),
				array_values( array_unique( array_merge( (array) ( $asset['dependencies'] ?? array() ), $extra_deps ) ) ),
				$asset['version'] ?? false,
				true
			);
			if ( function_exists( 'wp_set_script_translations' ) ) {
				// GoDAM's own layers load their translations from GoDAM's languages
				// folder; an add-on's use WordPress's lookup for its text domain.
				if ( $this->is_godam_file( $type['file'] ) ) {
					wp_set_script_translations( $handle, $type['textdomain'] ?? 'godam', RTGODAM_PATH . 'languages' );
				} elseif ( ! empty( $type['textdomain'] ) ) {
					wp_set_script_translations( $handle, $type['textdomain'] );
				}
			}
			$handles[] = $handle;
		}
		return $handles;
	}

	/**
	 * Register the stylesheets a `layer.json` names under a key.
	 *
	 * A value is a registered style handle, or `file:./path.css` relative to the
	 * `layer.json`. A `*-rtl.css` beside the file (as `@wordpress/scripts` builds
	 * it) replaces it on right-to-left sites.
	 *
	 * @since 2.9.0
	 *
	 * @param array  $type Layer type.
	 * @param string $key  `style`, `viewStyle` or `editorStyle`.
	 * @return string[] Handles.
	 */
	private function register_styles( $type, $key ) {
		$handles = array();
		foreach ( array_filter( (array) ( $type[ $key ] ?? array() ), 'is_string' ) as $index => $style ) {
			if ( 0 !== strpos( $style, 'file:' ) ) {
				$handles[] = $style;
				continue;
			}

			$path = $this->get_asset_path( $type, $style );
			// Only CSS is registered: a stylesheet that isn't built yet (say a
			// core layer's `.scss` source) loads nothing.
			if ( ! $path || '.css' !== substr( $path, -4 ) ) {
				continue;
			}

			$handle = $this->get_asset_handle( $type, $key, $index );
			wp_register_style(
				$handle,
				plugins_url( basename( $path ), $path ),
				array(),
				isset( $type['version'] ) && is_string( $type['version'] ) ? $type['version'] : (string) filemtime( $path )
			);
			wp_style_add_data( $handle, 'path', $path );
			if ( file_exists( substr( $path, 0, -4 ) . '-rtl.css' ) ) {
				wp_style_add_data( $handle, 'rtl', 'replace' );
			}
			$handles[] = $handle;
		}
		return $handles;
	}

	/**
	 * The file a `file:` asset in a `layer.json` points to.
	 *
	 * @param array  $type  Layer type.
	 * @param string $asset `file:./path`, relative to the type's `layer.json`.
	 * @return string The normalized path, or '' when the type has no `layer.json` or the file doesn't exist.
	 */
	private function get_asset_path( $type, $asset ) {
		if ( empty( $type['file'] ) ) {
			return '';
		}
		$real = realpath( dirname( $type['file'] ) . '/' . substr( $asset, 5 ) );
		return $real && is_file( $real ) ? wp_normalize_path( $real ) : '';
	}

	/**
	 * The handle a type's `file:` asset registers under, e.g. `acme-countdown-view-style`.
	 *
	 * @param array  $type  Layer type.
	 * @param string $key   Asset key, e.g. `viewStyle`.
	 * @param int    $index Position in the key's list; the second asset gets a `-2` suffix.
	 * @return string The handle.
	 */
	private function get_asset_handle( $type, $key, $index ) {
		// Core types (no namespace) get a `godam-layer-` prefix, as core blocks get `wp-block-`.
		$prefix = false === strpos( $type['name'], '/' ) ? 'godam-layer-' . $type['name'] : str_replace( '/', '-', $type['name'] );
		return sprintf( '%s-%s%s', $prefix, self::ASSET_HANDLE_SUFFIXES[ $key ], $index ? '-' . ( $index + 1 ) : '' );
	}

	/**
	 * Whether a file is part of GoDAM itself.
	 *
	 * @param string $file Path.
	 * @return bool
	 */
	private function is_godam_file( $file ) {
		if ( ! defined( 'RTGODAM_PATH' ) ) {
			return false;
		}
		$godam = wp_normalize_path( (string) realpath( RTGODAM_PATH ) );
		$real  = wp_normalize_path( (string) realpath( $file ) );
		return '' !== $godam && '' !== $real && 0 === strpos( $real, trailingslashit( $godam ) );
	}

	/**
	 * Translate a type's metadata strings with its text domain, as core's
	 * `translate_settings_using_i18n_schema()` does for `block.json`.
	 *
	 * A string is looked up with its gettext context first (`layer title`, …),
	 * then without one, so a translation the text domain already has for the
	 * same string, say from the add-on's editor script, is used too.
	 *
	 * @since 2.9.0
	 *
	 * @param string|array $schema     Context, or the schema of an array of settings.
	 * @param mixed        $settings   Metadata, or part of it.
	 * @param string       $textdomain Text domain.
	 * @return mixed The translated metadata.
	 */
	private function translate_metadata( $schema, $settings, $textdomain ) {
		if ( is_string( $schema ) ) {
			if ( ! is_string( $settings ) || '' === $settings ) {
				return $settings;
			}
			// phpcs:ignore WordPress.WP.I18n.LowLevelTranslationFunction, WordPress.WP.I18n.NonSingularStringLiteralText, WordPress.WP.I18n.NonSingularStringLiteralContext, WordPress.WP.I18n.NonSingularStringLiteralDomain -- translating layer.json strings, as core translates block.json.
			$translated = translate_with_gettext_context( $settings, $schema, $textdomain );
			if ( $translated === $settings ) {
				// phpcs:ignore WordPress.WP.I18n.LowLevelTranslationFunction, WordPress.WP.I18n.NonSingularStringLiteralText, WordPress.WP.I18n.NonSingularStringLiteralDomain -- as above.
				$translated = translate( $settings, $textdomain );
			}
			return $translated;
		}
		if ( ! is_array( $schema ) || ! is_array( $settings ) ) {
			return $settings;
		}
		// A list: every item uses the schema's one entry.
		if ( isset( $schema[0] ) ) {
			foreach ( $settings as $index => $item ) {
				$settings[ $index ] = $this->translate_metadata( $schema[0], $item, $textdomain );
			}
			return $settings;
		}
		foreach ( $schema as $key => $item_schema ) {
			if ( isset( $settings[ $key ] ) ) {
				$settings[ $key ] = $this->translate_metadata( $item_schema, $settings[ $key ], $textdomain );
			}
		}
		return $settings;
	}

	/**
	 * Register `godam-layer-runtime`, the front-end layer runtime registry
	 * (`window.godam.layers.registerLayerRuntime`) that add-on view scripts depend on.
	 *
	 * The player and image scripts bundle the same registry and share it
	 * through `window.godam.layers`, so they work without it.
	 *
	 * @return void
	 */
	private function register_runtime_script() {
		if ( ! defined( 'RTGODAM_PATH' ) || ! defined( 'RTGODAM_URL' ) || wp_script_is( 'godam-layer-runtime', 'registered' ) ) {
			return;
		}
		$asset_path = RTGODAM_PATH . 'assets/build/js/godam-layer-runtime.min.asset.php';
		if ( ! file_exists( RTGODAM_PATH . 'assets/build/js/godam-layer-runtime.min.js' ) ) {
			return;
		}
		// phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingVariable -- RTGODAM_PATH plus a fixed build filename, checked to exist.
		$asset = file_exists( $asset_path ) ? include $asset_path : array();
		wp_register_script(
			'godam-layer-runtime',
			RTGODAM_URL . 'assets/build/js/godam-layer-runtime.min.js',
			(array) ( $asset['dependencies'] ?? array() ),
			$asset['version'] ?? ( defined( 'RTGODAM_VERSION' ) ? RTGODAM_VERSION : false ),
			true
		);
	}

	/**
	 * Read a `layer.json`.
	 *
	 * @param string $path File, or the folder holding `layer.json`.
	 * @return array|null The metadata.
	 */
	private function read_metadata( $path ) {
		$file = is_string( $path ) && is_dir( $path ) ? trailingslashit( $path ) . 'layer.json' : $path;
		if ( ! is_string( $file ) || ! file_exists( $file ) ) {
			return null;
		}
		$metadata = wp_json_file_decode( $file, array( 'associative' => true ) );
		return is_array( $metadata ) ? $metadata : null;
	}

	/**
	 * Report a registration mistake to developers.
	 *
	 * @param string $method  Method name.
	 * @param string $message Message.
	 * @return void
	 */
	private function notice( $method, $message ) {
		if ( function_exists( '_doing_it_wrong' ) ) {
			_doing_it_wrong( esc_html( __CLASS__ . '::' . $method ), esc_html( $message ), '2.9.0' );
		}
	}
}
