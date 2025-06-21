<?php
/**
 * Media Folders REST API class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Media_Library;

use RTGODAM\Inc\Traits\Singleton;

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

		add_action( 'added_term_relationship', array( $this, 'invalidate_folder_count_cache' ), 10, 3 );
		add_action( 'deleted_term_relationships', array( $this, 'invalidate_folder_count_cache' ), 10, 3 );
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
		$response->data['attachmentCount'] = (int) $this->get_term_attachment_count( $term->term_id );

		return $response;
	}

	/**
	 * Get the count of attachments in a media folder.
	 *
	 * Caches the count for a 15 day to improve performance.
	 *
	 * @param int $term_id The term ID of the media folder.
	 * @return int The count of attachments in the media folder.
	 */
	private function get_term_attachment_count( $term_id ) {

		$cache_key    = 'media_folder_count_' . $term_id;
		$cached_count = get_transient( $cache_key );

		if ( false !== $cached_count ) {
			return $cached_count;
		}

		$query = new \WP_Query(
			array(
				'post_type'      => 'attachment',
				'post_status'    => 'inherit',
				'fields'         => 'ids',
				'posts_per_page' => 1, // We only need count.
				'no_found_rows'  => false, // Important to get found_posts.
				'tax_query'      => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query,WordPress.DB.SlowDBQuery.slow_db_query_tax_query_no_cache
					array(
						'taxonomy'         => 'media-folder',
						'field'            => 'term_id',
						'terms'            => $term_id,
						'include_children' => false,
					),
				),
			)
		);

		if ( ! $query->have_posts() ) {
			return 0;
		}

		$attachment_count = (int) $query->found_posts;

		set_transient( $cache_key, $attachment_count, 15 * DAY_IN_SECONDS );

		return $attachment_count;
	}

	/**
	 * Invalidate the media folder count cache when attachments are added or removed.
	 *
	 * @param array  $object_ids The IDs of the objects being modified.
	 * @param int    $term_id    The term ID of the media folder.
	 * @param string $taxonomy   The taxonomy being modified.
	 */
	public function invalidate_folder_count_cache( $object_ids, $term_id, $taxonomy ) {
		if ( 'media-folder' !== $taxonomy ) {
			return;
		}

		// Invalidate the cache for this term.
		delete_transient( 'media_folder_count_' . $term_id );

		// Optionally, you can also invalidate the cache for all terms in this taxonomy.
		$terms = get_terms(
			array(
				'taxonomy'   => 'media-folder',
				'hide_empty' => false,
			)
		);

		foreach ( $terms as $term ) {
			delete_transient( 'media_folder_count_' . $term->term_id );
		}
	}
}
