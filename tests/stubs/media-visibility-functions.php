<?php
/**
 * Narrow WordPress stubs for the media visibility tests (MediaVisibilityTest).
 *
 * Posts, post meta and capabilities come from `$GLOBALS['rtgodam_stub']`, which each
 * test resets: `posts` (ID => WP_Post), `post_meta_by_id` (ID => key => value),
 * `caps` (a capability, or "edit_post:42" for one object), `unlocked` (IDs of
 * password-protected posts the visitor has entered the password for) and
 * `wpdb_rows` (the rows the next $wpdb->get_results() returns). Writes to post meta
 * are recorded in `meta_writes`, so a test can assert that a read wrote nothing.
 *
 * @package GoDAM
 */

// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Universal.Files.SeparateFunctionsFromOO.Mixed, Generic.Files.OneObjectStructurePerFile.MultipleFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- test stubs mirroring WP APIs.

if ( ! function_exists( 'get_current_blog_id' ) ) {

	/**
	 * @return int
	 */
	function get_current_blog_id() {
		return 1;
	}
}

if ( ! function_exists( 'get_post_status' ) ) {

	/**
	 * @param object $post Post.
	 * @return string|false
	 */
	function get_post_status( $post = null ) {
		return is_object( $post ) ? $post->post_status : false;
	}
}

if ( ! function_exists( 'is_post_status_viewable' ) ) {

	/**
	 * Only "publish" is viewable, plus any status a test lists in `viewable_statuses`.
	 *
	 * @param string $status Post status.
	 * @return bool
	 */
	function is_post_status_viewable( $status ) {
		$viewable = array_merge( array( 'publish' ), $GLOBALS['rtgodam_stub']['viewable_statuses'] ?? array() );

		return in_array( $status, $viewable, true );
	}
}

if ( ! function_exists( 'get_post_stati' ) ) {

	/**
	 * @return string[] Status names, keyed by name.
	 */
	function get_post_stati() {
		$statuses = array( 'publish', 'future', 'draft', 'pending', 'private', 'trash', 'auto-draft', 'inherit' );

		return array_combine( $statuses, $statuses );
	}
}

if ( ! function_exists( 'post_password_required' ) ) {

	/**
	 * True for a post with a password the visitor has not entered.
	 *
	 * @param object $post Post.
	 * @return bool
	 */
	function post_password_required( $post = null ) {
		return is_object( $post )
			&& '' !== (string) $post->post_password
			&& ! in_array( (int) $post->ID, $GLOBALS['rtgodam_stub']['unlocked'] ?? array(), true );
	}
}

if ( ! function_exists( 'maybe_unserialize' ) ) {

	/**
	 * @param mixed $value Value.
	 * @return mixed
	 */
	function maybe_unserialize( $value ) {
		return is_string( $value ) ? @unserialize( $value ) : $value; // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.PHP.DiscouragedPHPFunctions.serialize_unserialize -- test stub.
	}
}

if ( ! function_exists( 'esc_html_e' ) ) {

	/**
	 * @param string $text   Text.
	 * @param string $domain Text domain.
	 * @return void
	 */
	function esc_html_e( $text, $domain = 'default' ) {
		echo esc_html__( $text, $domain ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by the stub it calls.
	}
}

if ( ! function_exists( 'rest_url' ) ) {

	/**
	 * @param string $path Path.
	 * @return string
	 */
	function rest_url( $path = '' ) {
		return 'https://example.test/wp-json/' . ltrim( (string) $path, '/' );
	}
}

if ( ! function_exists( 'rest_ensure_response' ) ) {

	/**
	 * @param mixed $data Data.
	 * @return WP_REST_Response
	 */
	function rest_ensure_response( $data ) {
		return new WP_REST_Response( $data );
	}
}

if ( ! function_exists( 'register_rest_field' ) ) {

	/**
	 * Records the field, so a test can call its callbacks.
	 *
	 * @param string $object_type Object type.
	 * @param string $name        Field name.
	 * @param array  $args        Field arguments.
	 * @return void
	 */
	function register_rest_field( $object_type, $name, $args = array() ) {
		$GLOBALS['rtgodam_stub']['rest_fields'][ $object_type ][ $name ] = $args;
	}
}

if ( ! function_exists( 'register_post_meta' ) ) {

	/**
	 * @return bool
	 */
	function register_post_meta() {
		return true;
	}
}

if ( ! function_exists( 'is_singular' ) ) {

	/**
	 * @return bool True unless a test sets `is_singular` to false.
	 */
	function is_singular() {
		return $GLOBALS['rtgodam_stub']['is_singular'] ?? true;
	}
}

if ( ! function_exists( 'is_feed' ) ) {

	/**
	 * @return bool
	 */
	function is_feed() {
		return false;
	}
}

if ( ! function_exists( 'get_queried_object_id' ) ) {

	/**
	 * @return int
	 */
	function get_queried_object_id() {
		return (int) ( $GLOBALS['rtgodam_stub']['queried_object_id'] ?? 0 );
	}
}

if ( ! function_exists( 'add_post_meta' ) ) {

	/**
	 * Records the write.
	 *
	 * @param int    $post_id Post ID.
	 * @param string $key     Meta key.
	 * @param mixed  $value   Value.
	 * @return int
	 */
	function add_post_meta( $post_id, $key, $value ) {
		$GLOBALS['rtgodam_stub']['meta_writes'][ $key ] = $value;
		return 1;
	}
}

if ( ! function_exists( 'delete_post_meta' ) ) {

	/**
	 * Records the write.
	 *
	 * @param int    $post_id Post ID.
	 * @param string $key     Meta key.
	 * @return bool
	 */
	function delete_post_meta( $post_id, $key ) {
		$GLOBALS['rtgodam_stub']['meta_writes'][ $key ] = null;
		return true;
	}
}

if ( ! class_exists( 'wpdb' ) ) {

	/**
	 * Just the parts the media visibility SQL uses. prepare() substitutes %s and %d;
	 * get_results() returns `wpdb_rows` and records the query in `wpdb_queries`.
	 */
	// phpcs:ignore PEAR.NamingConventions.ValidClassName.StartWithCapital -- mirrors core's class name.
	class wpdb {

		/**
		 * @var string
		 */
		public $posts = 'wp_posts';

		/**
		 * @var string
		 */
		public $postmeta = 'wp_postmeta';

		/**
		 * @param string $query Query with %s / %d placeholders.
		 * @param mixed  ...$args Values, or one array of them.
		 * @return string
		 */
		public function prepare( $query, ...$args ) {
			if ( isset( $args[0] ) && is_array( $args[0] ) ) {
				$args = $args[0];
			}

			$index = 0;

			return preg_replace_callback(
				'/%[sd]/',
				static function ( $placeholder ) use ( &$args, &$index ) {
					$value = $args[ $index++ ];

					return '%d' === $placeholder[0] ? (string) (int) $value : "'" . addslashes( (string) $value ) . "'";
				},
				$query
			);
		}

		/**
		 * @param string $text Text.
		 * @return string
		 */
		public function esc_like( $text ) {
			return addcslashes( $text, '_%\\' );
		}

		/**
		 * @param string $query Query.
		 * @return array
		 */
		public function get_results( $query ) {
			$GLOBALS['rtgodam_stub']['wpdb_queries'][] = $query;

			return $GLOBALS['rtgodam_stub']['wpdb_rows'] ?? array();
		}
	}
}
