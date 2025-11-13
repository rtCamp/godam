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

		add_action( 'youzify_after_media_item', array( $this, 'add_youzify_godam_player' ), 10, 2 );

		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_youzify_scripts' ) );
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
	 * Add GoDAM player after Youzify media item.
	 *
	 * @since n.e.x.t
	 *
	 * @param int   $media_id Media ID.
	 * @param array $args Media arguments.
	 */
	public function add_youzify_godam_player( $media_id = 0, $args = array() ) {
		$media_id = intval( $media_id );

		if ( 'videos' === $args['type'] ) {
			?>
				<div class="youzify-media-item-godam-video" id="godam-video-<?php echo esc_attr( $media_id ); ?>">
					<div class="youzify-media-item-godam-video--tools">
						<!-- We don't have item_id hence unable to generate permalink -->
						<a href="#">
							<i class="fas fa-link youzify-media-post-link"></i>
						</a>
						<a class="youzify-media-item-godam-video--play-button">
							<i class="fas fa-play-circle youzify-media-video-play"></i>
						</a>
					</div>
					<?php echo do_shortcode( '[godam_video id="' . esc_attr( $media_id ) . '" aspectRatio="16:9"]' ); ?>
				</div>
			<?php
		}
	}

	/**
	 * Enqueue Youzify related scripts.
	 *
	 * @since n.e.x.t
	 */
	public function enqueue_youzify_scripts() {
		// Activity Observer Script.
		wp_register_script(
			'godam-youzify-activity-observer',
			RTGODAM_URL . 'assets/build/js/youzify-activity-observer.min.js',
			array( 'godam-player-frontend-script' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/youzify-activity-observer.min.js' ),
			true
		);

		// Media Page Scripts.
		wp_register_style(
			'godam-youzify-media-page',
			RTGODAM_URL . 'assets/build/css/youzify-media-page.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/youzify-media-page.css' )
		);
		wp_register_script(
			'godam-youzify-media-page',
			RTGODAM_URL . 'assets/build/js/youzify-media-page.min.js',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/js/youzify-media-page.min.js' ),
			true
		);
		
		if ( function_exists( 'bp_is_activity_component' ) && bp_is_activity_component() ) {
			wp_enqueue_script( 'godam-youzify-activity-observer' );
		}
		
		// Only enqueue on user profile media page (e.g., /members/username/media/).
		if ( function_exists( 'bp_is_user' ) && bp_is_user() && function_exists( 'bp_current_action' ) && 'all' === bp_current_action() ) {
			wp_enqueue_script( 'godam-youzify-activity-observer' );
			wp_enqueue_style( 'godam-youzify-media-page' );
			wp_enqueue_script( 'godam-youzify-media-page' );
		}
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
