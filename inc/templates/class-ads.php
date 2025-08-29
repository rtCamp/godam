<?php
/**
 * Ads Handler class for the godam-player.php
 *
 * This class handles ad tag URL generation and retrieval from various sources
 * including global settings, attachment settings, and dynamic layer configurations.
 *
 * @package GoDAM
 * @since   n.e.x.t
 */

defined( 'ABSPATH' ) || exit;

/**
 * Class Ads
 *
 * Handles advertisement configuration and URL generation for video players.
 */
class Ads {

	/**
	 * The attachment ID for the current media item.
	 *
	 * @var int
	 */
	private $attachment_id;

	/**
	 * Global advertisement settings.
	 *
	 * @var array
	 */
	private $global_ad_settings;

	/**
	 * Attachment-specific advertisement settings.
	 *
	 * @var array
	 */
	private $attachment_ad_settings;

	/**
	 * Constructor for the Ads class.
	 *
	 * @param int   $attachment_id         The attachment ID for the media item.
	 * @param array $global_ad_settings    Optional. Global advertisement settings. Default empty array.
	 * @param array $attachment_ad_settings Optional. Attachment-specific settings. Default empty array.
	 */
	public function __construct( $attachment_id, $global_ad_settings = array(), $attachment_ad_settings = array() ) {
		$this->attachment_id          = absint( $attachment_id );
		$this->global_ad_settings     = is_array( $global_ad_settings ) ? $global_ad_settings : array();
		$this->attachment_ad_settings = is_array( $attachment_ad_settings ) ? $attachment_ad_settings : array();
	}

	/**
	 * Get the ad tag URL.
	 *
	 * Retrieves the first available ad tag URL from multiple sources in priority order:
	 * 1. Attachment-specific ad tag URL
	 * 2. Dynamically generated ad tag URL from layers
	 * 3. Global ad tag URL
	 *
	 * @return string The ad tag URL if found, empty string otherwise.
	 */
	public function get_ad_tag_url() {
		// Try attachment-specific ad tag URL first (highest priority).
		$attachment_ad_tag_url = $this->get_attachment_ad_tag_url();
		if ( ! empty( $attachment_ad_tag_url ) ) {
			return $attachment_ad_tag_url;
		}

		// Try dynamically generated ad tag URL last.
		$dynamic_ad_tag_url = $this->generate_ad_tag_url_from_layers();
		if ( ! empty( $dynamic_ad_tag_url ) ) {
			return $dynamic_ad_tag_url;
		}

		// Try global ad tag URL second.
		$global_ad_tag_url = $this->get_global_ad_tag_url();
		if ( ! empty( $global_ad_tag_url ) ) {
			return $global_ad_tag_url;
		}

		return '';
	}

	/**
	 * Get the global ad tag URL.
	 *
	 * Retrieves the ad tag URL from global video advertisement settings.
	 *
	 * @return string The global ad tag URL if enabled and configured, empty string otherwise.
	 */
	private function get_global_ad_tag_url() {
		$global_layers    = isset( $this->global_ad_settings['global_layers'] ) ? $this->global_ad_settings['global_layers'] : array();
		$video_ads_config = isset( $global_layers['video_ads'] ) ? $global_layers['video_ads'] : array();

		$is_enabled = isset( $video_ads_config['enabled'] ) ? $video_ads_config['enabled'] : false;
		$ad_tag_url = isset( $video_ads_config['adTagUrl'] ) ? $video_ads_config['adTagUrl'] : '';

		if ( $is_enabled && ! empty( $ad_tag_url ) ) {
			return esc_url_raw( $ad_tag_url );
		}

		return '';
	}

	/**
	 * Get the attachment-specific ad tag URL.
	 *
	 * Retrieves the ad tag URL from attachment-specific video configuration settings.
	 *
	 * @return string The attachment ad tag URL if configured and enabled, empty string otherwise.
	 */
	private function get_attachment_ad_tag_url() {
		$video_config   = isset( $this->attachment_ad_settings['videoConfig'] ) ? $this->attachment_ad_settings['videoConfig'] : array();
		$ad_server_type = isset( $video_config['adServer'] ) ? $video_config['adServer'] : '';
		$ad_tag_url     = isset( $video_config['adTagURL'] ) ? $video_config['adTagURL'] : '';

		if ( 'ad-server' === $ad_server_type && ! empty( $ad_tag_url ) ) {
			return esc_url_raw( $ad_tag_url );
		}

		return '';
	}

	/**
	 * Generate ad tag URL from layers configuration.
	 *
	 * Creates a dynamic ad tag URL based on advertisement layers configuration.
	 *
	 * @return string The generated ad tag URL if ad layers exist, empty string otherwise.
	 */
	private function generate_ad_tag_url_from_layers() {
		$layers = isset( $this->attachment_ad_settings['layers'] ) ? $this->attachment_ad_settings['layers'] : array();

		if ( empty( $layers ) || ! is_array( $layers ) ) {
			return '';
		}

		$ad_layers = array_filter(
			$layers,
			function ( $layer ) {
				return isset( $layer['type'] ) && 'ad' === $layer['type'];
			}
		);

		if ( ! empty( $ad_layers ) ) {
			return get_rest_url( get_current_blog_id(), '/godam/v1/adTagURL/' . $this->attachment_id );
		}

		return '';
	}
}
