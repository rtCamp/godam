<?php
/**
 * Render template for the GoDAM Video Thumbnail Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$link_to_video    = isset( $attributes['linkToVideo'] ) ? $attributes['linkToVideo'] : false;
$show_play_button = isset( $attributes['showPlayButton'] ) ? $attributes['showPlayButton'] : false;
$open_in_new_tab  = isset( $attributes['openInNewTab'] ) ? $attributes['openInNewTab'] : false;

$video_post_id = get_the_ID();
$thumbnail_url = '';
$alt_text      = '';

if ( $video_post_id ) {

	// Get attachment ID from post meta.
	$attachment_id = get_post_meta( $video_post_id, '_godam_attachment_id', true );

	// Get thumbnail URL directly from attachment's meta.
	$thumbnail_url = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );

	// Set alt text to the post title.
	$alt_text = get_the_title();
}

$wrapper_classes = 'godam-video-thumbnail__container';
if ( empty( $thumbnail_url ) ) {
	$wrapper_classes .= ' godam-video-thumbnail--not-found';
}
if ( $show_play_button ) {
	$wrapper_classes .= ' godam-video-thumbnail--with-play-button';
}

$wrapper_attributes = get_block_wrapper_attributes(
	array(
		'class' => $wrapper_classes,
	)
);
?>

<div <?php echo wp_kses_data( $wrapper_attributes ); ?>>
	<?php if ( ! empty( $thumbnail_url ) ) : ?>
		<?php if ( $link_to_video ) : ?>
			<a href="<?php echo esc_url( get_permalink( $video_post_id ) ); ?>" class="godam-video-thumbnail__link"<?php echo $open_in_new_tab ? ' target="_blank" rel="noopener noreferrer"' : ''; ?>>
				<img src="<?php echo esc_url( $thumbnail_url ); ?>" alt="<?php echo esc_attr( $alt_text ); ?>" class="godam-video-thumbnail" />
				<?php if ( $show_play_button ) : ?>
					<div class="godam-video-thumbnail__play-button">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60" height="60" aria-hidden="true" focusable="false">
							<path d="M8 5v14l11-7z" fill="currentColor"></path>
						</svg>
					</div>
				<?php endif; ?>
			</a>
		<?php else : ?>
			<img src="<?php echo esc_url( $thumbnail_url ); ?>" alt="<?php echo esc_attr( $alt_text ); ?>" class="godam-video-thumbnail" />
			<?php if ( $show_play_button ) : ?>
				<div class="godam-video-thumbnail__play-button">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60" height="60" aria-hidden="true" focusable="false">
						<path d="M8 5v14l11-7z" fill="currentColor"></path>
					</svg>
				</div>
			<?php endif; ?>
		<?php endif; ?>
	<?php else : ?>
		<?php if ( $link_to_video ) : ?>
			<a href="<?php echo esc_url( get_permalink( $video_post_id ) ); ?>" class="godam-video-thumbnail__link"<?php echo $open_in_new_tab ? ' target="_blank" rel="noopener noreferrer"' : ''; ?>>
				<div class="godam-video-thumbnail__fallback"></div>
				<?php if ( $show_play_button ) : ?>
					<div class="godam-video-thumbnail__play-button">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60" height="60" aria-hidden="true" focusable="false">
							<path d="M8 5v14l11-7z" fill="currentColor"></path>
						</svg>
					</div>
				<?php endif; ?>
			</a>
		<?php else : ?>
			<div class="godam-video-thumbnail__fallback"></div>
			<?php if ( $show_play_button ) : ?>
				<div class="godam-video-thumbnail__play-button">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60" height="60" aria-hidden="true" focusable="false">
						<path d="M8 5v14l11-7z" fill="currentColor"></path>
					</svg>
				</div>
			<?php endif; ?>
		<?php endif; ?>
	<?php endif; ?>
</div>