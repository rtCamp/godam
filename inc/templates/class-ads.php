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
	 * Get the ad tag URL.
	 *
	 * Retrieves the first available ad tag URL from multiple sources in priority order:
	 * 1. Attachment-specific ad tag URL
	 * 2. Dynamically generated ad tag URL from layers
	 * 3. Global ad tag URL
	 *
	 * @param int   $attachment_id          The attachment ID for the media item.
	 * @param array $global_ad_settings     Optional. Global advertisement settings. Default empty array.
	 * @param array $attachment_ad_settings Optional. Attachment-specific settings. Default empty array.
	 * @return string The ad tag URL if found, empty string otherwise.
	 */
	public static function get_ad_tag_url( $attachment_id, $global_ad_settings = array(), $attachment_ad_settings = array() ) {
		$attachment_id          = absint( $attachment_id );
		$global_ad_settings     = is_array( $global_ad_settings ) ? $global_ad_settings : array();
		$attachment_ad_settings = is_array( $attachment_ad_settings ) ? $attachment_ad_settings : array();

		// Try attachment-specific ad tag URL first (highest priority).
		$attachment_ad_tag_url = self::get_attachment_ad_tag_url( $attachment_ad_settings );
		if ( ! empty( $attachment_ad_tag_url ) ) {
			return $attachment_ad_tag_url;
		}

		// Try dynamically generated ad tag URL second.
		$dynamic_ad_tag_url = self::generate_ad_tag_url_from_layers( $attachment_id, $attachment_ad_settings );
		if ( ! empty( $dynamic_ad_tag_url ) ) {
			return $dynamic_ad_tag_url;
		}

		// Try global ad tag URL last.
		$global_ad_tag_url = self::get_global_ad_tag_url( $global_ad_settings );
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
	 * @param array $global_ad_settings Global advertisement settings.
	 * @return string The global ad tag URL if enabled and configured, empty string otherwise.
	 */
	public static function get_global_ad_tag_url( $global_ad_settings ) {
		if ( ! is_array( $global_ad_settings ) ) {
			return '';
		}

		$global_layers    = isset( $global_ad_settings['global_layers'] ) ? $global_ad_settings['global_layers'] : array();
		$video_ads_config = isset( $global_layers['video_ads'] ) && is_array( $global_layers['video_ads'] ) ? $global_layers['video_ads'] : array();

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
	 * @param array $attachment_ad_settings Attachment-specific advertisement settings.
	 * @return string The attachment ad tag URL if configured and enabled, empty string otherwise.
	 */
	public static function get_attachment_ad_tag_url( $attachment_ad_settings ) {
		if ( ! is_array( $attachment_ad_settings ) ) {
			return '';
		}

		$video_config   = isset( $attachment_ad_settings['videoConfig'] ) && is_array( $attachment_ad_settings['videoConfig'] ) ? $attachment_ad_settings['videoConfig'] : array();
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
	 * @param int   $attachment_id          The attachment ID for the media item.
	 * @param array $attachment_ad_settings Attachment-specific advertisement settings.
	 * @return string The generated ad tag URL if ad layers exist, empty string otherwise.
	 */
	public static function generate_ad_tag_url_from_layers( $attachment_id, $attachment_ad_settings ) {
		if ( ! is_array( $attachment_ad_settings ) ) {
			return '';
		}

		$attachment_id = absint( $attachment_id );
		$layers        = isset( $attachment_ad_settings['layers'] ) && is_array( $attachment_ad_settings['layers'] ) ? $attachment_ad_settings['layers'] : array();

		if ( empty( $layers ) ) {
			return '';
		}

		$ad_layers = array();
		foreach ( $layers as $layer ) {
			if ( is_array( $layer ) && isset( $layer['type'] ) && 'ad' === $layer['type'] ) {
				$ad_layers[] = $layer;
			}
		}

		if ( ! empty( $ad_layers ) ) {
			return get_rest_url( get_current_blog_id(), '/godam/v1/adTagURL/' . $attachment_id );
		}

		return '';
	}
}
