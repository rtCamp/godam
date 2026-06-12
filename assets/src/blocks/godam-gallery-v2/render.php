<?php
/**
 * Server-side rendering of the `godam/gallery-v2` block.
 *
 * Thin wrapper around inc/templates/godam-video-gallery.php — the shared
 * template is also used by the [godam_video_gallery] shortcode and the
 * Elementor Godam_Gallery widget so all three surfaces produce the same
 * markup and JS contract.
 *
 * @package GoDAM
 */

defined( 'ABSPATH' ) || exit;

$inner_block_video_ids = array();

if ( isset( $block ) && ! empty( $block->inner_blocks ) ) {
	foreach ( $block->inner_blocks as $godam_inner_block ) {
		if ( 'godam/gallery-v2-item' !== $godam_inner_block->name ) {
			continue;
		}

		$inner_block_video_ids[] = isset( $godam_inner_block->attributes['videoId'] ) ? absint( $godam_inner_block->attributes['videoId'] ) : 0;
	}
}

require RTGODAM_PATH . 'inc/templates/godam-video-gallery.php';
