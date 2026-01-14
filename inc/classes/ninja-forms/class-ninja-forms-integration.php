<?php
/**
 * Handles Ninja Forms integration class.
 *
 * @since 1.4.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Ninja_Forms;

use RTGODAM\Inc\Ninja_Forms\Ninja_Forms_Field_Godam_Recorder;
use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Ninja_Forms_Integration
 *
 * @since 1.4.0
 */
class Ninja_Forms_Integration {

	use Singleton;

	/**
	 * Initialize class.
	 *
	 * @since 1.4.0
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
	 * @since 1.4.0
	 *
	 * @return void
	 */
	public function setup_hooks() {
		add_action( 'admin_enqueue_scripts', array( $this, 'add_additional_scripts' ), 11 );
		add_action( 'wp_enqueue_scripts', array( $this, 'add_additional_css_for_godam_player' ), 11 );

		add_action( 'rtgodam_render_layer_for_video_editor_before', array( $this, 'add_css_for_the_layer_inside_iframe' ), 10, 2 );
		add_action( 'rtgodam_render_layer_for_video_editor', array( $this, 'render_layer_form_for_video_editor' ), 10, 2 );

		add_filter( 'ninja_forms_register_fields', array( $this, 'register_field' ) );
		add_filter( 'ninja_forms_field_template_file_paths', array( $this, 'register_template_path' ) );
	}

	/**
	 * Add additional scripts.
	 *
	 * @since 1.4.0
	 *
	 * @return void
	 */
	public function add_additional_scripts() {
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

		$screen = get_current_screen();
		if ( ! $screen ) {
			return;
		}

		if ( 'ninja-forms_page_nf-submissions' !== $screen->id ) {
			return;
		}

		$custom_script = "
			document.addEventListener('DOMContentLoaded', () => {
				const processCells = () => {
					const list = document.querySelector('#the-list');

					if ( ! list ) {
						return;
					}

					list.querySelectorAll('.nf-submissions-cell').forEach(cell => {

						// Prevent re-processing
						if (cell && cell.dataset && cell.dataset.godamProcessed === '1') {
							return;
						}

						const text = cell.textContent.trim();

						if (
							(text.startsWith('http://') || text.startsWith('https://')) &&
							text.includes('/wp-content/uploads/')
						) {
							const link = document.createElement('a');
							link.href = text;
							link.target = '_blank';
							link.rel = 'noopener noreferrer';
							link.textContent = 'View Recording';

							cell.textContent = '';
							cell.appendChild(link);

							cell.dataset.godamProcessed = '1';
						}
					});
				};

				// Initial run
				processCells();

				const ninjaFormEntriesObserver = new MutationObserver(() => {
					processCells();
				});

				ninjaFormEntriesObserver.observe(document.body, {
					childList: true,
					subtree: true
				});
			});
			";

			wp_add_inline_script( 'rtgodam-script', $custom_script );
	}

	/**
	 * Add additional css for godam player.
	 *
	 * @since 1.4.0
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
	 * @since 1.4.0
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
	 * @since 1.4.0
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

	/**
	 * Register field
	 *
	 * @param array $fields Fields to register.
	 *
	 * @since 1.4.0
	 *
	 * @return array
	 */
	public function register_field( $fields ) {

		$fields[ Ninja_Forms_Field_Godam_Recorder::$field_type ] = Ninja_Forms_Field_Godam_Recorder::get_instance();

		return $fields;
	}

	/**
	 * Provides the template path for GoDAM Recorder.
	 *
	 * @param array $paths Paths to template files.
	 *
	 * @since 1.4.0
	 *
	 * @return array
	 */
	public function register_template_path( $paths ) {
		$paths[] = RTGODAM_PATH . 'inc/classes/ninja-forms/templates/';

		return $paths;
	}
}
