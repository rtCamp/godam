<?php
/**
 * This class is responsible for managing the migration of files in the GoDAM plugin.
 * It sets up a cron job to periodically check for files that need to be migrated.
 *
 * Class to handle files migration to CDN.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Cron_Jobs;

use RTGODAM\Inc\Filesystem\Plugin;

defined( 'ABSPATH' ) || exit;

/**
 * Class Files_Migration
 *
 * This class handles the migration of files to a CDN in batches.
 * It provides methods to start, stop, and check the progress of the migration.
 *
 * This is a utility class with static methods only.
 *
 * @since n.e.x.t
 */
class Files_Migration {

	/**
	 * Batch size for processing files.
	 *
	 * @since n.e.x.t
	 */
	const BATCH_SIZE = 10;

	/**
	 * Cron hook for files migration to CDN.
	 *
	 * This constant defines the hook that will be used to schedule the cron job
	 * for processing files in batches and migrating them to the CDN.
	 *
	 * @since n.e.x.t
	 */
	const CRON_HOOK = 'godam_cdn_files_migration_cron';

	/**
	 * Option name to store the status of the files migration to CDN.
	 *
	 * This constant defines the option name that will be used to store the current
	 * status of the files migration process, such as 'running', 'stopped', or 'idle'.
	 *
	 * @since n.e.x.t
	 */
	const STATUS_OPTION = 'godam_cdn_files_migration_status';

	/**
	 * Option name to store the list of migrated files.
	 *
	 * This constant defines the option name that will be used to store the list of
	 * files that have already been migrated to the CDN.
	 *
	 * @since n.e.x.t
	 */
	const MIGRATED_FILES_OPTION = 'godam_cdn_migrated_files_list';

	/**
	 * Option name to store the list of failed files during migration.
	 *
	 * This constant defines the option name that will be used to store the list of
	 * files that failed to migrate to the CDN, allowing for retry or manual intervention.
	 *
	 * @since n.e.x.t
	 */
	const FAILED_FILES_OPTION = 'godam_cdn_failed_files_list';

	/**
	 * Current migrating file.
	 *
	 * @since n.e.x.t
	 */
	const CURRENT_FILE_OPTION = 'godam_cdn_migrating_current_file';

	/**
	 * Initialize the class.
	 *
	 * This method should be called once to set up the hooks.
	 * Since this is now a pure static class, no constructor is needed.
	 *
	 * @since n.e.x.t
	 */
	public static function initialize() {
		self::setup_hooks();
	}

	/**
	 * Setup hooks for files migration to CDN.
	 *
	 * This function adds the necessary actions for processing files in batches,
	 * starting the migration, and handling AJAX requests related to the migration.
	 *
	 * @since n.e.x.t
	 */
	public static function setup_hooks() {
		add_action( 'init', array( __CLASS__, 'init' ) );
		add_action( self::CRON_HOOK, array( __CLASS__, 'process_batch' ) );
		add_action( 'trigger_files_cdn_migration', array( __CLASS__, 'start_migration' ) );
		add_action( 'wp_ajax_godam_handle_files_migration', array( __CLASS__, 'ajax_handle_migration' ) );
	}

