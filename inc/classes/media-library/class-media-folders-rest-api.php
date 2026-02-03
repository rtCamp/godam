<?php
/**
 * Media Folders REST API class.
 *
 * @since 1.3.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Media_Library;

use RTGODAM\Inc\Traits\Singleton;
use RTGODAM\Inc\Taxonomies\Media_Folders;

defined( 'ABSPATH' ) || exit;

/**
 * Class Media_Folders_REST_API
 *
 * @since 1.3.0
 */
class Media_Folders_REST_API {

	use Singleton;

	/**
	 * Construct method.
	 *
	 * @since 1.3.0
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks for the class.
	 *
	 * @since 1.3.0
	 */
	private function setup_hooks() {
		add_action( 'set_object_terms', array( $this, 'invalidate_attachment_count_cache' ), 10, 4 );
		add_action( 'delete_term_relationships', array( $this, 'invalidate_attachment_cache_on_delete_relationship' ), 10, 3 );
		add_action( 'godam_attachment_added', array( $this, 'invalidate_all_attachment_caches' ), 10, 1 );
		add_action( 'godam_attachment_deleted', array( $this, 'invalidate_all_attachment_caches' ), 10, 1 );

		add_action( 'godam_cleanup_zip', array( $this, 'godam_cleanup_zip_file' ), 10, 1 );
	}

	/**
	 * Invalidate the attachment count cache when attachments are added or removed from a media folder.
	 *
	 * @since 1.3.0
	 *
	 * @param int    $object_id  Object ID.
	 * @param array  $terms      An array of object term IDs or slugs.
	 * @param array  $tt_ids     An array of term taxonomy IDs.
	 * @param string $taxonomy   Taxonomy slug.
	 */
	public function invalidate_attachment_count_cache( $object_id, $terms, $tt_ids, $taxonomy ) {
		if ( Media_Folders::SLUG === $taxonomy ) {
			// Filter term IDs to ensure they're integers (not slugs).
			$term_ids = array_filter( $terms, 'is_numeric' );
			$term_ids = array_map( 'intval', $term_ids );

			// Invalidate cache for each term ID.
			foreach ( $term_ids as $term_id ) {
				Media_Folder_Utils::get_instance()->invalidate_attachment_count_cache( $term_id );
			}
		}
	}

	/**
	 * Invalidate all attachment count caches when a term is deleted.
	 *
	 * @since 1.3.0
	 *
	 * @param int    $object_id The term ID.
	 * @param array  $tt_ids  An array of term taxonomy IDs.
	 * @param string $taxonomy The taxonomy slug.
	 */
	public function invalidate_attachment_cache_on_delete_relationship( $object_id, $tt_ids, $taxonomy ) {
		// Only process if it's the media-folder taxonomy.
		if ( Media_Folders::SLUG !== $taxonomy ) {
			return;
		}

		// Ensure $tt_ids is an array.
		if ( ! is_array( $tt_ids ) ) {
			$tt_ids = array( $tt_ids );
		}

		// Get term IDs from term taxonomy IDs.
		$term_ids = array();

		foreach ( $tt_ids as $tt_id ) {
			$term_taxonomy = get_term_by( 'term_taxonomy_id', $tt_id );

			if ( $term_taxonomy && ! is_wp_error( $term_taxonomy ) ) {
				$term_ids[] = $term_taxonomy->term_id;
			}
		}

		// Invalidate cache for specific terms only.
		if ( ! empty( $term_ids ) ) {
			Media_Folder_Utils::get_instance()->invalidate_multiple_attachment_count_cache( $term_ids );
		}
	}

	/**
	 * Invalidate all attachment count caches when a new attachment is added.
	 *
	 * This ensures that folder counts are refreshed in the React components
	 * when new media is uploaded.
	 *
	 * @since 1.4.0
	 *
	 * @param int $attachment_id The ID of the newly added attachment.
	 */
	public function invalidate_all_attachment_caches( $attachment_id ) {
		// Get all media folder terms to invalidate their caches.
		$folder_terms = wp_get_object_terms(
			$attachment_id,
			Media_Folders::SLUG,
			array( 'fields' => 'ids' )
		);

		if ( ! is_wp_error( $folder_terms ) && ! empty( $folder_terms ) ) {
			Media_Folder_Utils::get_instance()->invalidate_multiple_attachment_count_cache( $folder_terms );
		}

		// Also invalidate the general attachment count (for unorganized files).
		Media_Folder_Utils::get_instance()->invalidate_attachment_count_cache( -1 );
	}

	/**
	 * Clean up the ZIP file after download.
	 *
	 * This method is called via an action hook to ensure that the ZIP file is deleted
	 * after it has been downloaded, preventing unnecessary storage usage.
	 *
	 * @since 1.3.0
	 *
	 * @param string $zip_path The path to the ZIP file to be cleaned up.
	 */
	public function godam_cleanup_zip_file( $zip_path ) {
		Media_Folder_Create_Zip::get_instance()->godam_cleanup_zip_file( $zip_path );
	}
}
