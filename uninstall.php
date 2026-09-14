<?php
/**
 * Uninstall handler for GoDAM.
 *
 * WordPress runs THIS file — in isolation, with WP_UNINSTALL_PLUGIN defined — when the plugin
 * is deleted, instead of including the main plugin file. Doing cleanup here rather than via
 * register_uninstall_hook() is deliberate and fixes issue #1146:
 *
 * register_uninstall_hook() makes WordPress `include` godam.php during deletion, which
 * bootstraps the entire plugin AND loads the bundled WooCommerce Action Scheduler. WordPress
 * then deletes the plugin's files, so on `shutdown` the now-dangling references (Action
 * Scheduler's shutdown callback, the class autoloaders) fatally try to load classes that no
 * longer exist. That surfaces as a "Deletion failed" error under Query Monitor, or as a
 * "502 Bad Gateway" on servers that buffer the response until shutdown — even though the
 * plugin is actually removed (a page refresh confirms it). Running cleanup from uninstall.php
 * never bootstraps the plugin, so those references simply do not exist at shutdown.
 *
 * @package GoDAM
 */

// Exit if uninstall is not called from WordPress.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

$rtgodam_uninstall_options = array(
	'rtgodam_plugin_version',
	'rtgodam_show_whats_new',
	'rtgodam_user_data',
	'rtgodam-api-key',
	'rtgodam-api-key-stored',
	'rtgodam-account-token',
	'rtgodam-api-key-status',
	'rtgodam-api-key-error-since',
);

$rtgodam_uninstall_transients = array(
	'rtgodam_show_whats_new', // Stored as a transient in ≤1.7.2.
	'rtgodam_release_data',
);

// On multisite, clean every site; otherwise just the current one. `'number' => 0` lifts
// WP_Site_Query's default 100-site cap so options/transients are not left behind on
// networks with more than 100 sites. The deletes are lightweight (option/transient only),
// so it is safe to run across every site without the plugin being loaded.
$rtgodam_is_multisite = is_multisite();
$rtgodam_blog_ids     = $rtgodam_is_multisite
	? get_sites(
		array(
			'fields' => 'ids',
			'number' => 0,
		) 
	)
	: array( 0 );

foreach ( $rtgodam_blog_ids as $rtgodam_blog_id ) {
	if ( $rtgodam_is_multisite ) {
		switch_to_blog( $rtgodam_blog_id ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.switch_to_blog_switch_to_blog
	}

	foreach ( $rtgodam_uninstall_options as $rtgodam_option ) {
		delete_option( $rtgodam_option );
	}

	foreach ( $rtgodam_uninstall_transients as $rtgodam_transient ) {
		delete_transient( $rtgodam_transient );
	}

	if ( $rtgodam_is_multisite ) {
		restore_current_blog();
	}
}
