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
		add_action( 'admin_enqueue_scripts', array( $this, 'godam_skin_styles_enqueue' ) );
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
			array( 'wp-i18n' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/godam-player-frontend.min.js' ),
			true
		);

		wp_register_script(
			'godam-player-analytics-script',
			RTGODAM_URL . 'assets/build/js/godam-player-analytics.min.js',
			array( 'godam-player-frontend-script', 'wp-i18n' ),
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

		wp_register_style(
			'godam-player-classic-skin',
			RTGODAM_URL . 'assets/build/css/classic-skin.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/classic-skin.css' )
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
	 * Enqueue all player skin styles on the admin settings page.
	 *
	 * @param string $hook_suffix The current admin page.
	 */
	public function godam_skin_styles_enqueue( $hook_suffix ) {

		if ( 'godam_page_rtgodam_settings' !== $hook_suffix ) {
			return;
		}

		wp_enqueue_style( 'godam-player-frontend-style' );
		wp_enqueue_style( 'godam-player-style' );
		wp_enqueue_style( 'godam-player-minimal-skin' );
		wp_enqueue_style( 'godam-player-pills-skin' );
		wp_enqueue_style( 'godam-player-bubble-skin' );
		wp_enqueue_style( 'godam-player-classic-skin' );
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
				// Core attributes.
				'id'                => '',
				'sources'           => '',
				'src'               => '',
				'transcoded_url'    => '',
				'poster'            => '',
				'aspectRatio'       => '',

				// Player behavior attributes.
				'autoplay'          => false,
				'controls'          => true,
				'loop'              => false,
				'muted'             => false,
				'preload'           => 'auto',
				'caption'           => '',
				'tracks'            => '',
				'hoverSelect'       => 'none',
				'preview'           => false,
				'verticalAlignment' => 'center',
				'overlayTimeRange'  => 0,
				'showOverlay'       => false,
				'videoWidth'        => '',
				'videoHeight'       => '',
				'width'             => '',
				'height'            => '',
				'playsinline'       => true,
				'start_time'        => '',
				'end_time'          => '',
				'playback_rate'     => '',
				'volume'            => '',
				
				// SEO attributes.
				'schema_type'       => 'VideoObject',
				'upload_date'       => '',
				'duration'          => '',
				'thumbnail_url'     => '',
				'description'       => '',
				'keywords'          => '',
				
				// Additional attributes from Gutenberg block.
				'cmmId'             => '',
				'layout'            => '',
			),
			$atts,
			'godam_video'
		);

		// Note: Boolean conversion is handled in the template for better compatibility.

		// Note: Numeric conversion is handled in the template for better compatibility.

		// Decode custom placeholders back to square brackets if sources contain them.
		if ( ! empty( $attributes['sources'] ) && is_string( $attributes['sources'] ) ) {
			// Convert custom placeholders back to square brackets.
			$attributes['sources'] = str_replace( array( '__rtgob__', '__rtgcb__' ), array( '[', ']' ), $attributes['sources'] );
		}

		// Decode custom placeholders back to square brackets if tracks contain them.
		if ( ! empty( $attributes['tracks'] ) && is_string( $attributes['tracks'] ) ) {
			// Convert custom placeholders back to square brackets.
			$attributes['tracks'] = str_replace( array( '__rtgob__', '__rtgcb__' ), array( '[', ']' ), $attributes['tracks'] );
		}

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
		} elseif ( 'Classic' === $selected_skin ) {
			wp_enqueue_style( 'godam-player-classic-skin' );
		}

		ob_start();
		require RTGODAM_PATH . 'inc/templates/godam-player.php';
		$player_html = ob_get_clean();
		return $player_html;
	}
}
