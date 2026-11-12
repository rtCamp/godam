<?php
/**
 * Layer API: cleans saved layers against their type's declared attributes (#2295, RFC D3).
 *
 * Every attribute in a `layer.json` declares a schema `type` (`string`,
 * `number`, `integer`, `boolean`, `array`, `object`, or a list such as
 * `[ "string", "null" ]`) and optionally a `format` for strings: `plain` (the
 * default, `sanitize_text_field()`), `html` (`wp_kses_post()`), `url`
 * (`esc_url_raw()`) or `color` (`rtgodam_sanitize_css_color()`).
 *
 * Two modes:
 *
 * - **Strict** (the default for add-on types): declared attributes are
 *   sanitized, a value of the wrong type that can't be converted without loss
 *   falls back to the attribute's default (or is removed), and undeclared keys
 *   are dropped.
 * - **Lenient** (types registered with `keep_undeclared_attributes`, which the
 *   core types use until their `layer.json` lists every attribute they save):
 *   a declared attribute is sanitized when its value already has the declared
 *   type (except `html`, which is escaped when it renders), and everything
 *   else is kept as saved.
 *
 * Layers of an unregistered type are kept unchanged: the add-on that owns them
 * may come back.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Layers;

defined( 'ABSPATH' ) || exit;

/**
 * Class Layer_Sanitizer
 */
class Layer_Sanitizer {

	/**
	 * Keys GoDAM manages on every layer.
	 *
	 * @var array<string, array>
	 */
	const MANAGED_KEYS = array(
		'id'          => array( 'type' => 'string' ),
		'type'        => array( 'type' => 'string' ),
		// The label in the editor's layer list, kept as typed: React escapes it
		// where it shows, and `sanitize_text_field()` would drop `<sale>` from
		// `Promo <sale> & more`.
		'name'        => array(
			'type'   => 'string',
			'format' => 'text',
		),
		'displayTime' => array( 'type' => array( 'number', 'string' ) ),
	);

	/**
	 * Keys shared by every layer type (a type may only change their default).
	 *
	 * @var array<string, array>
	 */
	const SHARED_KEYS = array(
		'duration'   => array( 'type' => 'number' ),
		'allow_skip' => array( 'type' => 'boolean' ),
		'custom_css' => array(
			'type'   => 'string',
			'format' => 'css',
		),
		'trigger'    => array( 'type' => 'string' ),
		'watchDepth' => array( 'type' => 'number' ),
	);

	/**
	 * Clean a list of saved layers.
	 *
	 * @param mixed               $layers   Saved layers.
	 * @param Layer_Type_Registry $registry Registry.
	 * @return mixed The cleaned layers (the input unchanged when it isn't a list).
	 */
	public static function sanitize_layers( $layers, $registry ) {
		if ( ! is_array( $layers ) ) {
			return $layers;
		}
		return array_map(
			function ( $layer ) use ( $registry ) {
				return self::sanitize_layer( $layer, $registry );
			},
			$layers
		);
	}

	/**
	 * Clean one saved layer.
	 *
	 * @param mixed               $layer    Saved layer.
	 * @param Layer_Type_Registry $registry Registry.
	 * @return mixed The cleaned layer.
	 */
	public static function sanitize_layer( $layer, $registry ) {
		$type = is_array( $layer ) && isset( $layer['type'] ) && is_string( $layer['type'] ) ? $registry->get( $layer['type'] ) : null;
		if ( null === $type ) {
			return $layer;
		}

		$strict  = empty( $type['keep_undeclared_attributes'] );
		$schemas = array_merge( self::SHARED_KEYS, self::declared_attributes( $type, $layer, $registry ), self::MANAGED_KEYS );
		$clean   = array();

		foreach ( $layer as $key => $value ) {
			if ( ! isset( $schemas[ $key ] ) ) {
				if ( ! $strict ) {
					$clean[ $key ] = $value;
				}
				continue;
			}

			// Lenient types keep a value whose type doesn't match as saved, rather
			// than converting it, and keep `html` as written: it is escaped when it
			// renders, and cleaning it here would delete what the author typed.
			if ( ! $strict && ( ! self::has_declared_type( $value, $schemas[ $key ] ) || 'html' === ( $schemas[ $key ]['format'] ?? '' ) ) ) {
				$clean[ $key ] = $value;
				continue;
			}

			$sanitized = self::sanitize_value( $value, $schemas[ $key ] );
			if ( null !== $sanitized || self::allows( $schemas[ $key ], 'null' ) ) {
				$clean[ $key ] = $sanitized;
			} elseif ( ! $strict ) {
				$clean[ $key ] = $value;
			} elseif ( array_key_exists( 'default', $schemas[ $key ] ) ) {
				$clean[ $key ] = $schemas[ $key ]['default'];
			}
		}

		return $clean;
	}

	/**
	 * Attributes a layer may store: its type's, plus those of its variation (e.g. a form provider's form-ID field).
	 *
	 * @param array               $type     Layer type.
	 * @param array               $layer    Saved layer.
	 * @param Layer_Type_Registry $registry Registry.
	 * @return array<string, array>
	 */
	private static function declared_attributes( $type, $layer, $registry ) {
		$attributes = is_array( $type['attributes'] ?? null ) ? $type['attributes'] : array();
		$variation  = $registry->get_layer_variation( $type, $layer );
		if ( is_array( $variation['attributeSchema'] ?? null ) ) {
			$attributes = array_merge( $attributes, $variation['attributeSchema'] );
		}

		// A schema with no `type` (e.g. one that only changes a shared key's
		// default) inherits the shared key's type.
		foreach ( $attributes as $key => $schema ) {
			$attributes[ $key ] = is_array( $schema ) ? $schema : array();
			if ( ! isset( $attributes[ $key ]['type'] ) && isset( self::SHARED_KEYS[ $key ] ) ) {
				$attributes[ $key ] = array_merge( self::SHARED_KEYS[ $key ], $attributes[ $key ] );
			}
		}
		return $attributes;
	}

