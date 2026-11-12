<?php
/**
 * Register REST API endpoints for Video Migration.
 *
 * This class handles the migration of core video blocks, and of Vimeo videos
 * in Gutenberg blocks, Elementor, WPBakery and ACF fields.
 *
 * @since 1.4.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Vimeo_Migration\Acf_Source;
use RTGODAM\Inc\Vimeo_Migration\Elementor_Source;
use RTGODAM\Inc\Vimeo_Migration\Vimeo_Resolver;
use RTGODAM\Inc\Vimeo_Migration\Vimeo_Url;
use RTGODAM\Inc\Vimeo_Migration\WPBakery_Source;

/**
 * Class Video_Migration
 *
 * @since 1.4.0
 */
class Video_Migration extends Base {

	/**
	 * Slug of the Gutenberg block source in the Vimeo migration status.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const GUTENBERG_SOURCE = 'gutenberg';

	/**
	 * Construct method.
	 */
	public function __construct() {
		parent::__construct();

		add_action( 'godam_process_full_video_migration', array( $this, 'process_full_video_migration' ) );
		add_action( 'godam_migrate_post_batch_video_blocks', array( $this, 'migrate_post_batch_video_blocks' ), 10, 3 );
	}

	/**
	 * Get REST routes.
	 *
	 * @since 1.4.0
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/video-migrate',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'migrate_videos' ),
						'permission_callback' => array( $this, 'check_video_migration_permission' ),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/video-migrate/abort',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'abort_video_migration' ),
						'permission_callback' => array( $this, 'check_video_migration_permission' ),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/video-migration/status',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_migration_status' ),
						'permission_callback' => array( $this, 'check_video_migration_permission' ),
					),
				),
			),
		);
	}

	/**
	 * Abort a running migration.
	 *
	 * Stops future scheduled actions and resets the stored status to initial state.
	 * Returns a small summary to display in UI.
	 *
	 * @since 1.4.0
	 *
	 * @param \WP_REST_Request $request Request containing migration type.
	 *
	 * @return \WP_REST_Response
	 */
	public function abort_video_migration( $request ) {
		$migration_type = $request->get_param( 'type' );

		if ( ! in_array( $migration_type, array( 'core', 'vimeo' ), true ) ) {
			return new \WP_Error( 'invalid_migration_type', __( 'Invalid migration type specified.', 'godam' ), array( 'status' => 400 ) );
		}

		$wp_option_key   = 'godam_' . $migration_type . '_video_migration_status';
		$current_status  = get_option( $wp_option_key, array() );
		$processed_count = isset( $current_status['done'] ) ? (int) $current_status['done'] : 0;
		$total_count     = isset( $current_status['total'] ) ? (int) $current_status['total'] : 0;

		// Unschedule all pending discovery and batch jobs. Core and Vimeo
		// migrations share these two AS hooks (distinguished only by arguments),
		// so aborting one type also cancels any concurrently queued jobs for the
		// other. In practice only one migration runs at a time, so this is safe.
		if ( function_exists( 'as_unschedule_all_actions' ) ) {
			as_unschedule_all_actions( 'godam_process_full_video_migration' );
			as_unschedule_all_actions( 'godam_migrate_post_batch_video_blocks' );
		}

		// Reset the status to initial state (pending) by deleting the option.
		delete_option( $wp_option_key );

		if ( 'core' === $migration_type ) {
			$migration_name = __( 'Core Video Migration', 'godam' );
		} else {
			$migration_name = __( 'Vimeo Video Migration', 'godam' );
		}

		$response = array(
			'status'  => 'aborted',
			'done'    => $processed_count,
			'total'   => $total_count,
			/* translators: %1$d is the number of posts processed, %2$d is the total number of posts to process and %3$d is the migration name */
			'message' => sprintf( __( 'Processed %1$d of %2$d posts. %3$s aborted.', 'godam' ), $processed_count, $total_count, $migration_name ),
		);

		return rest_ensure_response( $response );
	}

	/**
	 * Get Vimeo migration status from GoDAM Central.
	 *
	 * This function fetches the current Vimeo migration status from GoDAM Central API.
	 * It requires a valid API key stored in WordPress options.
	 *
	 * @since 1.4.0
	 *
	 * @return array|\WP_Error Migration status or error object on failure.
	 */
	public function get_vimeo_migration_status_from_godam_central() {

		$api_key = get_option( 'rtgodam-api-key', '' );

		if ( empty( $api_key ) ) {
			return new \WP_Error( 'missing_api_key', __( 'GoDAM API key is required to access this endpoint.', 'godam' ), array( 'status' => 403 ) );
		}

		// Build API URL.
		$url = RTGODAM_API_BASE . '/api/method/godam_core.api.vimeo.check_migration_status';

		// Prepare request body with API key.
		$request_body = array(
			'api_key' => $api_key,
		);

		$args = array(
			'body'    => wp_json_encode( $request_body ),
			'headers' => array(
				'Content-Type' => 'application/json',
			),
		);

		// Use vip_safe_wp_remote_post as primary and wp_safe_remote_post as fallback.
		if ( function_exists( 'vip_safe_wp_remote_post' ) ) {
			$response = vip_safe_wp_remote_post( $url, $args, 3, 3 );
		} else {
			$response = wp_safe_remote_post( $url, $args );
		}

		if ( is_wp_error( $response ) ) {
			return new \WP_Error( 'api_error', __( 'Error fetching migration status from GoDAM Central.', 'godam' ), array( 'status' => 500 ) );
		}

		$body = wp_remote_retrieve_body( $response );

		$body = json_decode( $body, true );

		return $body;
	}

	/**
	 * Permission callback for video migration endpoints.
	 *
	 * @since 1.4.0
	 *
	 * @return bool True if the user has permission, false otherwise.
	 */
	public function check_video_migration_permission() {
		// Check if the user has the capability to manage options.
		return current_user_can( 'edit_pages' );
	}

