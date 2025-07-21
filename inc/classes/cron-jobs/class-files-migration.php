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
use RTGODAM\Inc\Traits\Singleton;


defined( 'ABSPATH' ) || exit;

/**
 * Class Files_Migration
 *
 * This class handles the migration of files to a CDN in batches.
 * It provides methods to start, stop, and check the progress of the migration.
 */
class Files_Migration {

	use Singleton;

	/**
	 * Batch size for processing files.
	 */
	const BATCH_SIZE = 10;

	/**
	 * Cron hook for files migration to CDN.
	 *
	 * This constant defines the hook that will be used to schedule the cron job
	 * for processing files in batches and migrating them to the CDN.
	 */
	const CRON_HOOK = 'godam_cdn_files_migration_cron';

	/**
	 * Option name to store the status of the files migration to CDN.
	 *
	 * This constant defines the option name that will be used to store the current
	 * status of the files migration process, such as 'running', 'stopped', or 'idle'.
	 */
	const STATUS_OPTION = 'godam_cdn_files_migration_status';

	/**
	 * Option name to store the list of migrated files.
	 *
	 * This constant defines the option name that will be used to store the list of
	 * files that have already been migrated to the CDN.
	 */
	const MIGRATED_FILES_OPTION = 'godam_cdn_migrated_files_list';

	/**
	 * Option name to store the list of failed files during migration.
	 *
	 * This constant defines the option name that will be used to store the list of
	 * files that failed to migrate to the CDN, allowing for retry or manual intervention.
	 */
	const FAILED_FILES_OPTION = 'godam_cdn_failed_files_list';

	/**
	 * Constructor.
	 *
	 * This method initializes the cron job for files migration to CDN.
	 * It sets up the necessary hooks and actions to handle the migration process.
	 */
	public function __construct() {
		// Initialize the cron job.
		self::setup_hooks();
	}

	/**
	 * Setup hooks for files migration to CDN.
	 *
	 * This function adds the necessary actions for processing files in batches,
	 * starting the migration, and handling AJAX requests related to the migration.
	 */
	public static function setup_hooks() {
		add_action( self::CRON_HOOK, array( __CLASS__, 'process_batch' ) );
		add_action( 'trigger_files_cdn_migration', array( __CLASS__, 'start_migration' ) );
		add_action( 'wp_ajax_godam_handle_files_migration', array( __CLASS__, 'ajax_handle_migration' ) );
	}

	/**
	 * Handle AJAX requests for files migration to CDN.
	 *
	 * This function checks the nonce for security, processes the sub-action,
	 * and returns the appropriate response based on the action requested.
	 */
	public static function ajax_handle_migration() {
		check_ajax_referer( 'files_migration_nonce', 'nonce' );

		$sub_action = isset( $_POST['subAction'] ) ? sanitize_text_field( $_POST['subAction'] ) : '';

		if ( 'start' === $sub_action ) {
			self::start_migration();
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
		} elseif ( 'progress' === $sub_action ) {
			$status = self::get_progress();
			wp_send_json_success( $status );
		} else {
			wp_send_json_error( 'Invalid action.', 400 );
		}
		exit;
	}

	/**
	 * Start the files migration to CDN.
	 *
	 * This function checks the current status of the migration. If it is already running,
	 * it does nothing. If it is stopped, it clears the status option and schedules a new cron job.
	 */
	public static function start_migration() {
		$status = get_option( self::STATUS_OPTION, 'idle' );

		// If the status is 'running', we do not start a new migration.
		if ( 'running' === $status ) {
			self::debug( 'Files migration is already running.' );
			return;
		}

		// If the status is 'stopped', we clear the status option to allow a fresh start.
		if ( 'stopped' === $status ) {
			delete_option( self::STATUS_OPTION );
		}

		self::schedule_cron();
	}

	/**
	 * Schedule the cron job for files migration to CDN.
	 *
	 * This function checks if the cron job is already scheduled. If not, it schedules a new event
	 * to process files in batches. It also updates the status of the migration to 'running'.
	 */
	public static function schedule_cron() {
		// If the cron job is already scheduled, we do not schedule it again.
		if ( wp_next_scheduled( self::CRON_HOOK ) ) {
			return;
		}

		// If the status is 'stopped', we do not schedule a new cron job.
		if ( 'stopped' === get_option( self::STATUS_OPTION, 'idle' ) ) {
			return;
		}

		// Schedule the cron job to run after 5 seconds.
		wp_schedule_single_event( time() + 5, self::CRON_HOOK );

		// Update the status to running if cron job is scheduled.
		if ( wp_next_scheduled( self::CRON_HOOK ) ) {
			update_option( self::STATUS_OPTION, 'running' );
			self::debug( 'Files migration cron job scheduled.' );
		} else {
			self::debug( 'Failed to schedule files migration cron job.' );
		}
	}

