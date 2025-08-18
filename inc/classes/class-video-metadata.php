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
					error_log( "GoDAM: WordPress metadata extraction successful for attachment {$attachment_id}, duration: " . $metadata['length'] );
				} else {
					error_log( "GoDAM: WordPress metadata extraction failed for attachment {$attachment_id}, file: {$file_path}" );
					
					// Try fallback methods to get video duration when WordPress fails.
					$duration = $this->get_video_duration_fallback( $file_path, $attachment_id );
					if ( $duration ) {
						update_post_meta( $attachment_id, '_video_duration', intval( $duration ) );
						error_log( "GoDAM: Fallback extraction successful for attachment {$attachment_id}, duration: {$duration}" );
						
						// Also update the core WordPress metadata so duration shows in admin
						$wp_metadata = wp_get_attachment_metadata( $attachment_id );
						if ( ! is_array( $wp_metadata ) ) {
							$wp_metadata = array();
						}
						
						// Add the duration data that WordPress expects
						$wp_metadata['length'] = intval( $duration );
						$wp_metadata['length_formatted'] = $this->format_duration_for_admin( intval( $duration ) );
						
						// Update the WordPress attachment metadata
						wp_update_attachment_metadata( $attachment_id, $wp_metadata );
						error_log( "GoDAM: WordPress core metadata updated for attachment {$attachment_id} with duration: {$duration}" );
					} else {
						error_log( "GoDAM: All fallback methods failed for attachment {$attachment_id}" );
					}
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
	 * Get video duration using fallback methods when getID3 fails.
	 *
	 * @param string $file_path Path to the video file.
	 * @param int    $attachment_id The attachment ID (unused but kept for filter compatibility).
	 * @return float|false Duration in seconds or false if unable to determine.
	 */
	private function get_video_duration_fallback( $file_path, $attachment_id ) {
		error_log( "GoDAM: Starting fallback duration extraction for attachment {$attachment_id}, file: {$file_path}" );
		
		if ( ! file_exists( $file_path ) ) {
			error_log( "GoDAM: File does not exist: {$file_path}" );
			return false;
		}
		
		$file_size = filesize( $file_path );
		error_log( "GoDAM: File size: {$file_size} bytes" );
		
		// Try enhanced getID3 with different configurations
		$duration = $this->get_duration_with_getid3_fallback( $file_path );
		if ( false !== $duration ) {
			error_log( "GoDAM: Enhanced getID3 extraction successful, duration: {$duration}" );
			return $duration;
		}

		// Try direct file parsing for common formats
		$duration = $this->get_duration_from_file_headers( $file_path );
		if ( false !== $duration ) {
			error_log( "GoDAM: Direct file parsing successful, duration: {$duration}" );
			return $duration;
		}

		error_log( "GoDAM: All fallback methods failed for {$file_path}" );
		return false;
	}

	/**
	 * Enhanced getID3 parsing with fallback configurations.
	 *
	 * @param string $file_path Path to the video file.
	 * @return float|false Duration in seconds or false if unable to determine.
	 */
	private function get_duration_with_getid3_fallback( $file_path ) {
		error_log( "GoDAM: Starting enhanced getID3 extraction for: {$file_path}" );
		
		if ( ! file_exists( $file_path ) ) {
			error_log( "GoDAM: getID3 - File does not exist: {$file_path}" );
			return false;
		}

		// Load getID3 library
		if ( ! class_exists( 'getID3' ) ) {
			$getid3_path = ABSPATH . WPINC . '/ID3/getid3.php';
			if ( ! file_exists( $getid3_path ) ) {
				error_log( "GoDAM: getID3 library not found at: {$getid3_path}" );
				return false;
			}
			require_once( $getid3_path );
		}

		try {
			$getid3 = new \getID3();
			
			// Configure for better video support
			$getid3->option_md5_data        = false;
			$getid3->option_md5_data_source = false;
			$getid3->option_tags_process    = false;
			$getid3->option_extra_info      = true;
			$getid3->encoding               = 'UTF-8';

			error_log( "GoDAM: getID3 configured, analyzing file..." );
			
			// Try analysis
			$file_info = $getid3->analyze( $file_path );

			if ( isset( $file_info['error'] ) ) {
				error_log( "GoDAM: getID3 errors: " . print_r( $file_info['error'], true ) );
			}
			
			if ( isset( $file_info['warning'] ) ) {
				error_log( "GoDAM: getID3 warnings: " . print_r( $file_info['warning'], true ) );
			}

			error_log( "GoDAM: getID3 analysis complete. Available keys: " . implode( ', ', array_keys( $file_info ) ) );

			// Check for duration in various locations
			if ( isset( $file_info['playtime_seconds'] ) && $file_info['playtime_seconds'] > 0 ) {
				error_log( "GoDAM: Found duration in playtime_seconds: " . $file_info['playtime_seconds'] );
				return (float) $file_info['playtime_seconds'];
			}

			if ( isset( $file_info['video']['playtime_seconds'] ) && $file_info['video']['playtime_seconds'] > 0 ) {
				error_log( "GoDAM: Found duration in video.playtime_seconds: " . $file_info['video']['playtime_seconds'] );
				return (float) $file_info['video']['playtime_seconds'];
			}

			if ( isset( $file_info['audio']['playtime_seconds'] ) && $file_info['audio']['playtime_seconds'] > 0 ) {
				error_log( "GoDAM: Found duration in audio.playtime_seconds: " . $file_info['audio']['playtime_seconds'] );
				return (float) $file_info['audio']['playtime_seconds'];
			}

			// Try to calculate from bitrate and filesize
			if ( isset( $file_info['bitrate'] ) && $file_info['bitrate'] > 0 && isset( $file_info['filesize'] ) ) {
				$duration = ( $file_info['filesize'] * 8 ) / $file_info['bitrate'];
				if ( $duration > 0 ) {
					error_log( "GoDAM: Calculated duration from bitrate: {$duration}" );
					return (float) $duration;
				}
			}

			error_log( "GoDAM: getID3 - no duration found in any expected location" );
			return false;
			
		} catch ( \Exception $e ) {
			error_log( "GoDAM: getID3 exception: " . $e->getMessage() );
			return false;
		}
	}

	/**
	 * Attempt to extract duration from file headers for various video formats.
	 * This method provides a universal approach that works on any server.
	 *
	 * @param string $file_path Path to the video file.
	 * @return int|false Duration in seconds or false if failed.
	 */
	private function get_duration_from_file_headers( $file_path ) {
		error_log( "GoDAM: Starting direct file header parsing for: {$file_path}" );
		
		$handle = fopen( $file_path, 'rb' );
		if ( ! $handle ) {
			error_log( "GoDAM: Could not open file for reading: {$file_path}" );
			return false;
		}

		$mime_type = mime_content_type( $file_path );
		error_log( "GoDAM: Detected MIME type: {$mime_type}" );
		$duration = false;

		// Try different parsing methods based on file type.
		if ( strpos( $mime_type, 'video/mp4' ) !== false || strpos( $mime_type, 'video/quicktime' ) !== false ) {
			error_log( "GoDAM: Attempting MP4 parsing" );
			$duration = $this->parse_mp4_duration( $handle );
		} elseif ( strpos( $mime_type, 'video/webm' ) !== false ) {
			error_log( "GoDAM: Attempting WebM parsing" );
			$duration = $this->parse_webm_duration( $handle );
		} elseif ( strpos( $mime_type, 'video/avi' ) !== false ) {
			error_log( "GoDAM: Attempting AVI parsing" );
			$duration = $this->parse_avi_duration( $handle );
		} else {
			error_log( "GoDAM: Unsupported MIME type for direct parsing: {$mime_type}" );
		}

		fclose( $handle );
		
		if ( $duration ) {
			error_log( "GoDAM: Direct file parsing successful, duration: {$duration}" );
			return intval( $duration );
		} else {
			error_log( "GoDAM: Direct file parsing failed" );
			return false;
		}
	}

	/**
	 * Parse MP4/MOV file for duration information.
	 *
	 * @param resource $handle File handle.
	 * @return int|false Duration in seconds or false if failed.
	 */
	private function parse_mp4_duration( $handle ) {
		error_log( "GoDAM: Starting MP4 duration parsing" );
		rewind( $handle );
		$duration = 0;
		$timescale = 1;
		$found_mvhd = false;

		// Read file in larger chunks for better performance.
		while ( ! feof( $handle ) ) {
			$chunk = fread( $handle, 16384 );
			if ( false === $chunk ) {
				break;
			}

			// Look for mvhd atom (movie header).
			$mvhd_pos = strpos( $chunk, 'mvhd' );
			if ( false !== $mvhd_pos ) {
				$found_mvhd = true;
				error_log( "GoDAM: Found mvhd atom at position " . ( ftell( $handle ) - strlen( $chunk ) + $mvhd_pos ) );
				
				// Found mvhd atom, extract timescale and duration.
				$current_pos = ftell( $handle ) - strlen( $chunk ) + $mvhd_pos;
				fseek( $handle, $current_pos + 12 ); // Skip atom size and type.
				
				$version_flags = fread( $handle, 4 );
				if ( strlen( $version_flags ) === 4 ) {
					$version = ord( $version_flags[0] );
					error_log( "GoDAM: mvhd version: {$version}" );
					
					if ( $version === 0 ) {
						// Version 0: 32-bit values.
						fseek( $handle, $current_pos + 20 ); // Skip to timescale.
						$timescale_data = fread( $handle, 4 );
						$duration_data = fread( $handle, 4 );
						
						if ( strlen( $timescale_data ) === 4 && strlen( $duration_data ) === 4 ) {
							$timescale = unpack( 'N', $timescale_data )[1];
							$duration = unpack( 'N', $duration_data )[1];
							error_log( "GoDAM: MP4 v0 - timescale: {$timescale}, duration: {$duration}" );
						}
					} elseif ( $version === 1 ) {
						// Version 1: 64-bit values.
						fseek( $handle, $current_pos + 28 ); // Skip to timescale.
						$timescale_data = fread( $handle, 4 );
						$duration_data = fread( $handle, 8 );
						
						if ( strlen( $timescale_data ) === 4 && strlen( $duration_data ) === 8 ) {
							$timescale = unpack( 'N', $timescale_data )[1];
							// For 64-bit, we only use the lower 32 bits for simplicity.
							$duration = unpack( 'N', substr( $duration_data, 4, 4 ) )[1];
							error_log( "GoDAM: MP4 v1 - timescale: {$timescale}, duration: {$duration}" );
						}
					}
					
					if ( $timescale > 0 && $duration > 0 ) {
						$calculated_duration = $duration / $timescale;
						error_log( "GoDAM: MP4 duration calculation successful: {$calculated_duration} seconds" );
						return $calculated_duration;
					}
				}
			}
		}

		if ( ! $found_mvhd ) {
			error_log( "GoDAM: mvhd atom not found in MP4 file" );
		} else {
			error_log( "GoDAM: mvhd atom found but duration calculation failed" );
		}

		return false;
	}

	/**
	 * Parse WebM file for duration information.
	 *
	 * @param resource $handle File handle.
	 * @return int|false Duration in seconds or false if failed.
	 */
	private function parse_webm_duration( $handle ) {
		rewind( $handle );
		
		// WebM duration parsing is complex, so we'll do a basic check.
		// Look for duration field in the segment info.
		while ( ! feof( $handle ) ) {
			$chunk = fread( $handle, 8192 );
			if ( false === $chunk ) {
				break;
			}
			
			// This is a simplified approach for WebM.
			// In practice, WebM parsing requires understanding EBML structure.
			// For now, we'll return false and let client-side handle it.
		}
		
		return false;
	}

	/**
	 * Parse AVI file for duration information.
	 *
	 * @param resource $handle File handle.
	 * @return int|false Duration in seconds or false if failed.
	 */
	private function parse_avi_duration( $handle ) {
		rewind( $handle );
		
		// Look for AVI header.
		$header = fread( $handle, 12 );
		if ( substr( $header, 0, 4 ) !== 'RIFF' || substr( $header, 8, 4 ) !== 'AVI ' ) {
			return false;
		}
		
		// Look for avih chunk (AVI header).
		while ( ! feof( $handle ) ) {
			$chunk_header = fread( $handle, 8 );
			if ( strlen( $chunk_header ) < 8 ) {
				break;
			}
			
			$chunk_id = substr( $chunk_header, 0, 4 );
			$chunk_size = unpack( 'V', substr( $chunk_header, 4, 4 ) )[1];
			
			if ( $chunk_id === 'avih' ) {
				// Found AVI header.
				$avih_data = fread( $handle, min( $chunk_size, 56 ) );
				if ( strlen( $avih_data ) >= 8 ) {
					$microsec_per_frame = unpack( 'V', substr( $avih_data, 0, 4 ) )[1];
					$total_frames = unpack( 'V', substr( $avih_data, 16, 4 ) )[1];
					
					if ( $microsec_per_frame > 0 && $total_frames > 0 ) {
						// Calculate duration in seconds.
						return ( $total_frames * $microsec_per_frame ) / 1000000;
					}
				}
				break;
			} else {
				// Skip this chunk.
				fseek( $handle, ftell( $handle ) + $chunk_size );
			}
		}
		
		return false;
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
	 * @since n.e.x.t
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

			$thumbnail_url   = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );
			$attachment_meta = get_post_meta( $attachment_id, '_wp_attachment_metadata', true );

			if ( ! empty( $thumbnail_url ) ) {
				$width  = $attachment_meta['width'] ?? self::DEFAULT_THUMBNAIL_WIDTH;
				$height = $attachment_meta['height'] ?? self::DEFAULT_THUMBNAIL_HEIGHT;
				$html   = sprintf( '<img width="%s" height="%s" src="%s" style="object-fit: cover; height: 60px;" decoding="async" loading="lazy" />', esc_attr( $width ), esc_attr( $height ), esc_url( $thumbnail_url ) );
			}
		}

		return $html;
	}

	/**
	 * Format duration for WordPress admin display.
	 *
	 * @param int $duration Duration in seconds.
	 * @return string Formatted duration string.
	 */
	private function format_duration_for_admin( $duration ) {
		$hours   = floor( $duration / 3600 );
		$minutes = floor( ( $duration % 3600 ) / 60 );
		$seconds = $duration % 60;

		if ( $hours > 0 ) {
			return sprintf( '%d:%02d:%02d', $hours, $minutes, $seconds );
		} else {
			return sprintf( '%d:%02d', $minutes, $seconds );
		}
	}
}
