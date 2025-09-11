<?php
/**
 * Register REST API endpoints for Video Migration.
 *
 * This class handles the migration of Vimeo videos in Gutenberg blocks.
 *
 * @since 1.4.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

use RTGODAM\Inc\Post_Types\GoDAM_Video;

defined( 'ABSPATH' ) || exit;

/**
 * Class Video_Migration
 *
 * @since 1.4.0
 */
class Video_Migration extends Base {

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

		// Best-effort: unschedule pending actions for this migration. This may cancel both types if they run simultaneously.
		if ( function_exists( 'as_unschedule_all_actions' ) ) {
			// Root discovery job (find posts) and all batch jobs.
			as_unschedule_all_actions( 'godam_process_full_video_migration' );
			as_unschedule_all_actions( 'godam_migrate_post_batch_video_blocks' );
		}

		// Reset the status to initial state (pending) by deleting the option.
		delete_option( $wp_option_key );

		$migration_name = ( 'core' === $migration_type ) ? __( 'Core Video Migration', 'godam' ) : __( 'Vimeo Video Migration', 'godam' );

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

		// Add api_key query parameter.
		$url = RTGODAM_API_BASE . '/api/method/godam_core.api.vimeo.check_migration_status';
		$url = add_query_arg( 'api_key', $api_key, $url ); // Add api_key query parameter.

		$response = wp_remote_get( $url );

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
		return current_user_can( 'manage_options' );
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

