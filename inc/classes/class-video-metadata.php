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
		/**
		 * Fires before reading/writing this attachment's video-duration and
		 * file-size meta, so integrations that centralize media on another
		 * site can switch context first. Reads the attachment's file path
		 * and existing `_video_duration`/`_video_file_size` postmeta, then
		 * writes back freshly probed values for whichever one is still
		 * missing.
		 *
		 * @since 1.8.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );

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

		do_action( 'rtgodam_after_attachment_lookup' );
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
			/**
			 * Fires before querying for video attachments still missing
			 * duration/file-size meta, so integrations that centralize
			 * media on another site can switch context first. This
			 * get_posts() call reads directly from the attachment post
			 * type (post_type => attachment), batched across every
			 * matching video on the site.
			 *
			 * @since 1.8.0
			 */
			do_action( 'rtgodam_before_attachment_lookup' );
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
			do_action( 'rtgodam_after_attachment_lookup' );

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
		$mime          = isset( $response['mime'] ) ? $response['mime'] : '';
		$thumbnail_url = '';

		/**
		 * Fires before reading this attachment's video/PDF/audio-thumbnail
		 * and `_wp_attachment_metadata` postmeta, so integrations that
		 * centralize media on another site can switch context first. This
		 * filter runs on every wp_prepare_attachment_for_js() call
		 * plugin-wide, including ones GoDAM doesn't control (WP core's
		 * media modal, REST responses) — self-wrapped so it's correct
		 * regardless of who triggered it.
		 *
		 * @since 1.8.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );

		if ( 0 === strpos( $mime, 'video/' ) || 'application/pdf' === $mime ) {
			$thumbnail_url = get_post_meta( $response['id'], 'rtgodam_media_video_thumbnail', true );

			// Check for icon if it is a virtual media (for PDFs imported from GoDAM).
			if ( empty( $thumbnail_url ) ) {
				$thumbnail_url = get_post_meta( $response['id'], 'rtgodam_media_pdf_thumbnail', true );
			}
		} elseif ( 0 === strpos( $mime, 'audio/' ) ) {
			// Virtual GoDAM audio carries its cover in dedicated meta (no image
			// subsizes exist for it), so surface it in the media library grid
			// and in the media object blocks receive on selection.
			$thumbnail_url = get_post_meta( $response['id'], 'rtgodam_media_audio_thumbnail', true );
		}

		if ( ! empty( $thumbnail_url ) ) {
			$attachment_meta = get_post_meta( $response['id'], '_wp_attachment_metadata', true );

			$response['image']['src']    = esc_url( rtgodam_convert_to_https_url( $thumbnail_url ) );
			$response['image']['width']  = $attachment_meta['width'] ?? self::DEFAULT_THUMBNAIL_WIDTH;
			$response['image']['height'] = $attachment_meta['height'] ?? self::DEFAULT_THUMBNAIL_HEIGHT;
		}

		do_action( 'rtgodam_after_attachment_lookup' );

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
				/**
				 * Fires before reading this attachment's meta, so
				 * integrations that centralize media on another site can
				 * switch context first. This filter runs on every
				 * wp_get_attachment_url() call plugin-wide, including ones
				 * GoDAM doesn't control (WP core, other plugins) —
				 * self-wrapped so it's correct regardless of who triggered
				 * it.
				 *
				 * @since 1.8.0
				 */
				do_action( 'rtgodam_before_attachment_lookup' );
				try {
					$is_vimeo_migrated = get_post_meta( $post_id, 'rtgodam_is_migrated_vimeo_video', true );
					if ( $is_vimeo_migrated ) {
						$remote_url = get_post_meta( $post_id, '_wp_attached_file', true );
						if ( ! empty( $remote_url ) ) {
							return $remote_url;
						}
					}
					return $url;
				} finally {
					do_action( 'rtgodam_after_attachment_lookup' );
				}
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

			/**
			 * Fires before reading this attachment's video/audio-thumbnail,
			 * `_godam_icon`, and `_wp_attachment_metadata` postmeta, so
			 * integrations that centralize media on another site can
			 * switch context first. This filter runs on every
			 * wp_get_attachment_image() call plugin-wide, including ones
			 * GoDAM doesn't control — self-wrapped so it's correct
			 * regardless of who triggered it. Scoped to the admin
			 * upload-list-view branch, the only branch that touches
			 * attachment postmeta.
			 *
			 * @since 1.8.0
			 */
			do_action( 'rtgodam_before_attachment_lookup' );

			$thumbnail_url = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );

			// Virtual GoDAM audio stores its cover in dedicated meta.
			if ( empty( $thumbnail_url ) ) {
				$thumbnail_url = get_post_meta( $attachment_id, 'rtgodam_media_audio_thumbnail', true );
			}

			// Check for icon if it is a virtual media.
			if ( empty( $thumbnail_url ) ) {
				$thumbnail_url = get_post_meta( $attachment_id, '_godam_icon', true );
			}

			$attachment_meta = get_post_meta( $attachment_id, '_wp_attachment_metadata', true );

			if ( ! empty( $thumbnail_url ) ) {
				$width  = $attachment_meta['width'] ?? self::DEFAULT_THUMBNAIL_WIDTH;
				$height = $attachment_meta['height'] ?? self::DEFAULT_THUMBNAIL_HEIGHT;
				$html   = sprintf( '<img width="%s" height="%s" src="%s" style="object-fit: cover; height: 60px;" decoding="async" loading="lazy" />', esc_attr( $width ), esc_attr( $height ), esc_url( rtgodam_convert_to_https_url( $thumbnail_url ) ) );
			}

			do_action( 'rtgodam_after_attachment_lookup' );
		}

		return $html;
	}
}
