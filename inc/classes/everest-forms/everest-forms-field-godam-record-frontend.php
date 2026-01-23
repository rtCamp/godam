<?php
/**
 * Template which is rendered for the Everest Forms GoDAM Video Field on the frontend.
 *
 * @package GoDAM
 *
 * @since 1.4.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Get the primary field data.
$godam_primary = $field['properties']['inputs']['primary'] ?? array();

// Get the required data.
$godam_max_file_size          = empty( $field['max_size'] ) ? (int) ( wp_max_upload_size() / ( 1024 * 1024 ) ) : absint( $field['max_size'] );
$godam_name                   = $godam_primary['attr']['name'] ?? 'godam-recorder';
$godam_input_id               = $godam_primary['id'] ?? 'godam-recorder';
$godam_field_id               = $field['id'] ?? 0;
$godam_class                  = ! empty( $godam_primary['class'] ) ? join( ' ', $godam_primary['class'] ) : 'godam-recorder';
$godam_video_upload_button_id = wp_unique_id( 'uppy-video-upload-' );
$godam_description            = $field['description'] ?? '';
$godam_button_text            = empty( $field['button_text'] ) ? __( 'Record Video', 'godam' ) : $field['button_text'];
$godam_file_selectors         = empty( $godam_file_selectors ) ? array( 'screen_capture', 'webcam' ) : $godam_file_selectors;
$godam_form_id                = $form_data['id'] ?? 0;
$godam_required               = 'required' === $godam_primary['required'] ? true : false;

/**
 * Uppy container.
 */
$godam_uppy_container_id = sprintf( 'uppy_container_%s_%s', $godam_input_id, $godam_form_id );
$godam_uppy_file_name_id = sprintf( 'uppy_filename_%s_%s', $godam_input_id, $godam_form_id );
$godam_uppy_preview_id   = sprintf( 'uppy_preview_%s_%s', $godam_input_id, $godam_form_id );

?>
<input
	type="hidden"
	name="max-file-size"
	value="<?php echo esc_attr( $godam_max_file_size ); ?>"
/>
<input
	name="<?php echo esc_attr( $godam_name . '_file' ); ?>"
	id="<?php echo esc_attr( $godam_input_id ); ?>"
	data-form-id="<?php echo esc_attr( $godam_form_id ); ?>"
	data-field-id="<?php echo esc_attr( $godam_field_id ); ?>"
	data-max-size="<?php echo esc_attr( $godam_max_file_size ); ?>"
	type="file"
	aria-required="<?php echo esc_attr( $godam_required ? 'true' : '' ); ?>"
	style="display: none;"
	class="rtgodam-hidden <?php echo esc_attr( $godam_class ); ?>"
/>
<div
	style="margin: 4px 0;"
	data-max-size="<?php echo esc_attr( $godam_max_file_size * 1024 * 1024 ); ?>"
	id="<?php echo esc_attr( $godam_uppy_container_id ); ?>"
	class="uppy-video-upload"
	data-input-id="<?php echo esc_attr( $godam_input_id ); ?>"
	data-video-upload-button-id="<?php echo esc_attr( $godam_video_upload_button_id ); ?>"
	data-file-selectors="<?php echo esc_attr( implode( ',', $godam_file_selectors ) ); ?>"
>
	<button
		type="button"
		id="<?php echo esc_attr( $godam_video_upload_button_id ); ?>"
		class="uppy-video-upload-button button"
	>
		<span style="vertical-align: text-top;" class="dashicons dashicons-video-alt"></span>
		<?php echo esc_html( $godam_button_text ); ?>
	</button>
	<div class="evf-field-description" style="margin-bottom: 0px;">
		<?php
		echo esc_html(
			sprintf(
				// Translators: %s will be replaced with the maximum file upload size allowed on the server (e.g., "300MB").
				__( 'Maximum allowed on this server: %s MB', 'godam' ),
				(int) $godam_max_file_size
			)
		);
		?>
	</div>
	<div id="<?php echo esc_attr( $godam_uppy_preview_id ); ?>" class="uppy-video-upload-preview"></div>
	<div id="<?php echo esc_attr( $godam_uppy_file_name_id ); ?>" class="uppy-video-upload-filename"></div>
</div>
<div style="display: none;" class="evf-uploaded-list godam-recorder">
	<input type="text" class="rtgodam-hidden" name="<?php echo esc_attr( $godam_name ); ?>" />
</div>
