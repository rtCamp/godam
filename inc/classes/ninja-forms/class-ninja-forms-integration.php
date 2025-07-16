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
 * Class Ninja_Forms_integration
 *
 * @since n.e.x.t
 */

class Ninja_Forms_integration {

	use Singleton;

	public function init() {
		if ( ! is_plugin_active( 'ninja-forms/ninja-forms.php' ) ) {
			return;
		}

		$this->setup_hooks();
	}

	public function setup_hooks() {
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_form_assets_on_video_editor_page' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_form_assets_on_video_editor_page' ) );
	}

	public function enqueue_form_assets_on_video_editor_page() {
		// $ver     = \Ninja_Forms::VERSION;
		// $js_dir  = \Ninja_Forms::$url . 'assets/js/min/';
		$css_dir = \Ninja_Forms::$url . 'assets/css/';

		// wp_enqueue_script( 'nf-front-end-deps', $js_dir . 'front-end-deps.js', array( 'jquery', 'backbone' ), $ver );
		// wp_enqueue_script( 'nf-front-end',      $js_dir . 'front-end.js',      array( 'nf-front-end-deps'  ), $ver );

		// wp_localize_script( 'nf-front-end', 'nfi18n', \Ninja_Forms::config( 'i18nFrontEnd' ) );

		// \NF_Display_Render::localize(0);

		// \NF_Display_Render::enqueue_scripts( 0 );

		// \NF_Display_Render::enqueue_styles_display( $css_dir );
	}
}
