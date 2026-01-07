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
$godam_max_file_size = wp_max_upload_size();

/**
 * Get all required attributes.
 */
$godam_label         = ! empty( $attributes['label'] ) ? $attributes['label'] : __( 'GoDAM Recorder', 'godam' );
$godam_help          = ! empty( $attributes['description'] ) ? $attributes['description'] : '';
$godam_block_id      = ! empty( $attributes['blockId'] ) ? $attributes['blockId'] : '';
$godam_required      = ! empty( $attributes['required'] ) ? $attributes['required'] : false;
$godam_record_button = ! empty( $attributes['recordButton'] ) ? $attributes['recordButton'] : __( 'Start Recording', 'godam' );
$godam_file_selector = ! empty( $attributes['fileSelector'] ) ? $attributes['fileSelector'] : array( 'file_input' );
$godam_max_file_size = ! empty( $attributes['maxFileSize'] ) ? absint( $attributes['maxFileSize'] ) * 1048576 : $godam_max_file_size;
$godam_form_id       = ! empty( $attributes['formId'] ) ? $attributes['formId'] : '';
$godam_slug          = ! empty( $attributes['slug'] ) ? $attributes['slug'] : 'recorder';
$godam_error_msg     = ! empty( $attributes['errorMsg'] ) ? $attributes['errorMsg'] : __( 'The field is required', 'godam' );
$godam_block_index   = ! empty( $attributes['blockIndex'] ) ? absint( $attributes['blockIndex'] ) : 1;

if ( empty( $godam_form_id ) ) {
	return;
}

/**
 * Unique video upload button ID.
 */
$godam_video_upload_button_id = wp_unique_id( 'uppy-video-upload-' );

/**
 * Uppy container.
 */
$godam_uppy_container_id = sprintf( 'uppy_container_%s_%s', $godam_form_id, $godam_block_id );
$godam_uppy_file_name_id = sprintf( 'uppy_filename_%s_%s', $godam_form_id, $godam_block_id );
$godam_uppy_preview_id   = sprintf( 'uppy_preview_%s_%s', $godam_form_id, $godam_block_id );

/**
 * Wrapper attributes.
 */
$godam_wrapper_attributes = get_block_wrapper_attributes(
	array(
		'class' => 'godam_srfm_input_recorder_container srfm-block srfm-block-single srfm-upload-block',
	)
);
?>

<div <?php echo $godam_wrapper_attributes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
	<input
		type="hidden"
		name="<?php echo esc_attr( 'godam-file-' . $godam_block_id . '-lbl-' . rtrim( base64_encode( 'file-input' ), '=' ) . '-max-file-size' ); ?>"
		value="<?php echo esc_attr( $godam_max_file_size ); ?>"
	/>
	<?php if ( $godam_required ) : ?>
		<input
			type="hidden"
			name="<?php echo esc_attr( 'godam-upload-error' . $godam_block_id . '-lbl-' . rtrim( base64_encode( 'errormsg' ), '=' ) . '-error-message' ); ?>"
			value="<?php echo esc_attr( $godam_error_msg ); ?>"
		/>
	<?php endif; ?>
	<input
		name="<?php echo esc_attr( 'godam-upload-' . $godam_block_id . '-lbl-' . rtrim( base64_encode( $godam_label ), '=' ) . '-input-recorder' . $godam_block_index ); ?>"
		id="<?php echo esc_attr( $godam_block_id ); ?>"
		type="file"
		style="display: none;"
		data-required="<?php echo esc_attr( $godam_required ? 'true' : '' ); ?>"
		class="rtgodam-hidden srfm-input-upload"
	/>
	<label
		for="<?php echo esc_attr( $godam_video_upload_button_id ); ?>"
		class="srfm-block-label"
		><?php echo esc_html( $godam_label ); ?>
		<?php if ( $godam_required ) : ?>
			<span class="srfm-required" aria-label="required"> *</span>
		<?php endif; ?>
	</label>
	<label
		for="<?php echo esc_attr( $godam_video_upload_button_id ); ?>"
		class="srfm-description"
		style="margin-top: 0;"
		><?php echo esc_html( $godam_help ); ?></label>
	<div
		style="margin: 4px 0;"
		data-max-size="<?php echo esc_attr( $godam_max_file_size ); ?>"
		id="<?php echo esc_attr( $godam_uppy_container_id ); ?>"
		class="uppy-video-upload"
		data-input-id="<?php echo esc_attr( $godam_block_id ); ?>"
		data-video-upload-button-id="<?php echo esc_attr( $godam_video_upload_button_id ); ?>"
		data-file-selectors="<?php echo esc_attr( implode( ',', $godam_file_selector ) ); ?>"
	>
		<button
			type="button"
			id="<?php echo esc_attr( $godam_video_upload_button_id ); ?>"
			class="uppy-video-upload-button srfm-button"
		>
			<span class="dashicons dashicons-video-alt"></span>
			<?php echo esc_html( $godam_record_button ); ?>
		</button>
		<p
			class="srfm-description"
			style="margin-bottom: 0;"
		>
			<?php
				echo esc_html(
					sprintf(
						// Translators: %s will be replaced with the maximum file upload size allowed on the server (e.g., "300MB").
						__( 'Maximum allowed on this server: %d MB', 'godam' ),
						(int) ( $godam_max_file_size / 1048576 ),
					)
				);
				?>
		</p>
		<div id="<?php echo esc_attr( $godam_uppy_preview_id ); ?>" class="uppy-video-upload-preview" style="margin-top: 0;"></div>
		<div id="<?php echo esc_attr( $godam_uppy_file_name_id ); ?>" class="upp-video-upload-filename srfm-description"></div>
		<div class="srfm-error-wrap">
			<div
				class="srfm-error-message"
				data-srfm-id="srfm-error-<?php echo esc_attr( $godam_block_id ); ?>"
				data-error-msg="<?php echo esc_attr( $godam_error_msg ); ?>"
			><?php echo esc_html( $godam_error_msg ); ?></div>
		</div>
	</div>
</div>