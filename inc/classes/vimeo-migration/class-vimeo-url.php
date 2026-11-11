<?php
/**
 * Helpers for recognising Vimeo video URLs.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Vimeo_Migration;

defined( 'ABSPATH' ) || exit;

/**
 * Class Vimeo_Url
 *
 * Tells whether a string is a link to a single Vimeo video, and reads the
 * video's numeric ID from it.
 *
 * @since n.e.x.t
 */
class Vimeo_Url {

	/**
	 * Hosts that serve Vimeo videos.
	 *
	 * @since n.e.x.t
	 *
	 * @var string[]
	 */
	const HOSTS = array( 'vimeo.com', 'www.vimeo.com', 'player.vimeo.com' );

	/**
	 * Whether the given value is a link to a single Vimeo video.
	 *
	 * The host has to be one of Vimeo's own hosts, so a URL that only mentions
	 * vimeo.com in its path or query string does not count.
	 *
	 * @since n.e.x.t
	 *
	 * @param mixed $url Value to check.
	 *
	 * @return bool True when the value is a Vimeo video URL.
	 */
	public static function is_vimeo_url( $url ): bool {
		if ( ! is_string( $url ) ) {
			return false;
		}

		$url = trim( $url );

		if ( '' === $url ) {
			return false;
		}

		// Protocol-relative embed URLs, e.g. //player.vimeo.com/video/123.
		if ( 0 === strpos( $url, '//' ) ) {
			$url = 'https:' . $url;
		}

		$host   = wp_parse_url( $url, PHP_URL_HOST );
		$scheme = wp_parse_url( $url, PHP_URL_SCHEME );

		if ( ! is_string( $host ) || ! is_string( $scheme ) ) {
			return false;
		}

		if ( ! in_array( strtolower( $scheme ), array( 'http', 'https' ), true ) ) {
			return false;
		}

		if ( ! in_array( strtolower( $host ), self::HOSTS, true ) ) {
			return false;
		}

		return '' !== self::get_video_id( $url );
	}

	/**
	 * Read the numeric Vimeo video ID from a Vimeo URL.
	 *
	 * Handles these forms, with or without a query string:
	 * - vimeo.com/123 and vimeo.com/123/abcdef (unlisted hash)
	 * - player.vimeo.com/video/123
	 * - vimeo.com/channels/<name>/123
	 * - vimeo.com/groups/<name>/videos/123
	 * - vimeo.com/showcase/<id>/video/123 and vimeo.com/album/<id>/video/123
	 * - vimeo.com/manage/videos/123
	 *
	 * @since n.e.x.t
	 *
	 * @param string $url Vimeo URL.
	 *
	 * @return string The video ID, or an empty string when none is found.
	 */
	public static function get_video_id( string $url ): string {
		$url = trim( $url );

		if ( 0 === strpos( $url, '//' ) ) {
			$url = 'https:' . $url;
		}

		$path = wp_parse_url( $url, PHP_URL_PATH );

		if ( ! is_string( $path ) ) {
			return '';
		}

		$pattern = '#^/(?:video/|channels/[^/]+/|groups/[^/]+/videos/|(?:showcase|album)/[^/]+/video/|manage/videos/)?(\d+)(?:/|$)#';

		if ( preg_match( $pattern, $path, $matches ) ) {
			return $matches[1];
		}

		return '';
	}
}
