<?php
/**
 * Media Folder Utilities class - Centralized helper functions for media folder operations.
 * 
 * @since 1.3.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Media_Library;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Media_Folder_Utils
 * 
 * @since 1.3.0
 */
class Media_Folder_Utils {

	use Singleton;

	/**
	 * Cache group for media folder operations
	 * 
	 * @since 1.3.0
	 */
	private const CACHE_GROUP = 'godam_media_folders';

	/**
	 * Default cache expiration time (15 days)
	 * 
	 * @since 1.3.0
	 */
	private const CACHE_EXPIRATION = 15 * DAY_IN_SECONDS;

	/**
	 * Get the count of attachments in a folder with caching
	 * 
	 * @since 1.3.0
	 *
	 * @param int  $folder_id - The ID of the media folder.
	 * @param bool $force_refresh - Whether to bypass cache and get fresh count.
	 * @return int - The count of attachments in the folder.
	 */
	public function get_attachment_count( $folder_id, $force_refresh = false ) {
		$folder_id = absint( $folder_id );

		if ( $folder_id <= 0 ) {
			return 0;
		}

		// Create a unique cache key for this folder.
		$cache_key = 'attachment_count_' . $folder_id;

		// Try to get cached count first (unless force refresh is requested).
		if ( ! $force_refresh ) {
			$cached_count = get_transient( $cache_key );

			if ( false !== $cached_count ) {
				return absint( $cached_count );
			}
		}

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Use direct SQL query for better performance.
		$count = $wpdb->get_var(
			$wpdb->prepare(
				"
			SELECT COUNT(DISTINCT p.ID)
			FROM {$wpdb->posts} p
			INNER JOIN {$wpdb->term_relationships} tr ON p.ID = tr.object_id
			INNER JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
			WHERE p.post_type = 'attachment'
			AND p.post_status = 'inherit'
			AND tt.taxonomy = 'media-folder'
			AND tt.term_id = %d
		",
				$folder_id
			)
		);

		$count = absint( $count );

		// Cache the result.
		set_transient( $cache_key, $count, self::CACHE_EXPIRATION );

		return $count;
	}

	/**
	 * Invalidate attachment count cache for a specific folder
	 * 
	 * @since 1.3.0
	 *
	 * @param int $folder_id - The ID of the media folder.
	 */
	public function invalidate_attachment_count_cache( $folder_id ) {
		$folder_id = absint( $folder_id );

		if ( $folder_id > 0 ) {
			$cache_key = 'attachment_count_' . $folder_id;
			delete_transient( $cache_key );
		}
	}

	/**
	 * Invalidate attachment count cache for multiple folders
	 * 
	 * @since 1.3.0
	 *
	 * @param array $folder_ids - An array of media folder IDs.
	 */
	public function invalidate_multiple_attachment_count_cache( $folder_ids ) {
		if ( empty( $folder_ids ) || ! is_array( $folder_ids ) ) {
			return;
		}

		foreach ( $folder_ids as $folder_id ) {
			$folder_id = absint( $folder_id );
			if ( $folder_id > 0 ) {
				$this->invalidate_attachment_count_cache( $folder_id );
			}
		}
	}

	/**
	 * Clear all attachment count caches
	 * Useful for bulk operations or when you want to force refresh all counts
	 * 
	 * @since 1.3.0
	 */
	public function clear_all_attachment_count_caches() {
		global $wpdb;

		// Get all transient keys related to attachment counts.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct SQL query to fetch transient keys.
		$transient_keys = $wpdb->get_col(
			"SELECT option_name FROM {$wpdb->options}
			WHERE option_name LIKE '_transient_attachment_count_%'"
		);

		foreach ( $transient_keys as $key ) {
			$transient_name = str_replace( '_transient_', '', $key );
			delete_transient( $transient_name );
		}
	}

	/**
	 * Check if a folder exists and is valid
	 * 
	 * @since 1.3.0
	 *
	 * @param int $folder_id - The ID of the media folder.
	 * @return bool - Whether the folder exists and is valid.
	 */
	public function is_valid_folder( $folder_id ) {
		$folder_id = absint( $folder_id );

		if ( $folder_id <= 0 ) {
			return false;
		}

		$term = get_term( $folder_id, 'media-folder' );

		return ! is_wp_error( $term ) && ! empty( $term );
	}

	/**
	 * Get folder information with attachment count
	 * 
	 * @since 1.3.0
	 *
	 * @param int  $folder_id - The ID of the media folder.
	 * @param bool $force_refresh - Whether to bypass cache for the count.
	 * @return array|\WP_Error - Folder information with count, or WP_Error on failure.
	 */
	public function get_folder_info( $folder_id, $force_refresh = false ) {
		$folder_id = absint( $folder_id );

		if ( $folder_id <= 0 ) {
			return new \WP_Error( 'invalid_folder_id', __( 'Invalid folder ID provided.', 'godam' ) );
		}

		$term = get_term( $folder_id, 'media-folder' );

		if ( is_wp_error( $term ) || empty( $term ) ) {
			return new \WP_Error( 'folder_not_found', __( 'Media folder not found.', 'godam' ) );
		}

		$attachment_count = $this->get_attachment_count( $folder_id, $force_refresh );

		return array(
			'id'               => $term->term_id,
			'name'             => $term->name,
			'slug'             => $term->slug,
			'description'      => $term->description,
			'attachment_count' => $attachment_count,
			'parent'           => $term->parent,
		);
	}
}
