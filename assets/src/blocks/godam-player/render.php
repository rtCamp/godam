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

if ( $post && $post instanceof WP_Post ) {
	/**
	 * Inside a query loop or single post context.
	 * Get attachment ID from postmeta.
	 */
	$query_loop_attachment_id = get_post_meta( $post->ID, '_godam_attachment_id', true );
	
	/**
	 * Set ID attribute if not already set.
	 */
	if ( ! empty( $query_loop_attachment_id ) ) {
		$attributes['id'] = $query_loop_attachment_id;
	}
}

// Conditionally enqueue skin styles based on settings (same as shortcode).
$godam_settings = get_option( 'rtgodam-settings', array() );
$selected_skin  = $godam_settings['video_player']['player_skin'] ?? '';

// Map skin names to their corresponding style handles.
$skin_styles = array(
	'Minimal' => 'godam-player-minimal-skin',
	'Pills'   => 'godam-player-pills-skin',
	'Bubble'  => 'godam-player-bubble-skin',
	'Classic' => 'godam-player-classic-skin',
);

if ( isset( $skin_styles[ $selected_skin ] ) ) {
	wp_enqueue_style( $skin_styles[ $selected_skin ] );
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
