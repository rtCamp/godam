<?php
/**
 * Maps WordPress `media-folder` terms to GoDAM Central `GoDAM File Label` ids.
 *
 * The link between a WordPress media folder and its GoDAM Central folder is stored
 * as the `_godam_folder_id` term meta (registered in Media_Folders). This helper is
 * the single seam every sync operation goes through, so the meta key and its lookup
 * logic live in one place instead of being scattered across the folder CRUD hooks,
 * the upload payload, and the reconcile job.
 *
 * The mapping is server-managed. The term meta is out of REST and write-denied, so
 * the only writers are the sync layer through set_central_id()/clear() below.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Media_Library;

use RTGODAM\Inc\Traits\Singleton;
use RTGODAM\Inc\Taxonomies\Media_Folders;

defined( 'ABSPATH' ) || exit;

/**
 * Class Folder_Sync_Map
 */
class Folder_Sync_Map {

	use Singleton;

	/**
	 * Term meta key holding the GoDAM Central `GoDAM File Label` id.
	 *
	 * Kept in sync with the meta registered in Media_Folders::register_term_meta().
	 *
	 * @var string
	 */
	const META_KEY = '_godam_folder_id';

	/**
	 * Get the Central File Label id mapped to a WordPress term.
	 *
	 * @param int $term_id WordPress `media-folder` term id.
	 *
	 * @return string|null Central File Label id, or null when the term is unmapped.
	 */
	public function get_central_id( $term_id ) {
		$value = get_term_meta( (int) $term_id, self::META_KEY, true );

		return ( is_string( $value ) && '' !== $value ) ? $value : null;
	}

	/**
	 * Store the WordPress term to Central mapping.
	 *
	 * Server-side only — the meta is not writable through REST.
	 *
	 * @param int    $term_id    WordPress `media-folder` term id.
	 * @param string $central_id GoDAM Central `GoDAM File Label` id (docname).
	 *
	 * @return void
	 */
	public function set_central_id( $term_id, $central_id ) {
		$central_id = sanitize_text_field( (string) $central_id );

		if ( '' === $central_id ) {
			return;
		}

		update_term_meta( (int) $term_id, self::META_KEY, $central_id );
	}

	/**
	 * Reverse lookup: find the WordPress term mapped to a Central File Label id.
	 *
	 * @param string $central_id GoDAM Central `GoDAM File Label` id (docname).
	 *
	 * @return int|null WordPress `media-folder` term id, or null when none is mapped.
	 */
	public function get_term_id_by_central_id( $central_id ) {
		$central_id = sanitize_text_field( (string) $central_id );

		if ( '' === $central_id ) {
			return null;
		}

		$terms = get_terms(
			array(
				'taxonomy'   => Media_Folders::SLUG,
				'hide_empty' => false,
				'number'     => 1,
				'fields'     => 'ids',
				'meta_key'   => self::META_KEY,   // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				'meta_value' => $central_id,      // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
			)
		);

		if ( is_wp_error( $terms ) || empty( $terms ) ) {
			return null;
		}

		return (int) $terms[0];
	}

	/**
	 * Remove the mapping from a WordPress term.
	 *
	 * @param int $term_id WordPress `media-folder` term id.
	 *
	 * @return void
	 */
	public function clear( $term_id ) {
		delete_term_meta( (int) $term_id, self::META_KEY );
	}
}
