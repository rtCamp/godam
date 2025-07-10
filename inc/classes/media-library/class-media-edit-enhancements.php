<?php
/**
 * Manage media edit page and related functionality.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Media_Library;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Media Edit class for handling media-related functionality.
 */
class Media_Edit_Enhancements {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks for the media edit functionality.
	 */
	protected function setup_hooks() {
		add_filter( 'wp_video_shortcode_override', array( $this, 'video_shortcode_override' ), 10, 2 );
	}

	/**
	 * Override the default video shortcode to handle .mov files playback within media edit page.
	 *
	 * @param string|false $html    The video HTML markup. Default empty.
	 * @param array        $attrs    Array of video shortcode attributes.
	 *
	 * @return string|false Modified video HTML or false to use default.
	 */
	public function video_shortcode_override( $html, array $attrs ) {
		// Only override for .mov files.
		if ( ! isset( $attrs['src'] ) || false === strpos( $attrs['src'], '.mov' ) ) {
			return false;
		}

		$src    = esc_url( $attrs['src'] );
		$width  = ! empty( $attrs['width'] ) ? absint( $attrs['width'] ) : 640;
		$height = ! empty( $attrs['height'] ) ? absint( $attrs['height'] ) : 360;

		// Build video attributes array for cleaner HTML generation.
		$video_attrs = array(
			'controls' => 'controls',
			'width'    => $width,
			'height'   => $height,
			'style'    => 'max-width: 100%; margin-top: 1rem;',
			'preload'  => 'metadata',
		);

		return $this->generate_video_html( $src, $video_attrs );
	}

	/**
	 * Generate video HTML markup.
	 *
	 * @param string $src        Video source URL.
	 * @param array  $attributes Video element attributes.
	 *
	 * @return string Video HTML markup.
	 */
	private function generate_video_html( string $src, array $attributes ): string {
		$attrs_string  = $this->build_attributes_string( $attributes );
		$fallback_text = esc_html__( 'Your browser does not support the video tag.', 'godam' );

		return sprintf(
			'<video %s><source src="%s" type="video/mp4">%s</video>',
			$attrs_string,
			esc_url( $src ),
			$fallback_text
		);
	}

	/**
	 * Build HTML attributes string from array.
	 *
	 * @param array $attributes Associative array of attributes.
	 *
	 * @return string HTML attributes string.
	 */
	private function build_attributes_string( array $attributes ): string {
		$attr_strings = array();

		foreach ( $attributes as $key => $value ) {
			if ( is_bool( $value ) && $value ) {
				$attr_strings[] = esc_attr( $key );
			} elseif ( ! is_bool( $value ) ) {
				$attr_strings[] = sprintf( '%s="%s"', esc_attr( $key ), esc_attr( $value ) );
			}
		}

		return implode( ' ', $attr_strings );
	}
}
