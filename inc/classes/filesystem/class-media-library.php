<?php
/**
 * Media Library Filter Class
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Filesystem;

defined( 'ABSPATH' ) || exit;

/**
 * Media Library Filter Class
 *
 * Handles attachment URL filtering and media library integration.
 */
class Media_Library {

	/**
	 * The GoDAM Plugin instance.
	 *
	 * @since n.e.x.t
	 *
	 * @var Plugin
	 */
	private $plugin;

	/**
	 * Constructor.
	 *
	 * @since n.e.x.t
	 *
	 * @param Plugin $plugin The GoDAM Plugin instance.
	 */
	public function __construct( $plugin ) {
		$this->plugin = $plugin;
		$this->setup();
	}

	/**
	 * Set up the hooks.
	 *
	 * @since n.e.x.t
	 */
	public function setup() {
		// Core attachment URL filters.
		add_filter( 'wp_get_attachment_url', array( $this, 'wp_get_attachment_url' ), 99, 2 );
		add_filter( 'wp_get_attachment_image_attributes', array( $this, 'wp_get_attachment_image_attributes' ), 99, 3 );
		add_filter( 'wp_get_attachment_image_src', array( $this, 'wp_get_attachment_image_src' ), 99, 4 );
		add_filter( 'wp_prepare_attachment_for_js', array( $this, 'wp_prepare_attachment_for_js' ), 99, 3 );
		add_filter( 'image_get_intermediate_size', array( $this, 'image_get_intermediate_size' ), 99, 3 );

		// Srcset and sizes.
		add_filter( 'wp_calculate_image_srcset', array( $this, 'wp_calculate_image_srcset' ), 100, 5 );

		// Shortcodes.
		add_filter( 'wp_audio_shortcode', array( $this, 'wp_media_shortcode' ), 100, 5 );
		add_filter( 'wp_video_shortcode', array( $this, 'wp_media_shortcode' ), 100, 5 );

		// Attachment file handling.
		add_filter( 'get_attached_file', array( $this, 'get_attached_file' ), 10, 2 );
		add_filter( 'wp_get_original_image_path', array( $this, 'get_attached_file' ), 10, 2 );
	}

	/**
	 * Filter attachment URL.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $url     Attachment URL.
	 * @param int    $post_id Attachment post ID.
	 *
	 * @return string Filtered URL.
	 */
	public function wp_get_attachment_url( $url, $post_id ) {
		// Check if attachment is migrated to GoDAM.
		$is_migrated = get_post_meta( $post_id, '_media_migrated_to_godam_cdn', true );
		if ( ! $is_migrated ) {
			return $url;
		}

		// Get CDN URL.
		$cdn_url = $this->get_attachment_cdn_url( $post_id );
		return $cdn_url ? $cdn_url : $url;
	}

	/**
	 * Filter attachment image attributes.
	 *
	 * @since n.e.x.t
	 *
	 * @param array    $attr       Image attributes.
	 * @param \WP_Post $attachment Attachment post.
	 * @param string   $size       Image size.
	 *
	 * @return array Filtered attributes.
	 */
	public function wp_get_attachment_image_attributes( $attr, $attachment, $size ) {
		$is_migrated = get_post_meta( $attachment->ID, '_media_migrated_to_godam_cdn', true );
		if ( ! $is_migrated ) {
			return $attr;
		}

		// Fix src attribute for specific size.
		if ( ! empty( $size ) && ! empty( $attr['src'] ) ) {
			$cdn_url = $this->get_attachment_cdn_url( $attachment->ID, $size );
			if ( $cdn_url ) {
				$attr['src'] = $cdn_url;
			}
		}

		return $attr;
	}

	/**
	 * Filter attachment image src.
	 *
	 * @since n.e.x.t
	 *
	 * @param array|false      $image         Image data or false.
	 * @param int              $attachment_id Attachment ID.
	 * @param string|int|array $size          Image size.
	 * @param bool             $icon          Whether to show icon.
	 *
	 * @return array|false Filtered image data.
	 */
	public function wp_get_attachment_image_src( $image, $attachment_id, $size, $icon ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		if ( ! $image || ! isset( $image[0] ) ) {
			return $image;
		}

		$is_migrated = get_post_meta( $attachment_id, '_media_migrated_to_godam_cdn', true );
		if ( ! $is_migrated ) {
			return $image;
		}

		$cdn_url = $this->get_attachment_cdn_url( $attachment_id, $size );
		if ( $cdn_url ) {
			$image[0] = $cdn_url;
		}

		return $image;
	}

	/**
	 * Filter attachment data for JavaScript.
	 *
	 * @since n.e.x.t
	 *
	 * @param array      $response   Attachment data.
	 * @param int|object $attachment Attachment ID or object.
	 * @param array      $meta       Attachment metadata.
	 *
	 * @return array Filtered data.
	 */
	public function wp_prepare_attachment_for_js( $response, $attachment, $meta ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		$attachment_id = is_object( $attachment ) ? $attachment->ID : $attachment;

		$is_migrated = get_post_meta( $attachment_id, '_media_migrated_to_godam_cdn', true );
		if ( ! $is_migrated ) {
			return $response;
		}

		// Update main URL.
		if ( isset( $response['url'] ) ) {
			$cdn_url = $this->get_attachment_cdn_url( $attachment_id );
			if ( $cdn_url ) {
				$response['url'] = $cdn_url;
			}
		}

		// Update size URLs.
		if ( isset( $response['sizes'] ) && is_array( $response['sizes'] ) ) {
			foreach ( $response['sizes'] as $size => $size_data ) {
				$cdn_url = $this->get_attachment_cdn_url( $attachment_id, $size );
				if ( $cdn_url ) {
					$response['sizes'][ $size ]['url'] = $cdn_url;
				}
			}
		}

		return $response;
	}