	/**
	 * Migrate Vimeo videos in Gutenberg blocks.
	 *
	 * This endpoint initiates the migration process for Vimeo videos in Gutenberg blocks.
	 * It queues a background action to process all posts that need migration.
	 *
	 * @since 1.4.0
	 *
	 * @param \WP_REST_Request $request The REST request object.
	 *
	 * @return \WP_REST_Response Migration status including total posts, done count, and current status.
	 */
	public function migrate_videos( $request ) {

		// Get migration type from request.
		$migration_type = $request->get_param( 'type' );

		if ( ! in_array( $migration_type, array( 'core', 'vimeo' ), true ) ) {
			return new \WP_Error( 'invalid_migration_type', __( 'Invalid migration type specified.', 'godam' ), array( 'status' => 400 ) );
		}
		$wp_option_key = 'godam_' . $migration_type . '_video_migration_status';

		if ( 'vimeo' === $migration_type ) {
			// Check if Vimeo migration is enabled.
			$godam_migration_status = $this->get_vimeo_migration_status_from_godam_central();
			if ( is_wp_error( $godam_migration_status ) ) {
				return $godam_migration_status; // Return error from GoDAM Central.
			}

			if ( isset( $godam_migration_status['message']['migration_status'] ) ) {
				$status = $godam_migration_status['message']['migration_status'];
				if ( 'Completed' !== $status ) {
					// Reset migration status since Central migration is not completed.
					delete_option( $wp_option_key );
					
					return new \WP_REST_Response(
						$godam_migration_status,
						200,
					);
				}
			}
		}

		$migration_status = get_option( $wp_option_key, array() );

		if ( ! empty( $migration_status ) && 'processing' === $migration_status['status'] ) {
			return rest_ensure_response( $migration_status );
		}

		// Initialize migration status.
		$initial_status = array(
			'total'     => 0,
			'done'      => 0,
			'started'   => current_time( 'mysql' ),
			'completed' => null,
			'status'    => 'processing', // pending | processing | completed | error.
			'message'   => __( 'Migration queued for processing', 'godam' ),
		);

		// For Vimeo migration, also track counts per place the videos sit in.
		if ( 'vimeo' === $migration_type ) {
			$include_acf = rest_sanitize_boolean( $request->get_param( 'include_acf' ) ) && Acf_Source::is_active();

			$initial_status['vimeo_blocks_found']    = 0;
			$initial_status['vimeo_blocks_migrated'] = 0;
			$initial_status['include_acf']           = $include_acf;
			$initial_status['vimeo_sources']         = array();

			foreach ( $this->get_active_vimeo_sources( $include_acf ) as $source ) {
				$initial_status['vimeo_sources'][ $source ] = array(
					'found'    => 0,
					'migrated' => 0,
				);
			}
		}

		update_option( $wp_option_key, $initial_status );

		// Schedule a single background action to handle everything.
		as_enqueue_async_action(
			'godam_process_full_video_migration',
			array( 'migration_type' => $migration_type )
		);

		return rest_ensure_response( $initial_status );
	}

	/**
	 * Process the full migration in background.
	 * This runs as a scheduled action and handles finding + migrating all posts.
	 *
	 * @since 1.4.0
	 *
	 * @param string $migration_type The type of migration to process (e.g., 'core', 'vimeo').
	 *
	 * @return void
	 */
	public function process_full_video_migration( $migration_type ) {

		if ( ! in_array( $migration_type, array( 'core', 'vimeo' ), true ) ) {
			return;
		}

		$wp_option_key = 'godam_' . $migration_type . '_video_migration_status';

		// Update status to processing.
		$status            = get_option( $wp_option_key, array() );
		$status['status']  = 'processing';
		$status['message'] = __( 'Finding all posts to migrate', 'godam' );
		update_option( $wp_option_key, $status );

		// Get all post types that support Gutenberg editor.
		$post_types = $this->get_gutenberg_enabled_post_types();

		// Find all posts that need migration.
		$all_post_ids = empty( $post_types ) ? array() : $this->find_all_posts_for_migration( $post_types );

		// The Vimeo migration also covers page builders and custom fields, whose
		// posts may not use the block editor at all.
		if ( 'vimeo' === $migration_type ) {
			$all_post_ids = array_merge( $all_post_ids, $this->find_vimeo_source_post_ids( ! empty( $status['include_acf'] ) ) );
			$all_post_ids = array_values( array_unique( array_map( 'intval', $all_post_ids ) ) );
			sort( $all_post_ids );
		}

		if ( empty( $post_types ) && empty( $all_post_ids ) ) {
			$this->update_migration_status_error( $wp_option_key, __( 'No post types with Gutenberg support found', 'godam' ) );
			return;
		}

		$total_posts = count( $all_post_ids );

		if ( 0 === $total_posts ) {
			$this->complete_migration_with_no_posts( $wp_option_key );
			return;
		}

		// Update status with total count.
		$status['total']   = $total_posts;
		$status['message'] = "Found {$total_posts} posts to process";
		update_option( $wp_option_key, $status );

		// Process posts in batches.
		$this->process_posts_in_batches( $migration_type, $all_post_ids );
	}

	/**
	 * Find all posts that need migration across all post types
	 *
	 * @since 1.4.0
	 *
	 * @param array $post_types Array of post type names to search for.
	 *
	 * @return array Array of post IDs that need migration.
	 */
	private function find_all_posts_for_migration( $post_types ) {
		$all_post_ids   = array();
		$posts_per_page = 1000; // Process 1000 posts at a time to prevent memory issues.

		foreach ( $post_types as $post_type ) {

			$offset          = 0;
			$post_type_total = 0;

			do {
				$posts = get_posts(  // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts
					array(
						'post_type'              => $post_type,
						'posts_per_page'         => $posts_per_page,
						'offset'                 => $offset,
						'post_status'            => 'any',
						'fields'                 => 'ids',
						'orderby'                => 'ID',
						'order'                  => 'ASC',
						'no_found_rows'          => true, // Skip SQL_CALC_FOUND_ROWS for better performance.
						'update_post_meta_cache' => false, // Skip post meta caching.
						'update_post_term_cache' => false, // Skip term caching.
					)
				);

				$post_count = is_array( $posts ) ? count( $posts ) : 0;

				if ( $post_count > 0 ) {
					$all_post_ids     = array_merge( $all_post_ids, $posts );
					$post_type_total += $post_count;

					// Add a small delay to prevent overwhelming the database.
					sleep( 1 ); // 1 second delay.
				}

				$offset += $posts_per_page;

			} while ( $post_count === $posts_per_page );

		}

		return $all_post_ids;
	}

	/**
	 * Process all posts in manageable batches.
	 *
	 * @since 1.4.0
	 *
	 * @param string $migration_type The type of migration being processed (e.g., 'core', 'vimeo').
	 * @param array  $all_post_ids Array of all post IDs to process.
	 *
	 * @return void
	 */
	private function process_posts_in_batches( $migration_type, $all_post_ids ) {
		$batch_size    = 20;
		$total_batches = ceil( count( $all_post_ids ) / $batch_size );
		$batch_number  = 0;

		// Split posts into batches and schedule each batch.
		$length = count( $all_post_ids );
		for ( $i = 0; $i < $length; $i += $batch_size ) {
			$batch_post_ids = array_slice( $all_post_ids, $i, $batch_size );
			++$batch_number;


			// Queue each batch for immediate async processing. Using async actions avoids reliance on wp-cron.
			if ( function_exists( 'as_enqueue_async_action' ) ) {
				// NOTE: When a hook expects N args, async enqueue should pass a flat array of N values, not an associative array.
				as_enqueue_async_action(
					'godam_migrate_post_batch_video_blocks',
					array( $migration_type, $batch_post_ids, $batch_number )
				);
			} elseif ( function_exists( 'as_schedule_single_action' ) ) {
				// Fallback to scheduled actions with a slight delay if async enqueue is unavailable.
				as_schedule_single_action(
					time() + ( $batch_number * 2 ),
					'godam_migrate_post_batch_video_blocks',
					array( $migration_type, $batch_post_ids, $batch_number )
				);
			}
		}

		// Update status.
		$status            = get_option( 'godam_' . $migration_type . '_video_migration_status', array() );
		$status['message'] = sprintf(
		/* translators: %d is the number of batches scheduled for processing */
			__( 'Scheduled %d batches for processing', 'godam' ),
			$batch_number,
		);
		update_option( 'godam_' . $migration_type . '_video_migration_status', $status );
	}

