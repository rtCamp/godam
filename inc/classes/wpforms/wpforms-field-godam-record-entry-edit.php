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

$value = ''; // Video file url, which is saved under the /uploads/godam/wpforms directory.
if ( $field['properties']['inputs']['primary']['attr']['value'] ) {
	$value = trim( $field['properties']['inputs']['primary']['attr']['value'] );
}

$primary            = $field['properties']['inputs']['primary'];
$primary['class'][] = 'godam-video-field-input';

$video_name     = basename( $value );
$thumbnail_url  = '';
$transcoded_url = '';

printf(
	'<input type="hidden" value="%s" %s %s>',
	esc_url( $value ), // $value is the video file URL.
	wpforms_html_attributes( $primary['id'], $primary['class'], $primary['data'], $primary['attr'] ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	$primary['required'] // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
);
?>
<div class="godam-video-preview">
	<?php echo do_shortcode( "[godam_video poster='{$thumbnail_url}' src='{$value}' transcoded_url='{$transcoded_url}']" ); ?>
</div>
<a
	href="<?php echo esc_url( $value ); ?>"
	target="_blank"
	class="godam-video-link <?php echo ( empty( $value ) ? 'hidden' : '' ); ?>"
>
	<div class="godam-video-name"><?php echo esc_html( $video_name ); ?></div>
</a>
<?php if ( ! empty( $value ) ) : ?>
    <a
        href="<?php echo esc_url( add_query_arg(
            array(
                'form_id'  => absint( $form_id ),
                'entry_id' => absint( $entry_id ),
                'field_id' => absint( $field['id'] ),
            ),
            site_url( '/godam-recorder/' )
        ) ); ?>"
        target="_blank"
        class="button godam-recorder-link"
    >
        <?php esc_html_e( 'Open Recorder', 'godam' ); ?>
    </a>
<?php endif; ?>

<div class="godam-video-media-controls">
	<button
		type="button"
		class="button godam-video-upload-btn <?php echo ( empty( $value ) ? '' : 'hidden' ); ?>"
	><?php esc_html_e( 'Upload', 'godam' ); ?></button>

	<button
		type="button"
		class="button godam-video-remove-btn <?php echo ( empty( $value ) ? 'hidden' : '' ); ?>"
	><?php esc_html_e( 'Remove', 'godam' ); ?></button>
</div>
