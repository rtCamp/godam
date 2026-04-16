<?php
/**
 * Migration: GoDAM CPT (godam-video) cleanup.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Permanently deletes all `godam-video` Custom Post Type posts from the database.
 *
 * The `godam-video` CPT was discontinued as of GoDAM 1.5.1. This migration
 * runs once per site and removes all remaining CPT posts (including their post
 * meta and taxonomy relationships) so they no longer pollute sitemaps or the
 * WordPress database.
 *
 * ## Execution model
 *
 * Posts are deleted in batches of 50 via Action Scheduler — each AS job handles
 * one batch and queues the next, so no single PHP request bears the full load
 * of a large deletion.
 *
 * ## Lifecycle
 *
 * 1. `Runner::run()` calls `maybe_run()` on every plugin bootstrap.
 * 2. `maybe_run()` bails immediately if the guard option is set, or if the
 *    current context is a frontend request.
 * 3. On the first qualifying request `run()` is scheduled on `init` priority 99.
 * 4. `run()` counts posts. If none exist, marks done immediately. Otherwise,
 *    writes `processing` to the guard option and queues the first AS batch job.
 * 5. Each `process_batch()` job deletes up to BATCH_SIZE posts and, if posts
 *    remain, queues the next batch. The last batch writes `done` and flushes
 *    sitemap caches.
 *
 * ## Re-running (e.g. for testing)
 *
 *   wp option delete rtgodam_godam_cpt_cleanup_done
 */
class Godam_Cpt_Cleanup {

	/**
	 * WordPress option key that records migration state.
	 *
	 * Values: absent → not started | 'processing' → in progress | 'done' → complete.
	 *
	 * @var string
	 */
	const OPTION_KEY = 'rtgodam_godam_cpt_cleanup_done';

	/**
	 * WordPress option key used as a short-lived concurrency lock for run().
	 *
	 * @var string
	 */
	const LOCK_KEY = 'rtgodam_godam_cpt_cleanup_lock';

	/**
	 * How long (seconds) the lock is held before it is considered stale.
	 *
	 * @var int
	 */
	const LOCK_TIMEOUT = 300;

	/**
	 * Posts to delete per Action Scheduler job.
	 *
	 * @var int
	 */
	const BATCH_SIZE = 50;

	/**
	 * The discontinued CPT slug.
	 *
	 * @var string
	 */
	const POST_TYPE = 'godam-video';

	/**
	 * Action Scheduler hook name for batch processing.
	 *
	 * @var string
	 */
	const AS_HOOK = 'rtgodam_godam_cpt_cleanup_batch';

	/**
	 * Action Scheduler group name.
	 *
	 * @var string
	 */
	const AS_GROUP = 'godam-cpt-cleanup';

	/**
	 * Register the AS batch callback and schedule the migration if needed.
	 *
	 * Called by Runner::run() on every plugin bootstrap. The AS hook is
	 * registered unconditionally so Action Scheduler can fire it on any
	 * request, even while a migration is already in progress.
	 *
	 * @return void
	 */
	public static function maybe_run() {
		// Always register the batch callback so AS can fire it on any request.
		add_action( self::AS_HOOK, array( static::class, 'process_batch' ) );

		// 'processing' or 'done' — migration already started or complete.
		if ( get_option( self::OPTION_KEY ) ) {
			return;
		}

		$is_cli  = defined( 'WP_CLI' ) && WP_CLI;
		$is_cron = wp_doing_cron();

		// Only trigger during authenticated admin requests, WP-CLI, or cron.
		// is_admin() is also true for admin-ajax.php which can be hit without
		// authentication, so non-cron/non-CLI requests require an explicit auth
		// and capability check before scheduling a destructive migration.
		if ( ! is_admin() && ! $is_cron && ! $is_cli ) {
			return;
		}
		if ( ! $is_cron && ! $is_cli && ( ! is_user_logged_in() || ! current_user_can( 'manage_options' ) ) ) {
			return;
		}

		add_action( 'init', array( static::class, 'run' ), 99 );
	}

