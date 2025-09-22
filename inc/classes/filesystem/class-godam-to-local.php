<?php
/**
 * GoDAM to Local Filter Class
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Filesystem;

defined( 'ABSPATH' ) || exit;

/**
 * GoDAM to Local Filter Class
 *
 * Handles converting GoDAM CDN URLs back to local URLs when saving content.
 *
 * @since n.e.x.t
 */
class GoDAM_To_Local extends Base_Filter {

	/**
	 * Set up the filter hooks.
	 *
	 * @since n.e.x.t
	 */
	public function setup() {
		parent::setup();

		// Content Saving (normalize URLs before saving to database).
		add_filter( 'content_save_pre', array( $this, 'filter_post' ) );
		add_filter( 'excerpt_save_pre', array( $this, 'filter_post' ) );

		// Widget Saving.
		add_filter( 'widget_update_callback', array( $this, 'filter_widget_save' ) );
		add_filter( 'pre_update_option_widget_block', array( $this, 'filter_widget_block_save' ) );

		// Customizer Saving.
		add_filter( 'pre_set_theme_mod_background_image', array( $this, 'filter_customizer_image' ), 10, 2 );
		add_filter( 'pre_set_theme_mod_header_image', array( $this, 'filter_customizer_image' ), 10, 2 );
		add_filter( 'pre_set_theme_mod_header_image_data', array( $this, 'filter_header_image_data' ), 10, 2 );
		add_filter( 'update_custom_css_data', array( $this, 'filter_update_custom_css_data' ), 10, 2 );
	}

	/**
	 * Filter post content before saving.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $content The post content.
	 *
	 * @return string Filtered content.
	 */
	public function filter_post( $content ) {
		if ( empty( $content ) ) {
			return $content;
		}

		$cache    = array();
		$to_cache = array();

		return $this->process_content( $content, $cache, $to_cache );
	}

	/**
	 * Filter widget save callback.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $instance Widget instance.
	 *
	 * @return array Filtered instance.
	 */
	public function filter_widget_save( $instance ) {
		return $this->handle_widget( $instance );
	}

	/**
	 * Filter widget block save.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $value Widget block value.
	 *
	 * @return array Filtered value.
	 */
	public function filter_widget_block_save( $value ) {
		if ( empty( $value ) || ! is_array( $value ) ) {
			return $value;
		}

		foreach ( $value as $idx => $section ) {
			$value[ $idx ] = $this->handle_widget( $section );
		}

		return $value;
	}

	/**
	 * Filter customizer image.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $value     Image URL.
	 * @param string $old_value Previous value.
	 *
	 * @return string Filtered URL.
	 */
	public function filter_customizer_image( $value, $old_value = '' ) {
		if ( empty( $value ) || ! $this->url_needs_replacing( $value ) ) {
			return $value;
		}

		$new_url = $this->get_replacement_url( $value );
		return $new_url ? $new_url : $value;
	}

	/**
	 * Filter header image data.
	 *
	 * @since n.e.x.t
	 *
	 * @param array  $data     Header image data.
	 * @param string $theme   Theme name.
	 *
	 * @return array Filtered data.
	 */
	public function filter_header_image_data( $data, $theme ) {
		if ( empty( $data ) || ! is_array( $data ) ) {
			return $data;
		}

		if ( ! empty( $data['url'] ) && $this->url_needs_replacing( $data['url'] ) ) {
			$new_url = $this->get_replacement_url( $data['url'] );
			if ( $new_url ) {
				$data['url'] = $new_url;
			}
		}

		return $data;
	}

	/**
	 * Filter custom CSS data update.
	 *
	 * @since n.e.x.t
	 *
	 * @param array  $data CSS data.
	 * @param string $args CSS args.
	 *
	 * @return array Filtered data.
	 */
	public function filter_update_custom_css_data( $data, $args ) {
		if ( empty( $data['css'] ) ) {
			return $data;
		}

		$data['css'] = $this->filter_post( $data['css'] );

		return $data;
	}

	/**
	 * Check if content should be filtered.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool True if content should be filtered.
	 */
	protected function should_filter_content() {
		return true;
	}

	/**
	 * Check if URL needs replacing.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $url The URL to check.
	 *
	 * @return bool True if URL needs replacing.
	 */
	public function url_needs_replacing( $url ) {
		if ( empty( $url ) ) {
			return false;
		}

		$cdn_host = wp_parse_url( $this->plugin->get_remote_url(), PHP_URL_HOST );
		return strpos( $url, $cdn_host ) !== false;
	}

	/**
	 * Get URL for item source.
	 *
	 * @since n.e.x.t
	 *
	 * @param array       $item_source The item source data.
	 * @param string|null $object_key  Optional object key.
	 *
	 * @return string|false The local URL or false if not found.
	 */
	protected function get_url( $item_source, $object_key = null ) {
		if ( empty( $item_source['id'] ) ) {
			return false;
		}

		// Get the original local URL by temporarily removing our filter.
		$attachment_id = $item_source['id'];

		// Get the original upload directory.
		$upload_dirs = $this->plugin->get_original_upload_dir();

		// Get the attached file path.
		$file_path = get_attached_file( $attachment_id );
		if ( ! $file_path ) {
			return false;
		}

		// Convert file path to local URL.
		if ( strpos( $file_path, 'godam://' ) === 0 ) {
			// Extract relative path from godam:// protocol.
			$relative_path = str_replace( 'godam://wp-content/uploads', '', $file_path );
		} else {
			// Convert local path to relative path.
			$relative_path = str_replace( $upload_dirs['basedir'], '', $file_path );
		}

		// Generate local URL using original upload directory.
		$local_url = rtrim( $upload_dirs['baseurl'], '/' ) . $relative_path;

		return $local_url;
	}

	/**
	 * Get attachment ID from CDN URL.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $url The CDN URL.
	 *
	 * @return int|false The attachment ID or false if not found.
	 */
	protected function get_attachment_id_from_url( $url ) {
		global $wpdb;

		// Normalize URL (strip query/fragments).
		$url = strtok( $url, '?' );

		// Extract the path from the CDN URL.
		$cdn_host = wp_parse_url( $this->plugin->get_remote_url(), PHP_URL_HOST );
		if ( strpos( $url, $cdn_host ) === false ) {
			return false; // Not a CDN URL.
		}

		// Extract the relative path from the CDN URL.
		$relative_path = str_replace( 'https://' . $cdn_host, '', $url );
		$relative_path = str_replace( 'http://' . $cdn_host, '', $relative_path );

		// Remove leading slash.
		$relative_path = ltrim( $relative_path, '/' );

		// Remove 'uploads/' prefix to match _wp_attached_file format.
		$relative_path = preg_replace( '#^uploads/#', '', $relative_path );

		// Try to find attachment by the relative path.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$attachment_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_wp_attached_file' AND meta_value = %s LIMIT 1",
				$relative_path
			)
		);

		if ( $attachment_id ) {
			return (int) $attachment_id;
		}

		// Fallback: search by basename.
		$basename = basename( $url );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$attachment_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_wp_attachment_metadata' AND meta_value LIKE %s LIMIT 1",
				'%' . $basename . '%'
			)
		);

		return $attachment_id ? (int) $attachment_id : false;
	}
}
