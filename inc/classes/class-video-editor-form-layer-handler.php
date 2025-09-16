<?php
/**
 * Handles the rendering of form layers in the video editor.
 *
 * @since 1.4.0
 * @package GoDAM
 */

namespace RTGODAM\Inc;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class for handling video editor form layers rendering.
 *
 * @since 1.4.0
 */
class Video_Editor_Form_Layer_Handler {
	use Singleton;

	/**
	 * Initialize.
	 *
	 * @since 1.4.0
	 *
	 * @return void
	 */
	public function init() {
		// Handle layer rendering for video editor.
		add_filter( 'query_vars', array( $this, 'add_render_layer_query_var_for_video_editor' ) );
		add_filter( 'template_include', array( $this, 'update_render_layer_template_for_video_editor' ) );
	}

	/**
	 * Update the template for rendering layers in the video editor.
	 *
	 * @since 1.4.0
	 *
	 * @param string $template The current template.
	 *
	 * @return string Updated template path.
	 */
	public function update_render_layer_template_for_video_editor( $template ) {
		$layer_type = get_query_var( 'rtgodam-render-layer' );
		$layer_id   = absint( get_query_var( 'rtgodam-layer-id' ) );

		if ( $layer_type && $layer_id ) {
			$template = untrailingslashit( RTGODAM_PATH ) . '/inc/templates/render-video-editor-form-layer.php';
		}

		return $template;
	}

	/**
	 * Add query vars for render layer in video editor.
	 *
	 * @since 1.4.0
	 *
	 * @param array $query_vars The existing query vars.
	 *
	 * @return array Modified query vars.
	 */
	public function add_render_layer_query_var_for_video_editor( $query_vars ) {
		$query_vars[] = 'rtgodam-render-layer';
		$query_vars[] = 'rtgodam-layer-id';

		return $query_vars;
	}
}
