<?php
/**
 * Template which is rendered for the Everest Forms GoDAM Video Field on the frontend.
 *
 * @package GoDAM
 *
 * @since 1.4.0
 */

// Get the primary field data.
$primary = $field['properties']['inputs']['primary'] ?? array();

// Get the required data.
$max_file_size          = empty( $field['max_size'] ) ? (int) ( wp_max_upload_size() / ( 1024 * 1024 ) ) : absint( $field['max_size'] );
$name                   = $primary['attr']['name'] ?? 'godam-recorder';
$input_id               = $primary['id'] ?? 'godam-recorder';
$field_id               = $field['id'] ?? 0;
$class                  = ! empty( $primary['class'] ) ? join( ' ', $primary['class'] ) : 'godam-recorder';
$video_upload_button_id = wp_unique_id( 'uppy-video-upload-' );
$description            = $field['description'] ?? '';
$button_text            = empty( $field['button_text'] ) ? __( 'Record Video', 'godam' ) : $field['button_text'];
$file_selectors         = empty( $file_selectors ) ? array( 'screen_capture', 'webcam' ) : $file_selectors;
$form_id                = $form_data['id'] ?? 0;
$required               = 'required' === $primary['required'] ? true : false;

/**
 * Uppy container.
 */
$uppy_container_id = sprintf( 'uppy_container_%s_%s', $input_id, $form_id );
$uppy_file_name_id = sprintf( 'uppy_filename_%s_%s', $input_id, $form_id );
$uppy_preview_id   = sprintf( 'uppy_preview_%s_%s', $input_id, $form_id );

?>
<input
	type="hidden"
	name="max-file-size"
	value="<?php echo esc_attr( $max_file_size ); ?>"
/>
<input
	name="<?php echo esc_attr( $name . '_file' ); ?>"
	id="<?php echo esc_attr( $input_id ); ?>"
	data-form-id="<?php echo esc_attr( $form_id ); ?>"
	data-field-id="<?php echo esc_attr( $field_id ); ?>"
	data-max-size="<?php echo esc_attr( $max_file_size ); ?>"
	type="file"
	aria-required="<?php echo esc_attr( $required ? 'true' : '' ); ?>"
	style="display: none;"
	class="rtgodam-hidden <?php echo esc_attr( $class ); ?>"
/>
<div
	style="margin: 4px 0;"
	data-max-size="<?php echo esc_attr( $max_file_size * 1024 * 1024 ); ?>"
	id="<?php echo esc_attr( $uppy_container_id ); ?>"
	class="uppy-video-upload"
	data-input-id="<?php echo esc_attr( $input_id ); ?>"
	data-video-upload-button-id="<?php echo esc_attr( $video_upload_button_id ); ?>"
	data-file-selectors="<?php echo esc_attr( implode( ',', $file_selectors ) ); ?>"
>
	<button
		type="button"
		id="<?php echo esc_attr( $video_upload_button_id ); ?>"
		class="uppy-video-upload-button button"
	>
		<span style="vertical-align: text-top;" class="dashicons dashicons-video-alt"></span>
		<?php echo esc_html( $button_text ); ?>
	</button>
	<div class="evf-field-description" style="margin-bottom: 0px;">
		<?php
		echo esc_html(
			sprintf(
				// Translators: %s will be replaced with the maximum file upload size allowed on the server (e.g., "300MB").
				__( 'Maximum allowed on this server: %s MB', 'godam' ),
				(int) $max_file_size
			)
		);
		?>
	</div>
	<div id="<?php echo esc_attr( $uppy_preview_id ); ?>" class="uppy-video-upload-preview"></div>
	<div id="<?php echo esc_attr( $uppy_file_name_id ); ?>" class="uppy-video-upload-filename"></div>
</div>
<div style="display: none;" class="evf-uploaded-list godam-recorder">
	<input type="text" class="rtgodam-hidden" name="<?php echo esc_attr( $name ); ?>" />
</div>
