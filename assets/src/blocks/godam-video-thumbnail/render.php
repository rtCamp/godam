<?php
/**
 * Render template for the GoDAM Video Thumbnail Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$video_post_id = get_the_ID();
$thumbnail_url = '';
$alt_text      = '';

if ( $video_post_id ) {

	// Get attachment ID from post meta.
	$attachment_id = get_post_meta( $video_post_id, '_godam_attachment_id', true );

	// Get thumbnail URL directly from attachment's meta.
	$thumbnail_url = get_post_meta( $video_post_id, '_godam_video_thumbnail_url', true );

	// Set alt text to the post title.
	$alt_text = get_the_title();

}

$wrapper_classes = 'godam-video-thumbnail__container';
if ( empty( $thumbnail_url ) ) {
	$wrapper_classes .= ' godam-video-thumbnail--not-found';
}

$wrapper_attributes = get_block_wrapper_attributes(
	array(
		'class' => $wrapper_classes,
	)
);
?>

<div <?php echo wp_kses_data( $wrapper_attributes ); ?>>
	<?php if ( ! empty( $thumbnail_url ) ) : ?>
		<img src="<?php echo esc_url( $thumbnail_url ); ?>" alt="<?php echo esc_attr( $alt_text ); ?>" class="godam-video-thumbnail" />
	<?php else : ?>
		<div class="godam-video-thumbnail__fallback">
		</div>
</div>
<?php endif; ?>