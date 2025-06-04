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
		add_action( 'add_attachment', array( $this, 'save_video_metadata' ) );
	}

	/**
	 * Run migration for existing videos only once after plugin activation.
	 *
	 * @return void
	 */
	public function maybe_migrate_existing_videos() {
		// Check if migration has been run, if not, run it once.
		$migration_completed = get_option( 'rtgodam_video_metadata_migration_completed', false );
		
		if ( ! $migration_completed ) {
			$this->migrate_existing_video_metadata();
			update_option( 'rtgodam_video_metadata_migration_completed', true );
		}
	}

	/**
	 * Save video duration and file size as meta fields when attachment is added.
	 *
	 * @param int $attachment_id The attachment ID.
	 * @return void
	 */
	public function save_video_metadata( $attachment_id ) {
		$this->process_video_metadata( $attachment_id );
	}

	/**
	 * Process a single video to save its duration and file size meta fields.
	 *
	 * @param int $attachment_id The attachment ID.
	 * @return void
	 */
	private function process_video_metadata( $attachment_id ) {
		$file_path = get_attached_file( $attachment_id );
		
		if ( $this->is_video_attachment( $attachment_id ) && file_exists( $file_path ) ) {
			// Check if metadata already exists to avoid unnecessary processing.
			$existing_duration = get_post_meta( $attachment_id, '_video_duration', true );
			$existing_size     = get_post_meta( $attachment_id, '_video_file_size', true );
			
			if ( empty( $existing_duration ) || empty( $existing_size ) ) {
				if ( ! function_exists( 'wp_read_video_metadata' ) ) {
					require_once ABSPATH . 'wp-admin/includes/media.php';
				}
				
				$metadata = wp_read_video_metadata( $file_path );
				
				// Save duration.
				if ( ! empty( $metadata['length'] ) ) {
					update_post_meta( $attachment_id, '_video_duration', intval( $metadata['length'] ) );
				}
				
				// Save file size.
				$file_size = filesize( $file_path );
				if ( $file_size ) {
					update_post_meta( $attachment_id, '_video_file_size', $file_size );
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
	 * Migrate existing videos to have duration and file size meta fields.
	 * This runs once on init after plugin activation in batches.
	 *
	 * @return void
	 */
	private function migrate_existing_video_metadata() {
		$offset          = 0;
		$has_more_videos = true;
		
		while ( $has_more_videos ) {
			// Get a batch of video attachments without metadata.
			$videos = get_posts(
				array(
					'post_type'      => 'attachment',
					'post_mime_type' => 'video',
					'posts_per_page' => self::BATCH_SIZE,
					'offset'         => $offset,
					// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
					'meta_query'     => array(
						'relation' => 'OR',
						array(
							'key'     => '_video_duration',
							'compare' => 'NOT EXISTS',
						),
						array(
							'key'     => '_video_file_size',
							'compare' => 'NOT EXISTS',
						),
					),
				)
			);
			
			if ( ! empty( $videos ) ) {
				// Process this batch.
				foreach ( $videos as $video ) {
					$this->process_video_metadata( $video->ID );
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
