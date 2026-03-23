<?php
/**
 * Template which is rendered for the WPForms GoDAM Video Field on the frontend.
 *
 * @package GoDAM
 *
 * @since 1.3.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$godam_video_upload_button_id = wp_unique_id( 'uppy-video-upload-' );

// Define data.
$godam_primary = $field['properties']['inputs']['primary'];

$godam_form_id       = isset( $form_data['id'] ) ? absint( $form_data['id'] ) : 0;
$godam_field_id      = isset( $field['id'] ) ? absint( $field['id'] ) : 0;
$godam_file_input_id = "wpforms_file_input_{$godam_form_id}_{$godam_field_id}";

// Attributes - Max Upload Size.
$godam_max_upload_size = isset( $field['max_file_size'] ) ? absint( $field['max_file_size'] ) : 0;
$godam_max_upload_size = $godam_max_upload_size > 0 ? $godam_max_upload_size * 1024 * 1024 : wp_max_upload_size(); // Convert MB to bytes.

// Attributes - File Selectors.
$godam_file_selectors = $this->extract_file_selectors_from_field( $field );
$godam_file_selectors = join( ',', $godam_file_selectors );

// Uppy container.
$godam_uppy_container_id = "uppy_container_{$godam_form_id}_{$godam_field_id}";
$godam_uppy_file_name_id = "uppy_filename_{$godam_form_id}_{$godam_field_id}";
$godam_uppy_preview_id   = "uppy_preview_{$godam_form_id}_{$godam_field_id}";

?>
<?php if ( $godam_max_upload_size <= 2047 * 1048576 ) : // Hidden file input that will be populated by Uppy. ?>
	<input type="hidden" name="MAX_FILE_SIZE" value="<?php echo esc_attr( $godam_max_upload_size ); ?>" />
<?php endif; ?>
<input
	type="file"
	id="<?php echo esc_attr( $godam_file_input_id ); ?>"
	style="display: none;"
	<?php echo wpforms_html_attributes( $godam_primary['id'], $godam_primary['class'], $godam_primary['data'], $godam_primary['attr'] ); //phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
	<?php echo $godam_primary['required']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
/>
<div
	data-max-size="<?php echo esc_attr( $godam_max_upload_size ); ?>"
	id="<?php echo esc_attr( $godam_uppy_container_id ); ?>"
	class="uppy-video-upload <?php echo esc_attr( join( ' ', $godam_primary['class'] ) ); ?>"
	data-input-id="<?php echo esc_attr( $godam_file_input_id ); ?>"
	data-video-upload-button-id="<?php echo esc_attr( $godam_video_upload_button_id ); ?>"
	data-file-selectors="<?php echo esc_attr( $godam_file_selectors ); ?>"
>
	<button
		type="button"
		id="<?php echo esc_attr( $godam_video_upload_button_id ); ?>"
		class="uppy-video-upload-button"
	>
		<span class="dashicons dashicons-video-alt"></span>
		<?php esc_html_e( 'Start Recording', 'godam' ); ?>
	</button>
	<div id="<?php echo esc_attr( $godam_uppy_preview_id ); ?>" class="uppy-video-upload-preview"></div>
	<div id="<?php echo esc_attr( $godam_uppy_file_name_id ); ?>" class="upp-video-upload-filename"></div>
</div>
