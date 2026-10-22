<?php
/**
 * Narrow term and REST stubs for the media-folder lock tests.
 *
 * They answer from `$GLOBALS['rtgodam_stub']`, matching the convention in bootstrap.php:
 *  - `terms`        term id => object( term_id, taxonomy, parent, name, slug, description );
 *  - `term_meta`    term id => array( meta key => value );
 *  - `object_terms` object id => list of term ids;
 *  - `user`         set for a signed-in user, unset for a logged-out visitor.
 *
 * All guarded so a real WP test bootstrap that already defines these wins.
 *
 * @package GoDAM
 */

if ( ! function_exists( 'get_term' ) ) {

	/**
	 * @param int    $term_id  Term ID.
	 * @param string $taxonomy Taxonomy the term must belong to; any when empty.
	 * @return object|null The stubbed term, or null when there is none.
	 */
	function get_term( $term_id, $taxonomy = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$term = $GLOBALS['rtgodam_stub']['terms'][ (int) $term_id ] ?? null;

		if ( $term && '' !== $taxonomy && $taxonomy !== $term->taxonomy ) {
			return null;
		}

		return $term;
	}
}

if ( ! function_exists( 'get_term_meta' ) ) {

	/**
	 * @param int    $term_id Term ID.
	 * @param string $key     Meta key.
	 * @param bool   $single  Ignored; always single-value semantics.
	 * @return mixed The stubbed value, or '' when there is none.
	 */
	function get_term_meta( $term_id, $key = '', $single = false ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- stub mirroring the WP function.
		$meta = $GLOBALS['rtgodam_stub']['term_meta'][ (int) $term_id ] ?? array();

		return array_key_exists( $key, $meta ) ? $meta[ $key ] : '';
	}
}

if ( ! function_exists( 'get_ancestors' ) ) {

	/**
	 * @param int    $object_id     Term ID.
	 * @param string $object_type   Ignored.
	 * @param string $resource_type Ignored.
	 * @return int[] Parent IDs, nearest first.
	 */
	function get_ancestors( $object_id, $object_type = '', $resource_type = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- stub mirroring the WP function.
		$ancestors = array();
		$term      = get_term( $object_id );

		while ( $term && $term->parent > 0 && ! in_array( (int) $term->parent, $ancestors, true ) ) {
			$ancestors[] = (int) $term->parent;
			$term        = get_term( $term->parent );
		}

		return $ancestors;
	}
}

if ( ! function_exists( 'wp_get_object_terms' ) ) {

	/**
	 * @param int          $object_id Object ID.
	 * @param string|array $taxonomy  Ignored.
	 * @param array        $args      Ignored; term IDs are always returned.
	 * @return int[]
	 */
	function wp_get_object_terms( $object_id, $taxonomy = '', $args = array() ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- stub mirroring the WP function.
		return $GLOBALS['rtgodam_stub']['object_terms'][ (int) $object_id ] ?? array();
	}
}

if ( ! function_exists( 'get_taxonomy' ) ) {

	/**
	 * @param string $taxonomy Taxonomy slug.
	 * @return object The taxonomy, with its REST base set to its slug.
	 */
	function get_taxonomy( $taxonomy ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return (object) array(
			'name'      => $taxonomy,
			'rest_base' => $taxonomy,
		);
	}
}

if ( ! function_exists( 'rest_get_route_for_taxonomy_items' ) ) {

	/**
	 * @param string $taxonomy Taxonomy slug.
	 * @return string The core namespace plus the slug, as core builds it.
	 */
	function rest_get_route_for_taxonomy_items( $taxonomy ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return '/wp/v2/' . $taxonomy;
	}
}

if ( ! function_exists( 'rest_authorization_required_code' ) ) {

	/**
	 * @return int 403 for a signed-in user, 401 for a visitor.
	 */
	function rest_authorization_required_code() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return is_user_logged_in() ? 403 : 401;
	}
}
