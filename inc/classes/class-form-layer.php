<?php
/**
 * Class to handle Form Layer customization.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;
use WPCF7_ContactForm;

/**
 * Class Form_Layer
 */
class Form_Layer {
	use Singleton;

	/**
	 * Add a hidden input field to the form with the GoDAM identifier.
	 *
	 * @param int    $video_id   The ID of the video.
	 * @param string $form_type  The type of form (e.g., 'cf7', 'gravity').
	 * @param int    $form_id    The ID of the form.
	 * @return void
	 */
	public static function add_form_godam_identifier( $video_id, $form_type, $form_id ) {

		$godam_identifier = array(
			'video_id' => $video_id,
		);

		switch ( $form_type ) {
			case 'cf7':
				// Contact Form 7.
				add_filter(
					'wpcf7_form_elements',
					function ( $content ) use ( $godam_identifier, $form_id ) {
						$current_form = WPCF7_ContactForm::get_current();

						// Check if the current form is set and matches the provided form ID.
						if ( ! $current_form || $current_form->id() !== $form_id ) {
							return $content;
						}

						$html_class = $current_form->shortcode_attr( 'html_class' );

						// Check if the HTML class contains 'godam-video'.
						if ( ! isset( $html_class ) || ! str_contains( $html_class, 'godam-video' ) ) {
							return $content;
						}

						$content .= '<input type="hidden" name="godam_source" value="' . esc_attr( wp_json_encode( $godam_identifier ) ) . '">';
						return $content;
					}
				);
				break;
			case 'gravity':
				// Gravity Forms.
				add_filter(
					'gform_get_form_filter_' . $form_id,
					function ( $content ) use ( $godam_identifier ) {
						global $godam_rending_form;

						// Check if we are rendering the a form layer.
						if ( ! $godam_rending_form ) {
							return $content;
						}
						// Append the hidden input field to the form content.
						$content = str_replace(
							'</form>',
							'<input type="hidden" name="godam_source" value="' . esc_attr( wp_json_encode( $godam_identifier ) ) . '"></form>',
							$content
						);
						return $content;
					},
					10,
					2
				);
				break;
		}
	}
}
