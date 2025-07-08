<?php



// Check if the field is not a video field.
if ( ! isset( $field['type'] ) || 'godam-video' !== $field['type'] ) {
    return;
}

$value = 0;
if ( $field["properties"]["inputs"]["primary"]["attr"]["value"] ) {
    $value = intval( $field["properties"]["inputs"]["primary"]["attr"]["value"] );
}

$primary = $field['properties']['inputs']['primary'];
$primary['class'][] = 'godam-video-field-input';

$attachment      = get_post( $value );
$attachment_url  = wp_get_attachment_url( $value );
$attachment_name = $attachment->post_title;
$thumbnail_url   = get_the_post_thumbnail_url( $attachment->ID );
$thumbnail_url   = $thumbnail_url ? $thumbnail_url : site_url('/wp-includes/images/media/video.svg');

printf(
    '<input type="hidden" value="%s" %s %s>',
    $value,
    wpforms_html_attributes( $primary['id'], $primary['class'], $primary['data'], $primary['attr'] ),
    $primary['required'] // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
);
?>
<a
    href="<?php echo esc_url( $attachment_url ) ;?>"
    target="_blank"
    class="godam-video-link <?php echo ( empty( $value ) ? 'hidden' : '' ); ?>"
>
    <img
        src="<?php echo esc_url( $thumbnail_url ); ?>"
        height="64"
        width="48"
        class="godam-video-file-thumbnail"
    />
    <div class="godam-video-name"><?php echo esc_html( $attachment_name ); ?></div>
</a>
<div class="godam-video-media-controls">
    <button
        type="button"
        class="button godam-video-upload-image <?php echo ( empty( $value ) ? '' : 'hidden' ); ?>"
    ><?php esc_html_e('Upload', 'godam'); ?></button>

    <button
        type="button"
        class="button godam-video-remove-image <?php echo ( empty( $value ) ? 'hidden' : '' ); ?>"
    ><?php esc_html_e('Remove', 'godam'); ?></button>
</div>
