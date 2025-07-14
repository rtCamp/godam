<?php
/**
 * Render template for the GoDAM Video Thumbnail Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<?php
$wrapper_attributes = get_block_wrapper_attributes();

$video_post_id = get_the_ID();

if ( $video_post_id ) {

	// Get attachment ID from post meta.
	$attachment_id = get_post_meta( $video_post_id, '_godam_attachment_id', true );

	// Get thumbnail URL directly from attachment's meta.
	$video_duration = get_post_meta( $attachment_id, '_video_duration', true );
}
?>

<?php if ( ! empty( $video_duration ) ) : ?>
	<div <?php echo wp_kses_data( $wrapper_attributes ); ?>>
		<p><?php echo esc_html( $video_duration ); ?></p>
	</div>
<?php endif; ?>