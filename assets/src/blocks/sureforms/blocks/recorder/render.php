<?php
/**
 * Render template for the GoDAM Gallery Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Get max upload file size.
 */
$max_file_size = wp_max_upload_size();

/**
 * Get all required attributes.
 */
$label         = ! empty( $attributes['label'] ) ? $attributes['label'] : __( 'Record Video', 'godam' );
$help          = ! empty( $attributes['description'] ) ? $attributes['description'] : '';
$block_id      = ! empty( $attributes['blockId'] ) ? $attributes['blockId'] : '';
$required      = ! empty( $attributes['required'] ) ? $attributes['required'] : false;
$record_button = ! empty( $attributes['recordButton'] ) ? $attributes['recordButton'] : __( 'Record Video', 'godam' );
$file_selector = ! empty( $attributes['fileSelector'] ) ? $attributes['fileSelector'] : array( 'file_input' );
$max_file_size = ! empty( $attributes['maxFileSize'] ) ? $attributes['maxFileSize'] : $max_file_size;
$form_id       = ! empty( $attributes['formId'] ) ? $attributes['formId'] : '';
$slug          = ! empty( $attributes['slug'] ) ? $attributes['slug'] : 'recorder';
$error_msg     = ! empty( $attributes['errorMsg'] ) ? $attributes['errorMsg'] : __( 'The field is required', 'godam' );

if ( empty( $form_id ) ) {
	return;
}

/**
 * Unique video upload button ID.
 */
$video_upload_button_id = wp_unique_id( 'uppy-video-upload-' );

/**
 * Uppy container.
 */
$uppy_container_id = sprintf( 'uppy_container_%s_%s', $form_id, $block_id );
$uppy_file_name_id = sprintf( 'uppy_filename_%s_%s', $form_id, $block_id );
$uppy_preview_id   = sprintf( 'uppy_preview_%s_%s', $form_id, $block_id );
?>

<div
	class="godam_srfm_input_container"
	data-allowed-extensions="<?php echo esc_attr( $allowed_extensions ); ?>"
	data-max-files="<?php echo esc_attr( $max_files ); ?>"
>
	<input
		type="hidden"
		name="MAX_FILE_SIZE"
		value="<?php echo esc_attr( $max_upload_size ); ?>"
	/>
	<input
		name="<?php echo esc_attr( 'input_' . $form_id ); ?>"
		id="<?php echo esc_attr( $block_id ); ?>"
		type="file"
		style="display: none;"
		class="rtgodam-hidden"
	/>
	<div
		data-max-size="<?php echo esc_attr( $max_upload_size ); ?>"
		id="<?php echo esc_attr( $uppy_container_id ); ?>"
		class="uppy-video-upload"
		data-input-id="<?php echo esc_attr( $block_id ); ?>"
		data-video-upload-button-id="<?php echo esc_attr( $video_upload_button_id ); ?>"
		data-file-selectors="<?php echo esc_attr( implode( ',', $file_selector ) ); ?>"
	>
		<button
			type="button"
			id="<?php echo esc_attr( $video_upload_button_id ); ?>"
			class="uppy-video-upload-button"
		>
			<span class="dashicons dashicons-video-alt"></span>
			<?php esc_html( $record_button ); ?>
		</button>
		<div id="<?php echo esc_attr( $uppy_preview_id ); ?>" class="uppy-video-upload-preview"></div>
		<div id="<?php echo esc_attr( $uppy_file_name_id ); ?>" class="upp-video-upload-filename"></div>
	</div>
	<?php if ( $rules_messages ) : ?>
		<span class="gfield_description gform_fileupload_rules" id="<?php echo esc_attr( $rules_messages_id ); ?>">
			<?php echo esc_html( $rules_messages ); ?>
		</span>
	<?php endif; ?>
</div>