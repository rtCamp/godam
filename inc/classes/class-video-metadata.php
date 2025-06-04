<?php
/**
 * Video Metadata Handler Class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Video_Metadata
 */
class Video_Metadata {
	use Singleton;

	/**
	 * Batch size for processing videos.
	 */
	const BATCH_SIZE = 50;

	/**
	 * Constructor.
	 */
	final protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		add_action( 'init', array( $this, 'maybe_migrate_existing_videos' ) );
		add_action( 'add_attachment', array( $this, 'save_video_duration_meta' ) );
	}

	/**
	 * Run migration for existing videos only once after plugin activation.
	 *
	 * @return void
	 */
	public function maybe_migrate_existing_videos() {
		// Check if migration has been run, if not, run it once.
		$migration_completed = get_option( 'rtgodam_video_duration_migration_completed', false );
		
		if ( ! $migration_completed ) {
			$this->migrate_existing_video_durations();
			update_option( 'rtgodam_video_duration_migration_completed', true );
		}
	}

	/**
	 * Save video duration as meta field when attachment is added.
	 *
	 * @param int $attachment_id The attachment ID.
	 * @return void
	 */
	public function save_video_duration_meta( $attachment_id ) {
		$this->process_video_duration( $attachment_id );
	}

	/**
	 * Process a single video to save its duration meta field.
	 *
	 * @param int $attachment_id The attachment ID.
	 * @return void
	 */
	private function process_video_duration( $attachment_id ) {
		$file_path = get_attached_file( $attachment_id );
		
		if ( $this->is_video_attachment( $attachment_id ) && file_exists( $file_path ) ) {
			// Check if duration meta already exists to avoid unnecessary processing.
			$existing_duration = get_post_meta( $attachment_id, '_video_duration', true );
			
			if ( empty( $existing_duration ) ) {
				if ( ! function_exists( 'wp_read_video_metadata' ) ) {
					require_once ABSPATH . 'wp-admin/includes/media.php';
				}
				
				$metadata = wp_read_video_metadata( $file_path );
				
				if ( ! empty( $metadata['length'] ) ) {
					update_post_meta( $attachment_id, '_video_duration', intval( $metadata['length'] ) );
				}
			}
		}
	}

	/**
	 * Check if attachment is a video.
	 *
	 * @param int $attachment_id The attachment ID.
	 * @return bool True if attachment is a video, false otherwise.
	 */
	private function is_video_attachment( $attachment_id ) {
		$mime_type = get_post_mime_type( $attachment_id );
		return strpos( $mime_type, 'video/' ) === 0;
	}

	/**
	 * Migrate existing videos to have duration meta field.
	 * This runs once on init after plugin activation in batches.
	 *
	 * @return void
	 */
	private function migrate_existing_video_durations() {
		$offset          = 0;
		$has_more_videos = true;
		
		while ( $has_more_videos ) {
			// Get a batch of video attachments without _video_duration meta.
			//phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts
			$videos = get_posts(
				array(
					'post_type'      => 'attachment',
					'post_mime_type' => 'video',
					'posts_per_page' => self::BATCH_SIZE,
					'offset'         => $offset,
					// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
					'meta_query'     => array(
						array(
							'key'     => '_video_duration',
							'compare' => 'NOT EXISTS',
						),
					),
				)
			);
			
			if ( ! empty( $videos ) ) {
				// Process this batch.
				foreach ( $videos as $video ) {
					$this->process_video_duration( $video->ID );
				}
				
				// Move to the next batch.
				$offset += self::BATCH_SIZE;
				
				// If we got fewer videos than batch size, we're done.
				if ( count( $videos ) < self::BATCH_SIZE ) {
					$has_more_videos = false;
				}
			} else {
				// No more videos to process.
				$has_more_videos = false;
			}
		}
	}
}
