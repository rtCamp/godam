<?php
/**
 * Render template for the GoDAM Video Thumbnail Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$godam_link_to_video    = isset( $attributes['linkToVideo'] ) ? $attributes['linkToVideo'] : false;
$godam_show_play_button = isset( $attributes['showPlayButton'] ) ? $attributes['showPlayButton'] : false;
$godam_open_in_new_tab  = isset( $attributes['openInNewTab'] ) ? $attributes['openInNewTab'] : false;

$godam_video_post_id = get_the_ID();
$godam_thumbnail_url = '';
$godam_alt_text      = '';

if ( $godam_video_post_id ) {

	// Get attachment ID from post meta.
	$godam_attachment_id = get_post_meta( $godam_video_post_id, '_godam_attachment_id', true ); // godam-coverage-ignore -- Reads '_godam_attachment_id' off the host post (get_the_ID()), not off the attachment — the actual attachment meta read a few lines below already has its own before/after pair.

	/**
	 * Fires before reading this attachment's thumbnail meta, so
	 * integrations that centralize media on another site can switch context
	 * first.
	 *
	 * @since 2.2.0
	 */
	do_action( 'rtgodam_before_attachment_lookup' );
	// Get thumbnail URL directly from attachment's meta.
	$godam_thumbnail_url = get_post_meta( $godam_attachment_id, 'rtgodam_media_video_thumbnail', true );
	do_action( 'rtgodam_after_attachment_lookup' );

	// Set alt text to the post title.
	$godam_alt_text = get_the_title(); // godam-coverage-ignore -- No argument: reads the title of the host post ($godam_video_post_id above), the same host-post distinction as the _godam_attachment_id read above — not the attachment.
}

$godam_wrapper_classes = 'godam-video-thumbnail__container';
if ( empty( $godam_thumbnail_url ) ) {
	$godam_wrapper_classes .= ' godam-video-thumbnail--not-found';
}
if ( $godam_show_play_button ) {
	$godam_wrapper_classes .= ' godam-video-thumbnail--with-play-button';
}

$godam_wrapper_attributes = get_block_wrapper_attributes(
	array(
		'class' => $godam_wrapper_classes,
	)
);
?>

<div <?php echo wp_kses_data( $godam_wrapper_attributes ); ?>>
	<?php

	// Link attributes.
	$godam_link_attrs = '';
	if ( $godam_link_to_video ) {
		$godam_link_attrs .= ' href="' . esc_url( get_permalink( $godam_video_post_id ) ) . '" class="godam-video-thumbnail__link"';
		if ( $godam_open_in_new_tab ) {
			$godam_link_attrs .= ' target="_blank" rel="noopener noreferrer"';
		}
	}

	// Content to display (thumbnail or fallback).
	$godam_content = '';
	if ( ! empty( $godam_thumbnail_url ) ) {
		$godam_content = '<img src="' . esc_url( $godam_thumbnail_url ) . '" alt="' . esc_attr( $godam_alt_text ) . '" class="godam-video-thumbnail" />';
	} else {
		$godam_content = '<div class="godam-video-thumbnail__fallback"></div>';
	}
	?>

	<!-- Opening link tag -->
	<?php if ( $godam_link_to_video ) : ?>
		<a <?php echo wp_kses_data( $godam_link_attrs ); ?>>
	<?php endif; ?>

	<!-- Thumbnail content -->
	<?php echo wp_kses_post( $godam_content ); ?>
	
	<!-- Play button -->
	<?php if ( $godam_show_play_button ) : ?>
		<div class="godam-video-thumbnail__play-button">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60" height="60" aria-hidden="true" focusable="false">
				<path d="M8 5v14l11-7z" fill="currentColor"></path>
			</svg>
		</div>
	<?php endif; ?>

	<!-- Closing link tag -->
	<?php if ( $godam_link_to_video ) : ?>
		</a>
	<?php endif; ?>

</div>