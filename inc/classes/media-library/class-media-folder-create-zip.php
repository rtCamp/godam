<?php
/**
 * Media Folders REST API class - Optimized with batch processing.
 *
 * @since 1.3.0
 * 
 * @package GoDAM
 */

namespace RTGODAM\Inc\Media_Library;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Media_Folder_Create_Zip
 * 
 * @since 1.3.0
 */
class Media_Folder_Create_Zip {

	use Singleton;

	/**
	 * Batch size for processing attachments
	 * 
	 * @since 1.3.0
	 *
	 * @var int - This is set to 50 to balance performance and memory usage.
	 */
	private const BATCH_SIZE = 50;

	/**
	 * Memory limit threshold (in bytes) - 80% of available memory
	 * 
	 * @since 1.3.0
	 *
	 * @var int - This is set to 80% of the available memory limit to prevent memory exhaustion.
	 */
	private $memory_threshold;

	/**
	 * Constructor
	 * 
	 * @since 1.3.0
	 */
	public function __construct() {
		// Set memory threshold to 80% of available memory.
		$memory_limit           = $this->get_memory_limit();
		$this->memory_threshold = $memory_limit * 0.8;
	}

	/**
	 * Create a ZIP file from the attachments in a media folder.
	 * 
	 * @since 1.3.0
	 *
	 * @param int    $folder_id - The ID of the media folder.
	 * @param string $zip_name - The name of the ZIP file to be created. Defaults to 'media-folder.zip'.
	 *
	 * @return array|\WP_Error - Returns an array with the ZIP file details on success, or a WP_Error object on failure.
	 */
	public function create_zip( $folder_id, $zip_name = 'media-folder.zip' ) {
		if ( ! is_numeric( $folder_id ) || $folder_id <= 0 ) {
			return new \WP_Error( 'invalid_folder_id', __( 'Invalid folder ID provided.', 'godam' ), array( 'status' => 400 ) );
		}

		// Get total attachment count first.
		$total_attachments = Media_Folder_Utils::get_instance()->get_attachment_count( $folder_id );

		if ( 0 === $total_attachments ) {
			return new \WP_Error( 'no_attachments', __( 'No attachments found in this folder.', 'godam' ), array( 'status' => 404 ) );
		}

		// Create the ZIP file and insure it's name has .zip extension.
		$zip_name = sanitize_file_name( $zip_name );

		if ( ! str_ends_with( $zip_name, '.zip' ) ) {
			$zip_name .= '.zip';
		}

		$result = $this->create_zip_file_batched( $folder_id, $zip_name, $total_attachments );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return $result;
	}

	/**
	 * Get attachments in batches for memory efficiency
	 * 
	 * @since 1.3.0
	 *
	 * @param int $folder_id - The ID of the media folder.
	 * @param int $offset - The offset for pagination.
	 * @param int $limit - The number of attachments to retrieve in this batch.
	 * @return array - An array of attachment objects, each containing only the ID.
	 */
	private function get_taxonomy_attachments_batch( $folder_id, $offset = 0, $limit = self::BATCH_SIZE ) {
		$args = array(
			'post_type'              => 'attachment',
			'post_status'            => 'inherit',
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query -- Using taxonomy query for media folders.
			'tax_query'              => array(
				array(
					'taxonomy' => 'media-folder',
					'field'    => 'term_id',
					'terms'    => $folder_id,
				),
			),
			'posts_per_page'         => $limit,
			'offset'                 => $offset,
			'fields'                 => 'ids',
			'no_found_rows'          => true,
			'cache_results'          => true,
			'update_post_meta_cache' => false,
			'update_post_term_cache' => false,
		);

		$query          = new \WP_Query( $args );
		$attachment_ids = $query->posts;

		// Clean up.
		wp_reset_postdata();

		// Convert IDs to minimal attachment objects.
		$attachments = array();
		foreach ( $attachment_ids as $id ) {
			$attachments[] = (object) array(
				'ID' => $id,
			);
		}

		return $attachments;
	}

