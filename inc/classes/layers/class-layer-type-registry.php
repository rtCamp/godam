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

		/**
		 * Fires when layer types should register. Call `godam_register_layer_type()` here.
		 *
		 * @since n.e.x.t
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
		if ( ! is_array( $metadata ) ) {
			$this->notice( __FUNCTION__, __( 'Layer type metadata could not be read.', 'godam' ) );
			return false;
		}

		/**
		 * Filters a layer type's metadata before it registers.
		 *
		 * @since n.e.x.t
		 *
		 * @param array $metadata Metadata from `layer.json`.
		 */
		$metadata = apply_filters( 'godam_layer_type_metadata', $metadata );
		$name     = isset( $metadata['name'] ) && is_string( $metadata['name'] ) ? $metadata['name'] : '';

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
			if ( 'video' !== $context['media'] ) {
				return '';
			}
			ob_start();
			/**
			 * Renders the container of a layer type that has no PHP registration.
			 *
			 * Use `godam_register_layer_type()` with a `render_callback` instead.
			 *
			 * @param array  $layer       Layer configuration.
			 * @param string $instance_id Player instance ID.
			 */
			do_action( 'godam_player_render_layer', $layer, $instance_id );
			return (string) ob_get_clean();
		}

		if ( ! $this->supports_media( $type, $context['media'] ) || empty( $type['render_callback'] ) || ! is_callable( $type['render_callback'] ) ) {
			return '';
		}

		$html = (string) call_user_func( $type['render_callback'], $layer, $instance_id, $context );
		return empty( $type['supports']['rawHtml'] ) ? wp_kses_post( $html ) : $html;
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
			$kept[] = $layer;
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
			_doing_it_wrong( esc_html( __CLASS__ . '::' . $method ), esc_html( $message ), 'n.e.x.t' );
		}
	}
}
