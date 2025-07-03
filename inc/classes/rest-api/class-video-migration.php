<?php
/**
 * Register REST API endpoints for Video Migration.
 * 
 * This class handles the migration of Vimeo videos in Gutenberg blocks.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class Video_Migration
 * 
 * 
 * @since n.e.x.t
 */
class Video_Migration extends Base {

	public function __construct() {
		parent::__construct();

		add_action( 'godam_process_full_video_migration', array( $this, 'process_full_video_migration' ) );
		add_action( 'godam_migrate_post_batch_video_blocks', array( $this, 'migrate_post_batch_video_blocks' ), 10, 3 );
	}

	/**
	 * Get REST routes.
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
	 * Permission callback for video migration endpoints.
	 * 
	 * @since n.e.x.t
	 * 
	 * @return bool True if the user has permission, false otherwise.
	 */
	public function check_video_migration_permission() {
		// Check if the user has the capability to manage options.
		// return current_user_can( 'manage_options' );
		return true;
	}

	/**
	 * Migrate Vimeo videos in Gutenberg blocks.
	 * 
	 * This endpoint initiates the migration process for Vimeo videos in Gutenberg blocks.
	 * It queues a background action to process all posts that need migration.
	 * 
	 * @since n.e.x.t
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

		$migration_status = get_option( $wp_option_key, array() );

		if ( ! empty( $migration_status ) && $migration_status['status'] === 'processing' ) {
			return rest_ensure_response( $migration_status );
		}

		// Initialize migration status.
		$initial_status = array(
			'total'     => 0,
			'done'      => 0,
			'started'   => current_time( 'mysql' ),
			'completed' => null,
			'status'    => 'processing', // pending | processing | completed | error.
			'message'   => 'Migration queued for processing',
		);
		
		update_option( $wp_option_key, $initial_status );

		// Schedule a single background action to handle everything.
		as_enqueue_async_action( 
			'godam_process_full_video_migration', 
			array( 'migration_type' => $migration_type ) 
		);

		return rest_ensure_response( $initial_status );
	}

	/**
	 * Process the full migration in background
	 * This runs as a scheduled action and handles finding + migrating all posts
	 * 
	 * @since n.e.x.t
	 * 
	 * @return void
	 */
	public function process_full_video_migration( $migration_type ) {
		
		if ( ! in_array( $migration_type, array( 'core', 'vimeo' ), true ) ) {
			error_log( 'Invalid migration type specified: ' . $migration_type );
			return;
		}
		
		$wp_option_key = 'godam_' . $migration_type . '_video_migration_status';

		error_log( 'Starting full Vimeo migration process in background' );
		
		// Update status to processing.
		$status            = get_option( $wp_option_key, array() );
		$status['status']  = 'processing';
		$status['message'] = 'Finding all posts to migrate';
		update_option( $wp_option_key, $status );

		// Get all post types that support Gutenberg editor.
		$post_types = $this->get_gutenberg_enabled_post_types();
		
		if ( empty( $post_types ) ) {
			$this->update_migration_status_error( $wp_option_key, 'No post types with Gutenberg support found' );
			return;
		}

		error_log( 'Gutenberg supported post types: ' . print_r( $post_types, true ) );

		// Find all posts that need migration.
		$all_post_ids = $this->find_all_posts_for_migration( $post_types );
		$total_posts  = count( $all_post_ids );
		
		if ( $total_posts === 0 ) {
			$this->complete_migration_with_no_posts( $wp_option_key );
			return;
		}

		// Update status with total count.
		$status['total']   = $total_posts;
		$status['message'] = "Found {$total_posts} posts to process";
		update_option( $wp_option_key, $status );

		error_log( "Found {$total_posts} posts total for migration" );

		// Process posts in batches.
		$this->process_posts_in_batches( $migration_type, $all_post_ids );
	}