	/**
	 * Create a ZIP file from attachments using batch processing
	 * 
	 * @since 1.3.0
	 *
	 * @param int    $folder_id - The ID of the media folder.
	 * @param string $zip_name - The name of the ZIP file to be created.
	 * @param int    $total_attachments - The total number of attachments in the folder.
	 * @return array|\WP_Error - Returns an array with the ZIP file details on success, or a WP_Error object on failure.
	 */
	private function create_zip_file_batched( $folder_id, $zip_name, $total_attachments ) {
		// Get upload directory info.
		$upload_dir = wp_get_upload_dir();

		// Create godam directory if it doesn't exist.
		$godam_dir = $upload_dir['basedir'] . '/godam';
		$godam_url = $upload_dir['baseurl'] . '/godam';

		if ( ! file_exists( $godam_dir ) ) {
			if ( ! wp_mkdir_p( $godam_dir ) ) {
				return new \WP_Error( 'directory_creation_failed', __( 'Failed to create godam directory.', 'godam' ), array( 'status' => 500 ) );
			}
		}

		// Full path to the ZIP file.
		$zip_path = $godam_dir . '/' . $zip_name;

		// Create a new ZipArchive instance.
		$zip        = new \ZipArchive();
		$zip_result = $zip->open( $zip_path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE );

		if ( true !== $zip_result ) {
			return new \WP_Error(
				'zip_creation_failed',
				/* translators: %d is the error code returned by ZipArchive::open() */
				sprintf( __( 'Failed to create ZIP file. Error code: %d', 'godam' ), $zip_result ),
				array( 'status' => 500 )
			);
		}

		$added_files    = 0;
		$skipped_files  = 0;
		$processed      = 0;
		$used_filenames = array(); // Track used filenames to avoid duplicates.

		// Process in batches.
		while ( $processed < $total_attachments ) {
			// Check memory usage before processing batch.
			if ( $this->is_memory_limit_approaching() ) {
				// Force garbage collection.
				$this->cleanup_memory();

				// If still approaching limit, break.
				if ( $this->is_memory_limit_approaching() ) {
					break;
				}
			}

			$batch_attachments = $this->get_taxonomy_attachments_batch( $folder_id, $processed, self::BATCH_SIZE );

			if ( empty( $batch_attachments ) ) {
				break;
			}

			foreach ( $batch_attachments as $attachment ) {
				$file_path = get_attached_file( $attachment->ID );

				if ( ! $file_path || ! file_exists( $file_path ) ) {
					++$skipped_files;
					continue;
				}

				// Check file size to prevent memory issues with very large files.
				$file_size = filesize( $file_path );
				if ( false === $file_size || $file_size > 500 * 1024 * 1024 ) { // Skip files larger than 500MB.
					++$skipped_files;
					continue;
				}

				$filename     = basename( $file_path );
				$zip_filename = $this->get_unique_filename( $filename, $attachment->ID, $used_filenames );

				if ( $zip->addFile( $file_path, $zip_filename ) ) {
					++$added_files;
					$used_filenames[] = $zip_filename;
				} else {
					++$skipped_files;
				}
			}

			$processed += count( $batch_attachments );

			// Clear batch from memory.
			unset( $batch_attachments );
		}

		$zip->close();

		// Check if any files were added.
		if ( 0 === $added_files ) {
			// Delete empty ZIP file.
			if ( file_exists( $zip_path ) ) {
				wp_delete_file( $zip_path );
			}
			return new \WP_Error(
				'no_files_added',
				__( 'No valid files found to add to ZIP.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		// Generate the URL for the ZIP file.
		$zip_url = $godam_url . '/' . $zip_name;

		// Schedule cleanup after 24 hours.
		wp_schedule_single_event( time() + DAY_IN_SECONDS, 'godam_cleanup_zip', array( $zip_path ) );

		return array(
			'zip_url'           => $zip_url,
			'zip_path'          => $zip_path,
			'zip_name'          => $zip_name,
			'added_files'       => $added_files,
			'skipped_files'     => $skipped_files,
			'total_processed'   => $processed,
			'total_attachments' => $total_attachments,
			'message'           => sprintf(
				/* translators: %1$d: added files, %2$d: skipped files, %3$d: total attachments */
				__( 'ZIP file created successfully. %1$d files added, %2$d files skipped out of %3$d total attachments.', 'godam' ),
				$added_files,
				$skipped_files,
				$total_attachments
			),
			'status'            => 'success',
		);
	}

	/**
	 * Generate a unique filename for the ZIP archive
	 * 
	 * @since 1.3.0
	 *
	 * @param string $filename - The original filename of the attachment.
	 * @param int    $attachment_id - The ID of the attachment.
	 * @param array  $used_filenames - An array of filenames that have already been used in the ZIP.
	 * @return string - A unique filename for the ZIP archive.
	 */
	private function get_unique_filename( $filename, $attachment_id, $used_filenames ) {
		$base_filename   = $attachment_id . '_' . $filename;
		$unique_filename = $base_filename;
		$counter         = 1;

		// Ensure filename is unique.
		while ( in_array( $unique_filename, $used_filenames, true ) ) {
			$pathinfo        = pathinfo( $base_filename );
			$unique_filename = $pathinfo['filename'] . '_' . $counter . '.' . $pathinfo['extension'];
			++$counter;
		}

		return $unique_filename;
	}

	/**
	 * Check if memory limit is approaching
	 * 
	 * @since 1.3.0
	 *
	 * @return bool
	 */
	private function is_memory_limit_approaching() {
		$current_memory = memory_get_usage( true );
		return $current_memory > $this->memory_threshold;
	}

	/**
	 * Get memory limit in bytes
	 * 
	 * @since 1.3.0
	 *
	 * @return int
	 */
	private function get_memory_limit() {
		$memory_limit = ini_get( 'memory_limit' );

		if ( '-1' === $memory_limit ) {
			return PHP_INT_MAX;
		}

		$memory_limit = trim( $memory_limit );
		$last_char    = strtolower( substr( $memory_limit, -1 ) );
		$memory_limit = (int) $memory_limit;

		switch ( $last_char ) {
			case 'g':
				$memory_limit *= 1024 * 1024 * 1024;
				break;
			case 'm':
				$memory_limit *= 1024 * 1024;
				break;
			case 'k':
				$memory_limit *= 1024;
				break;
		}

		return $memory_limit;
	}

	/**
	 * Force garbage collection and cleanup
	 * 
	 * @since 1.3.0
	 */
	private function cleanup_memory() {
		if ( function_exists( 'gc_collect_cycles' ) ) {
			gc_collect_cycles();
		}

		if ( function_exists( 'wp_cache_flush' ) ) {
			wp_cache_flush();
		}
	}

	/**
	 * Cleanup the ZIP file after a scheduled time.
	 * 
	 * @since 1.3.0
	 *
	 * @param string $zip_path The path to the ZIP file to be cleaned up.
	 */
	public function godam_cleanup_zip_file( $zip_path ) {
		if ( ! is_string( $zip_path ) || empty( $zip_path ) ) {
			return;
		}

		// Ensure the file exists before attempting to delete it.
		if ( file_exists( $zip_path ) ) {
			wp_delete_file( $zip_path );
		}
	}
}
