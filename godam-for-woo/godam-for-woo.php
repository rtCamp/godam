<?php
/**
 * Plugin Name: GoDAM for Woo
 * Plugin URI: https://godam.io
 * Description: WooCommerce integration add-on for GoDAM. Adds product video galleries, featured video support, product hotspot layers, and video-product gallery blocks to your WooCommerce store.
 * Version: 1.0.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Text Domain: godam-woo
 * Author: rtCamp
 * Author URI: https://rtcamp.com/?utm_source=dashboard&utm_medium=plugin&utm_campaign=godam-woo
 * Domain Path: /languages
 * License: GPLv2 or later
 * License URI: http://www.gnu.org/licenses/gpl-2.0.html
 * Requires Plugins: godam, woocommerce
 *
 * @package GoDAM_Woo
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'GODAM_WOO_VERSION' ) ) {
	define( 'GODAM_WOO_VERSION', '1.0.0' );
}

if ( ! defined( 'GODAM_WOO_PATH' ) ) {
	define( 'GODAM_WOO_PATH', plugin_dir_path( __FILE__ ) );
}

if ( ! defined( 'GODAM_WOO_URL' ) ) {
	define( 'GODAM_WOO_URL', plugin_dir_url( __FILE__ ) );
}

if ( ! defined( 'GODAM_WOO_BASE_NAME' ) ) {
	define( 'GODAM_WOO_BASE_NAME', plugin_basename( __FILE__ ) );
}

if ( ! defined( 'GODAM_WOO_MIN_GODAM_VERSION' ) ) {
	define( 'GODAM_WOO_MIN_GODAM_VERSION', '1.7.0' );
}

if ( ! defined( 'GODAM_WOO_DEACTIVATED_GALLERY_OPTION' ) ) {
	define( 'GODAM_WOO_DEACTIVATED_GALLERY_OPTION', 'godam_woo_deactivated_gallery_video_map' );
}

if ( ! defined( 'GODAM_WOO_FD_API_URL' ) ) {
	define( 'GODAM_WOO_FD_API_URL', 'https://app.godam.io' );
}

if ( ! defined( 'GODAM_WOO_FD_ITEM_ID' ) ) {
	define( 'GODAM_WOO_FD_ITEM_ID', 'godam-for-woo' );
}

if ( ! defined( 'FRAPPE_DISPATCH_SITE_URL' ) ) {
	define( 'FRAPPE_DISPATCH_SITE_URL', 'https://app-godam-preprod.rt.gw' );
}

// ── Frappe Dispatch Updater ──────────────────────────────────────────────

if ( ! class_exists( 'Frappe_Dispatch_Updater' ) ) {
	require_once GODAM_WOO_PATH . 'lib/Frappe_Dispatch_Updater.php';
}

/**
 * Initialize the Frappe Dispatch updater for GoDAM for Woo.
 *
 * Follows the client integration guide: hook into admin_init at priority 0
 * so WordPress picks up updates from the Frappe Dispatch backend.
 */
function godam_woo_frappe_dispatch_setup() {
	$license_key = get_option( 'rtgodam-api-key', '' );

	$GLOBALS['godam_woo_updater'] = new Frappe_Dispatch_Updater(
		GODAM_WOO_FD_API_URL,
		__FILE__,
		array(
			'version' => GODAM_WOO_VERSION,
			'license' => $license_key,
			'item_id' => GODAM_WOO_FD_ITEM_ID,
			'author'  => 'rtCamp',
		)
	);
}

add_action( 'admin_init', 'godam_woo_frappe_dispatch_setup', 0 );

/**
 * Register the add-on with GoDAM's add-on system.
 *
 * @param \RTGODAM\Inc\Addons\Addon_Registry $registry The add-on registry instance.
 */
function godam_woo_register_addon( $registry ) {
	require_once GODAM_WOO_PATH . 'inc/class-godam-woo-addon.php';
	$registry->register( new \GoDAM_Woo\Godam_Woo_Addon() );
}

add_action( 'godam_register_addons', 'godam_woo_register_addon' );

/**
 * Show the "update available" admin notice on the plugins page when
 * the user clicked "Check for Updates" and a new version was found.
 */
function godam_woo_update_admin_notice() {
	$notice = get_transient( 'godam_woo_update_notice' );

	if ( 'update_available' === $notice ) {
		delete_transient( 'godam_woo_update_notice' );
		printf(
			'<div class="notice notice-warning is-dismissible"><p>%s</p></div>',
			esc_html__( 'A new version of GoDAM for Woo is available. Please click "update now" below to update the plugin.', 'godam-woo' )
		);
	}
}

add_action( 'admin_notices', 'godam_woo_update_admin_notice' );

/**
 * Check whether an attachment is a video.
 *
 * @param int $attachment_id Attachment ID.
 * @return bool
 */
function godam_woo_is_video_attachment( $attachment_id ) {
	$mime_type = (string) get_post_mime_type( $attachment_id );

	return strpos( $mime_type, 'video/' ) === 0;
}

/**
 * Get all product IDs that contain a gallery meta value.
 *
 * @return int[]
 */
