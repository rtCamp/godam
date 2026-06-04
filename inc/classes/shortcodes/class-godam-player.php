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

		// Invalidate video render cache when rtgodam_meta changes.
		add_action( 'updated_post_meta', array( $this, 'invalidate_video_cache_on_meta_change' ), 10, 3 );
		add_action( 'added_post_meta', array( $this, 'invalidate_video_cache_on_meta_change' ), 10, 3 );
		add_action( 'deleted_post_meta', array( $this, 'invalidate_video_cache_on_meta_change' ), 10, 3 );

		// Fallback: invalidate on attachment save/delete.
		add_action( 'edit_attachment', array( $this, 'invalidate_video_cache_for_post' ) );
		add_action( 'delete_attachment', array( $this, 'invalidate_video_cache_for_post' ) );
	}

	/**
	 * Return the work-cache index key for a given video post ID.
	 *
	 * @since 1.8.0
	 *
	 * @param int $post_id Post/attachment ID.
	 * @return string
	 */
	public function get_video_cache_index_key( $post_id ) {
		return 'work_cache_godam_meta_' . absint( $post_id );
	}

	/**
	 * Invalidate the render cache for a video when its rtgodam_meta post meta changes.
	 *
	 * @since 1.8.0
	 *
	 * @param int    $meta_id    Meta entry ID (unused).
	 * @param int    $object_id  Post ID the meta belongs to.
	 * @param string $meta_key   Meta key being updated.
	 */
	public function invalidate_video_cache_on_meta_change( $meta_id, $object_id, $meta_key ) {
		// Only invalidate for attachment posts (GoDAM videos are stored as attachments).
		if ( 'attachment' !== get_post_type( $object_id ) ) {
			return;
		}

		$watched_keys = array(
			'rtgodam_meta',
			'rtgodam_transcoded_url',
			'rtgodam_hls_transcoded_url',
			'rtgodam_media_video_thumbnail',
			'rtgodam_media_video_placeholder_thumbnail',
			'rtgodam_media_placeholder_thumbnails',
			'rtgodam_transcript_path',
		);

		if ( ! in_array( $meta_key, $watched_keys, true ) ) {
			return;
		}

		$this->invalidate_video_cache_for_post( $object_id );
	}

	/**
	 * Clear all cached render output for a given post/video ID.
	 *
	 * Only acts on attachment post types to avoid unnecessary cache work on
	 * unrelated post deletions/edits.
	 *
	 * @since 1.8.0
	 *
	 * @param int $post_id Post ID.
	 */
	public function invalidate_video_cache_for_post( $post_id ) {
		if ( 'attachment' !== get_post_type( $post_id ) ) {
			return;
		}

		rtgodam_work_cache_index_clear( $this->get_video_cache_index_key( $post_id ) );
	}

	/**
	 * Outputs custom css from video player settings tab input field.
	 */
	public function godam_output_admin_player_css() {
		$godam_settings = get_option( 'rtgodam-settings', array() );
		$custom_css     = $godam_settings['video_player']['custom_css'] ?? '';
		if ( ! empty( $custom_css ) ) {
			$safe_css = str_replace( "'", "\\'", $custom_css );
			echo '<style id="godam-player-inline-css">' . wp_kses( $safe_css, array() ) . '</style>';
		}
	}

	/**
	 * Register scripts and styles for the GoDAM player.
	 */
	public function register_scripts() {
		// Allow external stylesheets to be enqueued.
		do_action( 'godam_player_enqueue_styles' );

		$player_frontend_asset_path   = RTGODAM_PATH . 'assets/build/js/godam-player-frontend.min.asset.php';
		$godam_player_frontend_assets = file_exists( $player_frontend_asset_path )
			? include $player_frontend_asset_path
			: array(
				'dependencies' => array(),
				'version'      => RTGODAM_VERSION,
			);

		// Add WooCommerce Blocks data store as a dependency if WooCommerce is active.
		// This is required for the WooCommerce cart store (wc/store/cart) to be available.
		$dependencies = $godam_player_frontend_assets['dependencies'];
		$dependencies = apply_filters( 'godam_player_frontend_dependencies', $dependencies );

		// Register your scripts and styles here.
		wp_register_script(
			'godam-player-frontend-script',
			RTGODAM_URL . 'assets/build/js/godam-player-frontend.min.js',
			$dependencies,
			$godam_player_frontend_assets['version'],
			true
		);

		$player_analytics_path = RTGODAM_PATH . 'assets/build/js/godam-player-analytics.min.js';

		if ( file_exists( $player_analytics_path ) ) {
			wp_register_script(
				'godam-player-analytics-script',
				RTGODAM_URL . 'assets/build/js/godam-player-analytics.min.js',
				array( 'godam-player-frontend-script', 'wp-i18n' ),
				filemtime( $player_analytics_path ),
				true
			);
		}

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
				'apiBase'                 => RTGODAM_API_BASE,
				'currentLoggedInUserData' => rtgodam_get_current_logged_in_user_data(),
				'loginUrl'                => apply_filters( 'rtgodam_site_login_url', wp_login_url() . '?redirect_to=' . rawurlencode( get_permalink() ) ),
				'registrationUrl'         => apply_filters( 'rtgodam_site_registration_url', wp_registration_url() . '&redirect_to=' . rawurlencode( get_permalink() ) ),
				'defaultAvatar'           => get_avatar_url( 0 ),
				'nonce'                   => wp_create_nonce( 'wp_rest' ),
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

		wp_enqueue_style( 'godam-player-style' );
		wp_enqueue_style( 'godam-player-minimal-skin' );
		wp_enqueue_style( 'godam-player-pills-skin' );
		wp_enqueue_style( 'godam-player-bubble-skin' );
		wp_enqueue_style( 'godam-player-classic-skin' );
	}

	/**
	 * Render the GoDAM player shortcode.
	 *
	 * HTML output is NOT cached here by design.  Caching the full rendered blob
	 * would suppress per-request side effects that the template performs on every
	 * call: adding wrapper CSS to wp_head, suppressing Gravity Forms autoscroll,
	 * conditionally initialising the IMA SDK for ad-enabled videos, and generating
	 * a unique per-render $godam_instance_id used in DOM IDs.
	 *
	 * Performance is instead improved at the data layer: the template bundles all
	 * expensive attachment meta calls (rtgodam_meta, transcoded URLs, thumbnails,
	 * etc.) into a single persistent cache entry (work_cache_godam_meta_{id}) that
	 * is invalidated precisely when the underlying meta changes.  This avoids the
	 * heavy DB work on warm requests while keeping HTML generation stateless and
	 * side-effect-safe on every render.
	 * 
	 * @since 1.8.0
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output of the player.
	 */
	public function render( $atts ) {
		$attributes = shortcode_atts(
			array(
				'id'                 => '',
				'autoplay'           => false,
				'controls'           => true,
				'loop'               => false,
				'muted'              => false,
				'hoverSelect'        => 'none',
				'hover_select'       => 'none', // WPBakery format (lowercase with underscore).
				'poster'             => '',
				'performanceMode'    => 'balanced',
				'performance_mode'   => 'balanced',
				'src'                => '',
				'sources'            => '',
				'transcoded_url'     => '',
				'hls_transcoded_url' => '',
				'aspectratio'        => 'responsive',
				'aspect_ratio'       => '', // WPBakery format (lowercase with underscore).
				'tracks'             => '',
				'caption'            => '',
				'engagements'        => false,
				'preview'            => false,
				'showShareButton'    => false,
				'show_share_button'  => false, // WPBakery format (lowercase with underscore).
				'css'                => '',
				'godam_context'      => '',
			),
			$atts,
			'godam_video'
		);

		// Handle boolean attributes passed as strings (do this before mapping).
		$boolean_attributes = array( 'autoplay', 'controls', 'loop', 'muted', 'preview', 'showShareButton', 'show_share_button' );
		foreach ( $boolean_attributes as $bool_attr ) {
			if ( isset( $attributes[ $bool_attr ] ) ) {
				$attributes[ $bool_attr ] = filter_var( $attributes[ $bool_attr ], FILTER_VALIDATE_BOOLEAN );
			}
		}

		// Normalize 'engagements' separately: the embed page passes 'show' as a truthy value,
		// which filter_var() would incorrectly map to false. Treat 'show' as true, then fall
		// back to standard boolean parsing for all other string representations.
		if ( isset( $attributes['engagements'] ) && is_string( $attributes['engagements'] ) ) {
			$attributes['engagements'] = 'show' === $attributes['engagements']
				? true
				: filter_var( $attributes['engagements'], FILTER_VALIDATE_BOOLEAN );
		}

		// Map WPBakery format (lowercase_underscore) to camelCase for backward compatibility.
		// Check if WPBakery format exists and camelCase doesn't, then use WPBakery format.
		if ( isset( $attributes['aspect_ratio'] ) && '' !== $attributes['aspect_ratio'] && ( ! isset( $attributes['aspectRatio'] ) || '' === $attributes['aspectRatio'] ) ) {
			$attributes['aspectRatio'] = $attributes['aspect_ratio'];
		}
		if ( isset( $attributes['hover_select'] ) && '' !== $attributes['hover_select'] && ( ! isset( $attributes['hoverSelect'] ) || 'none' === $attributes['hoverSelect'] ) ) {
			$attributes['hoverSelect'] = $attributes['hover_select'];
		}
		if ( isset( $attributes['show_share_button'] ) && '' !== $attributes['show_share_button'] && ( ! isset( $attributes['showShareButton'] ) || false === $attributes['showShareButton'] ) ) {
			$attributes['showShareButton'] = $attributes['show_share_button'];
		}
		$raw_has_performance_mode            = is_array( $atts ) && array_key_exists( 'performance_mode', $atts );
		$raw_has_performance_mode_camel_case = is_array( $atts ) && array_key_exists( 'performanceMode', $atts );
		if ( $raw_has_performance_mode && ! $raw_has_performance_mode_camel_case && isset( $attributes['performance_mode'] ) && '' !== $attributes['performance_mode'] ) {
			$attributes['performanceMode'] = $attributes['performance_mode'];
		}

		// Get WPBakery Design Options CSS class if available.
		$attributes['css_class'] = '';
		if ( ! empty( $attributes['css'] ) && function_exists( 'vc_shortcode_custom_css_class' ) ) {
			$attributes['css_class'] = vc_shortcode_custom_css_class( $attributes['css'], ' ' );
		}

		// If autoplay is true, muted must be true for most browsers to allow autoplay.
		if ( $attributes['autoplay'] ) {
			$attributes['muted'] = true;
		}

		// Decode custom placeholders back to square brackets if sources contain them.
		if ( ! empty( $attributes['sources'] ) && is_string( $attributes['sources'] ) ) {
			// Convert custom placeholders back to square brackets.
			$attributes['sources'] = str_replace( array( '__rtgob__', '__rtgcb__' ), array( '[', ']' ), $attributes['sources'] );
		}

		// Decode tracks if it's a JSON string.
		if ( ! empty( $attributes['tracks'] ) && is_string( $attributes['tracks'] ) ) {
			$attributes['tracks'] = str_replace( array( '__rtgob__', '__rtgcb__' ), array( '[', ']' ), $attributes['tracks'] );
		}

		$is_shortcode = true; // Do not remove this line, this variable is being used in godam-player template.

		wp_enqueue_script( 'godam-player-frontend-script' );
		wp_enqueue_script( 'godam-player-analytics-script' );
		wp_enqueue_style( 'godam-player-style' );

		$godam_settings = get_option( 'rtgodam-settings', array() );
		$selected_skin  = isset( $godam_settings['video_player']['player_skin'] ) ? $godam_settings['video_player']['player_skin'] : '';
		$skins          = array(
			'Minimal' => 'godam-player-minimal-skin',
			'Pills'   => 'godam-player-pills-skin',
			'Bubble'  => 'godam-player-bubble-skin',
			'Classic' => 'godam-player-classic-skin',
		);

		if ( isset( $skins[ $selected_skin ] ) ) {
			wp_enqueue_style( $skins[ $selected_skin ] );
		}

		ob_start();
		require RTGODAM_PATH . 'inc/templates/godam-player.php';
		return ob_get_clean();
	}
}