	/**
	 * Handle migration completion when no posts found.
	 *
	 * @since 1.4.0
	 *
	 * @param string $wp_option_key The WordPress option key to update with the completion status.
	 *
	 * @return void
	 */
	private function complete_migration_with_no_posts( $wp_option_key ) {
		$status = array(
			'total'     => 0,
			'done'      => 0,
			'started'   => current_time( 'mysql' ),
			'completed' => current_time( 'mysql' ),
			'status'    => 'completed',
			'message'   => __( 'No posts found that need migration', 'godam' ),
		);

		update_option( $wp_option_key, $status );
	}

	/**
	 * Update status with error message
	 *
	 * @since 1.4.0
	 *
	 * @param string $wp_option_key The WordPress option key to update with the error status.
	 * @param string $error_message The error message to log and update in the migration status.
	 *
	 * @return void
	 */
	private function update_migration_status_error( $wp_option_key, $error_message ) {
		$status              = get_option( $wp_option_key, array() );
		$status['status']    = 'error';
		$status['message']   = $error_message;
		$status['completed'] = current_time( 'mysql' );
		update_option( $wp_option_key, $status );
	}

	/**
	 * Enhanced batch processing with better error handling.
	 *
	 * @since 1.4.0
	 *
	 * @param string $migration_type The type of migration being processed (e.g., 'core', 'vimeo').
	 * @param array  $post_ids Array of post IDs to process in this batch.
	 * @param int    $batch_number The current batch number.
	 *
	 * @return int Number of posts processed in this batch.
	 */
	public function migrate_post_batch_video_blocks( $migration_type, $post_ids, $batch_number = 0 ) {

		if ( ! in_array( $migration_type, array( 'core', 'vimeo' ), true ) ) {
			return 0;
		}


		if ( empty( $post_ids ) || ! is_array( $post_ids ) ) {
			return 0; // No posts to process.
		}

		$wp_option_key = 'godam_' . $migration_type . '_video_migration_status';

		$migration_status = get_option( $wp_option_key, array() );

		$processed_count = 0;
		// Track Vimeo video counts for this batch, per place they sit in.
		$vimeo_sources_in_batch = array();
		$include_acf            = ! empty( $migration_status['include_acf'] );
		$vimeo_resolver         = 'vimeo' === $migration_type ? new Vimeo_Resolver( $this ) : null;

		foreach ( $post_ids as $post_id ) {
			try {
				$post_changed = false;

				// Migrate individual post.
				if ( 'core' === $migration_type ) {
					$post_changed = $this->migrate_single_post_video_blocks( $post_id );
				} elseif ( 'vimeo' === $migration_type ) {
					$result       = $this->migrate_single_post_vimeo( (int) $post_id, $include_acf, $vimeo_resolver );
					$post_changed = $result['changed'];

					foreach ( $result['sources'] as $source => $counts ) {
						$vimeo_sources_in_batch[ $source ]['found']    = ( $vimeo_sources_in_batch[ $source ]['found'] ?? 0 ) + $counts['found'];
						$vimeo_sources_in_batch[ $source ]['migrated'] = ( $vimeo_sources_in_batch[ $source ]['migrated'] ?? 0 ) + $counts['migrated'];
					}
				}

				if ( $post_changed ) {
					++$processed_count;
				}

				// Small delay to prevent server overload.
				usleep( 50000 ); // 0.05 second delay.

			} catch ( \Exception $e ) {
				error_log( "Error processing post {$post_id} in batch #{$batch_number}: " . $e->getMessage() ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			}
		}

		// Update the migration status atomically to avoid race conditions across parallel batches.
		if ( ! empty( $migration_status ) ) {
			$lock_key = 'godam_' . $migration_type . '_video_migration_lock';
			if ( $this->acquire_migration_lock( $lock_key ) ) {
				// Re-read inside the lock, from the database: this request's
				// option cache still holds the value from when it started.
				$migration_status = $this->get_fresh_option( $wp_option_key );

				// The run was aborted while this batch ran: don't bring it back.
				if ( empty( $migration_status ) ) {
					$this->release_migration_lock( $lock_key );
					return $processed_count;
				}

				$migration_status['done'] = ( $migration_status['done'] ?? 0 ) + count( $post_ids );

				// Accumulate Vimeo video counts if applicable.
				if ( 'vimeo' === $migration_type ) {
					$migration_status['vimeo_sources'] = $this->add_vimeo_source_counts( $migration_status['vimeo_sources'] ?? array(), $vimeo_sources_in_batch );

					// Kept for integrations that read them: Gutenberg block counts.
					$migration_status['vimeo_blocks_found']    = (int) ( $migration_status['vimeo_sources'][ self::GUTENBERG_SOURCE ]['found'] ?? 0 );
					$migration_status['vimeo_blocks_migrated'] = (int) ( $migration_status['vimeo_sources'][ self::GUTENBERG_SOURCE ]['migrated'] ?? 0 );
				}

				// Calculate progress percentage.
				$progress = 0;
				if ( ! empty( $migration_status['total'] ) && $migration_status['total'] > 0 ) {
					$progress = round( ( $migration_status['done'] / $migration_status['total'] ) * 100 );
				}

				$migration_status['message'] = sprintf(
				/* translators: %1$d is the number of posts processed, %2$d is the total number of posts, %3$d is the progress percentage */
					__( 'Processed %1$d/%2$d posts (%3$d%% complete)', 'godam' ),
					$migration_status['done'],
					$migration_status['total'],
					$progress
				);

				// Check if migration is complete.
				if ( $migration_status['done'] >= ( $migration_status['total'] ?? 0 ) ) {
					$migration_status['status']    = 'completed';
					$migration_status['completed'] = current_time( 'mysql' );
					if ( 'vimeo' === $migration_type ) {
						$migration_status['message'] = sprintf(
						/* translators: 1: total posts processed, 2: replaced Vimeo videos, 3: total Vimeo videos found */
							__( 'Migration completed! Processed %1$d posts. Replaced %2$d of %3$d Vimeo videos found.', 'godam' ),
							(int) ( $migration_status['total'] ?? 0 ),
							(int) array_sum( array_column( $migration_status['vimeo_sources'] ?? array(), 'migrated' ) ),
							(int) array_sum( array_column( $migration_status['vimeo_sources'] ?? array(), 'found' ) )
						);
					} else {
						$migration_status['message'] = sprintf(
						/* translators: %d is the total number of posts processed */
							__( 'Migration completed! Processed %d posts.', 'godam' ),
							$migration_status['total'],
						);
					}
				}

				update_option( $wp_option_key, $migration_status );
				$this->release_migration_lock( $lock_key );
			} else {
				// As a fallback if we fail to acquire the lock after retries, attempt a best-effort update.
				$migration_status = $this->get_fresh_option( $wp_option_key );

				if ( ! empty( $migration_status ) ) {
					$migration_status['done'] = ( $migration_status['done'] ?? 0 ) + count( $post_ids );
					update_option( $wp_option_key, $migration_status );
				}
			}
		}

		return $processed_count;
	}

	/**
	 * Read an option from the database rather than this request's cache.
	 *
	 * Batches run in parallel requests, and each request caches options when
	 * it starts, so a plain get_option() can return a value another batch has
	 * since replaced.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $option Option name.
	 *
	 * @return array The option value, or an empty array when it isn't set.
	 */
	private function get_fresh_option( string $option ): array {
		wp_cache_delete( $option, 'options' );
		wp_cache_delete( 'alloptions', 'options' );
		wp_cache_delete( 'notoptions', 'options' );

		$value = get_option( $option, array() );

		return is_array( $value ) ? $value : array();
	}

	/**
	 * Acquire a short-lived lock for migration status updates.
	 *
	 * The lock is a row in the options table, created with INSERT IGNORE so
	 * only one request can create it, and taken over only when it has
	 * expired and still holds the expiry that was read. Both go straight to
	 * the database: the option cache of a long-running request goes stale.
	 *
	 * @since 1.4.0
	 * @since n.e.x.t Uses atomic queries instead of cached option reads, and waits longer.
	 *
	 * @param string $lock_key   Unique option key for the lock.
	 * @param int    $timeout_s  Lock expiry seconds.
	 * @param int    $retry_ms   Milliseconds to wait between retries.
	 * @param int    $max_wait_s Maximum total seconds to wait for the lock.
	 *
	 * @return bool True if the lock was acquired, false otherwise.
	 */
	private function acquire_migration_lock( string $lock_key, int $timeout_s = 30, int $retry_ms = 100, int $max_wait_s = 30 ): bool {
		global $wpdb;

		$deadline = microtime( true ) + $max_wait_s;

		do {
			$lock_expires_at = (string) ( time() + $timeout_s );

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- an atomic insert is the lock.
			$inserted = $wpdb->query(
				$wpdb->prepare(
					"INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, 'no')",
					$lock_key,
					$lock_expires_at
				)
			);

			if ( 1 === (int) $inserted ) {
				return true;
			}

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- the cached value can be stale.
			$current = $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", $lock_key ) );

			// Lock expired: take it over, unless another request just did.
			if ( null !== $current && (int) $current < time() ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- conditional update is the takeover.
				$updated = $wpdb->update(
					$wpdb->options,
					array( 'option_value' => $lock_expires_at ),
					array(
						'option_name'  => $lock_key,
						'option_value' => (string) $current,
					)
				);

				if ( 1 === (int) $updated ) {
					return true;
				}
			}

			usleep( $retry_ms * 1000 );
		} while ( microtime( true ) < $deadline );

		return false;
	}

	/**
	 * Release a previously acquired migration lock.
	 *
	 * @since 1.4.0
	 *
	 * @param string $lock_key Lock option key.
	 *
	 * @return void
	 */
	private function release_migration_lock( string $lock_key ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- the lock row is written directly, see acquire_migration_lock().
		$wpdb->delete( $wpdb->options, array( 'option_name' => $lock_key ) );
		wp_cache_delete( $lock_key, 'options' );
	}

	/**
	 * Migrate video blocks for a single post.
	 *
	 * @since 1.4.0
	 *
	 * @param int $post_id The ID of the post to migrate.
	 *
	 * @return bool True if post content was changed, false otherwise.
	 */
	private function migrate_single_post_video_blocks( $post_id ) {
		$post = get_post( $post_id ); // godam-coverage-ignore -- migrate_single_post_video_blocks(): $post_id is the HOST post being scanned for an embedded core/video block, not an attachment — the attachment ID parsed from the block is already wrapped in traverse_and_migrate_core_video_blocks_recursive().

		if ( ! $post || ! has_blocks( $post->post_content ) ) {
			return false;
		}

		$blocks  = parse_blocks( $post->post_content );
		$changed = false;

		$this->traverse_and_migrate_core_video_blocks_recursive( $blocks, $changed );

		if ( $changed ) {
			$this->update_post_content( (int) $post_id, serialize_blocks( $blocks ) );
		}

		return $changed;
	}

	/**
	 * Save a migrated post's content exactly as given.
	 *
	 * The content is slashed, because wp_update_post() expects slashed
	 * data: unslashed, the JSON escapes in block attributes (a backslash
	 * followed by u0026, for example) lose their backslash.
	 *
	 * The background job runs without a logged-in user, so kses would also
	 * strip markup the post's author was allowed to save, such as an
	 * `<iframe>` in a Custom HTML block. The migration only swaps videos, so
	 * kses is switched off for this one write and restored afterwards.
	 *
	 * @since n.e.x.t
	 *
	 * @param int    $post_id Post ID.
	 * @param string $content New post content.
	 *
	 * @return bool True when the post was updated.
	 */
	private function update_post_content( int $post_id, string $content ): bool {
		$kses_was_active = false !== has_filter( 'content_save_pre', 'wp_filter_post_kses' );

		if ( $kses_was_active ) {
			kses_remove_filters();
		}

		try {
			$result = wp_update_post( // godam-coverage-ignore -- update_post_content(): rewrites the HOST post's own post_content after migrating its embedded videos, not attachment data.
				wp_slash(
					array(
						'ID'           => $post_id,
						'post_content' => $content,
					)
				),
				true
			);
		} finally {
			if ( $kses_was_active ) {
				kses_init_filters();
			}
		}

		return ! is_wp_error( $result ) && 0 !== $result;
	}

	/**
	 * Recursively traverse blocks and migrate core/video blocks to godam/video.
	 *
	 * Handles nested structures like columns, groups, grids, etc.
	 *
	 * @since 1.4.0
	 *
	 * @param array $blocks  Parsed blocks array (passed by reference).
	 * @param bool  $changed Whether content changed (by reference).
	 */
	private function traverse_and_migrate_core_video_blocks_recursive( array &$blocks, bool &$changed ) {
		foreach ( $blocks as &$block ) {
			$block_name = $block['blockName'] ?? '';

			if ( 'core/video' === $block_name ) {
				$attrs         = $block['attrs'] ?? array();
				$attachment_id = isset( $attrs['id'] ) ? (int) $attrs['id'] : 0;

				/**
				 * Fires before reading this attachment's URL/sources/SEO
				 * data, so integrations that centralize media on another
				 * site can switch context first.
				 *
				 * @since 2.2.0
				 */
				do_action( 'rtgodam_before_attachment_lookup' );

				if ( $attachment_id ) {
					$attrs['src'] = wp_get_attachment_url( $attachment_id );
				}

				$sources = $this->build_video_sources_array( $attachment_id );

				// Build default SEO data so the migrated block has SEO populated.
				$seo_data = $this->build_default_seo_data( $attachment_id, $attrs, $sources );

				/**
				 * Fires after reading this attachment's data, so
				 * integrations can restore the site context switched in
				 * `rtgodam_before_attachment_lookup`.
				 *
				 * @since 2.2.0
				 */
				do_action( 'rtgodam_after_attachment_lookup' );

				// Transform to custom block with attributes.
				$block = array(
					'blockName'    => 'godam/video',
					'attrs'        => array(
						'autoplay' => $attrs['autoplay'] ?? false,
						'id'       => $attrs['id'] ?? '',
						'loop'     => $attrs['loop'] ?? false,
						'muted'    => $attrs['muted'] ?? false,
						'poster'   => $attrs['poster'] ?? '',
						'src'      => $attrs['src'] ?? '',
						'sources'  => $sources,
						'seo'      => $seo_data,
					),
					'innerContent' => array( '<div class="wp-block-godam-video"></div>' ),
					'innerBlocks'  => array(),
				);

				$changed = true;
				continue; // Replacement done for this block.
			}

			if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
				$this->traverse_and_migrate_core_video_blocks_recursive( $block['innerBlocks'], $changed );
			}
		}
	}

