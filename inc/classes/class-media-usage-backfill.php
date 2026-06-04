<?php
/**
 * Backfill media usage tracking for existing posts.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Media_Usage_Backfill
 *
 * Processes existing posts in small background batches to populate the
 * `_godam_tracked_media` / `_godam_usage_post_ids` meta that the live
 * Media_Usage_Tracker maintains going forward.
 *
 * Each batch queries only posts that do not yet have a `_godam_tracked_media`
 * meta row, so already-processed posts are naturally skipped and the backfill
 * is safe to restart after a stall or server restart.
 *
 * Progress is persisted in wp_options. Batches run via Action Scheduler so
 * no single request is blocked by a long-running loop.
 *
 * REST API (admin-only):
 *   POST godam/v1/media-backfill/start   — start (or resume) the backfill
 *   POST godam/v1/media-backfill/stop    — stop an in-progress backfill
 *   GET  godam/v1/media-backfill/status  — check current status and progress
 */
class Media_Usage_Backfill {

	use Singleton;

	// ----- Action Scheduler action name -----
	const AS_BATCH_ACTION = 'godam_media_backfill_batch';

	// ----- Number of posts processed per batch -----
	const BATCH_SIZE = 50;

	// ----- Seconds to spend inside a single AS action call -----
	const TIME_LIMIT_SECONDS = 20;

	// ----- wp_options keys -----
	const OPT_STATUS    = 'godam_media_backfill_status';
	const OPT_PROCESSED = 'godam_media_backfill_processed';
	const OPT_TOTAL     = 'godam_media_backfill_total';

	// ----- Object cache -----
	const CACHE_KEY   = 'status';
	const CACHE_GROUP = 'godam_media_backfill';

	// ----- Status values -----
	const STATUS_IDLE      = 'idle';
	const STATUS_RUNNING   = 'running';
	const STATUS_STOPPED   = 'stopped';
	const STATUS_COMPLETED = 'completed';

	// Post statuses never worth scanning — no embeddable content.
	const EXCLUDED_STATUSES = array( 'trash', 'auto-draft', 'inherit' );

	/**
	 * Prefix for API endpoint namespace.
	 *
	 * @var string
	 */
	public static $namespace_prefix = 'godam/v1';

	/**
	 * Constructor.
	 */
	protected function __construct() {
		add_action( self::AS_BATCH_ACTION, array( $this, 'process_batch' ) );
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
	}

	// -------------------------------------------------------------------------
	// REST API
	// -------------------------------------------------------------------------

	/**
	 * Register admin-only REST routes.
	 *
	 * @return void
	 */
	public function register_rest_routes() {
		register_rest_route(
			self::$namespace_prefix,
			'/media-backfill/start',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'rest_start' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
			)
		);

