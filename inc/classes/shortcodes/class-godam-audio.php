<?php
/**
 * GoDAM Audio Shortcode Class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Shortcodes;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class GoDAM_Audio.
 *
 * This class handles the GoDAM audio shortcode functionality.
 */
class GoDAM_Audio {
	use Singleton;

	/**
	 * Constructor.
	 */
	final protected function __construct() {
		add_shortcode( 'godam_audio', array( $this, 'render' ) );
	}

	/**
	 * Render the GoDAM audio shortcode.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output of the audio player.
	 */
	public function render( $atts ) {
		// Snake_case attribute names (WordPress lowercases shortcode attribute
		// names) matching the WPBakery element params. Mapped below to the block's
		// camelCase attribute keys that the shared render.php consumes.
		$attributes = shortcode_atts(
			array(
				'id'              => '',
				'src'             => '',
				'autoplay'        => false,
				'loop'            => false,
				'preload'         => 'metadata',
				'audio_title'     => '',
				'description'     => '',
				'thumbnail'       => '',
				'show_transcript' => true,
				'show_chapters'   => true,
				'css'             => '',
			),
			$atts,
			'godam_audio'
		);

		// Handle boolean attributes passed as strings.
		$boolean_attributes = array( 'autoplay', 'loop', 'show_transcript', 'show_chapters' );
		foreach ( $boolean_attributes as $bool_attr ) {
			$attributes[ $bool_attr ] = filter_var( $attributes[ $bool_attr ], FILTER_VALIDATE_BOOLEAN );
		}

		// Map the redesigned attributes to the block's camelCase keys that
		// render.php reads. 'description'/'thumbnail' already share the key name.
		$attributes['audioTitle']     = $attributes['audio_title'];
		$attributes['showTranscript'] = $attributes['show_transcript'];
		$attributes['showChapters']   = $attributes['show_chapters'];

		// Get WPBakery Design Options CSS class if available.
		$attributes['css_class'] = '';
		if ( ! empty( $attributes['css'] ) && function_exists( 'vc_shortcode_custom_css_class' ) ) {
			$attributes['css_class'] = vc_shortcode_custom_css_class( $attributes['css'], ' ' );
		}

		// Enqueue the block's front-end script + styles so the shortcode gets the
		// same custom player and Chapters/Transcript panel as the block. These
		// handles are registered by register_block_type() (see class-blocks.php);
		// WordPress auto-enqueues them for the block, but not when the shared
		// render.php is included directly by this shortcode.
		wp_enqueue_script( 'godam-audio-view-script' );
		wp_enqueue_style( 'godam-audio-style' );

		// Tells the shared render.php it runs outside block context, so it skips
		// get_block_wrapper_attributes() (which warns without a block) and still
		// emits the stable `godam-audio` hook class that view.js targets.
		$godam_is_shortcode = true;

		ob_start();
		require RTGODAM_PATH . 'assets/build/blocks/godam-audio/render.php';
		$player_html = ob_get_clean();
		return $player_html;
	}
}
