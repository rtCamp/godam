<?php
/**
 * Template which is rendered for the WPForms GoDAM Video Field on the frontend.
 *
 * @package GoDAM
 *
 * @since n.e.x.t
 */

$video_upload_button_id = wp_unique_id( 'uppy-video-upload-' );

// Define data.
$primary = $field['properties']['inputs']['primary'];

$form_id       = isset( $form_data['id'] ) ? absint( $form_data['id'] ) : 0;
$field_id      = isset( $field['id'] ) ? absint( $field['id'] ) : 0;
$file_input_id = "wpforms_file_input_{$form_id}_{$field_id}";

// Attributes - Max Upload Size.
$max_upload_size = isset( $field['max_file_size'] ) ? absint( $field['max_file_size'] ) : 0;
$max_upload_size = $max_upload_size > 0 ? $max_upload_size * 1024 * 1024 : wp_max_upload_size(); // Convert MB to bytes.

// Attributes - File Selectors.
$file_selectors = $this->extract_file_selectors_from_field( $field );
$file_selectors = join( ',', $file_selectors );

// Uppy container.
$uppy_container_id = "uppy_container_{$form_id}_{$field_id}";
$uppy_file_name_id = "uppy_filename_{$form_id}_{$field_id}";
$uppy_preview_id   = "uppy_preview_{$form_id}_{$field_id}";

?>
<?php if ( $max_upload_size <= 2047 * 1048576 ) : // Hidden file input that will be populated by Uppy. ?>
	<input type="hidden" name="MAX_FILE_SIZE" value="<?php echo esc_attr( $max_upload_size ); ?>" />
<?php endif; ?>
<input
	type="file"
	id="<?php echo esc_attr( $file_input_id ); ?>"
	style="display: none;"
	<?php echo wpforms_html_attributes( $primary['id'], $primary['class'], $primary['data'], $primary['attr'] ); //phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
	<?php echo $primary['required']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
/>
<div
	data-max-size="<?php echo esc_attr( $max_upload_size ); ?>"
	id="<?php echo esc_attr( $uppy_container_id ); ?>"
	class="uppy-video-upload <?php echo esc_attr( join( ' ', $primary['class'] ) ); ?>"
	data-input-id="<?php echo esc_attr( $file_input_id ); ?>"
	data-video-upload-button-id="<?php echo esc_attr( $video_upload_button_id ); ?>"
	data-file-selectors="<?php echo esc_attr( $file_selectors ); ?>"
>
	<button
		type="button"
		id="<?php echo esc_attr( $video_upload_button_id ); ?>"
		class="uppy-video-upload-button"
	>
		<span class="dashicons dashicons-video-alt"></span>
		<?php esc_html_e( 'Record Video', 'godam' ); ?>
	</button>
	<div id="<?php echo esc_attr( $uppy_preview_id ); ?>" class="uppy-video-upload-preview"></div>
	<div id="<?php echo esc_attr( $uppy_file_name_id ); ?>" class="upp-video-upload-filename"></div>
</div>
