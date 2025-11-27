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
		$attributes = shortcode_atts(
			array(
				'id'       => '',
				'src'      => '',
				'caption'  => '',
				'autoplay' => false,
				'loop'     => false,
				'preload'  => 'metadata',
			),
			$atts,
			'godam_audio'
		);

		// Handle boolean attributes passed as strings.
		$boolean_attributes = array( 'autoplay', 'loop' );
		foreach ( $boolean_attributes as $bool_attr ) {
			$attributes[ $bool_attr ] = filter_var( $attributes[ $bool_attr ], FILTER_VALIDATE_BOOLEAN );
		}

		ob_start();
		require RTGODAM_PATH . 'assets/build/blocks/godam-audio/render.php';
		$player_html = ob_get_clean();
		return $player_html;
	}
}
