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
 * 1. `Runner::maybe_run()` (hooked to `admin_init`) calls `maybe_run()` when
 *    the stored db version is behind the current plugin version.
 * 2. `maybe_run()` bails immediately if the guard option is already set.
 * 3. On the first qualifying admin page load, `maybe_run()` calls `run()` directly.
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
	 * Register the Action Scheduler batch callback.
	 *
	 * Must be called on every request so Action Scheduler can invoke
	 * process_batch() for jobs that were queued on a previous request,
	 * regardless of whether the migration is still pending.
	 *
	 * Called by Runner::init() during plugin bootstrap.
	 *
	 * @return void
	 */
	public static function register_hooks(): void {
		add_action( self::AS_HOOK, array( static::class, 'process_batch' ) );
	}

	/**
	 * Register the template_redirect handler that emits 410 Gone for old CPT URLs.
	 *
	 * Called unconditionally from Runner::init() on every request so the handler
	 * is active on all front-end requests once the migration is complete. The
	 * handler itself bails immediately unless OPTION_KEY === 'done'.
	 *
	 * @return void
	 */
	public static function register_redirect_hooks(): void {
		add_action( 'template_redirect', array( static::class, 'maybe_send_410' ) );
	}

	/**
	 * Emit HTTP 410 Gone for requests that match the discontinued godam-video CPT URL patterns.
	 *
	 * Runs on template_redirect. Returns early unless all three conditions are met:
	 *   - The cleanup migration is complete (OPTION_KEY === 'done').
	 *   - WordPress has already determined the current request is a 404.
	 *   - The request path matches /{video_slug} (archive) or /{video_slug}/{slug} (single).
	 *
	 * Responding with 410 Gone (instead of 404 Not Found) signals to search engines
	 * that the removal is intentional, prompting faster de-indexing and preserving
	 * crawl budget for the rest of the site.
	 *
	 * @return void
	 */
	public static function maybe_send_410(): void {
		if ( 'done' !== get_option( self::OPTION_KEY ) ) {
			return;
		}

		if ( ! is_404() ) {
			return;
		}

		$video_settings = get_option( 'rtgodam_video_post_settings', array() );
		$cpt_url_slug   = ! empty( $video_settings['video_slug'] )
			? sanitize_title( $video_settings['video_slug'] )
			: 'videos';

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- path used for pattern matching only, never output.
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		$path        = (string) wp_parse_url( $request_uri, PHP_URL_PATH );

		if ( ! preg_match( '#^/' . preg_quote( $cpt_url_slug, '#' ) . '(/[^/]*/?)?$#', $path ) ) {
			return;
		}

		status_header( 410 );
		nocache_headers();
		exit;
	}

	/**
	 * Register the AS batch callback and schedule the migration if needed.
	 *
	 * Called by Runner::maybe_run() only when the plugin version has changed.
	 * The AS hook is registered by register_hooks() unconditionally; this
	 * method only decides whether to queue a new migration run.
	 *
	 * Returns true when the migration is already started/done or was successfully
	 * queued, so the runner can advance the stored DB version. Returns false when
	 * the migration bailed before starting (e.g. insufficient capabilities),
	 * signalling the runner to hold the DB version for a retry.
	 *
	 * @return bool True if migration is complete, in progress, or just queued; false if it bailed.
	 */
	public static function maybe_run(): bool {
		// 'processing' or 'done' — migration already started or complete.
		if ( get_option( self::OPTION_KEY ) ) {
			return true; // Already started or done.
		}

		// Called from Runner::maybe_run() on admin_init — is_user_logged_in()
		// and current_user_can() are guaranteed available. Call run() directly;
		// no need to defer to a later hook.
		self::run();

		// If run() started the migration it sets OPTION_KEY to 'processing';
		// if it bailed (e.g. cap check) the option is still absent.
		return (bool) get_option( self::OPTION_KEY );
	}

	/**
	 * Entry point: count posts and queue the first Action Scheduler batch.
	 *
	 * Called directly from maybe_run() on admin_init. A concurrency lock prevents
	 * two simultaneous admin page loads from each queuing a batch.
	 *
	 * @return void
	 */
	public static function run() {
		// Called from maybe_run() on admin_init — pluggable.php is fully loaded
		// and auth cookies are processed, so is_user_logged_in() and
		// current_user_can() are guaranteed available.
		$is_cli  = defined( 'WP_CLI' ) && WP_CLI;
		$is_cron = wp_doing_cron();

		if ( ! $is_cron && ! $is_cli && ( ! is_user_logged_in() || ! current_user_can( 'manage_options' ) ) ) {
			return;
		}

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