		register_rest_route(
			self::$namespace_prefix,
			'/media-backfill/stop',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'rest_stop' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
			)
		);

		register_rest_route(
			self::$namespace_prefix,
			'/media-backfill/status',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'rest_get_status' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
			)
		);
	}

	/**
	 * REST handler: start (or resume) the backfill.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function rest_start() {
		if ( ! function_exists( 'as_enqueue_async_action' ) ) {
			return new \WP_Error(
				'as_not_available',
				__( 'Action Scheduler is required to run the GoDAM media usage backfill.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		$this->start();
		return rest_ensure_response( $this->get_status() );
	}

	/**
	 * REST handler: stop an in-progress backfill.
	 *
	 * @return \WP_REST_Response
	 */
	public function rest_stop() {
		$this->stop();
		return rest_ensure_response( $this->get_status() );
	}

	/**
	 * REST handler: return current backfill status.
	 *
	 * @return \WP_REST_Response
	 */
	public function rest_get_status() {
		return rest_ensure_response( $this->get_status() );
	}

	// -------------------------------------------------------------------------
	// Public API
	// -------------------------------------------------------------------------

	/**
	 * Initialise (or resume) the media usage backfill.
	 *
	 * If a media usage backfill is already running and its Action Scheduler job is still
	 * pending, this is a no-op. If it is RUNNING but the AS job has gone
	 * missing (e.g. queue was wiped), a new batch is scheduled so the backfill
	 * self-heals without manual intervention.
	 *
	 * @return void
	 */
	public function start() {
		$current_status = get_option( self::OPT_STATUS );

		if ( self::STATUS_RUNNING === $current_status ) {
			// Self-heal: reschedule if the AS action somehow disappeared.
			if ( ! as_has_scheduled_action( self::AS_BATCH_ACTION ) ) {
				as_enqueue_async_action( self::AS_BATCH_ACTION );
			}
			return;
		}

		$pending = $this->count_pending_posts();

		// On resume the total must cover work already done plus what remains,
		// otherwise OPT_PROCESSED will climb past OPT_TOTAL and the progress
		// bar exceeds 100%. On a fresh start the total is just the pending count.
		$total = ( self::STATUS_STOPPED === $current_status )
			? (int) get_option( self::OPT_PROCESSED, 0 ) + $pending
			: $pending;

		update_option( self::OPT_STATUS, self::STATUS_RUNNING, false );
		if ( self::STATUS_STOPPED !== $current_status ) {
			update_option( self::OPT_PROCESSED, 0, false );
		}
		update_option( self::OPT_TOTAL, $total, false );
		wp_cache_delete( self::CACHE_KEY, self::CACHE_GROUP );

		if ( 0 === $pending ) {
			update_option( self::OPT_STATUS, self::STATUS_COMPLETED, false );
			wp_cache_delete( self::CACHE_KEY, self::CACHE_GROUP );
			return;
		}

		// Clear any stale pending action from a previous interrupted run before
		// enqueuing a fresh one — a leftover pending action would otherwise
		// trigger the dedup guard inside process_batch() and stall the chain.
		as_unschedule_action( self::AS_BATCH_ACTION );
		as_enqueue_async_action( self::AS_BATCH_ACTION );
	}

	/**
	 * Stop an in-progress backfill.
	 *
	 * Sets status to 'stopped' and cancels the pending Action Scheduler job.
	 * Progress counters are preserved so the UI can show how far it got.
	 * Calling start() afterwards resumes from where it left off (the NOT EXISTS
	 * query naturally skips already-processed posts).
	 *
	 * @return void
	 */
	public function stop() {
		if ( self::STATUS_RUNNING !== get_option( self::OPT_STATUS ) ) {
			return;
		}

		update_option( self::OPT_STATUS, self::STATUS_STOPPED, false );
		wp_cache_delete( self::CACHE_KEY, self::CACHE_GROUP );

		if ( function_exists( 'as_unschedule_action' ) ) {
			as_unschedule_action( self::AS_BATCH_ACTION );
		}
	}

	/**
	 * Return the current backfill status.
	 *
	 * @return array{status: string, processed: int, total: int, percentage: float}
	 */
	public function get_status() {
		$cached = wp_cache_get( self::CACHE_KEY, self::CACHE_GROUP );
		if ( false !== $cached ) {
			return $cached;
		}

		$status    = get_option( self::OPT_STATUS, self::STATUS_IDLE );
		$processed = (int) get_option( self::OPT_PROCESSED, 0 );
		$total     = (int) get_option( self::OPT_TOTAL, 0 );

		$data = array(
			'status'     => $status,
			'processed'  => $processed,
			'total'      => $total,
			'percentage' => $total > 0 ? round( ( $processed / $total ) * 100, 1 ) : 0,
		);

		wp_cache_set( self::CACHE_KEY, $data, self::CACHE_GROUP );
		return $data;
	}

	// -------------------------------------------------------------------------
	// Batch handler (Action Scheduler callback)
	// -------------------------------------------------------------------------

	/**
	 * Process posts in a timed loop within a single Action Scheduler action.
	 *
	 * Instead of one batch per AS action, iterates over batches of BATCH_SIZE
	 * posts until TIME_LIMIT_SECONDS is reached, then schedules a single
	 * continuation action. This dramatically reduces AS invocations and the
	 * associated WordPress boot overhead for large sites.
	 *
	 * The status is re-read at the top of every iteration so an external stop()
	 * call is honoured promptly without waiting for a full batch to complete.
	 *
	 * @return void
	 */
	public function process_batch() {
		$start_time = microtime( true );
		$tracker    = Media_Usage_Tracker::get_instance();

		while ( true ) {
			// Re-check status each iteration — handles an external stop() call.
			if ( self::STATUS_RUNNING !== get_option( self::OPT_STATUS ) ) {
				return;
			}

			$posts = $this->fetch_pending_posts( self::BATCH_SIZE );

			if ( empty( $posts ) ) {
				update_option( self::OPT_STATUS, self::STATUS_COMPLETED, false );
				wp_cache_delete( self::CACHE_KEY, self::CACHE_GROUP );
				return;
			}

			foreach ( $posts as $post ) {
				// sync_post_attachments() writes _godam_tracked_media to the post,
				// so this post will not appear in fetch_pending_posts() again.
				$tracker->sync_post_attachments( (int) $post->ID, (string) $post->post_content );
			}

			$batch_count = count( $posts );
			update_option( self::OPT_PROCESSED, (int) get_option( self::OPT_PROCESSED, 0 ) + $batch_count, false );
			wp_cache_delete( self::CACHE_KEY, self::CACHE_GROUP );

			// Release memory accumulated by this batch before the next iteration.
			$this->free_memory();

			// A partial batch means no more posts remain.
			if ( $batch_count < self::BATCH_SIZE ) {
				update_option( self::OPT_STATUS, self::STATUS_COMPLETED, false );
				wp_cache_delete( self::CACHE_KEY, self::CACHE_GROUP );
				return;
			}

			// Stop iterating if approaching the time limit.
			if ( ( microtime( true ) - $start_time ) >= self::TIME_LIMIT_SECONDS ) {
				break;
			}
		}

		// Time limit reached with more posts remaining — schedule a continuation.
		// Cancel any stale pending action first (same guard as before) so a
		// leftover action cannot block the fresh one.
		as_unschedule_action( self::AS_BATCH_ACTION );
		as_enqueue_async_action( self::AS_BATCH_ACTION );
	}

	// -------------------------------------------------------------------------
	// WP_Query helpers
	// -------------------------------------------------------------------------

	/**
	 * Count posts that have no `_godam_tracked_media` meta row yet.
	 *
	 * @return int
	 */
	private function count_pending_posts() {
		$query = new \WP_Query(
			array_merge(
				$this->build_wp_query_args(),
				array(
					'posts_per_page' => 1,
					'fields'         => 'ids',
					'no_found_rows'  => false, // required to populate found_rows.
				)
			)
		);

		return (int) $query->found_posts;
	}

	/**
	 * Fetch up to $limit posts that have not yet been backfilled.
	 *
	 * Returns full WP_Post objects so post_content is available without extra
	 * queries. Post meta for the batch is loaded in one round-trip by WP_Query's
	 * default update_post_meta_cache behaviour, which means the get_post_meta()
	 * call inside sync_post_attachments() is served from cache for every post
	 * in the batch.
	 *
	 * @param int $limit Maximum rows to return.
	 * @return \WP_Post[]
	 */
	private function fetch_pending_posts( $limit ) {
		$query = new \WP_Query(
			array_merge(
				$this->build_wp_query_args(),
				array(
					'posts_per_page'         => (int) $limit,
					'update_post_term_cache' => false,  // avoids querying terms for posts that won't be needed here.
				)
			)
		);

		return $query->posts;
	}

	/**
	 * Build the shared WP_Query args for pending-post queries.
	 *
	 * @return array
	 */
	private function build_wp_query_args() {
		return array(
			'post_type'     => $this->get_post_types(),
			'post_status'   => $this->get_post_statuses(),
			'no_found_rows' => true,
			'meta_query'    => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
				array(
					'key'     => Media_Usage_Tracker::POST_META_KEY,
					'compare' => 'NOT EXISTS',
				),
			),
		);
	}

	/**
	 * Return the post types to include in the backfill.
	 *
	 * Defaults to all public post types except 'attachment' (media itself).
	 *
	 * @return string[]
	 */
	private function get_post_types() {
		$post_types = array_values( get_post_types( array( 'public' => true ) ) );
		$post_types = array_diff( $post_types, array( 'attachment' ) );

		/**
		 * Filters the post types included in the GoDAM media usage backfill.
		 *
		 * By default all public post types except 'attachment' are processed.
		 * Use this filter to add non-public post types or remove types you
		 * don't want scanned.
		 *
		 * @param string[] $post_types Post type slugs to backfill.
		 */
		return (array) apply_filters( 'godam_media_backfill_post_types', array_values( $post_types ) );
	}

	/**
	 * Return the post statuses to include in the backfill.
	 *
	 * @return string[]
	 */
	private function get_post_statuses() {
		$statuses = array_values(
			array_diff( array_keys( get_post_stati() ), self::EXCLUDED_STATUSES )
		);

		/**
		 * Filters the post statuses included in the GoDAM media usage backfill.
		 *
		 * By default all registered statuses except 'trash', 'auto-draft', and
		 * 'inherit' are included, so custom statuses from plugins (e.g. WooCommerce
		 * order statuses) are picked up automatically.
		 *
		 * @param string[] $statuses Post status slugs to backfill.
		 */
		return (array) apply_filters( 'godam_media_backfill_post_statuses', $statuses );
	}

	// -------------------------------------------------------------------------
	// Memory management
	// -------------------------------------------------------------------------

	/**
	 * Release memory accumulated during a batch.
	 *
	 * Each batch loads post meta, term data, and query results into the
	 * in-memory object cache. Without cleanup this grows unbounded across
	 * batches, which is a problem on large databases.
	 *
	 * wp_cache_flush_runtime() clears only the non-persistent (in-process)
	 * layer, so any external persistent cache (Redis / Memcached) is left
	 * intact. It is available since WP 6.0 — safe here as GoDAM requires 6.5.
	 *
	 * @return void
	 */
	private function free_memory() {
		global $wpdb;

		// Purge the query log that accumulates when SAVEQUERIES is on (dev envs).
		if ( defined( 'SAVEQUERIES' ) && \SAVEQUERIES ) {
			$wpdb->queries = array();
		}

		// Release wpdb's internal result buffer from the last query.
		$wpdb->flush();

		// Clear the in-process object cache. This is the primary memory sink
		// during backfill — post meta and query results pile up here each batch.
		wp_cache_flush_runtime();
	}
}