	/**
	 * Find all posts that need migration across all post types
	 * 
	 * @since n.e.x.t
	 * 
	 * @param array $post_types Array of post type names to search for.
	 * 
	 * @return array Array of post IDs that need migration.
	 */
	private function find_all_posts_for_migration( $post_types ) {
		$all_post_ids   = array();
		$posts_per_page = 1000; // Process 1000 posts at a time to prevent memory issues.
		
		foreach ( $post_types as $post_type ) {
			error_log( "Finding posts for post type: {$post_type}" );
			
			$offset          = 0;
			$post_type_total = 0;
			
			do {
				$posts = get_posts(
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
				
				if ( ! empty( $posts ) ) {
					$all_post_ids     = array_merge( $all_post_ids, $posts );
					$post_type_total += count( $posts );
					
					error_log( 'Found ' . count( $posts ) . " posts in {$post_type} (offset: {$offset})" );
					
					// Add a small delay to prevent overwhelming the database.
					sleep( 1 ); // 1 second delay.
				}
				
				$offset += $posts_per_page;
				
				// Safety check: if we're processing too many posts, we might want to log a warning.
				if ( $post_type_total > 50000 ) {
					error_log( "Warning: {$post_type} has over 50,000 posts. Consider adding filters to reduce dataset." );
				}           
			} while ( count( $posts ) === $posts_per_page );
			
			if ( $post_type_total > 0 ) {
				error_log( "Total posts found in {$post_type}: {$post_type_total}" );
			}
		}
		
		error_log( 'Total posts found across all post types: ' . count( $all_post_ids ) );
		return $all_post_ids;
	}

	/**
	 * Process all posts in manageable batches.
	 * 
	 * @since n.e.x.t
	 * 
	 * @param string $migration_type The type of migration being processed (e.g., 'core', 'vimeo').
	 * @param array $all_post_ids Array of all post IDs to process.
	 * 
	 * @return void
	 */
	private function process_posts_in_batches( $migration_type, $all_post_ids ) {
		$batch_size    = 20;
		$total_batches = ceil( count( $all_post_ids ) / $batch_size );
		$batch_number  = 0;
		
		error_log( "Processing {$total_batches} batches of {$batch_size} posts each" );
		
		// Split posts into batches and schedule each batch.
		for ( $i = 0; $i < count( $all_post_ids ); $i += $batch_size ) {
			$batch_post_ids = array_slice( $all_post_ids, $i, $batch_size );
			++$batch_number;
			
			// Schedule each batch with a slight delay to prevent overwhelming.
			as_schedule_single_action(
				time() + ( $batch_number * 2 ), // 2 second delay between batches.
				'godam_migrate_post_batch_video_blocks',
				array(
					'migration_type' => $migration_type,
					'post_ids'       => $batch_post_ids,
					'batch_number'   => $batch_number,
				)
			);
		}
		
		error_log( "Scheduled {$batch_number} batches for processing" );
		
		// Update status.
		$status            = get_option( 'godam_vimeo_video_migration_status', array() );
		$status['message'] = "Scheduled {$batch_number} batches for processing";
		update_option( 'godam_vimeo_video_migration_status', $status );
	}

	/**
	 * Handle migration completion when no posts found.
	 * 
	 * @since n.e.x.t
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
			'message'   => 'No posts found that need migration',
		);
		
		update_option( $wp_option_key, $status );
		error_log( 'Migration completed - no posts found that need migration' );
	}

	/**
	 * Update status with error message
	 * 
	 * @since n.e.x.t
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
		
		error_log( 'Migration error: ' . $error_message );
	}

	/**
	 * Enhanced batch processing with better error handling.
	 * 
	 * @since n.e.x.t
	 * 
	 * @param string $migration_type The type of migration being processed (e.g., 'core', 'vimeo').
	 * @param array $post_ids Array of post IDs to process in this batch.
	 * @param int   $batch_number The current batch number.
	 * 
	 * @return int Number of posts processed in this batch.
	 */
	public function migrate_post_batch_video_blocks( $migration_type, $post_ids, $batch_number = 0 ) {

		if ( ! in_array( $migration_type, array( 'core', 'vimeo' ), true ) ) {
			error_log( 'Invalid migration type specified: ' . $migration_type );
			return 0;
		}


		if ( empty( $post_ids ) || ! is_array( $post_ids ) ) {
			error_log( "Invalid post_ids for batch #{$batch_number}" );
			return;
		}

		error_log( "Processing batch #{$batch_number} for migration type: {$migration_type}" );

		$wp_option_key = 'godam_' . $migration_type . '_video_migration_status';

		$migration_status = get_option( $wp_option_key, array() );

		$processed_count = 0;
		
		foreach ( $post_ids as $post_id ) {
			try {
				// Migrate individual post.
				if ( 'core' === $migration_type ) {
					$post_changed = $this->migrate_single_post_video_blocks( $post_id );
				} elseif ( 'vimeo' === $migration_type ) {
					$post_changed = $this->migrate_single_post_vimeo_blocks( $post_id );
				}
				
				if ( $post_changed ) {
					++$processed_count;
				}
				
				// Small delay to prevent server overload.
				usleep( 50000 ); // 0.05 second delay.
				
			} catch ( Exception $e ) {
				error_log( "Error processing post {$post_id} in batch #{$batch_number}: " . $e->getMessage() );
			}
		}
		
		// Update the migration status.
		if ( ! empty( $migration_status ) ) {
			$migration_status['done'] = ( $migration_status['done'] ?? 0 ) + count( $post_ids );
			
			// Calculate progress percentage.
			$progress = 0;
			if ( $migration_status['total'] > 0 ) {
				$progress = round( ( $migration_status['done'] / $migration_status['total'] ) * 100, 2 );
			}
			
			$migration_status['message'] = "Processed {$migration_status['done']}/{$migration_status['total']} posts ({$progress}%)";
			
			// Check if migration is complete.
			if ( $migration_status['done'] >= $migration_status['total'] ) {
				$migration_status['status']    = 'completed';
				$migration_status['completed'] = current_time( 'mysql' );
				$migration_status['message']   = "Migration completed! Processed {$migration_status['total']} posts.";
				
				error_log( 'Vimeo migration completed successfully' );
			}
			
			update_option( $wp_option_key, $migration_status );
		}
		
		return $processed_count;
	}

	/**
	 * Migrate video blocks for a single post.
	 * 
	 * @since n.e.x.t
	 *
	 * @param int $post_id The ID of the post to migrate.
	 *
	 * @return bool True if post content was changed, false otherwise.
	 */
	private function migrate_single_post_video_blocks( $post_id ) {

		error_log( "Migrating post ID: {$post_id}" );

		$post = get_post( $post_id );
		
		if ( ! $post || ! has_blocks( $post->post_content ) ) {
			return false;
		}
		
		$blocks  = parse_blocks( $post->post_content );
		$changed = false;

		foreach ( $blocks as &$block ) {
			if ( 'core/video' === $block['blockName'] ) {
				$attrs = $block['attrs'] ?? array();

				error_log( 'Replacing block: ' . print_r( $block, true ) );

				if ( $attrs['id'] ) {
					$attrs['src'] = wp_get_attachment_url( $attrs['id'] );
				}

				// Transform to custom block with attributes.
				$block = array(
					'blockName'    => 'godam/video',
					'attrs'        => array(
						'id'       => $attrs['id'] ?? '',
						'src'      => $attrs['src'] ?? '',
						'autoplay' => $attrs['autoplay'] ?? false,
						'loop'     => $attrs['loop'] ?? false,
						'muted'    => $attrs['muted'] ?? false,
						'controls' => $attrs['controls'] ?? true,
						'poster'   => $attrs['poster'] ?? '',
						'preload'  => $attrs['preload'] ?? 'metadata',
						'caption'  => $attrs['caption'] ?? '',
						'seo'      => array(),
					),
					'innerContent' => '<div class="wp-block-godam-video"></div>',
					'innerBlocks'  => array(),
				);

				$changed = true;
			}
		}

		if ( $changed ) {
			$new_content = serialize_blocks( $blocks );
			wp_update_post(
				array(
					'ID'           => $post_id,
					'post_content' => $new_content,
				)
			);
		}

		error_log( "Post ID {$post_id} migration " . ( $changed ? 'succeeded' : 'skipped (no changes)' ) );
		
		return $changed;
	}

	/**
	 * Migrate Vimeo video blocks for a single post.
	 * 
	 * @since n.e.x.t
	 *
	 * @param int $post_id The ID of the post to migrate.
	 *
	 * @return bool True if post content was changed, false otherwise.
	 */
	private function migrate_single_post_vimeo_blocks( $post_id ) {
		error_log( "Migrating post ID: {$post_id}" );

		$post = get_post( $post_id );

		if ( ! $post || ! has_blocks( $post->post_content ) ) {
			return false;
		}
		
		$blocks  = parse_blocks( $post->post_content );
		$changed = false;

		foreach ( $blocks as &$block ) {
			if ( 'core/video' === $block['blockName'] ) {
				$attrs = $block['attrs'] ?? array();

				if ( 'vimeo' !== $attrs['providerNameSlug'] ) {
					// Skip if not a Vimeo video block.
					continue;
				}

				$vimeo_url = $attrs['url'] ?? '';

				// Create attachment from Vimeo URL.
				$this->create_attachment_form_vimeo_video( $vimeo_url );

				// ToDo: Replace block with custom video block.
			}
		}

		if ( $changed ) {
			$new_content = serialize_blocks( $blocks );
			wp_update_post(
				array(
					'ID'           => $post_id,
					'post_content' => $new_content,
				)
			);
		}

		error_log( "Post ID {$post_id} migration " . ( $changed ? 'succeeded' : 'skipped (no changes)' ) );
		
		return $changed;
	}

	private function create_attachment_form_vimeo_video( $vimeo_url ) {
		// ToDo: Implement logic to create an attachment from the Vimeo URL.
		
		error_log( "Creating attachment from Vimeo URL: {$vimeo_url}" );
	}

	/**
	 * Get the current migration status.
	 * 
	 * @since n.e.x.t
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
				'status'    => 'pending', //  processing | completed | error.
			);
		}

		return rest_ensure_response( $migration_status );
	}

	/**
	 * Get all post types that have Gutenberg editor enabled.
	 * 
	 * @since n.e.x.t
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