function godam_woo_get_product_ids_with_gallery_meta() {
	$product_ids = array();
	$paged       = 1;

	while ( true ) {
		$query = new \WP_Query(
			array(
				'post_type'      => 'product',
				'post_status'    => 'any',
				'fields'         => 'ids',
				'posts_per_page' => 100,
				'paged'          => $paged,
				'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
					array(
						'key'     => '_product_image_gallery',
						'compare' => 'EXISTS',
					),
				),
			)
		);

		if ( empty( $query->posts ) ) {
			wp_reset_postdata();
			break;
		}

		$product_ids = array_merge( $product_ids, array_map( 'absint', $query->posts ) );

		if ( $paged >= (int) $query->max_num_pages ) {
			wp_reset_postdata();
			break;
		}

		wp_reset_postdata();
		++$paged;
	}

	return array_values( array_unique( $product_ids ) );
}

/**
 * Remove video IDs from product gallery and save a snapshot for later restore.
 */
function godam_woo_temporarily_remove_video_ids_from_gallery() {
	$product_ids = godam_woo_get_product_ids_with_gallery_meta();

	if ( empty( $product_ids ) ) {
		delete_option( GODAM_WOO_DEACTIVATED_GALLERY_OPTION );
		return;
	}

	$snapshot_map = array();

	foreach ( $product_ids as $product_id ) {
		$raw_gallery = (string) get_post_meta( $product_id, '_product_image_gallery', true );

		if ( '' === $raw_gallery ) {
			continue;
		}

		$gallery_ids = array_values( array_filter( array_map( 'absint', explode( ',', $raw_gallery ) ) ) );

		if ( empty( $gallery_ids ) ) {
			continue;
		}

		$non_video_ids = array();
		$video_indexes = array();

		foreach ( $gallery_ids as $index => $attachment_id ) {
			if ( godam_woo_is_video_attachment( $attachment_id ) ) {
				$video_indexes[] = array(
					'position' => (int) $index,
					'id'       => (int) $attachment_id,
				);
				continue;
			}

			$non_video_ids[] = (int) $attachment_id;
		}

		if ( empty( $video_indexes ) ) {
			continue;
		}

		$snapshot_map[ (string) $product_id ] = array(
			'original_gallery' => $gallery_ids,
			'video_positions'  => $video_indexes,
		);

		update_post_meta( $product_id, '_product_image_gallery', implode( ',', $non_video_ids ) );
	}

	if ( empty( $snapshot_map ) ) {
		delete_option( GODAM_WOO_DEACTIVATED_GALLERY_OPTION );
		return;
	}

	update_option( GODAM_WOO_DEACTIVATED_GALLERY_OPTION, $snapshot_map, false );
}

/**
 * Restore previously removed video IDs in their original gallery positions.
 */
function godam_woo_restore_video_ids_to_gallery() {
	$snapshot_map = get_option( GODAM_WOO_DEACTIVATED_GALLERY_OPTION, array() );

	if ( ! is_array( $snapshot_map ) || empty( $snapshot_map ) ) {
		return;
	}

	foreach ( $snapshot_map as $product_id => $snapshot ) {
		$product_id = absint( $product_id );

		if ( ! $product_id || ! is_array( $snapshot ) ) {
			continue;
		}

		$original_gallery = isset( $snapshot['original_gallery'] ) && is_array( $snapshot['original_gallery'] )
			? array_values( array_map( 'absint', $snapshot['original_gallery'] ) )
			: array();

		if ( empty( $original_gallery ) ) {
			continue;
		}

		update_post_meta( $product_id, '_product_image_gallery', implode( ',', $original_gallery ) );
	}

	delete_option( GODAM_WOO_DEACTIVATED_GALLERY_OPTION );
}

/**
 * Permanently remove video IDs from all product galleries.
 */
function godam_woo_permanently_remove_video_ids_from_gallery() {
	$product_ids = godam_woo_get_product_ids_with_gallery_meta();

	foreach ( $product_ids as $product_id ) {
		$raw_gallery = (string) get_post_meta( $product_id, '_product_image_gallery', true );

		if ( '' === $raw_gallery ) {
			continue;
		}

		$gallery_ids = array_values( array_filter( array_map( 'absint', explode( ',', $raw_gallery ) ) ) );

		if ( empty( $gallery_ids ) ) {
			continue;
		}

		$filtered_gallery = array();
		$has_video        = false;

		foreach ( $gallery_ids as $attachment_id ) {
			if ( godam_woo_is_video_attachment( $attachment_id ) ) {
				$has_video = true;
				continue;
			}

			$filtered_gallery[] = (int) $attachment_id;
		}

		if ( ! $has_video ) {
			continue;
		}

		update_post_meta( $product_id, '_product_image_gallery', implode( ',', $filtered_gallery ) );
	}

	delete_option( GODAM_WOO_DEACTIVATED_GALLERY_OPTION );
}

/**
 * Plugin activation hook.
 */
function godam_woo_activate() {
	godam_woo_restore_video_ids_to_gallery();
	flush_rewrite_rules( true );
}

register_activation_hook( __FILE__, 'godam_woo_activate' );

/**
 * Plugin deactivation hook.
 */
function godam_woo_deactivate() {
	godam_woo_temporarily_remove_video_ids_from_gallery();
	flush_rewrite_rules( true );
}

register_deactivation_hook( __FILE__, 'godam_woo_deactivate' );

/**
 * Plugin uninstall hook.
 */
function godam_woo_uninstall() {
	godam_woo_permanently_remove_video_ids_from_gallery();
}

register_uninstall_hook( __FILE__, 'godam_woo_uninstall' );
