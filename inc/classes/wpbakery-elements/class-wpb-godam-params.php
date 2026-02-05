<?php
/**
 * WPBakery GoDAM Params Class
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\WPBakery_Elements;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class WPB_GoDAM_Params
 *
 * @since 1.6.0
 * 
 * @package GoDAM
 */
class WPB_GoDAM_Params {
	use Singleton;

	/**
	 * WPB_GoDAM_Params constructor.
	 *
	 * @since 1.6.0
	 */
	protected function __construct() {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$is_wpbakery_active = is_plugin_active( 'js_composer/js_composer.php' );

		if ( $is_wpbakery_active ) {
			add_action( 'vc_before_init', array( $this, 'setup_custom_params' ), 9 );
		}
	}

	/**
	 * Setup custom params.
	 * 
	 * @since 1.6.0
	 *
	 * @return void
	 */
	public function setup_custom_params() {

		vc_add_shortcode_param( 
			'video_selector',
			array( $this, 'video_selector_settings_field' ),
			RTGODAM_URL . 'assets/build/js/wpbakery-video-selector-param.min.js'
		);

		vc_add_shortcode_param( 
			'audio_selector',
			array( $this, 'audio_selector_settings_field' ),
			RTGODAM_URL . 'assets/build/js/wpbakery-audio-selector-param.min.js'
		);

		vc_add_shortcode_param(
			'image_src_selector',
			array( $this, 'image_src_selector_settings_field' ),
			RTGODAM_URL . 'assets/build/js/wpbakery-image-src-selector-param.min.js'
		);

		vc_add_shortcode_param(
			'textfield_hidden',
			array( $this, 'textfield_hidden_settings_field' ),
		);
	}

	/**
	 * Video selector settings field.
	 * 
	 * @since 1.6.0
	 *
	 * @param array  $settings Field settings.
	 * @param string $value    Field value.
	 * @return string
	 */
	public function video_selector_settings_field( $settings, $value ) {
		$button_text   = ! empty( $value ) ? esc_html__( 'Replace', 'godam' ) : esc_html__( 'Select video', 'godam' );
		$preview_html  = '';
		$remove_button = '';
		
		// If a video is selected, show preview and remove button.
		if ( ! empty( $value ) && is_numeric( $value ) ) {
			$attachment = wp_get_attachment_url( $value );
			if ( $attachment ) {
				$preview_html  = '<div class="video-selector-preview" style="margin-top: 10px;">
					<video width="100%" height="auto" controls style="max-width: 300px;">
						<source src="' . esc_url( $attachment ) . '" type="video/mp4">
					</video>
				</div>';
				$remove_button = '<button class="button video-selector-remove" data-param="' . esc_attr( $settings['param_name'] ) . '" style="margin-left: 5px;">' . esc_html__( 'Remove', 'godam' ) . '</button>';
			}
		}
		
		return '<div class="video_selector_block">'
			. '<input name="' . esc_attr( $settings['param_name'] ) . '" class="wpb_vc_param_value wpb-textinput video_selector_field ' .
			esc_attr( $settings['param_name'] ) . ' ' .
			esc_attr( $settings['type'] ) . '_field" type="hidden" value="' . esc_attr( $value ) . '" />'
			. '<div class="video_selector-buttons-wrapper" style="display: flex; align-items: center;">'
			. '<button class="button video-selector-button" data-param="' . esc_attr( $settings['param_name'] ) . '">' . $button_text . '</button>'
			. $remove_button
			. '</div>'
			. $preview_html
			. '</div>';
	}

