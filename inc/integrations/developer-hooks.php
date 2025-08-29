<?php
/**
 * Developer Hooks for GoDAM Player
 * External developers can use these hooks to add their custom JavaScript
 * 
 * @since n.e.x.t
 */

// Prevent direct access
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Hook for adding custom JavaScript after GoDAM player loads
 */
add_action( 'wp_footer', 'godam_add_developer_script_hook', 20 );

function godam_add_developer_script_hook() {
	// Only add if GoDAM player is present on the page
	if ( ! wp_script_is( 'godam-player-frontend-script', 'enqueued' ) ) {
		return;
	}
	
	// Allow developers to hook into this
	do_action( 'godam_developer_script' );
	
	// Also allow theme/plugin developers to enqueue their own scripts
	do_action( 'godam_enqueue_developer_scripts' );
}

/**
 * Check if current theme has a GoDAM integration file
 */
add_action( 'after_setup_theme', 'godam_check_theme_integration' );

function godam_check_theme_integration() {
	// Look for theme-specific GoDAM integration
	$integration_file = get_template_directory() . '/godam-integration.php';
	
	if ( file_exists( $integration_file ) ) {
		include_once $integration_file;
	}
	
	// Also check child theme
	if ( is_child_theme() ) {
		$child_integration = get_stylesheet_directory() . '/godam-integration.php';
		if ( file_exists( $child_integration ) ) {
			include_once $child_integration;
		}
	}
}

/**
 * Hook for plugins to register their custom conditions
 */
add_action( 'wp_footer', 'godam_plugin_integration', 30 );

function godam_plugin_integration() {
	if ( ! wp_script_is( 'godam-player-frontend-script', 'enqueued' ) ) {
		return;
	}
	
	// Allow plugins to add their custom JavaScript
	do_action( 'godam_plugin_custom_script' );
}
