<?php
/**
 * Class for handling scheduled tasks (CRON jobs) related to video cleanup.
 *
 * @package Transcoder
 */

namespace Transcoder\Inc;

defined( 'ABSPATH' ) || exit;

use Transcoder\Inc\Traits\Singleton;

/**
 * Class Cron
 */
class Cron {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		// Schedule the cron job on plugin activation.
		add_action( 'wp', array( $this, 'schedule_video_cleanup' ) );

		// Hook into the scheduled event.
		add_action( 'rtgodam_cleanup_expired_videos', array( $this, 'cleanup_expired_videos' ) );

		add_filter(
			'cron_schedules',
			function ( $schedules ) {
				$schedules['twelve_hours'] = array(
					'interval' => 12 * HOUR_IN_SECONDS,
					'display'  => __( 'Every 12 Hours', 'godam' ),
				);
				return $schedules;
			}
		);
	}

	/**
	 * Schedule the cron job for cleaning up expired videos.
	 */
	public function schedule_video_cleanup() {
		if ( ! wp_next_scheduled( 'rtgodam_cleanup_expired_videos' ) ) {
			wp_schedule_event( time(), 'twelve_hours', 'rtgodam_cleanup_expired_videos' );
		}
	}

	/**
	 * Clean up expired videos from CDN and remove MPD URLs.
	 */
	public function cleanup_expired_videos() {

		global $wpdb;

		$batch_size = 50; // Process in batches to avoid performance issues.

		$usage_data  = get_site_option( 'rt-transcoding-usage', array() );
		$license_key = get_site_option( 'rtgodam-api-key', '' );
		$usage_data  = isset( $usage_data[ $license_key ] ) ? (array) $usage_data[ $license_key ] : null;

		// If there is no valid license usage data, do nothing.
		if ( empty( $usage_data ) ) {
			return;
		}

		// Extract subscription end date.
		$subscription_end    = isset( $usage_data['end_date'] ) ? strtotime( $usage_data['end_date'] ) : null;
		$grace_period_days   = 30;
		$current_time        = time();
		$days_until_deletion = floor( ( $subscription_end + ( $grace_period_days * DAY_IN_SECONDS ) - $current_time ) / DAY_IN_SECONDS );

		// Ensure the subscription is expired and the grace period has ended.
		if ( $days_until_deletion <= 0 ) {

			$batch_size = 50; // Number of media items per batch.

			// Get total number of expired media.
			$total_media = $wpdb->get_var(
				"SELECT COUNT(*) FROM {$wpdb->posts} 
				WHERE post_type = 'attachment' "
			);

			if ( empty( $total_media ) || $total_media < 1 ) {
				return; // No expired media, exit early.
			}

			// Calculate total number of batches.
			$total_batches = ceil( $total_media / $batch_size );

			for ( $batch = 0; $batch < $total_batches; $batch++ ) {
				$offset = $batch * $batch_size;

				// Fetch next batch of expired media.
				$expired_media = $wpdb->get_col(
					$wpdb->prepare(
						"SELECT ID FROM {$wpdb->posts} 
					WHERE post_type = 'attachment' 
					LIMIT %d OFFSET %d",
						$batch_size,
						$offset
					)
				);

				if ( empty( $expired_media ) ) {
					break; // No more media to process.
				}

				foreach ( $expired_media as $video_id ) {
					$cdn_url = get_post_meta( $video_id, '_rt_transcoded_url', true );
					if ( ! empty( $cdn_url ) ) {
						delete_post_meta( $video_id, '_rt_transcoded_url' );
					}
				}
			}
		}
	}

	/**
	 * Remove the scheduled cron event on plugin deactivation.
	 */
	public function unschedule_video_cleanup() {
		$timestamp = wp_next_scheduled( 'rtgodam_cleanup_expired_videos' );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, 'rtgodam_cleanup_expired_videos' );
		}
		wp_schedule_single_event( time() + 10, 'rtgodam_cleanup_expired_videos' );
	}
}
