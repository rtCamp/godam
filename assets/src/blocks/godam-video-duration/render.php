<?php
/**
 * Render template for the GoDAM Video Thumbnail Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$wrapper_attributes = get_block_wrapper_attributes();
$attributes         = $block->attributes;
$duration_format    = isset( $attributes['durationFormat'] ) ? $attributes['durationFormat'] : 'default';

$video_post_id = get_the_ID();

if ( $video_post_id ) {

	// Get attachment ID from post meta.
	$attachment_id = get_post_meta( $video_post_id, '_godam_attachment_id', true );

	// Get thumbnail URL directly from attachment's meta.
	$video_duration = get_post_meta( $attachment_id, '_video_duration', true );
}

// Format the duration using the formatting function.
$formatted_duration = '';
if ( ! empty( $video_duration ) ) {
	$formatted_duration = rtgodam_block_format_video_duration( $video_duration, $duration_format );
}
?>

<?php if ( ! empty( $formatted_duration ) ) : ?>
	<div <?php echo wp_kses_data( $wrapper_attributes ); ?>>
		<p><?php echo esc_html( $formatted_duration ); ?></p>
	</div>
<?php endif; ?>