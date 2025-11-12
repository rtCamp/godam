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

		// Todo : Check `youzify_get_wall_post_audio` hook existence in Youzify.
		// It dose not returning audio media_id currently, hence GoDAM audio player integration is disabled for now.
		add_filter( 'youzify_get_wall_post_audio', array( $this, 'replace_youzify_wall_audio_player' ), 10, 3 );

		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_activity_observer_script' ), 20 );
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
	public function replace_youzify_wall_video_player( $video_html, $video_url, $media_id = 0 ) {
		$media_id = intval( $media_id );

		if ( empty( $media_id ) ) {
			return $video_html;
		}

		return do_shortcode( '[godam_video id="' . esc_attr( $media_id ) . '" aspectRatio="16:9"]' );
	}

	/**
	 * Replace Youzify wall audio player with GoDAM player.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $audio_html Original Youzify audio HTML.
	 * @param string $audio_url Audio URL.
	 * @param int    $media_id Media ID.
	 *
	 * @return string Modified audio HTML with GoDAM player.
	 */
	public function replace_youzify_wall_audio_player( $audio_html, $audio_url, $media_id = 0 ) {
		$media_id = intval( $media_id );
		
		if ( empty( $media_id ) ) {
			return $audio_html;
		}

		return do_shortcode( '[godam_audio id="' . esc_attr( $media_id ) . '"]' );
	}

	/**
	 * Enqueue IntersectionObserver script for BuddyPress activity page.
	 *
	 * @since n.e.x.t
	 */
	public function enqueue_activity_observer_script() {
		if ( ! function_exists( 'bp_is_activity_component' ) || ! bp_is_activity_component() ) {
			return;
		}

		wp_register_script(
			'godam-youzify-activity-observer',
			RTGODAM_URL . 'assets/build/js/youzify-activity-observer.min.js',
			array( 'godam-player-frontend-script' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/youzify-activity-observer.min.js' ),
			true
		);

		wp_enqueue_script( 'godam-youzify-activity-observer' );
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