	/**
	 * Audio selector settings field.
	 * 
	 * @since 1.6.0
	 *
	 * @param array  $settings Field settings.
	 * @param string $value    Field value.
	 * @return string
	 */
	public function audio_selector_settings_field( $settings, $value ) {
		$button_text   = ! empty( $value ) ? esc_html__( 'Replace', 'godam' ) : esc_html__( 'Select audio', 'godam' );
		$preview_html  = '';
		$remove_button = '';
		
		// If an audio is selected, show preview and remove button.
		if ( ! empty( $value ) && is_numeric( $value ) ) {
			$attachment = wp_get_attachment_url( $value );
			if ( $attachment ) {
				$preview_html  = '<div class="audio-selector-preview" style="margin-top: 10px;">
					<audio controls style="max-width: 300px; width: 100%;">
						<source src="' . esc_url( $attachment ) . '" type="audio/mpeg">
					</audio>
				</div>';
				$remove_button = '<button class="button audio-selector-remove" data-param="' . esc_attr( $settings['param_name'] ) . '" style="margin-left: 5px;">' . esc_html__( 'Remove', 'godam' ) . '</button>';
			}
		}
		
		return '<div class="audio_selector_block">'
			. '<input name="' . esc_attr( $settings['param_name'] ) . '" class="wpb_vc_param_value wpb-textinput audio_selector_field ' .
			esc_attr( $settings['param_name'] ) . ' ' .
			esc_attr( $settings['type'] ) . '_field" type="hidden" value="' . esc_attr( $value ) . '" />'
			. '<div class="audio_selector-buttons-wrapper" style="display: flex; align-items: center;">'
			. '<button class="button audio-selector-button" data-param="' . esc_attr( $settings['param_name'] ) . '">' . $button_text . '</button>'
			. $remove_button
			. '</div>'
			. $preview_html
			. '</div>';
	}

	/**
	 * Image Src selector settings field.
	 * 
	 * @since 1.6.0
	 *
	 * @param array  $settings Field settings.
	 * @param string $value    Field value.
	 * @return string
	 */
	public function image_src_selector_settings_field( $settings, $value ) {
		$button_text   = ! empty( $value ) ? esc_html__( 'Replace', 'godam' ) : esc_html__( 'Select image', 'godam' );
		$preview_html  = '';
		$remove_button = '';
		
		// If an image is selected, show preview and remove button.
		if ( ! empty( $value ) ) {
			$preview_html  = '<div class="image-src-selector-preview" style="margin-top: 10px;">
                <img src="' . esc_url( $value ) . '" alt="" style="max-width: 300px; height: auto;" />
            </div>';
			$remove_button = '<button class="button image-src-selector-remove" data-param="' . esc_attr( $settings['param_name'] ) . '" style="margin-left: 5px;">' . esc_html__( 'Remove', 'godam' ) . '</button>';            
		}
		
		return '<div class="image_src_selector_block">'
			. '<input name="' . esc_attr( $settings['param_name'] ) . '" class="wpb_vc_param_value wpb-textinput image_src_selector_field ' .
			esc_attr( $settings['param_name'] ) . ' ' .
			esc_attr( $settings['type'] ) . '_field" type="hidden" value="' . esc_attr( $value ) . '" />'
			. '<div class="image_src_selector-buttons-wrapper" style="display: flex; align-items: center;">'
			. '<button class="button image-src-selector-button" data-param="' . esc_attr( $settings['param_name'] ) . '">' . $button_text . '</button>'
			. $remove_button
			. '</div>'
			. $preview_html
			. '</div>';
	}

	/**
	 * Textfield hidden settings field.
	 * 
	 * @since 1.6.0
	 *
	 * @param array  $settings Field settings.
	 * @param string $value    Field value.
	 * @return string
	 */
	public function textfield_hidden_settings_field( $settings, $value ) {
		return '<input style="pointer-events: none; opacity: 0.5;" name="' . esc_attr( $settings['param_name'] ) . '" class="wpb_vc_param_value wpb-textinput textfield_hidden_field ' .
			esc_attr( $settings['param_name'] ) . ' ' .
			esc_attr( $settings['type'] ) . '_field" value="' . esc_attr( $value ) . '" />';        
	}
}
