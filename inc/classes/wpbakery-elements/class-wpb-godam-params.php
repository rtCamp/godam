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
			'document_selector',
			array( $this, 'document_selector_settings_field' ),
			RTGODAM_URL . 'assets/build/js/wpbakery-document-selector-param.min.js'
		);

		vc_add_shortcode_param(
			'document_cover_selector',
			array( $this, 'document_cover_selector_settings_field' ),
			RTGODAM_URL . 'assets/build/js/wpbakery-document-cover-selector-param.min.js'
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
				$preview_html  = '<div class="video-selector-preview" data-test-id="godam-wpb-preview-video" style="margin-top: 10px;">
					<video width="100%" height="auto" controls style="max-width: 300px;">
						<source src="' . esc_url( $attachment ) . '" type="video/mp4">
					</video>
				</div>';
				$remove_button = '<button type="button" class="button video-selector-remove" data-test-id="godam-wpb-button-remove-video" data-param="' . esc_attr( $settings['param_name'] ) . '" style="margin-left: 5px;">' . esc_html__( 'Remove', 'godam' ) . '</button>';
			}
		}

		return '<div class="video_selector_block">'
			. '<input name="' . esc_attr( $settings['param_name'] ) . '" data-test-id="godam-wpb-input-video" class="wpb_vc_param_value wpb-textinput video_selector_field ' .
			esc_attr( $settings['param_name'] ) . ' ' .
			esc_attr( $settings['type'] ) . '_field" type="hidden" value="' . esc_attr( $value ) . '" />'
			. '<div class="video_selector-buttons-wrapper" style="display: flex; align-items: center;">'
			. '<button type="button" class="button video-selector-button" data-test-id="godam-wpb-button-select-video" data-param="' . esc_attr( $settings['param_name'] ) . '">' . $button_text . '</button>'
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
				$preview_html  = '<div class="audio-selector-preview" data-test-id="godam-wpb-preview-audio" style="margin-top: 10px;">
					<audio controls style="max-width: 300px; width: 100%;">
						<source src="' . esc_url( $attachment ) . '" type="audio/mpeg">
					</audio>
				</div>';
				$remove_button = '<button type="button" class="button audio-selector-remove" data-test-id="godam-wpb-button-remove-audio" data-param="' . esc_attr( $settings['param_name'] ) . '" style="margin-left: 5px;">' . esc_html__( 'Remove', 'godam' ) . '</button>';
			}
		}

		return '<div class="audio_selector_block">'
			. '<input name="' . esc_attr( $settings['param_name'] ) . '" data-test-id="godam-wpb-input-audio" class="wpb_vc_param_value wpb-textinput audio_selector_field ' .
			esc_attr( $settings['param_name'] ) . ' ' .
			esc_attr( $settings['type'] ) . '_field" type="hidden" value="' . esc_attr( $value ) . '" />'
			. '<div class="audio_selector-buttons-wrapper" style="display: flex; align-items: center;">'
			. '<button type="button" class="button audio-selector-button" data-test-id="godam-wpb-button-select-audio" data-param="' . esc_attr( $settings['param_name'] ) . '">' . $button_text . '</button>'
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
			$preview_html  = '<div class="image-src-selector-preview" data-test-id="godam-wpb-preview-image" style="margin-top: 10px;">
                <img src="' . esc_url( $value ) . '" alt="" style="max-width: 300px; height: auto;" />
            </div>';
			$remove_button = '<button type="button" class="button image-src-selector-remove" data-test-id="godam-wpb-button-remove-image" data-param="' . esc_attr( $settings['param_name'] ) . '" style="margin-left: 5px;">' . esc_html__( 'Remove', 'godam' ) . '</button>';
		}

		return '<div class="image_src_selector_block">'
			. '<input name="' . esc_attr( $settings['param_name'] ) . '" data-test-id="godam-wpb-input-image" class="wpb_vc_param_value wpb-textinput image_src_selector_field ' .
			esc_attr( $settings['param_name'] ) . ' ' .
			esc_attr( $settings['type'] ) . '_field" type="hidden" value="' . esc_attr( $value ) . '" />'
			. '<div class="image_src_selector-buttons-wrapper" style="display: flex; align-items: center;">'
			. '<button type="button" class="button image-src-selector-button" data-test-id="godam-wpb-button-select-image" data-param="' . esc_attr( $settings['param_name'] ) . '">' . $button_text . '</button>'
			. $remove_button
			. '</div>'
			. $preview_html
			. '</div>';
	}

	/**
	 * Document selector settings field.
	 *
	 * @since 2.0.0
	 *
	 * @param array  $settings Field settings.
	 * @param string $value    Field value.
	 * @return string
	 */
	public function document_selector_settings_field( $settings, $value ) {
		$button_text   = ! empty( $value ) ? esc_html__( 'Replace', 'godam' ) : esc_html__( 'Select document', 'godam' );
		$preview_html  = '';
		$remove_button = '';

		// If a document is selected, show preview and remove button.
		if ( ! empty( $value ) && is_numeric( $value ) ) {
			$attachment = wp_get_attachment_url( $value );
			if ( $attachment ) {
				$file_name     = basename( $attachment );
				$preview_html  = '<div class="document-selector-preview" data-test-id="godam-wpb-preview-document" style="margin-top: 10px;">
					<span class="dashicons dashicons-media-document" style="vertical-align: middle;"></span>
					<span class="document-selector-preview__name">' . esc_html( $file_name ) . '</span>
				</div>';
				$remove_button = '<button type="button" class="button document-selector-remove" data-test-id="godam-wpb-button-remove-document" data-param="' . esc_attr( $settings['param_name'] ) . '" style="margin-left: 5px;">' . esc_html__( 'Remove', 'godam' ) . '</button>';
			}
		}

		return '<div class="document_selector_block">'
			. '<input name="' . esc_attr( $settings['param_name'] ) . '" data-test-id="godam-wpb-input-document" class="wpb_vc_param_value wpb-textinput document_selector_field ' .
			esc_attr( $settings['param_name'] ) . ' ' .
			esc_attr( $settings['type'] ) . '_field" type="hidden" value="' . esc_attr( $value ) . '" />'
			. '<div class="document_selector-buttons-wrapper" style="display: flex; align-items: center;">'
			. '<button type="button" class="button document-selector-button" data-test-id="godam-wpb-button-select-document" data-param="' . esc_attr( $settings['param_name'] ) . '">' . $button_text . '</button>'
			. $remove_button
			. '</div>'
			. $preview_html
			. '</div>';
	}

	/**
	 * Document cover selector settings field.
	 *
	 * Mirrors the block's cover picker: the auto-generated cover (fetched
	 * client-side from the attachment meta) is the default, with the option to
	 * override it with a custom image. An empty stored value means "use the
	 * auto-generated cover" — which the render template already falls back to.
	 *
	 * @since 2.0.0
	 *
	 * @param array  $settings Field settings.
	 * @param string $value    Field value (custom cover URL, empty = auto).
	 * @return string
	 */
	public function document_cover_selector_settings_field( $settings, $value ) {
		return '<div class="document_cover_selector_block">'
			. '<input name="' . esc_attr( $settings['param_name'] ) . '" data-test-id="godam-wpb-input-cover" class="wpb_vc_param_value wpb-textinput document_cover_selector_field ' .
			esc_attr( $settings['param_name'] ) . ' ' .
			esc_attr( $settings['type'] ) . '_field" type="hidden" value="' . esc_attr( $value ) . '" />'
			. '<div class="document-cover-tiles" data-test-id="godam-wpb-cover-tiles" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;"></div>'
			. '<div class="document_cover_selector-buttons-wrapper" style="display:flex;align-items:center;">'
			. '<button type="button" class="button document-cover-select" data-test-id="godam-wpb-button-select-cover">' . esc_html__( 'Select image', 'godam' ) . '</button>'
			. '</div>'
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