	/**
	 * Sanitize a value against its schema.
	 *
	 * @param mixed $value  Value.
	 * @param array $schema `type`, `format`.
	 * @return mixed The sanitized value, or null when it can't take any of the schema's types.
	 */
	private static function sanitize_value( $value, $schema ) {
		$types = isset( $schema['type'] ) ? (array) $schema['type'] : array();
		if ( empty( $types ) ) {
			return $value;
		}

		// Prefer a type the value already has, so `[ "number", "string" ]` keeps 5 as 5.
		usort(
			$types,
			function ( $a, $b ) use ( $value ) {
				return (int) ! self::is_type( $value, $a ) - (int) ! self::is_type( $value, $b );
			}
		);

		foreach ( $types as $type ) {
			$converted = self::convert( $value, $type, $schema['format'] ?? '' );
			if ( null !== $converted ) {
				return $converted;
			}
		}
		return null;
	}

	/**
	 * Whether a value already has a schema type.
	 *
	 * @param mixed  $value Value.
	 * @param string $type  Schema type.
	 * @return bool
	 */
	private static function is_type( $value, $type ) {
		switch ( $type ) {
			case 'string':
				return is_string( $value );
			case 'number':
				return is_int( $value ) || is_float( $value );
			case 'integer':
				return is_int( $value );
			case 'boolean':
				return is_bool( $value );
			case 'array':
				return is_array( $value ) && array_values( $value ) === $value;
			case 'object':
				return is_array( $value );
			case 'null':
				return null === $value;
		}
		return false;
	}

	/**
	 * Convert a value to a schema type, if that loses nothing.
	 *
	 * @param mixed  $value  Value.
	 * @param string $type   Schema type.
	 * @param string $format String format.
	 * @return mixed The value, or null when it can't be converted.
	 */
	private static function convert( $value, $type, $format ) {
		switch ( $type ) {
			case 'string':
				if ( is_string( $value ) || is_int( $value ) || is_float( $value ) ) {
					return self::format_string( (string) $value, $format );
				}
				return null;
			case 'number':
				return is_numeric( $value ) ? $value + 0 : null;
			case 'integer':
				return is_numeric( $value ) && floor( (float) $value ) === (float) $value ? (int) $value : null;
			case 'boolean':
				if ( is_bool( $value ) ) {
					return $value;
				}
				if ( in_array( $value, array( 1, 0, '1', '0', 'true', 'false' ), true ) ) {
					return in_array( $value, array( 1, '1', 'true' ), true );
				}
				return null;
			case 'array':
			case 'object':
				return is_array( $value ) ? $value : null;
		}
		return null;
	}

	/**
	 * Sanitize a string by its format.
	 *
	 * @param string $value  Value.
	 * @param string $format `plain`, `html`, `url`, `color`, `css` or `text`.
	 * @return string|null The value, or null for an invalid color.
	 */
	private static function format_string( $value, $format ) {
		switch ( $format ) {
			case 'text':
				// Text kept as typed, for values only ever printed escaped.
				return $value;
			case 'html':
				return wp_kses_post( $value );
			case 'url':
				return esc_url_raw( $value );
			case 'css':
				return self::strip_style_end( $value );
			case 'color':
				// A plain colour only: a value like `rgb(0);position:fixed)` would
				// add CSS declarations wherever an add-on prints it into `style`.
				$color = rtgodam_sanitize_css_color( $value );
				return '' !== $color ? $color : null;
		}
		return sanitize_text_field( $value );
	}

	/**
	 * CSS as written, without any `</style`, the only sequence that could end a
	 * `<style>` element it is printed in. Nothing else is touched: CSS uses `<`
	 * and `>` (`@media (width<=600px)`, `content: "<"`, child selectors), which
	 * an HTML tag stripper would cut off. The player applies layer CSS through
	 * `textContent`, which can't create markup either way.
	 *
	 * @param string $css CSS.
	 * @return string The CSS.
	 */
	private static function strip_style_end( $css ) {
		// Repeat until stable, so removing one `</style` can't join the text
		// around it into another (`</sty</stylele`).
		do {
			$before = $css;
			$css    = preg_replace( '#</style#i', '', $css );
		} while ( $css !== $before );
		return $css;
	}

	/**
	 * Whether a value already has one of its schema's types (any value, when the schema names none).
	 *
	 * @param mixed $value  Value.
	 * @param array $schema Schema.
	 * @return bool
	 */
	private static function has_declared_type( $value, $schema ) {
		$types = (array) ( $schema['type'] ?? array() );
		if ( empty( $types ) ) {
			return true;
		}
		foreach ( $types as $type ) {
			if ( self::is_type( $value, $type ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Whether a schema allows a type.
	 *
	 * @param array  $schema Schema.
	 * @param string $type   Type.
	 * @return bool
	 */
	private static function allows( $schema, $type ) {
		return in_array( $type, (array) ( $schema['type'] ?? array() ), true );
	}
}
