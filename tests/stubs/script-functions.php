<?php
/**
 * Minimal script-registry stubs that record what was registered, enqueued and
 * added inline, in `$GLOBALS['rtgodam_scripts']`.
 *
 * Shape: `{ registered: string[], enqueued: string[], inline: array<string, string[]> }`.
 *
 * @package GoDAM
 */

// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter -- stubs mirroring the WP functions.

if ( ! function_exists( 'rtgodam_scripts_stub' ) ) {

	/**
	 * The recorded script state, created on first use.
	 *
	 * @return array
	 */
	function &rtgodam_scripts_stub() {
		if ( ! isset( $GLOBALS['rtgodam_scripts'] ) ) {
			$GLOBALS['rtgodam_scripts'] = array(
				'registered' => array(),
				'enqueued'   => array(),
				'inline'     => array(),
			);
		}

		return $GLOBALS['rtgodam_scripts'];
	}
}

if ( ! function_exists( 'wp_register_script' ) ) {

	function wp_register_script( $handle, $src = '', $deps = array(), $ver = false, $args = array() ) {
		$scripts                 = &rtgodam_scripts_stub();
		$scripts['registered'][] = $handle;

		return true;
	}
}

if ( ! function_exists( 'wp_enqueue_script' ) ) {

	function wp_enqueue_script( $handle, $src = '', $deps = array(), $ver = false, $args = array() ) {
		$scripts               = &rtgodam_scripts_stub();
		$scripts['enqueued'][] = $handle;
	}
}

if ( ! function_exists( 'wp_add_inline_script' ) ) {

	function wp_add_inline_script( $handle, $data, $position = 'after' ) {
		$scripts                        = &rtgodam_scripts_stub();
		$scripts['inline'][ $handle ][] = $data;

		return true;
	}
}

if ( ! function_exists( 'wp_script_is' ) ) {

	function wp_script_is( $handle, $status = 'enqueued' ) {
		$scripts = &rtgodam_scripts_stub();
		$list    = 'registered' === $status ? $scripts['registered'] : $scripts['enqueued'];

		return in_array( $handle, $list, true );
	}
}

if ( ! function_exists( 'wp_set_script_translations' ) ) {

	function wp_set_script_translations( $handle, $domain = 'default', $path = '' ) {
		$scripts                            = &rtgodam_scripts_stub();
		$scripts['translations'][ $handle ] = array(
			'domain' => $domain,
			'path'   => $path,
		);

		return true;
	}
}

if ( ! function_exists( 'rtgodam_styles_stub' ) ) {

	/**
	 * The recorded style state, created on first use.
	 *
	 * Shape: `{ registered: array<string, array{src: string, ver: mixed}>, enqueued: string[], data: array<string, array> }`.
	 *
	 * @return array
	 */
	function &rtgodam_styles_stub() {
		if ( ! isset( $GLOBALS['rtgodam_styles'] ) ) {
			$GLOBALS['rtgodam_styles'] = array(
				'registered' => array(),
				'enqueued'   => array(),
				'data'       => array(),
			);
		}

		return $GLOBALS['rtgodam_styles'];
	}
}

if ( ! function_exists( 'wp_register_style' ) ) {

	function wp_register_style( $handle, $src, $deps = array(), $ver = false, $media = 'all' ) {
		$styles                          = &rtgodam_styles_stub();
		$styles['registered'][ $handle ] = array(
			'src' => $src,
			'ver' => $ver,
		);

		return true;
	}
}

if ( ! function_exists( 'wp_enqueue_style' ) ) {

	function wp_enqueue_style( $handle, $src = '', $deps = array(), $ver = false, $media = 'all' ) {
		$styles               = &rtgodam_styles_stub();
		$styles['enqueued'][] = $handle;
	}
}

if ( ! function_exists( 'wp_style_add_data' ) ) {

	function wp_style_add_data( $handle, $key, $value ) {
		$styles                            = &rtgodam_styles_stub();
		$styles['data'][ $handle ][ $key ] = $value;

		return true;
	}
}
