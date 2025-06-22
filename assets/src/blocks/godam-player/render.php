<?php

declare(strict_types = 1);

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
