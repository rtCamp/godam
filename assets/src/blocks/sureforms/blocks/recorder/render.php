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

/**
 * Wrapper attributes.
 */
$wrapper_attributes = get_block_wrapper_attributes(
	array(
		'class' => 'godam_srfm_input_recorder_container srfm-block',
	)
);
?>

<div <?php echo $wrapper_attributes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
	<input
		type="hidden"
		name="MAX_FILE_SIZE"
		value="<?php echo esc_attr( $max_file_size ); ?>"
	/>
	<input
		name="<?php echo esc_attr( 'input_' . $form_id ); ?>"
		id="<?php echo esc_attr( $block_id ); ?>"
		type="file"
		style="display: none;"
		class="rtgodam-hidden"
	/>
	<label
		for="<?php echo esc_attr( $video_upload_button_id ); ?>"
		class="srfm-block-label"
		><?php echo esc_html( $label ); ?>
		<?php if ( $required ) : ?>
			<span class="srfm-required" aria-label="required"> *</span>
		<?php endif; ?>
	</label>
	<label
		for="<?php echo esc_attr( $video_upload_button_id ); ?>"
		class="srfm-description"
		><?php echo esc_html( $help ); ?></label>
	<div
		style="margin: 4px 0;"
		data-max-size="<?php echo esc_attr( $max_file_size ); ?>"
		id="<?php echo esc_attr( $uppy_container_id ); ?>"
		class="uppy-video-upload"
		data-input-id="<?php echo esc_attr( $block_id ); ?>"
		data-video-upload-button-id="<?php echo esc_attr( $video_upload_button_id ); ?>"
		data-file-selectors="<?php echo esc_attr( implode( ',', $file_selector ) ); ?>"
	>
		<button
			type="button"
			id="<?php echo esc_attr( $video_upload_button_id ); ?>"
			class="uppy-video-upload-button srfm-button"
		>
			<span class="dashicons dashicons-video-alt"></span>
			<?php echo esc_html( $record_button ); ?>
		</button>
		<div id="<?php echo esc_attr( $uppy_preview_id ); ?>" class="uppy-video-upload-preview"></div>
		<div id="<?php echo esc_attr( $uppy_file_name_id ); ?>" class="upp-video-upload-filename"></div>
	</div>
	<p class="srfm-description">
		<?php
			echo esc_html(
				sprintf(
					// Translators: %s will be replaced with the maximum file upload size allowed on the server (e.g., "300MB").
					__( 'Maximum allowed on this server: %s MB', 'godam' ),
					$max_file_size,
				)
			);
			?>
	</p>
</div>