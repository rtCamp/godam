<?php

namespace RTGODAM\Inc\Elementor_Controls;

use RTGODAM\Inc\Assets;
use RTGODAM\Inc\Pages;

/**
 * FileSelect control.
 *
 * A control for selecting any type of files.
 *
 * @since 1.0.0
 */
class Media_Custom extends \Elementor\Base_Data_Control {

	public function get_type() {
		return 'media-custom';
	}

	public function get_default_value(){
		return [
			'id' => '',
			'url' => ''
		];
	}

	protected function get_default_settings(){
		return [
			'media_type' => 'text/vtt'
		];
	}

	public function enqueue() {
		wp_enqueue_script( 'fileselect-control' );
		// // Copy from assets:
		Assets::get_instance()->admin_enqueue_scripts();
		Pages::get_instance()->admin_enqueue_scripts();
	}

	public function content_template() {
		?>
		<div class="elementor-control-field elementor-control-media e-media-empty e-media-empty-placeholder rtgodam-file-selector">
			<label class="elementor-control-title">{{{ data.label }}}</label>
				<div class="rtgodam-media-controller elementor-control-media__file elementor-control-preview-area">
					<div class="elementor-control-media__file__content">
						<div class="elementor-control-media__file__content__label"><?php echo esc_html__( 'Click the media icon to upload file', 'elementor' ); ?></div>
						<div class="elementor-control-media__file__content__info">
							<div class="elementor-control-media__file__content__info__icon">
								<i class="eicon-document-file"></i>
							</div>
							<div class="elementor-control-media__file__content__info__name"></div>
						</div>
					</div>
					<div class="elementor-control-media__file__controls">
						<div class="elementor-control-media__remove elementor-control-media__file__controls__remove" data-tooltip="<?php echo esc_attr__( 'Remove', 'elementor' ); ?>">
							<i class="eicon-trash-o" aria-hidden="true"></i>
							<span class="elementor-screen-only"><?php echo esc_html__( 'Remove', 'elementor' ); ?></span>
						</div>
						<div class="elementor-control-media__file__controls__upload-button elementor-control-media-upload-button" data-tooltip="<?php echo esc_attr__( 'Upload', 'elementor' ); ?>">
							<i class="eicon-upload" aria-hidden="true"></i>
							<span class="elementor-screen-only"><?php echo esc_html__( 'Upload', 'elementor' ); ?></span>
						</div>
					</div>
				</div>
				<div class="elementor-control-field-description">{{{ data.description }}}</div>
			<input type="hidden" data-setting="audio-file">
		</div>
		<?php
	}
}