	/**
	 * Initialize the files migration to CDN.
	 *
	 * This function checks if the cron job is already scheduled but not running.
	 * If the status is 'scheduled', it schedules the cron job to start processing files.
	 *
	 * @since n.e.x.t
	 */
	public static function init() {
		$status = get_option( self::STATUS_OPTION, 'idle' );

		// If status is not 'scheduled', we do not need to schedule the cron job.
		if ( 'scheduled' !== $status ) {
			return;
		}

		// If the cron job is not scheduled, with the status 'scheduled', we schedule it.
		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			$status = self::schedule_cron();
			if ( is_wp_error( $status ) ) {
				self::debug( 'Error scheduling files migration cron job: ' . $status->get_error_message() );
			}
		}
	}

	/**
	 * Handle AJAX requests for files migration to CDN.
	 *
	 * This function checks the nonce for security, processes the sub-action,
	 * and returns the appropriate response based on the action requested.
	 *
	 * @since n.e.x.t
	 */
	public static function ajax_handle_migration() {
		check_ajax_referer( 'files_migration_nonce', 'nonce' );

		$sub_action = isset( $_POST['subAction'] ) ? sanitize_text_field( $_POST['subAction'] ) : '';

		if ( 'start' === $sub_action ) {
			$status = self::start_migration();

			if ( is_wp_error( $status ) ) {
				self::debug( 'Error starting files migration: ' . $status->get_error_message() );
				wp_send_json_error(
					array(
						'message' => $status->get_error_message(),
					),
					400
				);
			}

			wp_send_json_success(
				array(
					'message' => 'Files migration started.',
				)
			);
		} elseif ( 'stop' === $sub_action ) {
			self::stop_migration();
			wp_send_json_success(
				array(
					'message' => 'Files migration stopped.',
				)
			);
		} elseif ( 'info' === $sub_action ) {
			$status = self::get_info();
			wp_send_json_success( $status );
		} else {
			wp_send_json_error(
				array(
					'message' => 'Invalid sub-action specified.',
				),
				400
			);
		}
		exit;
	}

	/**
	 * Start the files migration to CDN.
	 *
	 * This function checks the current status of the migration. If it is already running,
	 * it does nothing. If it is stopped, it clears the status option and schedules a new cron job.
	 *
	 * @since n.e.x.t
	 */
	public static function start_migration() {
		$status = get_option( self::STATUS_OPTION, 'idle' );

		// If the status is 'running', we do not start a new migration.
		if ( 'running' === $status ) {
			return new \WP_Error( 'files_migration_running', 'Files migration is already running.' );
		}

		// If the status is 'stopped', we clear the status option to allow a fresh start.
		if ( 'stopped' === $status ) {
			delete_option( self::STATUS_OPTION );
		}

		// If the status is 'scheduled', we do not start a new migration.
		if ( 'scheduled' === $status && wp_next_scheduled( self::CRON_HOOK ) ) {
			return new \WP_Error( 'files_migration_scheduled', 'Files migration is already scheduled.' );
		}

		$can_migrate = self::can_migrate( true );

		if ( is_wp_error( $can_migrate ) ) {
			return $can_migrate;
		}

		return self::schedule_cron();
	}

	/**
	 * Schedule the cron job for files migration to CDN.
	 *
	 * This function checks if the cron job is already scheduled. If not, it schedules a new event
	 * to process files in batches. It also updates the status of the migration to 'running'.
	 *
	 * @since n.e.x.t
	 */
	public static function schedule_cron() {
		// If the cron job is already scheduled, we do not schedule it again.
		if ( wp_next_scheduled( self::CRON_HOOK ) ) {
			return new \WP_Error( 'files_migration_already_scheduled', 'Files migration cron job is already scheduled.' );
		}

		// If the status is 'stopped', we do not schedule a new cron job.
		if ( 'stopped' === get_option( self::STATUS_OPTION, 'idle' ) ) {
			return new \WP_Error( 'files_migration_stopped', 'Files migration was stopped manually.' );
		}

		// Schedule the cron job to run after 5 seconds.
		wp_schedule_single_event( time() + 5, self::CRON_HOOK );

		// Update the status to running if cron job is scheduled.
		if ( wp_next_scheduled( self::CRON_HOOK ) ) {
			update_option( self::STATUS_OPTION, 'scheduled' );
			return true;
		} else {
			return new \WP_Error( 'files_migration_failed_to_schedule', 'Failed to schedule files migration cron job.' );
		}
	}

	/**
	 * Process a batch of files for migration to CDN.
	 *
	 * This function retrieves a batch of files that have not been migrated yet,
	 * uploads them to the CDN, and updates their metadata accordingly.
	 *
	 * @since n.e.x.t
	 */
	public static function process_batch() {
		// If the status is 'stopped', we do not process the files.
		if ( 'stopped' === get_option( self::STATUS_OPTION, 'idle' ) ) {
			return;
		}

		update_option( self::STATUS_OPTION, 'running' );

		$all_files       = self::get_all_upload_files();
		$migrated_files  = get_option( self::MIGRATED_FILES_OPTION, array() );
		$failed_files    = get_option( self::FAILED_FILES_OPTION, array() );
		$remaining_files = array_diff( wp_list_pluck( $all_files, 'path' ), $migrated_files );
		$batch           = array_slice( $remaining_files, 0, self::BATCH_SIZE );

		if ( empty( $batch ) ) {
			delete_option( self::STATUS_OPTION );
			self::debug( 'Files migration completed.' );
			return;
		}

		foreach ( $batch as $file_path ) {
			$destination = self::get_destination_path( $file_path );
			$source_path = self::get_source_path( $file_path );
			$plugin      = Plugin::get_instance();
			$client      = $plugin->client();

			if ( 'stopped' === get_option( self::STATUS_OPTION, 'idle' ) ) {
				// If the status is 'stopped', we do not process the files.
				self::debug( 'Files migration was stopped manually.' );
				return;
			}

			update_option( self::CURRENT_FILE_OPTION, $file_path );

			self::debug( 'Processing file: ' . $file_path );
			self::debug( 'Source path: ' . $source_path );
			self::debug( 'Destination: ' . $destination );

			if ( file_exists( $destination ) ) {
				self::debug( 'File with same name exists on CDN!' );
				self::maybe_transcode( $file_path );
				$migrated_files[] = $file_path;
				continue;
			}

			if ( ! $source_path || ! file_exists( $source_path ) ) {
				self::debug( 'Source file does not exist: ' . $source_path );
				continue;
			}

			$status = $client->upload_file(
				$source_path,
				$destination
			);

			if ( is_wp_error( $status ) ) {
				self::debug( 'Error uploading file to CDN: ' . $status->get_error_message() );

				if ( ! in_array( $file_path, $failed_files, true ) ) {
					$failed_files[] = $file_path;
				}
				continue;
			}

			// Transcode the file if necessary.
			self::maybe_transcode( $file_path );

			// Get attachment ID from file path.
			$attachment_id = self::get_attachment_id_from_file_path( $file_path );
			if ( $attachment_id ) {
				// Mark attachment as migrated.
				update_post_meta( $attachment_id, '_media_migrated_to_godam_cdn', true );
				update_post_meta( $attachment_id, '_godam_cdn_url', $destination );
				update_post_meta( $attachment_id, '_godam_migration_date', current_time( 'mysql' ) );

				self::debug( 'Marked attachment ' . $attachment_id . ' as migrated to GoDAM CDN' );
			}

			self::debug( 'Successfully uploaded: ' . $file_path );
			$migrated_files[] = $file_path;
		}

		update_option( self::MIGRATED_FILES_OPTION, array_unique( $migrated_files ) );
		update_option( self::FAILED_FILES_OPTION, array_unique( $failed_files ) );

		if ( count( $remaining_files ) > self::BATCH_SIZE ) {
			// schedule next batch.
			$status = self::schedule_cron();
			if ( is_wp_error( $status ) ) {
				self::debug( 'Error scheduling next batch: ' . $status->get_error_message() );
				return;
			}

			// Update the status to 'paused' if the migration is not finished.
			if ( 'stopped' !== get_option( self::STATUS_OPTION, 'idle' ) ) {
				update_option( self::STATUS_OPTION, 'paused' );
			}
		} else {
			delete_option( self::STATUS_OPTION );
			self::debug( 'Files migration completed.' );
		}
	}

	/**
	 * Get the source path for the media file.
	 *
	 * @param string $relative_path The relative path of the media file.
	 * @return string|false The full source path for the media file, or false if the directory does not exist.
	 *
	 * @since n.e.x.t
	 */
	public static function get_source_path( $relative_path ) {
		$plugin     = Plugin::get_instance();
		$upload_dir = $plugin->original_upload_dir['basedir'];

		if ( ! is_dir( $upload_dir ) ) {
			return false;
		}

		// Clean the relative path - remove any godam:// prefix.
		$clean_path = str_replace( 'godam://wp-content/uploads/', '', $relative_path );

		return trailingslashit( $upload_dir ) . $clean_path;
	}

	/**
	 * Get the destination path for the file on the CDN.
	 *
	 * @param string $relative_path The relative path of the file.
	 * @return string The full destination path for the file on the CDN.
	 *
	 * @since n.e.x.t
	 */
	public static function get_destination_path( $relative_path ) {
		// Ensure the path is properly formatted.
		$clean_path = ltrim( $relative_path, '/' );

		// Add the godam:// prefix if not already present.
		if ( strpos( $clean_path, 'godam://' ) !== 0 ) {
			return 'godam://wp-content/uploads/' . $clean_path;
		}

		return $clean_path;
	}

	/**
	 * Stop the files migration to CDN.
	 *
	 * This function updates the status of the migration to 'stopped'.
	 *
	 * @since n.e.x.t
	 */
	public static function stop_migration() {
		update_option( self::STATUS_OPTION, 'stopped' );
	}

	/**
	 * Get the current status of the files migration to CDN.
	 *
	 * @return string The current status of the migration.
	 *
	 * @since n.e.x.t
	 */
	public static function get_status() {
		return get_option( self::STATUS_OPTION, 'idle' );
	}

	/**
	 * Get the progress of the files migration to CDN.
	 *
	 * @return array An array containing the status, completed count, and remaining count.
	 *
	 * @since n.e.x.t
	 */
	public static function get_info() {
		$status          = self::get_status();
		$all_files       = array_column( self::get_all_upload_files(), 'size', 'path' );
		$completed_files = get_option( self::MIGRATED_FILES_OPTION, array() );
		$failed_files    = get_option( self::FAILED_FILES_OPTION, array() );
		$total_size      = array_sum( array_values( $all_files ) );
		$current_file    = get_option( self::CURRENT_FILE_OPTION, '' );

		$remaining_size = 0;
		foreach ( $all_files as $file_path => $size ) {
			if ( ! in_array( $file_path, $completed_files, true ) && ! in_array( $file_path, $failed_files, true ) ) {
				$remaining_size += $size;
			}
		}

		return array(
			'status'         => $status,
			'total'          => count( $all_files ),
			'completed'      => count( $completed_files ),
			'remaining'      => count( $all_files ) - count( $completed_files ) - count( $failed_files ),
			'failed'         => count( $failed_files ),
			'total_size'     => $total_size,
			'remaining_size' => $remaining_size,
			'migrating'      => array(
				'filename' => basename( $current_file ),
				'size'     => $all_files[ $current_file ] ?? 0,
			),
			'cron_scheduled' => self::varify_cron(),
		);
	}

	/**
	 * Maybe transcode the file if necessary.
	 *
	 * This function checks if the file needs to be transcoded and performs the transcoding
	 * if the RTGODAM_Transcoder_Handler class is available and the metadata is present.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $file_path The path of the file to be transcoded.
	 */
	public static function maybe_transcode( $file_path ) {
		// Get the attachment ID from the file path.
		if ( function_exists( 'wpcom_vip_attachment_url_to_postid' ) ) {
			$attachment_id = \wpcom_vip_attachment_url_to_postid( $file_path );
		} else {
			// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.attachment_url_to_postid_attachment_url_to_postid -- Using WordPress core function as fallback.
			$attachment_id = \attachment_url_to_postid( $file_path );
		}

		// If no attachment ID is found, exit the function.
		if ( ! $attachment_id ) {
			self::debug( 'No attachment found for file: ' . $file_path );
			return;
		}

		// Get the attachment post object.
		$attachment = get_post( $attachment_id );

		if ( ! $attachment ) {
			self::debug( 'No attachment post found for ID: ' . $attachment_id );
			return;
		}

		// Get the metadata for the attachment.
		$metadata = wp_get_attachment_metadata( $attachment_id );

		// Transcode the file if necessary.
		if ( class_exists( '\RTGODAM_Transcoder_Handler' ) && ! empty( $metadata ) ) {
			$transcoder_handler = new \RTGODAM_Transcoder_Handler();
			$transcoder_handler->wp_media_transcoding( $metadata, $attachment_id );
		}
	}

	/**
	 * Check if files can be migrated to the CDN.
	 *
	 * This function checks the storage usage and the size of remaining files to determine
	 * if there is enough space available for migration.
	 *
	 * @since n.e.x.t
	 *
	 * @param bool $return_error Whether to return an error if migration cannot proceed.
	 *
	 * @return bool|\WP_Error True if files can be migrated, false otherwise.
	 */
	public static function can_migrate( $return_error = false ) {
		$storage_usage   = rtgodam_get_usage_data();
		$all_files       = array_column( self::get_all_upload_files(), 'size', 'path' );
		$completed_files = get_option( self::MIGRATED_FILES_OPTION, array() );
		$failed_files    = get_option( self::FAILED_FILES_OPTION, array() );

		$remaining_size = 0;
		foreach ( $all_files as $file_path => $size ) {
			if ( ! in_array( $file_path, $completed_files, true ) && ! in_array( $file_path, $failed_files, true ) ) {
				$remaining_size += $size;
			}
		}

		if ( ! is_wp_error( $storage_usage ) ) {
			$available_storage = ( $storage_usage['total_storage'] * GB_IN_BYTES ) - ( $storage_usage['storage_used'] * GB_IN_BYTES );
			return $remaining_size < $available_storage;
		} elseif ( $return_error ) {
				return $storage_usage; // Return the error if requested.

		}

		return false;
	}

	/**
	 * Get all files from the wp-content/uploads directory.
	 *
	 * @since n.e.x.t
	 *
	 * @return array List of file paths relative to the uploads directory.
	 */
	public static function get_all_upload_files() {
		$plugin              = Plugin::get_instance();
		$original_upload_dir = $plugin->get_original_upload_dir();

		if ( ! $original_upload_dir ) {
			return array();
		}

		$upload_dir = $original_upload_dir['basedir'];
		$files      = array();
		$iterator   = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator( $upload_dir, \RecursiveDirectoryIterator::SKIP_DOTS ),
			\RecursiveIteratorIterator::SELF_FIRST
		);

		foreach ( $iterator as $file ) {
			if ( $file->isFile() ) {
				$_file   = str_replace( trailingslashit( $upload_dir ), '', $file->getPathname() );
				$files[] = array(
					'path' => $_file,
					'size' => $file->getSize(),
				);
			}
		}

		// Handle option data to remove files that are not in the uploads directory.
		self::handle_option_data( $files );

		return $files;
	}

	/**
	 * Handle option data to remove files that are not in the uploads directory.
	 *
	 * This function filters the migrated and failed files options to ensure they only contain
	 * file paths that are present in the provided list of files.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $files List of files with their paths.
	 */
	private static function handle_option_data( $files ) {
		// Remove file paths that are not in the uploads directory from migrated and failed files.
		$files          = wp_list_pluck( $files, 'path' );
		$migrated_files = get_option( self::MIGRATED_FILES_OPTION, array() );
		$failed_files   = get_option( self::FAILED_FILES_OPTION, array() );

		$migrated_files = array_filter(
			$migrated_files,
			function ( $file ) use ( $files ) {
				return in_array( $file, $files, true );
			}
		);

		$failed_files = array_filter(
			$failed_files,
			function ( $file ) use ( $files ) {
				return in_array( $file, $files, true );
			}
		);

		update_option( self::MIGRATED_FILES_OPTION, array_unique( $migrated_files ) );
		update_option( self::FAILED_FILES_OPTION, array_unique( $failed_files ) );
	}

	/**
	 * Verify if the cron job is scheduled or if the migration is running.
	 *
	 * This function checks if the cron job for files migration is scheduled and
	 * if the status of the migration is 'running'. It returns true if either condition
	 * is met, indicating that the migration can proceed.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool True if the cron job is scheduled or the status is 'running', false otherwise.
	 */
	public static function varify_cron() {
		// Check if the cron job is scheduled.
		if ( wp_next_scheduled( self::CRON_HOOK ) ) {
			return true;
		}

		// Check if the status is 'running'.
		if ( get_option( self::STATUS_OPTION, 'idle' ) === 'running' ) {
			return true;
		}

		return true;
	}

	/**
	 * Debugging function to log messages.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $message The message to log.
	 */
	public static function debug( $message ) {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Debugging messages are logged to error log.
			error_log( '[GoDAM CronJob FilesMigration] ' . $message );
		}
	}

	/**
	 * Get attachment ID from file path.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $file_path The file path.
	 * @return int|false The attachment ID or false if not found.
	 */
	public static function get_attachment_id_from_file_path( $file_path ) {
		global $wpdb;

		// Clean the file path.
		$clean_path = str_replace( 'godam://wp-content/uploads/', '', $file_path );
		$filename   = basename( $clean_path );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Try to find attachment by filename.
		$attachment_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta}
			WHERE meta_key = '_wp_attached_file'
			AND meta_value LIKE %s
			LIMIT 1",
				'%' . $filename
			)
		);

		return $attachment_id ? (int) $attachment_id : false;
	}

	/**
	 * Get list of migrated attachments.
	 *
	 * @since n.e.x.t
	 *
	 * @return array Array of attachment IDs.
	 */
	public static function get_migrated_attachments() {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return $wpdb->get_col(
			"
			SELECT post_id
			FROM {$wpdb->postmeta}
			WHERE meta_key = '_media_migrated_to_godam_cdn'
			AND meta_value = '1'
		"
		);
	}
}
