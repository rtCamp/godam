<?php
/**
 * GoDAM Player Shortcode Class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Shortcodes;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class GoDAM_Player.
 *
 * This class handles the GoDAM player shortcode functionality.
 */
class GoDAM_Player {
	use Singleton;

	/**
	 * Constructor.
	 */
	final protected function __construct() {
		add_shortcode( 'godam_video', array( $this, 'render' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'register_scripts' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'register_scripts' ) );
		add_action( 'wp_head', array( $this, 'godam_output_admin_player_css' ) );
	}
	
	/**
	 * Outputs custom css from video player settings tab input field.
	 */
	public function godam_output_admin_player_css() {
		$godam_settings = get_option( 'rtgodam-settings', array() );
		$custom_css     = $godam_settings['video_player']['custom_css'] ?? '';
		if ( ! empty( $custom_css ) ) {
			echo '<style id="godam-player-inline-css">' . esc_html( $custom_css ) . '</style>';
		}
	}

	/**
	 * Register scripts and styles for the GoDAM player.
	 */
	public function register_scripts() {
		// Allow external stylesheets to be enqueued.
		do_action( 'godam_player_enqueue_styles' );

		// Register your scripts and styles here.
		wp_register_script(
			'godam-player-frontend-script',
			RTGODAM_URL . 'assets/build/js/godam-player-frontend.min.js',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/js/godam-player-frontend.min.js' ),
			true
		);

		wp_register_script(
			'godam-player-analytics-script',
			RTGODAM_URL . 'assets/build/js/godam-player-analytics.min.js',
			array( 'godam-player-frontend-script' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/godam-player-analytics.min.js' ),
			true
		);

		wp_register_style(
			'godam-player-frontend-style',
			RTGODAM_URL . 'assets/build/css/godam-player-frontend.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/godam-player-frontend.css' )
		);

		wp_register_style(
			'godam-player-style',
			RTGODAM_URL . 'assets/build/css/godam-player.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/godam-player.css' )
		);

		wp_register_style(
			'godam-player-minimal-skin',
			RTGODAM_URL . 'assets/build/css/minimal-skin.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/minimal-skin.css' )
		);

		wp_register_style(
			'godam-player-pills-skin',
			RTGODAM_URL . 'assets/build/css/pills-skin.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/pills-skin.css' )
		);

		wp_register_style(
			'godam-player-bubble-skin',
			RTGODAM_URL . 'assets/build/css/bubble-skin.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/bubble-skin.css' )
		);

		wp_localize_script(
			'godam-player-frontend-script',
			'godamData',
			array(
				'apiBase' => RTGODAM_API_BASE,
			)
		);
	}

	/**
	 * Render the GoDAM player shortcode.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output of the player.
	 */
	public function render( $atts ) {
		$attributes = shortcode_atts(
			array(
				'id'             => '',
				'sources'        => '',
				'src'            => '',
				'transcoded_url' => '',
				'poster'         => '',
				'aspectRatio'    => '',
			),
			$atts,
			'godam_video'
		);

		$is_shortcode = true;

		wp_enqueue_script( 'godam-player-frontend-script' );
		wp_enqueue_script( 'godam-player-analytics-script' );
		wp_enqueue_style( 'godam-player-frontend-style' );
		wp_enqueue_style( 'godam-player-style' );
		
		$godam_settings = get_option( 'rtgodam-settings', array() );
		$selected_skin  = $godam_settings['video_player']['player_skin'] ?? '';
		if ( 'Minimal' === $selected_skin ) {
			wp_enqueue_style( 'godam-player-minimal-skin' );
		} elseif ( 'Pills' === $selected_skin ) {
			wp_enqueue_style( 'godam-player-pills-skin' );
		} elseif ( 'Bubble' === $selected_skin ) {
			wp_enqueue_style( 'godam-player-bubble-skin' );
		}

		ob_start();
		require RTGODAM_PATH . 'inc/templates/godam-player.php';
		$player_html = ob_get_clean();
		return $player_html;
	}
}
