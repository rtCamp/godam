<?php
/**
 * Media Folders REST API class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Media_Library;

use RTGODAM\Inc\Traits\Singleton;
use RTGODAM\Inc\Taxonomies\Media_Folders;

defined( 'ABSPATH' ) || exit;

/**
 * Class Media_Folders_REST_API
 */
class Media_Folders_REST_API {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks for the class.
	 */
	private function setup_hooks() {
		add_filter( 'rest_prepare_media-folder', array( $this, 'add_data_to_media_folder_rest_api' ), 10, 2 );

		add_action( 'set_object_terms', array( $this, 'invalidate_attachment_count_cache' ), 10, 4 );
		add_action( 'deleted_term_relationships', array( $this, 'invalidate_all_attachment_count_cache' ), 10, 3 );
	}

	/**
	 * Add additional data to the media folder REST API response.
	 *
	 * @param \WP_REST_Response $response The response object.
	 * @param \WP_Term          $term     The term object.
	 * @return \WP_REST_Response
	 */
	public function add_data_to_media_folder_rest_api( $response, $term ) {
		// Add the attachment count to the response.
		$response->data['attachmentCount'] = (int) Media_Folder_Utils::get_instance()->get_attachment_count( $term->term_id );

		return $response;
	}

	/**
	 * Invalidate the attachment count cache when attachments are added or removed from a media folder.
	 *
	 * @param int    $object_id  Object ID.
	 * @param array  $terms      An array of object term IDs or slugs.
	 * @param array  $tt_ids     An array of term taxonomy IDs.
	 * @param string $taxonomy   Taxonomy slug.
	 */
	public function invalidate_attachment_count_cache( $object_id, $terms, $tt_ids, $taxonomy ) {

		if ( 'media-folder' === $taxonomy ) {
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
	 * @param int    $object_id The term ID.
	 * @param array  $tt_ids  An array of term taxonomy IDs.
	 * @param string $taxonomy The taxonomy slug.
	 */
	public function invalidate_all_attachment_count_cache( $object_id, $tt_ids, $taxonomy ) {
		// TODO: Cache invalidation logic can be optimized to only clear the specific folder's cache.
		// For now, we clear all caches for the media folders taxonomy.
		// That is because the invalidation logic when folder is removed from an attachment is tricky.
		if ( 'media-folder' === $taxonomy ) {
			Media_Folder_Utils::get_instance()->clear_all_attachment_count_caches();
		}
	}
}
