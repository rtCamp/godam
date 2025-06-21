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
 * Class Media_Folder_Create_Zip
 */
class Media_Folder_Create_Zip {

	use Singleton;

	/**
	 * Create a ZIP file from the attachments in a media folder.
	 *
	 * @param int    $folder_id - The ID of the media folder.
	 * @param string $zip_name - The name of the ZIP file to create. Defaults to 'media-folder.zip'.
	 * @return array|\WP_Error - Returns an array with the ZIP file details on success, or a WP_Error object on failure.
	 */
	public function create_zip( $folder_id, $zip_name = 'media-folder.zip' ) {
		// Ensure the folder ID is valid.
		if ( ! is_numeric( $folder_id ) || $folder_id <= 0 ) {
			return new \WP_Error( 'invalid_folder_id', __( 'Invalid folder ID provided.', 'godam' ), array( 'status' => 400 ) );
		}

		$attachments = $this->get_taxonomy_attachments( $folder_id );

		if ( empty( $attachments ) || is_wp_error( $attachments ) ) {
			return new \WP_Error( 'no_attachments', __( 'No attachments found in this folder.', 'godam' ), array( 'status' => 404 ) );
		}

		// Create the ZIP file.
		$zip_name = sanitize_file_name( $zip_name );

		$result = $this->create_zip_file( $attachments, $zip_name );

		if ( is_wp_error( $result ) ) {
			return $result; // Return the error if ZIP creation failed.
		}

		return $result;
	}

	/**
	 * Get attachments associated with a specific media folder.
	 *
	 * @param int $folder_id The ID of the media folder.
	 * @return array Array of attachment objects.
	 */
	private function get_taxonomy_attachments( $folder_id ) {
		// Get attachments associated with the folder.
		$args = array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'tax_query'      => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
				array(
					'taxonomy' => 'media-folder',
					'field'    => 'term_id',
					'terms'    => $folder_id,
				),
			),
			'posts_per_page' => -1, // Get all attachments.
		);

		return get_posts( $args );
	}

	/**
	 * Create a ZIP file from the provided attachments.
	 *
	 * @param array  $attachments Array of attachment objects.
	 * @param string $zip_name    Name of the ZIP file to create.
	 * @return array|\WP_Error    Array with ZIP file details or WP_Error on failure.
	 */
	private function create_zip_file( $attachments, $zip_name ) {
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

		// Ensure zip_name has .zip extension.
		if ( ! str_ends_with( $zip_name, '.zip' ) ) {
			$zip_name .= '.zip';
		}

		// Full path to the ZIP file.
		$zip_path = $godam_dir . '/' . $zip_name;

		// Create a new ZipArchive instance.
		$zip        = new \ZipArchive();
		$zip_result = $zip->open( $zip_path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE );

		if ( true !== $zip_result ) {
			return new \WP_Error(
				'zip_creation_failed',
				/* translators: %d is the error code returned by ZipArchive::open */
				sprintf( __( 'Failed to create ZIP file. Error code: %d', 'godam' ), $zip_result ),
				array( 'status' => 500 )
			);
		}

		$added_files   = 0;
		$skipped_files = 0;

		foreach ( $attachments as $attachment ) {
			$file_path = get_attached_file( $attachment->ID );

			if ( ! $file_path || ! file_exists( $file_path ) ) {
				++$skipped_files;
				continue;
			}

			$filename = basename( $file_path );

			// Handle duplicate filenames by adding attachment ID prefix.
			$zip_filename = $attachment->ID . '_' . $filename;

			if ( $zip->addFile( $file_path, $zip_filename ) ) {
				++$added_files;
			} else {
				++$skipped_files;
			}
		}

		$zip->close();

		// Check if any files were added.
		if ( 0 === $added_files ) {
			// Delete empty ZIP file.
			if ( file_exists( $zip_path ) ) {
				unlink( $zip_path ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_unlink -- using `wp-content/uploads/` folder create only.

			}
			return new \WP_Error(
				'no_files_added',
				__( 'No valid files found to add to ZIP.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		// Generate the URL for the ZIP file.
		$zip_url = $godam_url . '/' . $zip_name;

		// Optional: Schedule cleanup after 24 hours.
		wp_schedule_single_event( time() + DAY_IN_SECONDS, 'godam_cleanup_zip', array( $zip_path ) );

		return array(
			'zip_url'       => $zip_url,
			'zip_path'      => $zip_path,
			'zip_name'      => $zip_name,
			'added_files'   => $added_files,
			'skipped_files' => $skipped_files,
			'message'       => sprintf(
				/* translators: %1$d is the number of files added, %2$d is the number of files skipped */
				__( 'ZIP file created successfully. %1$d files added, %2$d files skipped.', 'godam' ),
				$added_files,
				$skipped_files
			),
			'status'        => 'success',
		);
	}

	/**
	 * Cleanup the ZIP file after a scheduled time.
	 *
	 * @param string $zip_path The path to the ZIP file to be cleaned up.
	 */
	public function godam_cleanup_zip_file( $zip_path ) {
		if ( file_exists( $zip_path ) ) {
			unlink( $zip_path ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_unlink -- using `wp-content/uploads/` folder cleanup only.
		}
	}
}
