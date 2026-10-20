<?php
/**
 * Migration: store transcoded MP3 audio under WordPress's MP3 type, audio/mpeg.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Changes attachments stored as `audio/mp3` to `audio/mpeg`, once.
 *
 * Until this release, audio that GoDAM converted to MP3 was saved with the type `audio/mp3`.
 * WordPress registers MP3 as `audio/mpeg` and does not know `audio/mp3`, so anything that
 * reads WordPress's list of types missed these files: the REST API's `media_type=audio`
 * left them out and its `mime_type=audio/mp3` filter was ignored. New conversions are now
 * saved as `audio/mpeg`; this fixes the ones saved before.
 *
 * The type is changed with one query rather than wp_update_post(), so no attachment
 * update hooks run and nothing is sent to GoDAM Central.
 *
 * ## Re-running (e.g. for testing)
 *   wp option delete rtgodam_transcoded_mp3_mime_type_done
 *   wp option delete rtgodam_db_version
 *
 * @since 2.5.0
 */
class Transcoded_Mp3_Mime_Type {

	/**
	 * WordPress option key that records the migration ran.
	 *
	 * @var string
	 */
	const OPTION_KEY = 'rtgodam_transcoded_mp3_mime_type_done';

	/**
	 * Run the migration once for the current site.
	 *
	 * @since 2.5.0
	 *
	 * @return bool True when done; false when the update failed, so the runner retries on a later request.
	 */
	public static function maybe_run(): bool {
		global $wpdb;

		if ( get_option( self::OPTION_KEY ) ) {
			return true;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One-time migration.
		$ids = $wpdb->get_col( // godam-coverage-ignore -- maybe_run(): the runner calls this once per site (switch_to_blog on multisite) to fix that site's own attachments; switching to a media-centralising site would fix another site's table instead.
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'attachment' AND post_mime_type = %s",
				'audio/mp3'
			)
		);

		// A failed SELECT returns an empty list; retry later rather than mark the site done.
		if ( '' !== $wpdb->last_error ) {
			return false;
		}

		if ( ! empty( $ids ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One-time migration; caches are cleared below.
			$updated = $wpdb->query( // godam-coverage-ignore -- maybe_run(): same per-site UPDATE of this site's own attachments as the SELECT above.
				$wpdb->prepare(
					"UPDATE {$wpdb->posts} SET post_mime_type = %s WHERE post_type = 'attachment' AND post_mime_type = %s",
					'audio/mpeg',
					'audio/mp3'
				)
			);

			if ( false === $updated ) {
				return false;
			}

			foreach ( $ids as $id ) {
				clean_post_cache( (int) $id );
			}
		}

		update_option( self::OPTION_KEY, 'done', false );

		return true;
	}
}
