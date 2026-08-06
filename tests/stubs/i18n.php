<?php
/**
 * Translation and escaping stubs that record every translation call.
 *
 * `$GLOBALS['rtgodam_translated']` collects the text passed to each translation
 * function. That turns "does this code translate before `init`?" into an
 * assertion about an array rather than a regex over the source, which is the
 * whole point of the #465 guards: any new `__()` on an early path shows up here,
 * including one added inside a function the guards never mention by name.
 *
 * @package GoDAM
 */

if ( ! isset( $GLOBALS['rtgodam_translated'] ) ) {
	$GLOBALS['rtgodam_translated'] = array();
}

if ( ! function_exists( '__' ) ) {

	/**
	 * @param string $text   Text to translate.
	 * @param string $domain Text domain.
	 *
	 * @return string
	 */
	function __( $text, $domain = 'default' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_translated'][] = array(
			'text'   => $text,
			'domain' => $domain,
		);
		return $text;
	}
}

if ( ! function_exists( 'esc_html__' ) ) {

	/**
	 * @param string $text   Text to translate.
	 * @param string $domain Text domain.
	 *
	 * @return string
	 */
	function esc_html__( $text, $domain = 'default' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return htmlspecialchars( __( $text, $domain ), ENT_QUOTES, 'UTF-8' );
	}
}

if ( ! function_exists( 'esc_attr__' ) ) {

	/**
	 * @param string $text   Text to translate.
	 * @param string $domain Text domain.
	 *
	 * @return string
	 */
	function esc_attr__( $text, $domain = 'default' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return esc_html__( $text, $domain );
	}
}

if ( ! function_exists( '_x' ) ) {

	/**
	 * @param string $text    Text to translate.
	 * @param string $context Context. Unused.
	 * @param string $domain  Text domain.
	 *
	 * @return string
	 */
	function _x( $text, $context, $domain = 'default' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found -- stub mirroring the WP function.
		return __( $text, $domain );
	}
}

if ( ! function_exists( 'esc_html' ) ) {

	/**
	 * Escaping only — deliberately not recorded, since it does not translate.
	 *
	 * @param string $text Text to escape.
	 *
	 * @return string
	 */
	function esc_html( $text ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
	}
}

if ( ! function_exists( 'esc_attr' ) ) {

	/**
	 * @param string $text Text to escape.
	 *
	 * @return string
	 */
	function esc_attr( $text ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return esc_html( $text );
	}
}

if ( ! function_exists( 'wp_kses_post' ) ) {

	/**
	 * @param string $data Content to filter.
	 *
	 * @return string
	 */
	function wp_kses_post( $data ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return (string) $data;
	}
}