	/**
	 * Migrate the Vimeo videos in a single post, wherever they sit.
	 *
	 * Runs, in order: Gutenberg Vimeo embed blocks and WPBakery Video Player
	 * elements in the post content (saved once), then Elementor Video widgets
	 * and, when asked for, ACF oEmbed and URL fields.
	 *
	 * @since n.e.x.t
	 *
	 * @param int                 $post_id     The ID of the post to migrate.
	 * @param bool                $include_acf Whether to replace Vimeo links in ACF fields.
	 * @param Vimeo_Resolver|null $resolver    Resolver shared across the batch, so each video is looked up once.
	 *
	 * @return array{changed: bool, found: int, migrated: int, sources: array<string, array{found: int, migrated: int}>}
	 */
	private function migrate_single_post_vimeo( int $post_id, bool $include_acf, ?Vimeo_Resolver $resolver = null ): array {
		$result = array(
			'changed'  => false,
			'found'    => 0,
			'migrated' => 0,
			'sources'  => array(),
		);

		$post = get_post( $post_id ); // godam-coverage-ignore -- migrate_single_post_vimeo(): $post_id is the HOST post being scanned for embedded Vimeo videos, not an attachment — attachment reads for the resolved videos are wrapped in Vimeo_Resolver and traverse_and_migrate_vimeo_blocks_recursive().

		if ( ! $post ) {
			return $result;
		}

		$resolver = null !== $resolver ? $resolver : new Vimeo_Resolver( $this );
		$resolve  = array( $resolver, 'resolve' );

		$content     = (string) $post->post_content;
		$new_content = $content;

		// Gutenberg blocks.
		if ( has_blocks( $content ) ) {
			$blocks   = parse_blocks( $content );
			$changed  = false;
			$found    = 0;
			$migrated = 0;

			$this->traverse_and_migrate_vimeo_blocks_recursive( $blocks, $post_id, $found, $migrated, $changed );

			if ( $changed ) {
				$new_content = serialize_blocks( $blocks );
			}

			$result['sources'][ self::GUTENBERG_SOURCE ] = array(
				'found'    => $found,
				'migrated' => $migrated,
			);
		}

		// WPBakery shortcodes.
		if ( WPBakery_Source::is_active() ) {
			$wpbakery    = new WPBakery_Source( $resolve );
			$new_content = $wpbakery->migrate_content( $new_content );

			$result['sources'][ WPBakery_Source::SLUG ] = $wpbakery->get_counts();
		}

		if ( $new_content !== $content && $this->update_post_content( $post_id, $new_content ) ) {
			$result['changed'] = true;
		}

		// Elementor data.
		if ( Elementor_Source::is_active() ) {
			$elementor_result = ( new Elementor_Source( $resolve ) )->migrate_post( $post_id );

			$result['changed']                           = $result['changed'] || $elementor_result['changed'];
			$result['sources'][ Elementor_Source::SLUG ] = array(
				'found'    => $elementor_result['found'],
				'migrated' => $elementor_result['migrated'],
			);
		}

		// ACF fields.
		if ( $include_acf && Acf_Source::is_active() ) {
			$acf_result = ( new Acf_Source( $resolve ) )->migrate_post( $post_id );

			$result['changed']                     = $result['changed'] || $acf_result['changed'];
			$result['sources'][ Acf_Source::SLUG ] = array(
				'found'    => $acf_result['found'],
				'migrated' => $acf_result['migrated'],
			);
		}

		foreach ( $result['sources'] as $counts ) {
			$result['found']    += $counts['found'];
			$result['migrated'] += $counts['migrated'];
		}

		return $result;
	}

