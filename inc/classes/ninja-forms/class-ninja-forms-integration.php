<?php
/**
 * Handles Ninja Forms integration class.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Ninja_Forms;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Ninja_Forms_Integration
 *
 * @since n.e.x.t
 */
class Ninja_Forms_Integration {

	use Singleton;

	/**
	 * Initialize class.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function init() {
		if ( ! is_plugin_active( 'ninja-forms/ninja-forms.php' ) ) {
			return;
		}

		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @since n.e.x.t
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
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function add_additional_css_for_video_editor() {
		$custom_css = '
			.form-container.ninja-form {
				margin: unset;
				height: 100%;
				overflow: unset !important;
				align-content: center;
				text-align: center;
			}

			.form-container.ninja-form iframe {
				height: 100%;
			}
		';


		wp_add_inline_style( 'rtgodam-style', $custom_css );
	}

	/**
	 * Add additional css for godam player.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function add_additional_css_for_godam_player() {
		$custom_css = '
			.easydam-layer.ninjaforms .form-container {
				position: static;
			}
		';


		wp_add_inline_style( 'godam-player-style', $custom_css );
	}

	/**
	 * Add css for the layer inside iframe.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $layer Layer name.
	 * @param string $layer_id Layer ID.
	 *
	 * @return void
	 */
	public function add_css_for_the_layer_inside_iframe( $layer, $layer_id ) {
		if ( 'ninja-forms' === $layer && ! empty( $layer_id ) ) {
			$custom_css = '
				html {
					margin: 0 !important;
					padding: 0 !important;
				}

				body {
					background: unset;
					height: 100vh;
					align-content: center;
				}
			';

			echo '<style>' . $custom_css . '</style>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
	}

	/**
	 * Render ninja form for video editor.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $layer Layer name.
	 * @param string $layer_id Layer ID.
	 *
	 * @return void
	 */
	public function render_layer_form_for_video_editor( $layer, $layer_id ) {
		if ( 'ninja-forms' === $layer && ! empty( $layer_id ) ) {
			echo do_shortcode( "[ninja_form id='{$layer_id}']" ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
	}
}