	/**
	 * Filter intermediate image size.
	 *
	 * @since n.e.x.t
	 *
	 * @param array        $data    Image size data.
	 * @param int          $post_id Attachment post ID.
	 * @param string|array $size    Image size.
	 *
	 * @return array Filtered data.
	 */
	public function image_get_intermediate_size( $data, $post_id, $size ) {
		if ( empty( $data['url'] ) ) {
			return $data;
		}

		$is_migrated = get_post_meta( $post_id, '_media_migrated_to_godam_cdn', true );
		if ( ! $is_migrated ) {
			return $data;
		}

		$cdn_url = $this->get_attachment_cdn_url( $post_id, $size );
		if ( $cdn_url ) {
			$data['url'] = $cdn_url;
		}

		return $data;
	}

	/**
	 * Filter image srcset calculation.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $srcset       Image srcset.
	 * @param array  $size_array   Size array.
	 * @param string $image_src    Image source URL.
	 * @param array  $image_meta   Image metadata.
	 * @param int    $attachment_id Attachment ID.
	 *
	 * @return string Filtered srcset.
	 */
	public function wp_calculate_image_srcset( $srcset, $size_array, $image_src, $image_meta, $attachment_id ) {
		if ( empty( $srcset ) || ! is_string( $srcset ) ) {
			return $srcset;
		}

		// Validate parameters to prevent type errors.
		if ( ! is_array( $size_array ) || ! is_string( $image_src ) || ! is_array( $image_meta ) || ! is_numeric( $attachment_id ) ) {
			return $srcset;
		}

		$is_migrated = get_post_meta( $attachment_id, '_media_migrated_to_godam_cdn', true );
		if ( ! $is_migrated ) {
			return $srcset;
		}

		// Replace local URLs with CDN URLs in srcset.
		$upload_dirs = $this->plugin->get_original_upload_dir();
		if ( ! is_array( $upload_dirs ) || empty( $upload_dirs['baseurl'] ) ) {
			return $srcset;
		}

		$cdn_base   = rtrim( $this->plugin->get_remote_url(), '/' );
		$local_base = rtrim( $upload_dirs['baseurl'], '/' );

		$srcset = str_replace( $local_base, $cdn_base, $srcset );

		return $srcset;
	}

	/**
	 * Filter media shortcode output.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $output   Shortcode output.
	 * @param array  $atts     Shortcode attributes.
	 * @param string $audio    Audio file URL.
	 * @param int    $post_id  Post ID.
	 * @param string $library  Media library.
	 *
	 * @return string Filtered output.
	 */
	public function wp_media_shortcode( $output, $atts, $audio, $post_id, $library ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		if ( empty( $output ) ) {
			return $output;
		}

		// Replace any local URLs with CDN URLs in the shortcode output.
		$upload_dirs = $this->plugin->get_original_upload_dir();
		$cdn_base    = rtrim( $this->plugin->get_remote_url(), '/' );
		$local_base  = rtrim( $upload_dirs['baseurl'], '/' );

		return str_replace( $local_base, $cdn_base, $output );
	}

	/**
	 * Filter attached file path.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $file        Attached file path.
	 * @param int    $attachment_id Attachment ID.
	 *
	 * @return string Filtered file path.
	 */
	public function get_attached_file( $file, $attachment_id ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		// Return original file path for compatibility.
		return $file;
	}

	/**
	 * Get CDN URL for attachment.
	 *
	 * @since n.e.x.t
	 *
	 * @param int         $attachment_id Attachment ID.
	 * @param string|null $size          Image size.
	 *
	 * @return string|false CDN URL or false if not found.
	 */
	private function get_attachment_cdn_url( $attachment_id, $size = null ) {
		// Get file path.
		$file_path = get_attached_file( $attachment_id );
		if ( ! $file_path ) {
			return false;
		}

		// If file path starts with godam://, extract the relative path.
		if ( strpos( $file_path, 'godam://' ) === 0 ) {
			// Extract relative path from godam:// protocol.
			$relative_path = str_replace( 'godam://wp-content/uploads', '', $file_path );
		} else {
			// Convert local path to relative path.
			$upload_dirs   = $this->plugin->get_original_upload_dir();
			$relative_path = str_replace( $upload_dirs['basedir'], '', $file_path );
		}

		// Handle image sizes.
		if ( $size && is_string( $size ) && 'full' !== $size ) {
			$metadata = wp_get_attachment_metadata( $attachment_id );
			if ( ! empty( $metadata['sizes'][ $size ]['file'] ) ) {
				$size_file     = $metadata['sizes'][ $size ]['file'];
				$relative_path = str_replace( basename( $relative_path ), $size_file, $relative_path );
			}
		}

		// Generate CDN URL.
		$cdn_url = rtrim( $this->plugin->get_remote_url(), '/' ) . $relative_path;

		return $cdn_url;
	}
}
