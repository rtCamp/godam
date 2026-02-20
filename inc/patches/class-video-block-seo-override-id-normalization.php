<?php
/**
 * Patch to normalize GoDAM video block attributes.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Patches;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Post_Types\GoDAM_Video;

/**
 * Class Video_Block_Seo_Override_Id_Normalization
 */
class Video_Block_Seo_Override_Id_Normalization extends Base_Patch {

	/**
	 * Unique patch ID.
	 *
	 * @var string
	 */
	const PATCH_ID = 'video_block_seo_override_id_normalization_1_6_0';

	/**
	 * Target plugin version.
	 *
	 * @var string
	 */
	const TARGET_VERSION = '1.6.0';

	/**
	 * Status option key.
	 *
	 * @var string
	 */
	const STATUS_OPTION = 'rtgodam_patch_video_block_seo_override_id_status';

	/**
	 * Lock option key.
	 *
	 * @var string
	 */
	const LOCK_OPTION = 'rtgodam_patch_video_block_seo_override_id_lock';

	/**
	 * Action hook to discover posts and schedule batches.
	 *
	 * @var string
	 */
	const PREPARE_ACTION = 'godam_patch_prepare_video_block_seo_override_id';

	/**
	 * Action hook to process one patch batch.
	 *
	 * @var string
	 */
	const BATCH_ACTION = 'godam_patch_process_video_block_seo_override_id_batch';

	/**
	 * Batch size for discovering posts.
	 *
	 * @var int
	 */
	const POSTS_PER_PAGE = 1000;

	/**
	 * Batch size for processing post IDs.
	 *
	 * @var int
	 */
	const PROCESS_BATCH_SIZE = 20;

	/**
	 * Register patch hooks.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		add_action( self::PREPARE_ACTION, array( $this, 'prepare_patch' ) );
		add_action( self::BATCH_ACTION, array( $this, 'process_patch_batch' ), 10, 2 );
	}

	/**
	 * Return patch ID.
	 *
	 * @since n.e.x.t
	 *
	 * @return string
	 */
	public function get_patch_id() {
		return self::PATCH_ID;
	}

	/**
	 * Return target version.
	 *
	 * @since n.e.x.t
	 *
	 * @return string
	 */
	public function get_target_version() {
		return self::TARGET_VERSION;
	}

