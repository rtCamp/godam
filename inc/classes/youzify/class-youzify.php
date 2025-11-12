<?php
/**
 * Youzify support integration class for GoDAM plugin.
 * Loads required integration script.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Youzify;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Youzify
 *
 * @since n.e.x.t
 */
class Youzify {
	use Singleton;

	/**
	 * Constructor.
	 */
	protected function __construct() {
		if ( ! $this->is_youzify_active() ) {
			return;
		}
		$this->setup_hooks();
	}

	/**
	 * Setup WordPress hooks and filters.
	 */
	private function setup_hooks() {
		add_filter( 'youzify_get_wall_post_video', array( $this, 'replace_youzify_wall_video_player' ), 10, 3 );
	}

	/**
	 * Replace Youzify wall video player with GoDAM player.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $video_html Original Youzify video HTML.
	 * @param string $video_url Video URL.
	 * @param int    $media_id Media ID.
	 *
	 * @return string Modified video HTML with GoDAM player.
	 */
	public function replace_youzify_wall_video_player( $video_html, $video_url, $media_id ) {
		$media_id = absint( $media_id );

		if ( ! $media_id ) {
			return $video_html;
		}

		return do_shortcode( '[godam_video id="' . esc_attr( $media_id ) . '" aspectRatio="16:9"]' );
	}

	/**
	 * Check if Youzify plugin is active.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public function is_youzify_active(): bool {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		if ( ! is_plugin_active( 'youzify/youzify.php' ) ) {
			return false;
		}
		return true;
	}
}
