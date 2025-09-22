<?php
/**
 * Video Metadata Handler Class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;
use WP_Post;

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
	 * Default width for video thumbnails in pixels.
	 */
	const DEFAULT_THUMBNAIL_WIDTH = 640;

	/**
	 * Default height for video thumbnails in pixels.
	 */
	const DEFAULT_THUMBNAIL_HEIGHT = 480;

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

		add_filter( 'wp_prepare_attachment_for_js', array( $this, 'set_media_library_thumbnail' ), 10, 3 );
		add_action( 'init', array( $this, 'filter_vimeo_migrated_urls' ) );

		add_filter( 'wp_get_attachment_image', array( $this, 'set_media_library_list_thumbnail' ), 10, 4 );
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
			//phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts
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

	/**
	 * Show thumbnails in the media library from URL present in the post meta.
	 *
	 * @param array       $response Array of attachment data.
	 * @param WP_Post     $attachment Attachment object.
	 * @param array|false $meta Array of attachment meta data.
	 * @return array
	 */
	public function set_media_library_thumbnail( $response, $attachment, $meta ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- $attachment and $meta are not modified.
		if ( strpos( $response['mime'], 'video/' ) === 0 ) {

			$thumbnail_url   = get_post_meta( $response['id'], 'rtgodam_media_video_thumbnail', true );
			$attachment_meta = get_post_meta( $response['id'], '_wp_attachment_metadata', true );

			if ( ! empty( $thumbnail_url ) ) {
				$response['image']['src']    = esc_url( $thumbnail_url );
				$response['image']['width']  = $attachment_meta['width'] ?? self::DEFAULT_THUMBNAIL_WIDTH;
				$response['image']['height'] = $attachment_meta['height'] ?? self::DEFAULT_THUMBNAIL_HEIGHT;
			}
		}
		return $response;
	}

	/**
	 * Filter to return the remote URL for Vimeo migrated videos.
	 *
	 * This filter modifies the attachment URL to return the remote URL
	 * if the video has been migrated from Vimeo.
	 *
	 * @since 1.4.0
	 */
	public function filter_vimeo_migrated_urls(): void {
		add_filter(
			'wp_get_attachment_url',
			function ( $url, $post_id ) {
				$is_vimeo_migrated = get_post_meta( $post_id, 'rtgodam_is_migrated_vimeo_video', true );
				if ( $is_vimeo_migrated ) {
					$remote_url = get_post_meta( $post_id, '_wp_attached_file', true );
					if ( ! empty( $remote_url ) ) {
						return $remote_url;
					}
				}
				return $url;
			},
			10,
			2
		);
	}

	/**
	 * Set custom thumbnail for video attachments in the media library list view.
	 *
	 * This filter targets the media library list view (upload screen) and
	 * replaces the default icon/thumbnail with a custom video thumbnail
	 * from post meta, if available.
	 *
	 * @param string     $html          The HTML output for the attachment.
	 * @param int        $attachment_id The ID of the attachment.
	 * @param array|bool $size          The size of the image (e.g., array(60, 60)).
	 * @param bool       $icon          Whether the attachment is displayed as an icon.
	 * @return string The modified HTML output for the thumbnail.
	 */
	public function set_media_library_list_thumbnail( $html, $attachment_id, $size, $icon ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- We dont use icon param.
		if ( is_admin() && 'upload' === get_current_screen()->id && array( 60, 60 ) === $size ) {

			$thumbnail_url = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );

			// Check for icon if it is a virtual media.
			if ( empty( $thumbnail_url ) ) {
				$thumbnail_url = get_post_meta( $attachment_id, '_godam_icon', true );
			}

			$attachment_meta = get_post_meta( $attachment_id, '_wp_attachment_metadata', true );

			if ( ! empty( $thumbnail_url ) ) {
				$width  = $attachment_meta['width'] ?? self::DEFAULT_THUMBNAIL_WIDTH;
				$height = $attachment_meta['height'] ?? self::DEFAULT_THUMBNAIL_HEIGHT;
				$html   = sprintf( '<img width="%s" height="%s" src="%s" style="object-fit: cover; height: 60px;" decoding="async" loading="lazy" />', esc_attr( $width ), esc_attr( $height ), esc_url( $thumbnail_url ) );
			}
		}

		return $html;
	}
}
