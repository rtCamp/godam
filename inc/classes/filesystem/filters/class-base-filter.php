<?php
/**
 * Base Filter Class for GoDAM URL Replacement
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Filesystem\Filters;

defined( 'ABSPATH' ) || exit;

/**
 * Abstract Base Filter Class
 *
 * Provides common functionality for URL filtering between local and GoDAM CDN.
 *
 * @since n.e.x.t
 */
abstract class Base_Filter {

	/**
	 * The GoDAM Plugin instance.
	 *
	 * @since n.e.x.t
	 *
	 * @var Plugin
	 */
	protected $plugin;

	/**
	 * Query cache for avoiding repeated database calls.
	 *
	 * @since n.e.x.t
	 *
	 * @var array
	 */
	protected $query_cache = array();

	/**
	 * Constructor.
	 *
	 * @since n.e.x.t
	 *
	 * @param Plugin $plugin The GoDAM Plugin instance.
	 */
	public function __construct( $plugin ) {
		$this->plugin = $plugin;
		$this->init();
	}

	/**
	 * Initialize the filter handler.
	 *
	 * @since n.e.x.t
	 */
	protected function init() {
		add_action( 'rtgodam_filters_setup', array( $this, 'setup' ) );
	}

	/**
	 * Set up the filter handler.
	 *
	 * @since n.e.x.t
	 */
	public function setup() {
		// Purge cache on attachment delete.
		add_action( 'delete_attachment', array( $this, 'purge_cache_on_attachment_delete' ) );
	}

	/**
	 * Purge cache when attachment is deleted.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $attachment_id The attachment ID.
	 */
	public function purge_cache_on_attachment_delete( $attachment_id ) {
		// Clear any cached data for this attachment.
		if ( isset( $this->query_cache[ $attachment_id ] ) ) {
			unset( $this->query_cache[ $attachment_id ] );
		}
	}

	/**
	 * Process content for URL replacement.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $content The content to process.
	 * @param array  $cache   Cache array for storing processed URLs.
	 * @param array  $to_cache Array of URLs to cache.
	 *
	 * @return string Processed content.
	 */
	protected function process_content( $content, $cache, &$to_cache ) {
		if ( empty( $content ) ) {
			return $content;
		}

		if ( ! $this->should_filter_content() ) {
			return $content;
		}

		$content = $this->pre_replace_content( $content );

		// Find URLs from img src.
		$url_pairs = $this->get_urls_from_img_src( $content, $to_cache );
		$content   = $this->replace_urls( $content, $url_pairs );

		// Find leftover URLs.
		$content = $this->find_urls_and_replace( $content, $cache, $to_cache );

		// Perform post processing if required.
		$content = $this->post_process_content( $content );

		return $content;
	}

	/**
	 * Handle widget processing.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $instance Widget instance data.
	 *
	 * @return array Processed widget instance.
	 */
	protected function handle_widget( $instance ) {
		if ( empty( $instance ) || ! is_array( $instance ) ) {
			return $instance;
		}

		$cache    = array();
		$to_cache = array();

		foreach ( $instance as $key => $value ) {
			if ( empty( $value ) ) {
				continue;
			}

			if ( in_array( $key, array( 'text', 'content' ), true ) || $this->is_url( $value ) ) {
				$instance[ $key ] = $this->process_content( $value, $cache, $to_cache );
			}
		}

		return $instance;
	}

	/**
	 * Find URLs and replace them.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $value   The content value.
	 * @param array  $cache   Cache array.
	 * @param array  $to_cache Array of URLs to cache.
	 *
	 * @return string Processed content.
	 */
	protected function find_urls_and_replace( $value, $cache, &$to_cache ) {
		if ( ! $this->should_filter_content() ) {
			return $value;
		}

		$url_pairs = $this->get_urls_from_content( $value, $cache, $to_cache );
		$value     = $this->replace_urls( $value, $url_pairs );

		return $value;
	}

	/**
	 * Get URLs from content.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $content The content to search.
	 * @param array  $cache   Cache array.
	 * @param array  $to_cache Array of URLs to cache.
	 *
	 * @return array Array of URL pairs for replacement.
	 */
	protected function get_urls_from_content( $content, $cache, &$to_cache ) { //phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		$url_pairs = array();

		if ( ! is_string( $content ) ) {
			return $url_pairs;
		}

		// Simple URL pattern matching.
		preg_match_all( '/https?:\/\/[^\s<>"\'\)]+/i', $content, $matches );

		if ( empty( $matches[0] ) ) {
			return $url_pairs;
		}

		foreach ( $matches[0] as $url ) {
			// Strip trailing chars common in CSS url(...) and HTML attrs.
			$url = rtrim( $url, ')"\'' );

			if ( ! $this->url_needs_replacing( $url ) ) {
				continue;
			}

			$new_url = $this->get_replacement_url( $url );
			if ( $new_url && $new_url !== $url ) {
				$url_pairs[ $url ] = $new_url;
			}
		}

		return $url_pairs;
	}

