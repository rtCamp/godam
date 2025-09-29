<?php
/**
 * Handles Metform integration class.
 *
 * @since 1.4.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Metform;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Metform_Integration
 *
 * @since 1.4.0
 */
class Metform_Integration {

	use Singleton;

	/**
	 * Initialize class.
	 *
	 * @since 1.4.0
	 *
	 * @return void
	 */
	public function init() {
		if ( ! is_plugin_active( 'metform/metform.php' ) ) {
			return;
		}

		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @since 1.4.0
	 *
	 * @return void
	 */
	public function setup_hooks() {
		add_action( 'admin_enqueue_scripts', array( $this, 'add_additional_css_for_video_editor' ), 11 );
		add_action( 'wp_enqueue_scripts', array( $this, 'add_additional_css_for_godam_player' ), 11 );

		add_action( 'rtgodam_render_layer_for_video_editor_before', array( $this, 'add_css_for_the_layer_inside_iframe' ), 10, 2 );
		add_action( 'rtgodam_render_layer_for_video_editor', array( $this, 'render_layer_form_for_video_editor' ), 10, 2 );
	}

	/**
	 * Add additional css for video editor.
	 *
	 * @since 1.4.0
	 *
	 * @return void
	 */
	public function add_additional_css_for_video_editor() {
		$custom_css = <<<'CSS'
			.form-container.metform {
				margin: unset;
				height: 100%;
				overflow: unset !important;
				align-content: center;
				text-align: center;
			}
			.form-container.metform iframe {
				height: 100%;
			}
		CSS;


		wp_add_inline_style( 'rtgodam-style', $custom_css );
	}

	/**
	 * Add additional css for godam player.
	 *
	 * @since 1.4.0
	 *
	 * @return void
	 */
	public function add_additional_css_for_godam_player() {
		$custom_css = <<<'CSS'
			.easydam-layer.metform .form-container {
				position: static;
			}
		CSS;

		wp_add_inline_style( 'godam-player-style', $custom_css );
	}

	/**
	 * Add css for the layer inside iframe.
	 *
	 * @since 1.4.0
	 *
	 * @param string $layer Layer name.
	 * @param string $layer_id Layer ID.
	 *
	 * @return void
	 */
	public function add_css_for_the_layer_inside_iframe( $layer, $layer_id ) {
		if ( 'metform' === $layer && ! empty( $layer_id ) ) {
			$custom_css = <<<'CSS'
				html {
					margin: 0 !important;
					padding: 0 !important;
				}
				body {
					background: unset;
					height: 100vh;
					align-content: center;
				}
			CSS;

			echo '<style>' . $custom_css . '</style>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
	}

	/**
	 * Render metform for video editor.
	 *
	 * @since 1.4.0
	 *
	 * @param string $layer Layer name.
	 * @param string $layer_id Layer ID.
	 *
	 * @return void
	 */
	public function render_layer_form_for_video_editor( $layer, $layer_id ) {
		if ( 'metform' === $layer && ! empty( $layer_id ) ) {
			echo do_shortcode( "[metform form_id='{$layer_id}']" ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
	}
}
