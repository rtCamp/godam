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
	<?php

	// Link attributes.
	$link_attrs = '';
	if ( $link_to_video ) {
		$link_attrs .= ' href="' . esc_url( get_permalink( $video_post_id ) ) . '" class="godam-video-thumbnail__link"';
		if ( $open_in_new_tab ) {
			$link_attrs .= ' target="_blank" rel="noopener noreferrer"';
		}
	}

	// Content to display (thumbnail or fallback).
	$content = '';
	if ( ! empty( $thumbnail_url ) ) {
		$content = '<img src="' . esc_url( $thumbnail_url ) . '" alt="' . esc_attr( $alt_text ) . '" class="godam-video-thumbnail" />';
	} else {
		$content = '<div class="godam-video-thumbnail__fallback"></div>';
	}
	?>

	<!-- Opening link tag -->
	<?php if ( $link_to_video ) : ?>
		<a <?php echo wp_kses_data( $link_attrs ); ?>>
	<?php endif; ?>

	<!-- Thumbnail content -->
	<?php echo wp_kses_post( $content ); ?>
	
	<!-- Play button -->
	<?php if ( $show_play_button ) : ?>
		<div class="godam-video-thumbnail__play-button">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60" height="60" aria-hidden="true" focusable="false">
				<path d="M8 5v14l11-7z" fill="currentColor"></path>
			</svg>
		</div>
	<?php endif; ?>

	<!-- Closing link tag -->
	<?php if ( $link_to_video ) : ?>
		</a>
	<?php endif; ?>

</div>