	/**
	 * Slugs of the places the Vimeo migration covers on this site.
	 *
	 * @since n.e.x.t
	 *
	 * @param bool $include_acf Whether ACF fields are included in this run.
	 *
	 * @return string[]
	 */
	private function get_active_vimeo_sources( bool $include_acf ): array {
		$sources = array( self::GUTENBERG_SOURCE );

		if ( Elementor_Source::is_active() ) {
			$sources[] = Elementor_Source::SLUG;
		}

		if ( WPBakery_Source::is_active() ) {
			$sources[] = WPBakery_Source::SLUG;
		}

		if ( $include_acf && Acf_Source::is_active() ) {
			$sources[] = Acf_Source::SLUG;
		}

		return $sources;
	}

	/**
	 * Find the posts with Vimeo videos in page builders and custom fields.
	 *
	 * @since n.e.x.t
	 *
	 * @param bool $include_acf Whether ACF fields are included in this run.
	 *
	 * @return int[] Post IDs.
	 */
	private function find_vimeo_source_post_ids( bool $include_acf ): array {
		$post_ids = array();

		if ( Elementor_Source::is_active() ) {
			$post_ids = array_merge( $post_ids, Elementor_Source::find_post_ids() );
		}

		if ( WPBakery_Source::is_active() ) {
			$post_ids = array_merge( $post_ids, WPBakery_Source::find_post_ids() );
		}

		if ( $include_acf && Acf_Source::is_active() ) {
			$post_ids = array_merge( $post_ids, Acf_Source::find_post_ids() );
		}

		return $post_ids;
	}

	/**
	 * Add one batch's per-source Vimeo counts to the running totals.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $totals Running totals: source slug => { found, migrated }.
	 * @param array $batch  This batch's counts, same shape.
	 *
	 * @return array The new totals.
	 */
	private function add_vimeo_source_counts( array $totals, array $batch ): array {
		foreach ( $batch as $source => $counts ) {
			$totals[ $source ]['found']    = (int) ( $totals[ $source ]['found'] ?? 0 ) + (int) ( $counts['found'] ?? 0 );
			$totals[ $source ]['migrated'] = (int) ( $totals[ $source ]['migrated'] ?? 0 ) + (int) ( $counts['migrated'] ?? 0 );
		}

		return $totals;
	}