		// For Vimeo migration, also track embed block counts.
		if ( 'vimeo' === $migration_type ) {
			$initial_status['vimeo_blocks_found']    = 0;
			$initial_status['vimeo_blocks_migrated'] = 0;
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

		if ( empty( $post_types ) ) {
			$this->update_migration_status_error( $wp_option_key, __( 'No post types with Gutenberg support found', 'godam' ) );
			return;
		}

		// Find all posts that need migration.
		$all_post_ids = $this->find_all_posts_for_migration( $post_types );
		$total_posts  = count( $all_post_ids );

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
		// Track Vimeo embed block counts for this batch.
		$vimeo_found_in_batch    = 0;
		$vimeo_migrated_in_batch = 0;

		foreach ( $post_ids as $post_id ) {
			try {
				// Migrate individual post.
				if ( 'core' === $migration_type ) {
					$post_changed = $this->migrate_single_post_video_blocks( $post_id );
				} elseif ( 'vimeo' === $migration_type ) {
					$result = $this->migrate_single_post_vimeo_blocks( $post_id );
					if ( is_array( $result ) ) {
						$post_changed             = (bool) ( $result['changed'] ?? false );
						$vimeo_found_in_batch    += (int) ( $result['found'] ?? 0 );
						$vimeo_migrated_in_batch += (int) ( $result['migrated'] ?? 0 );
					} else {
						$post_changed = (bool) $result;
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
				// Re-read inside the lock to ensure we have the latest value before increment.
				$migration_status         = get_option( $wp_option_key, array() );
				$migration_status['done'] = ( $migration_status['done'] ?? 0 ) + count( $post_ids );

				// Accumulate Vimeo embed block counts if applicable.
				if ( 'vimeo' === $migration_type ) {
					$migration_status['vimeo_blocks_found']    = ( $migration_status['vimeo_blocks_found'] ?? 0 ) + $vimeo_found_in_batch;
					$migration_status['vimeo_blocks_migrated'] = ( $migration_status['vimeo_blocks_migrated'] ?? 0 ) + $vimeo_migrated_in_batch;
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
						/* translators: 1: total posts processed, 2: migrated Vimeo embeds, 3: total Vimeo embeds found */
							__( 'Migration completed! Processed %1$d posts. Migrated %2$d out of %3$d Vimeo Embed Blocks found.', 'godam' ),
							(int) ( $migration_status['total'] ?? 0 ),
							(int) ( $migration_status['vimeo_blocks_migrated'] ?? 0 ),
							(int) ( $migration_status['vimeo_blocks_found'] ?? 0 )
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
				$migration_status['done'] = ( $migration_status['done'] ?? 0 ) + count( $post_ids );
				update_option( $wp_option_key, $migration_status );
			}
		}

		return $processed_count;
	}

	/**
	 * Acquire a short-lived lock for migration status updates.
	 *
	 * Uses add_option as a mutex. If an existing lock is expired, it will be taken over.
	 *
	 * @since 1.4.0
	 *
	 * @param string $lock_key   Unique option key for the lock.
	 * @param int    $timeout_s  Lock expiry seconds.
	 * @param int    $retry_ms   Milliseconds to wait between retries.
	 * @param int    $max_wait_s Maximum total seconds to wait for the lock.
	 *
	 * @return bool True if the lock was acquired, false otherwise.
	 */
	private function acquire_migration_lock( string $lock_key, int $timeout_s = 5, int $retry_ms = 100, int $max_wait_s = 5 ): bool {
		$lock_expires_at = time() + $timeout_s;
		$deadline        = microtime( true ) + $max_wait_s;

		// First attempt: create the option if it doesn't exist.
		if ( add_option( $lock_key, $lock_expires_at, '', 'no' ) ) {
			return true;
		}

		while ( microtime( true ) < $deadline ) {
			$current = (int) get_option( $lock_key, 0 );
			if ( $current < time() ) {
				// Lock expired; take ownership.
				update_option( $lock_key, $lock_expires_at );
				return true;
			}
			usleep( $retry_ms * 1000 );
		}

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
		delete_option( $lock_key );
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
		$post = get_post( $post_id );

		if ( ! $post || ! has_blocks( $post->post_content ) ) {
			return false;
		}

		$blocks  = parse_blocks( $post->post_content );
		$changed = false;

		$this->traverse_and_migrate_core_video_blocks_recursive( $blocks, $changed );

		if ( $changed ) {
			$new_content = serialize_blocks( $blocks );
			wp_update_post(
				array(
					'ID'           => $post_id,
					'post_content' => $new_content,
				)
			);
		}

		return $changed;
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
				if ( $attachment_id ) {
					$attrs['src'] = wp_get_attachment_url( $attachment_id );
				}

				$sources = $this->build_video_sources_array( $attachment_id );

				// Build default SEO data so the migrated block has SEO populated.
				$seo_data = $this->build_default_seo_data( $attachment_id, $attrs, $sources );

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
	 * Migrate Vimeo video blocks for a single post.
	 *
	 * @since 1.4.0
	 *
	 * @param int $post_id The ID of the post to migrate.
	 *
	 * @return bool|array True if post content was changed, or an array with keys 'changed', 'found', 'migrated' when counting embeds.
	 */
	private function migrate_single_post_vimeo_blocks( $post_id ) {

		$post = get_post( $post_id );

		if ( ! $post || ! has_blocks( $post->post_content ) ) {
			return false;
		}

		$blocks   = parse_blocks( $post->post_content );
		$changed  = false;
		$found    = 0;
		$migrated = 0;

		$this->traverse_and_migrate_vimeo_blocks_recursive( $blocks, (int) $post_id, $found, $migrated, $changed );

		if ( $changed ) {
			$new_content = serialize_blocks( $blocks );
			wp_update_post(
				array(
					'ID'           => $post_id,
					'post_content' => $new_content,
				)
			);
		}

		return array(
			'changed'  => $changed,
			'found'    => $found,
			'migrated' => $migrated,
		);
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
							$video_url = wp_get_attachment_url( $attachment_id );
							if ( ! empty( $video_url ) ) {
								$sources = $this->build_video_sources_array( $attachment_id );

								// Build default SEO data so the migrated block has SEO populated.
								$seo_data = $this->build_default_seo_data( $attachment_id, $attrs, $sources );

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

		$headline    = $attachment instanceof \WP_Post ? get_the_title( $attachment_id ) : '';
		$desc_field  = $attachment instanceof \WP_Post ? get_post_field( 'post_excerpt', $attachment_id ) : '';
		$description = ! empty( $desc_field ) ? $desc_field : ( $attachment instanceof \WP_Post ? get_post_field( 'post_content', $attachment_id ) : '' );

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
		wp_update_post( $attachment_data );

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
		$wpdb->update(
			$wpdb->posts,
			array(
				'guid' => ! empty( $video_info['transcoded_mp4_url'] ) ? $video_info['transcoded_mp4_url'] : $video_info['transcoded_file_path'],
			),
			array(
				'ID' => $attachment_id,
			)
		);

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
		$request_url = add_query_arg(
			array(
				'api_key'   => $api_key,
				'vimeo_url' => $vimeo_video_id,
			),
			$request_url
		);

		// Fetch video info from GoDAM Central.
		$response = wp_remote_get( $request_url );
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
			if ( post_type_supports( $post_type->name, 'editor' ) && use_block_editor_for_post_type( $post_type->name ) && GoDAM_Video::SLUG !== $post_type->name ) {
				$gutenberg_post_types[] = $post_type->name;
			}
		}

		return $gutenberg_post_types;
	}
}