	/**
	 * Entry point: count posts and queue the first Action Scheduler batch.
	 *
	 * Runs once on `init` (priority 99). A concurrency lock prevents two
	 * simultaneous admin page loads from each queuing a batch.
	 *
	 * @return void
	 */
	public static function run() {
		if ( ! self::acquire_lock() ) {
			return;
		}

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$total = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = %s",
				self::POST_TYPE
			)
		);

		if ( 0 === $total ) {
			update_option( self::OPTION_KEY, 'done', false );
			self::flush_sitemap_caches();
			self::release_lock();
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			error_log( '[GoDAM] CPT cleanup: no godam-video posts found. Nothing to clean up.' );
			return;
		}

		if ( ! function_exists( 'as_enqueue_async_action' ) ) {
			// Action Scheduler is unavailable — reset so the next request retries.
			self::release_lock();
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			error_log( '[GoDAM] CPT cleanup: Action Scheduler unavailable. Migration will be retried on next qualifying request.' );
			return;
		}

		// Mark as in-progress so maybe_run() does not re-trigger on the next request.
		update_option( self::OPTION_KEY, 'processing', false );

		$action_id = as_enqueue_async_action( self::AS_HOOK, array(), self::AS_GROUP );
		self::release_lock();

		if ( ! $action_id ) {
			// Enqueue failed — reset so migration can be retried.
			delete_option( self::OPTION_KEY );
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			error_log( '[GoDAM] CPT cleanup: failed to queue first batch. Migration state reset for retry.' );
			return;
		}

		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log(
			sprintf(
				'[GoDAM] CPT cleanup: found %d post(s). First batch queued via Action Scheduler.',
				$total
			)
		);
	}

	/**
	 * Action Scheduler callback: delete one batch of CPT posts.
	 *
	 * Deletes up to BATCH_SIZE `godam-video` posts, logs progress, then checks
	 * whether posts remain. If they do, queues the next batch job. If not,
	 * writes the `done` guard and flushes sitemap caches.
	 *
	 * Each job is independent — only one batch runs per AS execution, so PHP
	 * memory and runtime are bounded regardless of total post count.
	 *
	 * @return void
	 */
	public static function process_batch() {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts} WHERE post_type = %s ORDER BY ID ASC LIMIT %d",
				self::POST_TYPE,
				self::BATCH_SIZE
			)
		);

		if ( empty( $ids ) ) {
			// Reached via a race or a retry of an already-completed batch.
			update_option( self::OPTION_KEY, 'done', false );
			self::flush_sitemap_caches();
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			error_log( '[GoDAM] CPT cleanup migration complete. All CPT posts deleted.' );
			return;
		}

		$deleted = 0;
		$failed  = 0;

		foreach ( $ids as $id ) {
			$result = wp_delete_post( (int) $id, true );

			if ( $result ) {
				++$deleted;
			} else {
				++$failed;
			}
		}

		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log(
			sprintf(
				'[GoDAM] CPT cleanup batch done. Deleted: %d. Failed: %d.',
				$deleted,
				$failed
			)
		);

		// Check how many posts remain to decide whether to queue another batch.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$remaining = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = %s",
				self::POST_TYPE
			)
		);

		if ( $remaining > 0 ) {
			if ( function_exists( 'as_enqueue_async_action' ) ) {
				as_enqueue_async_action( self::AS_HOOK, array(), self::AS_GROUP );
			}
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			error_log(
				sprintf(
					'[GoDAM] CPT cleanup: %d post(s) remaining. Next batch queued.',
					$remaining
				)
			);
		} else {
			update_option( self::OPTION_KEY, 'done', false );
			self::flush_sitemap_caches();
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			error_log( '[GoDAM] CPT cleanup migration complete. All CPT posts deleted.' );
		}
	}

	// -------------------------------------------------------------------------
	// Sitemap helpers
	// -------------------------------------------------------------------------

	/**
	 * Flush WordPress rewrite rules and clear SEO-plugin sitemap caches.
	 *
	 * Called once after all `godam-video` posts have been deleted so that
	 * sitemap generators (Yoast SEO, Rank Math, AIOSEO, Jetpack) no longer
	 * emit those URLs.
	 *
	 * @return void
	 */
	private static function flush_sitemap_caches() {
		// Remove CPT-based rewrite rules from the database.
		flush_rewrite_rules( true );

		// Yoast SEO — invalidate post and page sitemap indexes.
		if ( function_exists( 'wpseo_invalidate_sitemap_cache' ) ) {
			wpseo_invalidate_sitemap_cache( 'post' );
			wpseo_invalidate_sitemap_cache( 'page' );
		}

		// Rank Math — clear full sitemap cache storage.
		if ( class_exists( '\RankMath\Sitemap\Cache' ) ) {
			\RankMath\Sitemap\Cache::invalidate_storage();
		}

		// All in One SEO — schedule sitemap regeneration.
		if ( function_exists( 'aioseo' ) && isset( aioseo()->sitemap ) ) {
			aioseo()->sitemap->scheduleRegeneration();
		}

		// Jetpack — reset sitemap state so next generation is fresh.
		if ( class_exists( '\Automattic\Jetpack\Sitemaps\Sitemap_State' ) ) {
			\Automattic\Jetpack\Sitemaps\Sitemap_State::reset_sitemap_state();
		}
	}

	// -------------------------------------------------------------------------
	// Concurrency helpers (used by run() only)
	// -------------------------------------------------------------------------

	/**
	 * Acquire a short-lived option-based lock.
	 *
	 * Prevents two simultaneous admin page loads from each calling run() and
	 * queuing duplicate initial batch jobs.
	 *
	 * `add_option()` is atomic (MySQL INSERT IGNORE) so only one caller wins.
	 * A compare-and-swap UPDATE handles stale locks.
	 *
	 * @return bool True when the lock was acquired, false otherwise.
	 */
	private static function acquire_lock(): bool {
		global $wpdb;

		$expires_at = time() + self::LOCK_TIMEOUT;

		if ( add_option( self::LOCK_KEY, $expires_at, '', 'no' ) ) {
			return true;
		}

		$current = (int) get_option( self::LOCK_KEY, 0 );
		if ( $current >= time() ) {
			return false;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->update(
			$wpdb->options,
			array( 'option_value' => $expires_at ),
			array(
				'option_name'  => self::LOCK_KEY,
				'option_value' => (string) $current,
			),
			array( '%s' ),
			array( '%s', '%s' )
		);

		return 1 === $wpdb->rows_affected;
	}

	/**
	 * Release the concurrency lock.
	 *
	 * @return void
	 */
	private static function release_lock(): void {
		delete_option( self::LOCK_KEY );
	}
}
