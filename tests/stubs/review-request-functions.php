<?php
/**
 * Narrow WordPress stubs for ReviewRequestTest.
 *
 * Each stub reads or writes `$GLOBALS['rtgodam_stub']`, matching the convention in
 * bootstrap.php. They are only loaded by ReviewRequestTest, which runs in separate
 * processes, so they do not leak into other tests.
 *
 * Keys used:
 * - screen_id, is_network_admin, user_id, caps (see current_user_can in bootstrap.php)
 * - user_meta: array( user id => array( key => value ) ), read and written by the stubs
 * - options: read by the get_option() stub, written by add_option() here
 * - finished_video_ids: what the video lookup would return
 * - wp_query_args: the args of the last WP_Query, for assertions
 * - nonce_ok: whether check_ajax_referer() passes
 * - json: the last wp_send_json_* call, array( 'success', 'data', 'status' )
 *
 * @package GoDAM
 */

// phpcs:disable Universal.Files.SeparateFunctionsFromOO.Mixed, Generic.Files.OneObjectStructurePerFile.MultipleFound, WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedClassFound -- test stubs mirroring WordPress, in one file.

if ( ! class_exists( 'Rtgodam_Json_Done' ) ) {

	/**
	 * Thrown by the wp_send_json_* and check_ajax_referer() stubs, standing in for wp_die().
	 */
	class Rtgodam_Json_Done extends \Exception {}
}

if ( ! function_exists( 'is_network_admin' ) ) {

	/**
	 * @return bool
	 */
	function is_network_admin() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return ! empty( $GLOBALS['rtgodam_stub']['is_network_admin'] );
	}
}

if ( ! function_exists( 'get_current_screen' ) ) {

	/**
	 * @return object|null
	 */
	function get_current_screen() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return isset( $GLOBALS['rtgodam_stub']['screen_id'] ) ? (object) array( 'id' => $GLOBALS['rtgodam_stub']['screen_id'] ) : null;
	}
}

if ( ! function_exists( 'get_current_user_id' ) ) {

	/**
	 * @return int
	 */
	function get_current_user_id() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return (int) ( $GLOBALS['rtgodam_stub']['user_id'] ?? 0 );
	}
}

if ( ! function_exists( 'get_user_meta' ) ) {

	/**
	 * @param int    $user_id User ID.
	 * @param string $key     Meta key.
	 * @param bool   $single  Ignored.
	 * @return mixed '' when unset, as in core.
	 */
	function get_user_meta( $user_id, $key = '', $single = false ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- stub mirroring the WP function.
		return $GLOBALS['rtgodam_stub']['user_meta'][ $user_id ][ $key ] ?? '';
	}
}

if ( ! function_exists( 'update_user_meta' ) ) {

	/**
	 * @param int    $user_id User ID.
	 * @param string $key     Meta key.
	 * @param mixed  $value   Value.
	 * @return true
	 */
	function update_user_meta( $user_id, $key, $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['user_meta'][ $user_id ][ $key ] = $value;
		return true;
	}
}

if ( ! function_exists( 'add_option' ) ) {

	/**
	 * @param string $option Option name.
	 * @param mixed  $value  Value.
	 * @return true
	 */
	function add_option( $option, $value = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['options'][ $option ] = $value;
		return true;
	}
}

if ( ! function_exists( 'check_ajax_referer' ) ) {

	/**
	 * @param string $action    Nonce action.
	 * @param string $query_arg Ignored.
	 * @return int
	 * @throws \Rtgodam_Json_Done Like wp_die(), when the nonce is bad.
	 */
	function check_ajax_referer( $action, $query_arg = false ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- stub mirroring the WP function.
		if ( empty( $GLOBALS['rtgodam_stub']['nonce_ok'] ) ) {
			$GLOBALS['rtgodam_stub']['json'] = array(
				'success' => false,
				'data'    => '-1',
				'status'  => 403,
			);
			throw new \Rtgodam_Json_Done();
		}
		return 1;
	}
}

if ( ! function_exists( 'wp_send_json_success' ) ) {

	/**
	 * @param mixed $data   Data.
	 * @param int   $status Status code.
	 * @return void
	 * @throws \Rtgodam_Json_Done Like wp_die().
	 */
	function wp_send_json_success( $data = null, $status = 200 ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['json'] = array(
			'success' => true,
			'data'    => $data,
			'status'  => $status,
		);
		throw new \Rtgodam_Json_Done();
	}
}

if ( ! function_exists( 'wp_send_json_error' ) ) {

	/**
	 * @param mixed $data   Data.
	 * @param int   $status Status code.
	 * @return void
	 * @throws \Rtgodam_Json_Done Like wp_die().
	 */
	function wp_send_json_error( $data = null, $status = 200 ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['json'] = array(
			'success' => false,
			'data'    => $data,
			'status'  => $status,
		);
		throw new \Rtgodam_Json_Done();
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {

	/**
	 * @param string $key Key.
	 * @return string
	 */
	function sanitize_key( $key ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) );
	}
}

if ( ! function_exists( 'wp_unslash' ) ) {

	/**
	 * @param mixed $value Value.
	 * @return mixed
	 */
	function wp_unslash( $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return $value;
	}
}

if ( ! function_exists( 'wp_create_nonce' ) ) {

	/**
	 * @param string $action Nonce action.
	 * @return string
	 */
	function wp_create_nonce( $action ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return 'nonce-for-' . $action;
	}
}

if ( ! function_exists( 'admin_url' ) ) {

	/**
	 * @param string $path Path.
	 * @return string
	 */
	function admin_url( $path = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return 'https://example.test/wp-admin/' . $path;
	}
}

if ( ! function_exists( 'esc_html_e' ) ) {

	/**
	 * @param string $text   Text.
	 * @param string $domain Text domain.
	 * @return void
	 */
	function esc_html_e( $text, $domain = 'default' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		echo esc_html__( $text, $domain ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped by the stub above.
	}
}

if ( ! function_exists( 'wp_print_inline_script_tag' ) ) {

	/**
	 * @param string $javascript Script body.
	 * @param array  $attributes Tag attributes.
	 * @return void
	 */
	function wp_print_inline_script_tag( $javascript, $attributes = array() ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$id = isset( $attributes['id'] ) ? ' id="' . $attributes['id'] . '"' : '';
		echo '<script' . $id . '>' . $javascript . '</script>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- test stub.
	}
}

if ( ! class_exists( 'WP_Query' ) ) {

	/**
	 * Records its args and returns the ids the test set, capped like the real LIMIT.
	 */
	class WP_Query {

		/**
		 * @var int[]
		 */
		public $posts = array();

		/**
		 * @param array $args Query args.
		 * @throws \RuntimeException When the test asks the lookup to fail.
		 */
		public function __construct( $args = array() ) {
			$GLOBALS['rtgodam_stub']['wp_query_args'] = $args;
			$GLOBALS['rtgodam_stub']['lookup_log'][]  = 'query';

			if ( ! empty( $GLOBALS['rtgodam_stub']['query_throws'] ) ) {
				throw new \RuntimeException( 'lookup failed' );
			}

			$this->posts = array_slice( $GLOBALS['rtgodam_stub']['finished_video_ids'] ?? array(), 0, (int) $args['posts_per_page'] );
		}
	}
}

// phpcs:enable