	/**
	 * Schedule patch run.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function maybe_schedule() {
		$status = get_option( self::STATUS_OPTION, array() );

		if ( ! empty( $status['status'] ) && in_array( $status['status'], array( 'queued', 'processing', 'completed' ), true ) ) {
			return;
		}

		$initial_status = array(
			'status'                 => 'queued',
			'total'                  => 0,
			'done'                   => 0,
			'updated_posts'          => 0,
			'seo_override_added'     => 0,
			'virtual_ids_resolved'   => 0,
			'virtual_ids_unresolved' => 0,
			'started'                => current_time( 'mysql' ),
			'completed'              => null,
			'message'                => __( 'Video block patch queued for processing.', 'godam' ),
		);

		update_option( self::STATUS_OPTION, $initial_status );

		if ( function_exists( 'as_enqueue_async_action' ) ) {
			as_enqueue_async_action( self::PREPARE_ACTION );
			return;
		}

		if ( function_exists( 'as_schedule_single_action' ) ) {
			as_schedule_single_action( time() + 1, self::PREPARE_ACTION );
			return;
		}

		$this->prepare_patch();
	}

	/**
	 * Discover all eligible posts and schedule processing batches.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function prepare_patch() {
		$status            = get_option( self::STATUS_OPTION, array() );
		$status['status']  = 'processing';
		$status['message'] = __( 'Finding Gutenberg posts for video block patch.', 'godam' );
		update_option( self::STATUS_OPTION, $status );

		$post_types = $this->get_gutenberg_enabled_post_types();

		if ( empty( $post_types ) ) {
			$this->complete_patch( __( 'No Gutenberg-enabled post types found for patch.', 'godam' ) );
			return;
		}

		$all_post_ids = $this->find_all_post_ids( $post_types );
		$total_posts  = count( $all_post_ids );

		$status['total']   = $total_posts;
		$status['message'] = sprintf(
			/* translators: %d is number of posts discovered for patching. */
			__( 'Found %d posts for video block patch.', 'godam' ),
			$total_posts
		);
		update_option( self::STATUS_OPTION, $status );

		if ( 0 === $total_posts ) {
			$this->complete_patch( __( 'No posts found that need video block patching.', 'godam' ) );
			return;
		}

		$this->schedule_batches( $all_post_ids );
	}

	/**
	 * Process one batch of post IDs.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $post_ids Batch post IDs.
	 * @param int   $batch_number Batch number.
	 *
	 * @return void
	 */
	public function process_patch_batch( $post_ids, $batch_number = 0 ) {
		if ( empty( $post_ids ) || ! is_array( $post_ids ) ) {
			return;
		}

		$processed_count        = 0;
		$updated_posts          = 0;
		$seo_override_added     = 0;
		$virtual_ids_resolved   = 0;
		$virtual_ids_unresolved = 0;

		foreach ( $post_ids as $post_id ) {
			$post_id = (int) $post_id;

			if ( $post_id <= 0 ) {
				continue;
			}

			++$processed_count;

			$result = $this->patch_single_post( $post_id );

			if ( ! empty( $result['changed'] ) ) {
				++$updated_posts;
			}

			$seo_override_added     += (int) ( $result['seo_override_added'] ?? 0 );
			$virtual_ids_resolved   += (int) ( $result['virtual_ids_resolved'] ?? 0 );
			$virtual_ids_unresolved += (int) ( $result['virtual_ids_unresolved'] ?? 0 );
		}

		$this->update_patch_status(
			$processed_count,
			$updated_posts,
			$seo_override_added,
			$virtual_ids_resolved,
			$virtual_ids_unresolved,
			(int) $batch_number
		);
	}

	/**
	 * Patch all eligible blocks for a single post.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $post_id Post ID.
	 *
	 * @return array
	 */
	private function patch_single_post( $post_id ) {
		$post = get_post( $post_id );

		if ( ! $post || ! has_blocks( $post->post_content ) ) {
			return array(
				'changed'                => false,
				'seo_override_added'     => 0,
				'virtual_ids_resolved'   => 0,
				'virtual_ids_unresolved' => 0,
			);
		}

		$blocks  = parse_blocks( $post->post_content );
		$changed = false;
		$stats   = array(
			'seo_override_added'     => 0,
			'virtual_ids_resolved'   => 0,
			'virtual_ids_unresolved' => 0,
		);

		$this->traverse_video_blocks_recursive( $blocks, $stats, $changed );

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
			'changed'                => $changed,
			'seo_override_added'     => $stats['seo_override_added'],
			'virtual_ids_resolved'   => $stats['virtual_ids_resolved'],
			'virtual_ids_unresolved' => $stats['virtual_ids_unresolved'],
		);
	}

	/**
	 * Traverse nested blocks and patch `godam/video` block attributes.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $blocks Parsed block tree.
	 * @param array $stats Patch counters.
	 * @param bool  $changed Whether post content changed.
	 *
	 * @return void
	 */
	private function traverse_video_blocks_recursive( array &$blocks, array &$stats, bool &$changed ) {
		foreach ( $blocks as &$block ) {
			$block_name = $block['blockName'] ?? '';

			if ( 'godam/video' === $block_name ) {
				$attrs         = isset( $block['attrs'] ) && is_array( $block['attrs'] ) ? $block['attrs'] : array();
				$block_changed = false;

				if ( ! array_key_exists( 'seoOverride', $attrs ) ) {
					$attrs['seoOverride'] = false;
					++$stats['seo_override_added'];
					$block_changed = true;
				}

				if ( isset( $attrs['id'] ) && '' !== $attrs['id'] && ! is_numeric( $attrs['id'] ) ) {
					$attachment_id = $this->resolve_attachment_id_from_virtual_id( (string) $attrs['id'] );

					if ( $attachment_id > 0 ) {
						$attrs['id'] = $attachment_id;
						++$stats['virtual_ids_resolved'];
						$block_changed = true;
					} else {
						++$stats['virtual_ids_unresolved'];
					}
				}

				if ( $block_changed ) {
					$block['attrs'] = $attrs;
					$changed        = true;
				}
			}

			if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
				$this->traverse_video_blocks_recursive( $block['innerBlocks'], $stats, $changed );
			}
		}
	}

	/**
	 * Resolve non-numeric GoDAM media ID into WordPress attachment ID.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $virtual_id Virtual/media job ID.
	 *
	 * @return int
	 */
	private function resolve_attachment_id_from_virtual_id( $virtual_id ) {
		$virtual_id = sanitize_text_field( $virtual_id );

		if ( empty( $virtual_id ) || is_numeric( $virtual_id ) ) {
			return 0;
		}

		$attachment_id = (int) rtgodam_get_post_id_by_meta_key_and_value( '_godam_original_id', $virtual_id );

		if ( $this->is_valid_attachment_id( $attachment_id ) ) {
			return $attachment_id;
		}

		$attachment_id = (int) rtgodam_get_post_id_by_meta_key_and_value( 'rtgodam_transcoding_job_id', $virtual_id );

		return $this->is_valid_attachment_id( $attachment_id ) ? $attachment_id : 0;
	}

	/**
	 * Find all posts for Gutenberg-enabled post types.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $post_types Eligible post types.
	 *
	 * @return array
	 */
	private function find_all_post_ids( $post_types ) {
		$all_post_ids = array();

		foreach ( $post_types as $post_type ) {
			$offset = 0;

			do {
				$posts = get_posts( // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts
					array(
						'post_type'              => $post_type,
						'posts_per_page'         => self::POSTS_PER_PAGE,
						'offset'                 => $offset,
						'post_status'            => 'any',
						'fields'                 => 'ids',
						'orderby'                => 'ID',
						'order'                  => 'ASC',
						'no_found_rows'          => true,
						'update_post_meta_cache' => false,
						'update_post_term_cache' => false,
					)
				);

				$post_count = is_array( $posts ) ? count( $posts ) : 0;

				if ( $post_count > 0 ) {
					$all_post_ids = array_merge( $all_post_ids, $posts );
				}

				$offset += self::POSTS_PER_PAGE;
			} while ( self::POSTS_PER_PAGE === $post_count );
		}

		return $all_post_ids;
	}

	/**
	 * Schedule patch batches.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $all_post_ids All post IDs.
	 *
	 * @return void
	 */
	private function schedule_batches( $all_post_ids ) {
		$batch_number = 0;
		$length       = count( $all_post_ids );
		$scheduled    = false;

		for ( $i = 0; $i < $length; $i += self::PROCESS_BATCH_SIZE ) {
			$batch_post_ids = array_slice( $all_post_ids, $i, self::PROCESS_BATCH_SIZE );
			++$batch_number;

			if ( function_exists( 'as_schedule_single_action' ) ) {
				as_schedule_single_action(
					time() + $batch_number,
					self::BATCH_ACTION,
					array( $batch_post_ids, $batch_number )
				);
				$scheduled = true;
				continue;
			}

			if ( function_exists( 'as_enqueue_async_action' ) ) {
				as_enqueue_async_action(
					self::BATCH_ACTION,
					array( $batch_post_ids, $batch_number )
				);
				$scheduled = true;
				continue;
			}

			$this->process_patch_batch( $batch_post_ids, $batch_number );
		}

		if ( $scheduled ) {
			$status            = get_option( self::STATUS_OPTION, array() );
			$status['message'] = sprintf(
				/* translators: %d is number of patch batches. */
				__( 'Scheduled %d patch batches.', 'godam' ),
				$batch_number
			);
			update_option( self::STATUS_OPTION, $status );
		}
	}

	/**
	 * Validate whether a post ID points to an attachment.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $attachment_id Candidate attachment ID.
	 *
	 * @return bool
	 */
	private function is_valid_attachment_id( $attachment_id ) {
		if ( empty( $attachment_id ) || ! is_numeric( $attachment_id ) ) {
			return false;
		}

		$attachment = get_post( (int) $attachment_id );

		return ( $attachment && 'attachment' === $attachment->post_type );
	}

	/**
	 * Update patch status safely.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $processed_count Processed posts in current batch.
	 * @param int $updated_posts Updated posts in current batch.
	 * @param int $seo_override_added Added seoOverride count.
	 * @param int $virtual_ids_resolved Resolved virtual ID count.
	 * @param int $virtual_ids_unresolved Unresolved virtual ID count.
	 * @param int $batch_number Current batch number.
	 *
	 * @return void
	 */
	private function update_patch_status( $processed_count, $updated_posts, $seo_override_added, $virtual_ids_resolved, $virtual_ids_unresolved, $batch_number ) {
		$lock_acquired = $this->acquire_patch_lock( self::LOCK_OPTION );

		if ( ! $lock_acquired ) {
			return;
		}

		try {
			$status = get_option( self::STATUS_OPTION, array() );

			$status['done']                   = (int) ( $status['done'] ?? 0 ) + (int) $processed_count;
			$status['updated_posts']          = (int) ( $status['updated_posts'] ?? 0 ) + (int) $updated_posts;
			$status['seo_override_added']     = (int) ( $status['seo_override_added'] ?? 0 ) + (int) $seo_override_added;
			$status['virtual_ids_resolved']   = (int) ( $status['virtual_ids_resolved'] ?? 0 ) + (int) $virtual_ids_resolved;
			$status['virtual_ids_unresolved'] = (int) ( $status['virtual_ids_unresolved'] ?? 0 ) + (int) $virtual_ids_unresolved;
			$status['status']                 = 'processing';
			$status['message']                = sprintf(
				/* translators: %d is current patch batch number. */
				__( 'Processed patch batch %d.', 'godam' ),
				$batch_number
			);

			if ( ! empty( $status['total'] ) && (int) $status['done'] >= (int) $status['total'] ) {
				$status['done']      = (int) $status['total'];
				$status['status']    = 'completed';
				$status['completed'] = current_time( 'mysql' );
				$status['message']   = __( 'Video block patch completed successfully.', 'godam' );

				Runner::get_instance()->mark_patch_as_applied( $this->get_patch_id() );
			}

			update_option( self::STATUS_OPTION, $status );
		} finally {
			$this->release_patch_lock( self::LOCK_OPTION );
		}
	}

	/**
	 * Mark patch complete when there are no eligible posts.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $message Completion message.
	 *
	 * @return void
	 */
	private function complete_patch( $message ) {
		$status              = get_option( self::STATUS_OPTION, array() );
		$status['status']    = 'completed';
		$status['completed'] = current_time( 'mysql' );
		$status['message']   = $message;
		update_option( self::STATUS_OPTION, $status );

		Runner::get_instance()->mark_patch_as_applied( $this->get_patch_id() );
	}

	/**
	 * Acquire a short-lived option lock.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $lock_key Lock option key.
	 * @param int    $timeout_s Lock expiry time in seconds.
	 * @param int    $retry_ms Sleep between retries in milliseconds.
	 * @param int    $max_wait_s Maximum wait time in seconds.
	 *
	 * @return bool
	 */
	private function acquire_patch_lock( $lock_key, $timeout_s = 5, $retry_ms = 100, $max_wait_s = 5 ) {
		$start = time();

		while ( ( time() - $start ) <= $max_wait_s ) {
			if ( add_option( $lock_key, time(), '', 'no' ) ) {
				return true;
			}

			$existing_lock_time = (int) get_option( $lock_key, 0 );

			if ( $existing_lock_time > 0 && ( time() - $existing_lock_time ) > $timeout_s ) {
				delete_option( $lock_key );
			}

			usleep( $retry_ms * 1000 );
		}

		return false;
	}

	/**
	 * Release patch option lock.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $lock_key Lock option key.
	 *
	 * @return void
	 */
	private function release_patch_lock( $lock_key ) {
		delete_option( $lock_key );
	}

	/**
	 * Get Gutenberg-enabled post types.
	 *
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	private function get_gutenberg_enabled_post_types() {
		$post_types           = get_post_types( array( 'public' => true ), 'objects' );
		$gutenberg_post_types = array();

		foreach ( $post_types as $post_type ) {
			if ( post_type_supports( $post_type->name, 'editor' ) && use_block_editor_for_post_type( $post_type->name ) && GoDAM_Video::SLUG !== $post_type->name ) {
				$gutenberg_post_types[] = $post_type->name;
			}
		}

		return $gutenberg_post_types;
	}
}
