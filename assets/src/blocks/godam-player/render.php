<?php
/**
 * Render template for the GoDAM Player Block.
 *
 * This file dynamically renders the video player block on the frontend.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

global $post;
if ( $post && is_object( $post ) ) {
	/**
	 * Inside a query loop or single post context.
	 * Get attachment ID from postmeta.
	 */
	$query_loop_attachment_id = get_post_meta( get_the_ID(), '_godam_attachment_id', true );
	
	/**
	 * Set ID attribute if not already set.
	 */
	if ( ! empty( $query_loop_attachment_id ) ) {
		$attributes['id'] = $attributes['id'] ?? $query_loop_attachment_id;
	}
}

// Get the inner blocks content.
$inner_blocks_content = '';
if ( ! empty( $block->inner_blocks ) ) {
	foreach ( $block->inner_blocks as $inner_block ) {
		if ( is_object( $inner_block ) && method_exists( $inner_block, 'render' ) ) {
			$inner_blocks_content .= $inner_block->render();
		}
	}
}

require RTGODAM_PATH . 'inc/templates/godam-player.php';
