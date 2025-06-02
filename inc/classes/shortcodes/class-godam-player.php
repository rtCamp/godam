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
	}

	/**
	 * Register scripts and styles for the GoDAM player.
	 */
	public function register_scripts() {
		// Register your scripts and styles here.
		wp_register_script(
			'godam-player-frontend-script',
			RTGODAM_URL . 'assets/build/js/godam-player-frontend.js',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/js/godam-player-frontend.js' ),
			true
		);

		wp_register_script(
			'godam-player-analytics-script',
			RTGODAM_URL . 'assets/build/js/godam-player-analytics.js',
			array( 'godam-player-frontend-script' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/godam-player-analytics.js' ),
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

		wp_localize_script(
			'godam-player-frontend-script',
			'godamData',
			array(
				'api_base' => RTGODAM_API_BASE,
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

		ob_start();
		require RTGODAM_PATH . 'inc/templates/godam-player.php';
		$player_html = ob_get_clean();
		return $player_html;
	}
}
