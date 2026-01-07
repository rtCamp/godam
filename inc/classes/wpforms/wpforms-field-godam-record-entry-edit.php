<?php
/**
 * Template/View which is render on the WPForms Edit Entry page for the GoDAM Video Recorder field.
 *
 * @package GoDAM
 *
 * @since 1.3.0
 */

// Check if the field is not a video field.
if ( ! isset( $field['type'] ) || 'godam_record' !== $field['type'] ) {
	return;
}

$godam_value = ''; // Video file url, which is saved under the /uploads/godam/wpforms directory.
if ( $field['properties']['inputs']['primary']['attr']['value'] ) {
	$godam_value = trim( $field['properties']['inputs']['primary']['attr']['value'] );
}

$godam_primary            = $field['properties']['inputs']['primary'];
$godam_primary['class'][] = 'godam-video-field-input';

$godam_video_name     = basename( $godam_value );
$godam_thumbnail_url  = '';
$godam_transcoded_url = '';

printf(
	'<input type="hidden" value="%s" %s %s>',
	esc_url( $godam_value ), // $godam_value is the video file URL.
	wpforms_html_attributes( $godam_primary['id'], $godam_primary['class'], $godam_primary['data'], $godam_primary['attr'] ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	$godam_primary['required'] // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
);

// Detect if this is an audio file.
$godam_is_audio = godam_is_audio_file( $godam_value );
?>
<div class="godam-video-preview">
	<?php if ( $godam_is_audio ) : ?>
		<audio controls>
			<?php if ( $godam_transcoded_url ) : ?>
				<source src="<?php echo esc_url( $godam_transcoded_url ); ?>" type="audio/mpeg">
			<?php endif; ?>
			<source src="<?php echo esc_url( $godam_value ); ?>" type="<?php echo esc_attr( $mime_type ); ?>">
			<?php esc_html_e( 'Your browser does not support the audio element.', 'godam' ); ?>
		</audio>
	<?php else : ?>
		<?php echo do_shortcode( "[godam_video poster='{$godam_thumbnail_url}' src='{$godam_value}' transcoded_url='{$godam_transcoded_url}']" ); ?>
	<?php endif; ?>
</div>
<a
	href="<?php echo esc_url( $godam_value ); ?>"
	target="_blank"
	class="godam-video-link <?php echo ( empty( $godam_value ) ? 'hidden' : '' ); ?>"
>
	<div class="godam-video-name"><?php echo esc_html( $godam_video_name ); ?></div>
</a>
<div class="godam-video-media-controls">
	<button
		type="button"
		class="button godam-video-upload-btn <?php echo ( empty( $godam_value ) ? '' : 'hidden' ); ?>"
	><?php esc_html_e( 'Upload', 'godam' ); ?></button>

	<button
		type="button"
		class="button godam-video-remove-btn <?php echo ( empty( $godam_value ) ? 'hidden' : '' ); ?>"
	><?php esc_html_e( 'Remove', 'godam' ); ?></button>
</div>
