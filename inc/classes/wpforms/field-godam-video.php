<input
	type="file"
	<?php echo wpforms_html_attributes( $primary['id'], $primary['class'], $primary['data'], $primary['attr'] ); ?>
	<?php echo $primary['required']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
/>
<div
	data-max-size="<?php echo esc_attr( $max_upload_size ); ?>"
	id="<?php echo esc_attr( $uppy_container_id ); ?>"
	class="uppy-video-upload"
	data-input-id="<?php echo esc_attr( $field_id ); ?>"
	data-video-upload-button-id="<?php echo esc_attr( $video_upload_button_id ); ?>"
	data-file-selectors="<?php echo esc_attr( $file_selectors ); ?>"
>
	<button
		type="button"
		id="<?php echo esc_attr( $video_upload_button_id ); ?>"
		class="uppy-video-upload-button"
		<?php echo $disabled_text; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Already escaped in above scope. ?>
	>
		<span class="dashicons dashicons-video-alt"></span>
		<?php esc_html_e( 'Record Video', 'godam' ); ?>
	</button>
	<div id="<?php echo esc_attr( $uppy_preview_id ); ?>" class="uppy-video-upload-preview"></div>
	<div id="<?php echo esc_attr( $uppy_file_name_id ); ?>" class="upp-video-upload-filename"></div>
</div>
<?php