	/**
	 * Process a batch of files for migration to CDN.
	 *
	 * This function retrieves a batch of files that have not been migrated yet,
	 * uploads them to the CDN, and updates their metadata accordingly.
	 */
	public static function process_batch() {
		$all_files       = self::get_all_upload_files();
		$migrated_files  = get_option( self::MIGRATED_FILES_OPTION, array() );
		$failed_files    = get_option( self::FAILED_FILES_OPTION, array() );
		$remaining_files = array_diff( $all_files, $migrated_files );
		$batch           = array_slice( $remaining_files, 0, self::BATCH_SIZE );

		if ( empty( $batch ) ) {
			delete_option( self::STATUS_OPTION );
			self::debug( '✅ Files migration completed.' );
			return;
		}

		foreach ( $batch as $file_path ) {
			$destination = self::get_destination_path( $file_path );
			$source_path = self::get_source_path( $file_path );
			$plugin      = Plugin::get_instance();
			$client      = $plugin->client();

			if ( file_exists( $destination ) ) {
				self::debug( 'File with same name exists on CDN!' );
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
				$failed_files[] = $file_path;
				continue;
			}

			$migrated_files[] = $file_path;
		}

		update_option( self::MIGRATED_FILES_OPTION, $migrated_files );
		update_option( self::FAILED_FILES_OPTION, $failed_files );

		if ( count( $remaining_files ) > self::BATCH_SIZE ) {
			// schedule next batch.
			self::schedule_cron();
		} else {
			delete_option( self::STATUS_OPTION );
			self::debug( 'Files migration fully processed.' );
		}
	}

	/**
	 * Get the source path for the media file.
	 *
	 * @param string $relative_path The relative path of the media file.
	 * @return string|false The full source path for the media file, or false if the directory does not exist.
	 */
	public static function get_source_path( $relative_path ) {
		$plugin     = Plugin::get_instance();
		$upload_dir = $plugin->original_upload_dir['basedir'];

		if ( ! is_dir( $upload_dir ) ) {
			return false;
		}
		return trailingslashit( $upload_dir ) . str_replace( 'godam://wp-content/uploads/', '', $relative_path );
	}

	/**
	 * Get the destination path for the file on the CDN.
	 *
	 * @param string $relative_path The relative path of the file.
	 * @return string The full destination path for the file on the CDN.
	 */
	public static function get_destination_path( $relative_path ) {
		return 'godam://wp-content/uploads/' . $relative_path;
	}

	/**
	 * Stop the files migration to CDN.
	 *
	 * This function updates the status of the migration to 'stopped'.
	 */
	public static function stop_migration() {
		update_option( self::STATUS_OPTION, 'stopped' );
		self::debug( 'Files migration was manually stopped.' );
	}

	/**
	 * Get the current status of the files migration to CDN.
	 *
	 * @return string The current status of the migration.
	 */
	public static function get_status() {
		return get_option( self::STATUS_OPTION, 'idle' );
	}

	/**
	 * Get the progress of the files migration to CDN.
	 *
	 * @return array An array containing the status, completed count, and remaining count.
	 */
	public static function get_progress() {
		$status          = self::get_status();
		$all_files       = self::get_all_upload_files();
		$migrated_files  = get_option( self::MIGRATED_FILES_OPTION, array() );
		$failed_files    = get_option( self::FAILED_FILES_OPTION, array() );
		$completed_count = count( $migrated_files );
		$remaining_count = count( $all_files ) - $completed_count;

		return array(
			'status'    => $status,
			'completed' => $completed_count,
			'remaining' => $remaining_count,
			'failed'    => count( $failed_files ),
			'total'     => count( $all_files ),
		);
	}

	/**
	 * Check if files migration to CDN is needed.
	 *
	 * @return bool True if migration is needed, false otherwise.
	 */
	public static function need_migration() {
		$progress = self::get_progress();
		return $progress['remaining'] > 0 && 'running' !== $progress['status'];
	}

	/**
	 * Get all files from the wp-content/uploads directory.
	 *
	 * @return array List of file paths relative to the uploads directory.
	 */
	public static function get_all_upload_files() {
		$plugin = Plugin::get_instance();

		if ( ! $plugin->original_upload_dir || ! is_array( $plugin->original_upload_dir ) ) {
			return array();
		}

		$upload_dir = $plugin->original_upload_dir['basedir'];
		$files      = array();
		$iterator   = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator( $upload_dir, \RecursiveDirectoryIterator::SKIP_DOTS ),
			\RecursiveIteratorIterator::SELF_FIRST
		);

		foreach ( $iterator as $file ) {
			if ( $file->isFile() ) {
				$files[] = str_replace( trailingslashit( $upload_dir ), '', $file->getPathname() );
			}
		}

		return $files;
	}

	/**
	 * Debugging function to log messages.
	 *
	 * @param string $message The message to log.
	 */
	public static function debug( $message ) {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Debugging messages are logged to error log.
			error_log( '[GoDAM CronJob FilesMigration] ' . $message );
		}
	}
}