	/**
	 * Get URLs from img src attributes.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $content  The content to search.
	 * @param array  $to_cache Array of URLs to cache.
	 *
	 * @return array Array of URL pairs for replacement.
	 */
	protected function get_urls_from_img_src( $content, &$to_cache ) { //phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		$url_pairs = array();

		if ( ! is_string( $content ) ) {
			return $url_pairs;
		}

		if ( ! preg_match_all( '/<img [^>]+>/', $content, $matches ) || ! isset( $matches[0] ) ) {
			return $url_pairs;
		}

		$matches      = array_unique( $matches[0] );
		$item_sources = array();

		foreach ( $matches as $image ) {
			if ( ! preg_match( '/wp-image-([0-9]+)/i', $image, $class_id ) || ! isset( $class_id[1] ) ) {
				continue;
			}

			if ( ! preg_match( '/src=\\\?["\']+([^"\'\\\]+)/', $image, $src ) || ! isset( $src[1] ) ) {
				continue;
			}

			$url = $src[1];

			if ( ! $this->is_usable_url( $url ) ) {
				continue;
			}

			if ( ! $this->url_needs_replacing( $url ) ) {
				continue;
			}

			$attachment_id        = absint( $class_id[1] );
			$item_sources[ $url ] = array(
				'id'          => $attachment_id,
				'source_type' => 'media-library',
			);
		}

		foreach ( $item_sources as $url => $item_source ) {
			$new_url = $this->get_url( $item_source );
			if ( $new_url && $new_url !== $url ) {
				$url_pairs[ $url ] = $new_url;
			}
		}

		return $url_pairs;
	}

	/**
	 * Replace URLs in content.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $content   The content.
	 * @param array  $url_pairs Array of URL pairs to replace.
	 *
	 * @return string Processed content.
	 */
	protected function replace_urls( $content, $url_pairs ) {
		if ( empty( $url_pairs ) ) {
			return $content;
		}

		foreach ( $url_pairs as $find => $replace ) {
			$content = str_replace( $find, $replace, $content );
		}

		return $content;
	}

	/**
	 * Get replacement URL for a given URL.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $url The original URL.
	 *
	 * @return string|false The replacement URL or false if no replacement needed.
	 */
	protected function get_replacement_url( $url ) {
		// Try to determine attachment ID from URL.
		$attachment_id = $this->get_attachment_id_from_url( $url );

		if ( ! $attachment_id ) {
			return false;
		}

		$item_source = array(
			'id'          => $attachment_id,
			'source_type' => 'media-library',
		);

		return $this->get_url( $item_source );
	}

	/**
	 * Get attachment ID from URL.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $url The URL.
	 *
	 * @return int|false The attachment ID or false if not found.
	 */
	protected function get_attachment_id_from_url( $url ) {
		global $wpdb;

		// Normalize URL (strip query/fragments).
		$url = strtok( $url, '?' );

		// 1) Prefer core resolver (works for images, videos, docs).
		if ( function_exists( 'wpcom_vip_attachment_url_to_postid' ) ) {
			// Use VIP-compatible function if available.
			$pid = wpcom_vip_attachment_url_to_postid( $url );
		} elseif ( function_exists( 'attachment_url_to_postid' ) ) {
			// Fallback to core function.
			$pid = attachment_url_to_postid( $url ); //phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.attachment_url_to_postid_attachment_url_to_postid
		} else {
			$pid = false;
		}

		if ( $pid ) {
			return (int) $pid;
		}

		// 2) Try exact match against _wp_attached_file (stores path relative to uploads).
		$uploads = wp_get_upload_dir();
		if ( ! empty( $uploads['baseurl'] ) && strpos( $url, $uploads['baseurl'] ) !== false ) {
			$relative = ltrim( str_replace( trailingslashit( $uploads['baseurl'] ), '', $url ), '/' );
			// Try to find attachment by URL.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$pid = $wpdb->get_var(
				$wpdb->prepare(
					"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_wp_attached_file' AND meta_value = %s LIMIT 1",
					$relative
				)
			);
			if ( $pid ) {
				return (int) $pid;
			}
		}

		// 3) Fallback: LIKE search on metadata by basename (works mostly for images).
		$basename = basename( $url );
		// Try to find attachment by URL.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$attachment_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_wp_attachment_metadata' AND meta_value LIKE %s LIMIT 1",
				'%' . $basename . '%'
			)
		);

		return $attachment_id ? (int) $attachment_id : false;
	}

	/**
	 * Pre-process content before URL replacement.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $content The content.
	 *
	 * @return string Processed content.
	 */
	protected function pre_replace_content( $content ) {
		return $content;
	}

	/**
	 * Post-process content after URL replacement.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $content The content.
	 *
	 * @return string Processed content.
	 */
	protected function post_process_content( $content ) {
		return $content;
	}

	/**
	 * Check if a URL is usable for processing.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $url The URL to check.
	 *
	 * @return bool True if URL is usable.
	 */
	protected function is_usable_url( $url ) {
		if ( empty( $url ) ) {
			return false;
		}

		// Basic URL validation.
		return filter_var( $url, FILTER_VALIDATE_URL ) !== false;
	}

	/**
	 * Check if a value is a URL.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $value The value to check.
	 *
	 * @return bool True if value is a URL.
	 */
	protected function is_url( $value ) {
		return is_string( $value ) && preg_match( '/^https?:\/\//', $value );
	}

	// Abstract methods that must be implemented by child classes.

	/**
	 * Check if content should be filtered.
	 *
	 * @return bool True if content should be filtered.
	 */
	abstract protected function should_filter_content();

	/**
	 * Check if URL needs replacing.
	 *
	 * @param string $url The URL to check.
	 *
	 * @return bool True if URL needs replacing.
	 */
	abstract public function url_needs_replacing( $url );

	/**
	 * Get URL for item source.
	 *
	 * @param array       $item_source The item source data.
	 * @param string|null $object_key  Optional object key.
	 *
	 * @return string|false The URL or false if not found.
	 */
	abstract protected function get_url( $item_source, $object_key = null );
}