	/**
	 * Recursively traverse blocks to find and migrate Vimeo embeds inside nested structures.
	 *
	 * @since 1.4.0
	 *
	 * @param array $blocks   Parsed Gutenberg blocks (passed by reference).
	 * @param int   $post_id  Post ID for logging context.
	 * @param int   $found    Counter for number of Vimeo embeds found (by reference).
	 * @param int   $migrated Counter for number of Vimeo embeds migrated (by reference).
	 * @param bool  $changed  Whether content changed (by reference).
	 */
	private function traverse_and_migrate_vimeo_blocks_recursive( array &$blocks, int $post_id, int &$found, int &$migrated, bool &$changed ) {
		foreach ( $blocks as &$block ) {
			$block_name = $block['blockName'] ?? '';

			if ( 'core/embed' === $block_name || 'core-embed/vimeo' === $block_name ) {
				$attrs     = $block['attrs'] ?? array();
				$provider  = $attrs['providerNameSlug'] ?? '';
				$vimeo_url = $attrs['url'] ?? '';
				$is_vimeo  = ( 'vimeo' === $provider ) || ( ! empty( $vimeo_url ) && str_contains( $vimeo_url, 'vimeo.com' ) );

				if ( $is_vimeo ) {
					++$found;

					if ( ! empty( $vimeo_url ) ) {
						$attachment_id = $this->create_attachment_from_vimeo_video( $vimeo_url );

						if ( ! is_wp_error( $attachment_id ) ) {
							/**
							 * Fires before reading the migrated attachment's
							 * URL/sources/SEO data, so integrations that
							 * centralize media on another site can switch
							 * context first — this runs after
							 * create_attachment_from_vimeo_video()'s own
							 * wrap has already restored.
							 *
							 * @since 2.2.0
							 */
							do_action( 'rtgodam_before_attachment_lookup' );
							$video_url = wp_get_attachment_url( $attachment_id );
							$sources   = array();
							$seo_data  = array();

							if ( ! empty( $video_url ) ) {
								$sources = $this->build_video_sources_array( $attachment_id );

								// Build default SEO data so the migrated block has SEO populated.
								$seo_data = $this->build_default_seo_data( $attachment_id, $attrs, $sources );
							}

							/**
							 * Fires after reading the migrated attachment's
							 * data, so integrations can restore the site
							 * context switched in
							 * `rtgodam_before_attachment_lookup`. Fired
							 * unconditionally — unlike the block-building
							 * below, which only runs when $video_url
							 * resolved — so the switch is always restored
							 * regardless of that outcome.
							 *
							 * @since 2.2.0
							 */
							do_action( 'rtgodam_after_attachment_lookup' );

							if ( ! empty( $video_url ) ) {
								$block = array(
									'blockName'    => 'godam/video',
									'attrs'        => array(
										'autoplay' => $attrs['autoplay'] ?? false,
										'id'       => $attachment_id,
										'loop'     => $attrs['loop'] ?? false,
										'muted'    => $attrs['muted'] ?? false,
										'poster'   => $attrs['poster'] ?? '',
										'src'      => $video_url,
										'sources'  => $sources,
										'seo'      => $seo_data,
									),
									'innerContent' => array( '<div class="wp-block-godam-video"></div>' ),
									'innerBlocks'  => array(),
								);

								$changed = true;
								++$migrated;
							}
						}
					}
				}
			} else {

				/**
				 * Prepare arguments for custom vimeo block migration.
				 *
				 * This includes the block data, post ID, and a flag indicating if the block has changed, as well as the found and migrated counts.
				 */
				$args = array(
					'block'    => $block,
					'post_id'  => $post_id,
					'changed'  => false,
					'found'    => $found,
					'migrated' => $migrated,
				);

				/**
				 * Filter the migration of custom Vimeo blocks.
				 *
				 * @since 1.4.0
				 *
				 * @param array    $args migration arguments.
				 * @param Video_Migration  $instance The current instance of the class.
				 */
				$block_migration_result = apply_filters( 'rtgodam_migrate_single_vimeo_block_result', $args, $this );

				// If a plugin handled this block via the filter, update our variables.
				if ( isset( $block_migration_result['block'] ) && $block_migration_result['block'] !== $block ) {
					$block    = $block_migration_result['block'];
					$changed  = $changed || $block_migration_result['changed'];
					$found    = $block_migration_result['found'];
					$migrated = $block_migration_result['migrated'];
				}
			}

			if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
				$this->traverse_and_migrate_vimeo_blocks_recursive( $block['innerBlocks'], $post_id, $found, $migrated, $changed );
			}
		}
	}

	/**
	 * Build sources array for a video attachment.
	 *
	 * This function creates the sources array that matches the format expected by the block editor.
	 *
	 * @since 1.4.0
	 *
	 * @param int $attachment_id The attachment ID.
	 *
	 * @return array Array of video sources with src and type properties.
	 */
	public function build_video_sources_array( int $attachment_id ): array {
		$sources = array();

		// Get the original source URL.
		$source_url = wp_get_attachment_url( $attachment_id );
		$mime_type  = get_post_mime_type( $attachment_id );

		if ( ! empty( $source_url ) ) {
			$sources[] = array(
				'src'  => $source_url,
				'type' => str_contains( $source_url, '.mov' ) ? 'video/mp4' : $mime_type,
			);
		}

		// Get HLS transcoded URL.
		$hls_transcoded_url = get_post_meta( $attachment_id, 'rtgodam_hls_transcoded_url', true );
		if ( ! empty( $hls_transcoded_url ) ) {
			$sources[] = array(
				'src'  => $hls_transcoded_url,
				'type' => str_contains( $hls_transcoded_url, '.m3u8' ) ? 'application/x-mpegURL' : $mime_type,
			);
		}

		// Get transcoded URL (MPD).
		$transcoded_url = get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );
		if ( ! empty( $transcoded_url ) ) {
			$sources[] = array(
				'src'  => $transcoded_url,
				'type' => str_contains( $transcoded_url, '.mpd' ) ? 'application/dash+xml' : $mime_type,
			);
		}

		// Reverse the sources to ensure the preferred format is first. MPD -> HLS -> Origin.
		return array_reverse( $sources );
	}

	/**
	 * Build default SEO data for a video attachment to populate block attrs during migration.
	 *
	 * @since 1.4.0
	 *
	 * @param int   $attachment_id Attachment ID.
	 * @param array $attrs         Source block attributes (optional).
	 * @param array $sources       Computed sources array (optional).
	 *
	 * @return array SEO data array compatible with block attribute `seo`.
	 */
	private function build_default_seo_data( int $attachment_id, array $attrs = array(), array $sources = array() ): array {
		if ( $attachment_id <= 0 ) {
			return array();
		}

		$attachment     = get_post( $attachment_id );
		$thumbnail_url  = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );
		$transcoded_url = get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );
		$hls_url        = get_post_meta( $attachment_id, 'rtgodam_hls_transcoded_url', true );
		$origin_url     = wp_get_attachment_url( $attachment_id );

		// Prefer MPD -> HLS -> Origin as contentUrl.
		$content_url = '';
		if ( ! empty( $transcoded_url ) ) {
			$content_url = $transcoded_url;
		} elseif ( ! empty( $hls_url ) ) {
			$content_url = $hls_url;
		} elseif ( ! empty( $origin_url ) ) {
			$content_url = $origin_url;
		}

		// Upload date in ISO 8601.
		$upload_date = '';
		if ( $attachment instanceof \WP_Post ) {
			$upload_date = get_post_time( 'c', true, $attachment ); // ISO 8601 UTC (Z).
		}

		// Duration from attachment meta to ISO 8601.
		$duration_iso = '';
		$meta         = wp_get_attachment_metadata( $attachment_id );
		if ( isset( $meta['length'] ) && is_numeric( $meta['length'] ) ) {
			$seconds      = (int) $meta['length'];
			$hours        = (int) floor( $seconds / 3600 );
			$minutes      = (int) floor( ( $seconds % 3600 ) / 60 );
			$secs         = (int) ( $seconds % 60 );
			$duration_iso = 'PT';
			if ( $hours > 0 ) {
				$duration_iso .= $hours . 'H';
			}
			if ( $minutes > 0 ) {
				$duration_iso .= $minutes . 'M';
			}
			if ( $secs > 0 || 'PT' === $duration_iso ) {
				$duration_iso .= $secs . 'S';
			}
		}

		$headline = $attachment instanceof \WP_Post ? get_the_title( $attachment_id ) : '';

		/**
		 * Fires before reading this attachment's excerpt/content for the
		 * SEO description fallback, so integrations that centralize media
		 * on another site can switch context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$desc_field  = $attachment instanceof \WP_Post ? get_post_field( 'post_excerpt', $attachment_id ) : '';
		$description = ! empty( $desc_field ) ? $desc_field : ( $attachment instanceof \WP_Post ? get_post_field( 'post_content', $attachment_id ) : '' );
		/**
		 * Fires after reading this attachment's data, so integrations can
		 * restore the site context switched in
		 * `rtgodam_before_attachment_lookup`.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_after_attachment_lookup' );

		return array(
			'contentUrl'       => $content_url,
			'headline'         => $headline,
			'description'      => is_string( $description ) ? wp_strip_all_tags( $description ) : '',
			'uploadDate'       => $upload_date,
			'duration'         => $duration_iso,
			'thumbnailUrl'     => ! empty( $thumbnail_url ) ? $thumbnail_url : '',
			'isFamilyFriendly' => true,
		);
	}

	/**
	 * Fetch Vimeo video id from url.
	 *
	 * @since 1.4.0
	 *
	 * @param string $vimeo_url The Vimeo video URL to fetch the ID from.
	 * @return string The Vimeo video ID or same vimeo URL if not found.
	 */
	private function fetch_vimeo_video_id( string $vimeo_url ) {
		$video_id = Vimeo_Url::get_video_id( $vimeo_url );

		if ( '' !== $video_id ) {
			return $video_id;
		}

		if ( preg_match( '/vimeo\.com\/(?:video\/)?(\d+)/', $vimeo_url, $matches ) ) {
			return $matches[1];
		}

		// Strip out the query parameters.
		$vimeo_url_stripped = strtok( $vimeo_url, '?' );

		return $vimeo_url_stripped;
	}

	/**
	 * Update video attachment metadata from Vimeo video info.
	 *
	 * This function handles setting all video metadata including dimensions,
	 * thumbnails, file size, duration, and transcoded URLs for both new and
	 * existing attachments during Vimeo migration.
	 *
	 * @since 1.4.0
	 *
	 * @param int         $attachment_id The attachment ID to update.
	 * @param array       $video_info    The video information from GoDAM Central API.
	 * @param string|null $job_id  The job ID if available.
	 *
	 * @return bool True on success, false on failure.
	 */
	private function update_video_metadata_from_vimeo_info( $attachment_id, $video_info, $job_id = null ) {
		if ( empty( $attachment_id ) || empty( $video_info ) ) {
			return false;
		}

		// Update attachment post data.
		$attachment_data = array(
			'ID'           => $attachment_id,
			'post_title'   => $video_info['title'] ?? $video_info['orignal_file_name'] ?? '',
			'post_content' => $video_info['description'] ?? '',
		);
		wp_update_post( $attachment_data ); // godam-coverage-ignore -- update_video_metadata_from_vimeo_info(): covered transitively — both call sites run inside create_attachment_from_vimeo_video()'s own before/after try/finally pair, same as the $wpdb->update() call below.

		// Update attachment metadata with dimensions.
		$metadata = array(
			'width'            => empty( $video_info['width'] ) ? 1920 : $video_info['width'],
			'height'           => empty( $video_info['height'] ) ? 1080 : $video_info['height'],
			'filesize'         => empty( $video_info['file_size'] ) ? 0 : intval( $video_info['file_size'] ),
			'mime_type'        => 'video/mp4',
			'length'           => empty( $video_info['playtime'] ) ? 0 : intval( $video_info['playtime'] ),
			'length_formatted' => empty( $video_info['playtime'] ) ? '00:00' : gmdate( 'i:s', intval( $video_info['playtime'] ) ),
			'fileformat'       => 'mp4',
		);
		wp_update_attachment_metadata( $attachment_id, $metadata );

		// Set the attachment thumbnail.
		if ( isset( $video_info['thumbnails'] ) && ! empty( $video_info['thumbnails'] ) ) {
			$thumbnails     = $video_info['thumbnails'];
			$thumbnail_urls = array();

			foreach ( $thumbnails as $thumb ) {
				if ( empty( $thumb['thumbnail_url'] ) ) {
					continue;
				}

				$thumbnail_urls[] = $thumb['thumbnail_url'];

				// Set as primary thumbnail if set to active.
				if ( isset( $thumb['is_active'] ) && $thumb['is_active'] ) {
					update_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', $thumb['thumbnail_url'] );
				}
			}

			update_post_meta( $attachment_id, 'rtgodam_media_thumbnails', $thumbnail_urls );
		}

		// Set the attachment file size.
		if ( ! empty( $video_info['file_size'] ) ) {
			update_post_meta( $attachment_id, '_video_file_size', intval( $video_info['file_size'] ) );
		}

		// Set the attachment playtime.
		if ( ! empty( $video_info['playtime'] ) ) {
			update_post_meta( $attachment_id, '_video_duration', intval( $video_info['playtime'] ) );
		}

		// Set the attachment attached file.
		if ( ! empty( $video_info['transcoded_mp4_url'] ) ) {
			update_post_meta( $attachment_id, '_wp_attached_file', $video_info['transcoded_mp4_url'] );
			update_post_meta( $attachment_id, 'rtgodam_is_migrated_vimeo_video', true );
		}

		// Set status as transcoded.
		update_post_meta( $attachment_id, 'rtgodam_transcoding_status', 'Transcoded' );

		// Save the job ID if available.
		if ( ! empty( $job_id ) ) {
			update_post_meta( $attachment_id, '_godam_original_id', $job_id );
			update_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', $job_id );
		}

		// Change the guid of the attachment to the transcoded file path.
		global $wpdb;
		//phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->update( // godam-coverage-ignore -- update_video_metadata_from_vimeo_info(): covered transitively — both call sites run inside create_attachment_from_vimeo_video()'s own before/after try/finally pair.
			$wpdb->posts,
			array(
				'guid' => ! empty( $video_info['transcoded_mp4_url'] ) ? $video_info['transcoded_mp4_url'] : $video_info['transcoded_file_path'],
			),
			array(
				'ID' => $attachment_id,
			)
		);

		// The direct write bypasses the post cache; drop it so the new guid is read back.
		clean_post_cache( $attachment_id );

		// Update attachment metadata.
		update_post_meta( $attachment_id, 'rtgodam_transcoded_url', $video_info['transcoded_file_path'] );
		update_post_meta( $attachment_id, 'rtgodam_hls_transcoded_url', $video_info['transcoded_hls_path'] );

		return true;
	}

	/**
	 * Create an attachment from a Vimeo video URL.
	 *
	 * Fetches video information from GoDAM Central and creates a WordPress attachment
	 * with the transcoded video file path. Checks for existing attachment by job ID first.
	 * If JOB ID is present and attachment exists, replaces all video metadata.
	 *
	 * @since 1.4.0
	 *
	 * @param string $vimeo_url The Vimeo video URL to create an attachment from.
	 *
	 * @return int|WP_Error Attachment ID on success, WP_Error object on failure.
	 */
	public function create_attachment_from_vimeo_video( $vimeo_url ) {
		if ( empty( $vimeo_url ) ) {
			return new \WP_Error( 'missing_url', __( 'Vimeo URL is required.', 'godam' ) );
		}

		// Fetch vimeo video id from url.
		$vimeo_video_id = $this->fetch_vimeo_video_id( $vimeo_url );

		// Get API key from options.
		$api_key = get_option( 'rtgodam-api-key', '' );
		if ( empty( $api_key ) ) {
			return new \WP_Error( 'missing_api_key', __( 'GoDAM API key is required.', 'godam' ) );
		}

		// Build request URL for GoDAM Central.
		$request_url = RTGODAM_API_BASE . '/api/method/godam_core.api.vimeo.get_vimeo_video_details';

		// Prepare request body with API key and Vimeo URL.
		$request_body = array(
			'api_key'   => $api_key,
			'vimeo_url' => $vimeo_video_id,
		);

		$args = array(
			'body'    => wp_json_encode( $request_body ),
			'headers' => array(
				'Content-Type' => 'application/json',
			),
		);

		// Use vip_safe_wp_remote_post as primary and wp_safe_remote_post as fallback.
		if ( function_exists( 'vip_safe_wp_remote_post' ) ) {
			$response = vip_safe_wp_remote_post( $request_url, $args, 3, 3 );
		} else {
			$response = wp_safe_remote_post( $request_url, $args );
		}
		if ( is_wp_error( $response ) ) {
			return new \WP_Error(
				'api_error',
				sprintf(
				/* translators: %s: error message */
					__( 'Error fetching video info: %s', 'godam' ),
					$response->get_error_message()
				)
			);
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( empty( $data['message'] ) || empty( $data['message']['transcoded_file_path'] ) ) {
			return new \WP_Error(
				'invalid_response',
				__( 'Invalid response from GoDAM Central.', 'godam' )
			);
		}

		$video_info = $data['message'];

		// Check if job ID exists in the response and look for existing attachment.
		$job_id = $video_info['name'] ?? null;

		/**
		 * Fires before the dedupe lookup and the eventual wp_insert_attachment()
		 * call, so integrations that centralize media on another site can
		 * switch context first — deliberately fired only after the SaaS
		 * HTTP call above returns, so the switch isn't held open across it.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		try {
			if ( ! empty( $job_id ) ) {
				// Check if attachment with this job ID already exists.
				if ( class_exists( 'RTGODAM_Transcoder_Handler' ) ) {
					$transcoder_handler = new \RTGODAM_Transcoder_Handler();
					if ( method_exists( $transcoder_handler, 'get_post_id_by_meta_key_and_value' ) ) {
						$existing_attachment_id = $transcoder_handler->get_post_id_by_meta_key_and_value( 'rtgodam_transcoding_job_id', $job_id );

						if ( $existing_attachment_id ) {
							// Replace all video metadata for existing attachment when JOB ID is present.
							$this->update_video_metadata_from_vimeo_info( $existing_attachment_id, $video_info, $job_id );
							return $existing_attachment_id;
						}
					}
				}
			}

			// Prepare attachment data for new attachment.
			$attachment = array(
				'post_mime_type' => 'video/mp4',
				'post_title'     => $video_info['title'] ?? $video_info['orignal_file_name'] ?? '',
				'post_content'   => $video_info['description'] ?? '',
				'post_status'    => 'inherit',
			);

			// Insert the attachment.
			$attachment_id = wp_insert_attachment( $attachment );

			if ( is_wp_error( $attachment_id ) ) {
				return $attachment_id;
			}

			// Update video metadata using the new reusable function.
			$this->update_video_metadata_from_vimeo_info( $attachment_id, $video_info, $job_id );

			return $attachment_id;
		} finally {
			do_action( 'rtgodam_after_attachment_lookup' );
		}
	}

	/**
	 * Get the current migration status.
	 *
	 * @since 1.4.0
	 *
	 * @param \WP_REST_Request $request The REST request object.
	 *
	 * @return \WP_REST_Response Migration status including total posts, done count, and current status.
	 */
	public function get_migration_status( $request ) {

		// Get migration type from request.
		$migration_type = $request->get_param( 'type' );

		if ( ! in_array( $migration_type, array( 'core', 'vimeo' ), true ) ) {
			return new \WP_Error( 'invalid_migration_type', __( 'Invalid migration type specified.', 'godam' ), array( 'status' => 400 ) );
		}

		$wp_option_key = 'godam_' . $migration_type . '_video_migration_status';

		$migration_status = get_option( $wp_option_key, array() );

		if ( empty( $migration_status ) ) {
			$migration_status = array(
				'total'     => 0,
				'done'      => 0,
				'started'   => null,
				'completed' => null,
				'status'    => 'pending', // processing | completed | error.
			);
		}

		// Tell the UI which places the Vimeo migration can cover on this site.
		if ( 'vimeo' === $migration_type ) {
			$migration_status['available_sources'] = array(
				Elementor_Source::SLUG => Elementor_Source::is_active(),
				WPBakery_Source::SLUG  => WPBakery_Source::is_active(),
				Acf_Source::SLUG       => Acf_Source::is_active(),
			);
		}

		return rest_ensure_response( $migration_status );
	}

	/**
	 * Get all post types that have Gutenberg editor enabled.
	 *
	 * @since 1.4.0
	 *
	 * @return array List of post type names that support Gutenberg editor.
	 */
	private function get_gutenberg_enabled_post_types() {
		$post_types           = get_post_types( array( 'public' => true ), 'objects' );
		$gutenberg_post_types = array();

		foreach ( $post_types as $post_type ) {
			// Check if post type supports editor and Gutenberg is not disabled.
			if ( post_type_supports( $post_type->name, 'editor' ) && use_block_editor_for_post_type( $post_type->name ) ) {
				$gutenberg_post_types[] = $post_type->name;
			}
		}

		return $gutenberg_post_types;
	}
}
