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
 */
class GoDAM_To_Local extends Base_Filter {

	/**
	 * Set up the filter hooks.
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
	 * @return bool True if content should be filtered.
	 */
	protected function should_filter_content() {
		return true;
	}

	/**
	 * Check if URL needs replacing.
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
	 * @param array       $item_source The item source data.
	 * @param string|null $object_key  Optional object key.
	 *
	 * @return string|false The local URL or false if not found.
	 */
	protected function get_url( $item_source, $object_key = null ) {
		if ( empty( $item_source['id'] ) ) {
			return false;
		}

		return wp_get_attachment_url( $item_source['id'] );
	}
}
