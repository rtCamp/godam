<?php
/**
 * Plugin Uninstall Handler
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Handles complete plugin uninstallation and cleanup
 */
class Uninstall {

	use Singleton;

	/**
	 * Run the uninstall process
	 */
	public function start_uninstall() {
		// Check permissions.
		if ( ! current_user_can( 'activate_plugins' ) ) {
			return;
		}

		$settings                 = get_option( 'rtgodam-settings', array() );
		$delete_data_on_uninstall = $settings['general']['delete_data_on_uninstall'] ?? false;

		if ( ! $delete_data_on_uninstall ) {
			return;
		}

		// Handle multisite.
		if ( is_multisite() ) {
			self::uninstall_multisite();
		} else {
			self::uninstall_single_site();
		}
	}

	/**
	 * Handle multisite uninstall
	 */
	private static function uninstall_multisite() {
		$blogs = get_sites( array( 'fields' => 'ids' ) );

		foreach ( $blogs as $blog_id ) {
			switch_to_blog( $blog_id );
			self::cleanup_site_data();
			restore_current_blog();
		}
	}

	/**
	 * Handle single site uninstall
	 */
	private static function uninstall_single_site() {
		self::cleanup_site_data();
	}

	/**
	 * Clean up all plugin data for a single site
	 */
	private static function cleanup_site_data() {
		self::cleanup_options();
		self::cleanup_transients();
		self::cleanup_post_meta();
		self::cleanup_custom_posts();
		self::cleanup_taxonomies();
		self::cleanup_scheduled_events();
	}

	/**
	 * Clean up plugin options
	 */
	private static function cleanup_options() {

		/**
		 * We can write SQL query to delete all options starting with `rtgodam` but
		 * It would be convenient to have list of options we are using stored somewhere.
		 */
		$options_to_delete = array(
			'rtgodam_plugin_version',
			'rtgodam_plugin_activation_time',
			'rtgodam_user_data',
			'rtgodam-api-key',
			'rtgodam-api-key-stored',
			'rtgodam-usage',
			'rtgodam-settings',
			'rtgodam-failed-transcoding-attachments',
			'rtgodam_video_metadata_migration_completed',
			'rtgodam_new_attachment',
			'rtgodam-account-token',
			'rtgodam-offer-banner',
			'rtgodam_video_post_settings',
			'rtgodam-transcoding-failed-notice-timestamp',
		);

		foreach ( $options_to_delete as $option ) {
			delete_option( $option );
		}
	}

	/**
	 * Clean up transients
	 */
	private static function cleanup_transients() {

		// TODO: add keys for the attachement count and transcript path.
		$transients_to_delete = array(
			'rtgodam_show_whats_new',
			'rtgodam_release_data',
		);

		foreach ( $transients_to_delete as $transient ) {
			delete_transient( $transient );
			delete_site_transient( $transient );
		}
	}

	/**
	 * Clean up post meta
	 */
	private static function cleanup_post_meta() {
		global $wpdb;

		$meta_keys_to_delete = array(
			'_godam_attachment_id',
			'_godam_original_id',
			'_godam_video_data',
			'_godam_transcoding_status',
			'_godam_icon',

			'rtgodam_media_transcoded_files',
			'rtgodam_retranscoding_sent',
			'rtgodam_media_video_thumbnail',
			'rtgodam_is_migrated_vimeo_video',
			'rtgodam_media_thumbnails',
			'rtgodam_transcoding_job_id',
			'rtgodam_transcoded_url',
			'rtgodam_transcoding_status',
			'rtgodam_hls_transcoded_url',
			'rtgodam_transcoding_error_msg',

			'rtgodam_analytics',
			'rtgodam_meta',

			'godam_video_seo_schema',
			'godam_video_seo_schema_updated',
		);

		foreach ( $meta_keys_to_delete as $meta_key ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$wpdb->delete(
				$wpdb->postmeta,
				array( 'meta_key' => $meta_key ),
				array( '%s' )
			);
		}
	}

	/**
	 * Clean up custom post types
	 */
	private static function cleanup_custom_posts() {
		// Delete all posts of your custom post type.
		$post_types = array( 'godam_video' );

		foreach ( $post_types as $post_type ) {
			$posts = get_posts(
				array(
					'post_type'   => $post_type,
					'numberposts' => -1,
					'post_status' => 'any',
				)
			);

			foreach ( $posts as $post ) {
				wp_delete_post( $post->ID, true ); // Force delete.
			}
		}
	}

	/**
	 * Clean up custom taxonomies
	 */
	private static function cleanup_taxonomies() {
		// If you have custom taxonomies, clean them up.
		$taxonomies = array( 'media-folder' );

		foreach ( $taxonomies as $taxonomy ) {
			$terms = get_terms(
				array(
					'taxonomy'   => $taxonomy,
					'hide_empty' => false,
				)
			);

			if ( ! is_wp_error( $terms ) ) {
				foreach ( $terms as $term ) {
					wp_delete_term( $term->term_id, $taxonomy );
				}
			}
		}
	}

	/**
	 * Clean up scheduled events
	 */
	private static function cleanup_scheduled_events() {
		$hooks = array(
			'retranscode_failed_media_event',
		);

		foreach ( $hooks as $hook ) {
			$timestamp = wp_next_scheduled( $hook );
			while ( $timestamp ) {
				wp_unschedule_event( $timestamp, $hook );
				$timestamp = wp_next_scheduled( $hook );
			}
		}
	}
}
