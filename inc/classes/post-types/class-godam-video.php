<?php
/**
 * Register GoDAM Video custom post type.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Post_Types;

defined( 'ABSPATH' ) || exit;

use WP_Query;
use RTGODAM\Inc\Video_Permalinks;

/**
 * Class GoDAM_Video.
 */
class GoDAM_Video extends Base {

	/**
	 * Slug of post type.
	 *
	 * @var string
	 */
	const SLUG = 'godam-video';

	/**
	 * Setup hooks for the post type.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		parent::setup_hooks();

		add_action( 'add_attachment', array( $this, 'create_video_post_from_attachment' ) );
		add_action( 'edit_attachment', array( $this, 'update_video_post_from_attachment' ) );
		add_action( 'delete_attachment', array( $this, 'delete_video_post_from_attachment' ) );
		add_action( 'save_post_attachment', array( $this, 'sync_attachment_to_video_post' ), 10, 3 );
		
		// Handle direct URL access based on user settings.
		add_action( 'template_redirect', array( $this, 'handle_url_access' ) );
		add_filter( 'attachment_fields_to_edit', array( $this, 'add_custom_attachment_fields' ), 10, 2 );
		add_filter( 'attachment_fields_to_save', array( $this, 'save_custom_attachment_fields' ) );
	}

	/**
	 * Add custom fields to the attachment edit screen.
	 *
	 * @param array   $form_fields Existing form fields.
	 * @param WP_Post $post        The attachment post object.
	 *
	 * @return array Modified form fields.
	 */
	public function add_custom_attachment_fields( $form_fields, $post ) {
		if ( ! $this->is_video_attachment( $post->ID ) ) {
			return $form_fields;
		}

		$godam_video_id = $this->get_godam_video_from_attachment( $post->ID );

		// If no video post exists, create one.
		if ( ! $godam_video_id ) {
			$godam_video_id = $this->create_video_post_from_attachment( $post->ID );

			// If creation failed, return original fields.
			if ( ! $godam_video_id ) {
				return $form_fields;
			}
		}

		/**
		 * Filters an array of metaboxes display on the godam video edit screen.
		 *
		 * Each metabox should have an 'id', 'title', and 'render_callback'.
		 *  - The 'id' is used as the field name.
		 *  - The 'title' is displayed as the label.
		 *  - The 'render_callback' should be a callable that outputs the HTML for the field. The parameter `$godam_video_id` the current video post ID is passed to the callback.
		 *
		 * @param array $metaboxes An array of metaboxes.
		 * @param int   $post_id   The video post ID.
		 */
		$metaboxes = apply_filters( 'godam_register_video_meta_boxes', array(), $godam_video_id );

		foreach ( $metaboxes as $metabox ) {
			// Check if the id, title, and render_callback are set.
			if ( ! isset( $metabox['id'], $metabox['title'], $metabox['render_callback'] ) ) {
				continue;
			}

			ob_start();

			if ( is_callable( $metabox['render_callback'] ) ) {
				call_user_func( $metabox['render_callback'], $godam_video_id );
			}

			$field_html = ob_get_clean();

			$form_fields[ $metabox['id'] ] = array(
				'label' => $metabox['title'],
				'input' => 'html',
				'html'  => $field_html,
			);
		}

		return $form_fields;
	}

	/**
	 * Save custom fields from the attachment edit screen.
	 *
	 * @param array $attachment_data The attachment data.
	 *
	 * @return array Modified attachment data.
	 */
	public function save_custom_attachment_fields( $attachment_data ) {
		if ( ! $this->is_video_attachment( $attachment_data['ID'] ) ) {
			return $attachment_data;
		}

		$godam_video_id = $this->get_godam_video_from_attachment( $attachment_data['ID'] );

		// If no video post exists, create one.
		if ( ! $godam_video_id ) {
			$godam_video_id = $this->create_video_post_from_attachment( $attachment_data['ID'] );
			
			// If creation failed, return original attachment data.
			if ( ! $godam_video_id ) {
				return $attachment_data;
			}
		}

		/**
		 * Fires saving the godam video.
		 *  - This action allows other plugins or themes to save additional metadata registered via `godam_register_video_meta_boxes`.
		 *  - Also allows to perform additional actions when a GoDAM video post is saved.
		 *  - The updated video meta can be accessed from the global $_POST variable.
		 *
		 * @param int $godam_video_id The ID of the GoDAM video post being saved.
		 */
		do_action( 'godam_save_video_meta', $godam_video_id );

		return $attachment_data;
	}
	
	/**
	 * Labels for post type.
	 *
	 * @return array
	 */
	public function get_labels() {

		return array(
			'name'          => _x( 'GoDAM Videos', 'Post Type General Name', 'godam' ),
			'singular_name' => _x( 'GoDAM Video', 'Post Type Singular Name', 'godam' ),
			'archives'      => __( 'Video Archives', 'godam' ),
		);
	}

	/**
	 * Get arguments for post type.
	 *
	 * @return array
	 */
	public function get_args() {
		$allow_archive = $this->get_allow_archive();
		$allow_single  = $this->get_allow_single();
		
		// Determine rewrite rules based on settings.
		$rewrite = false;
		if ( $allow_archive || $allow_single ) {
			$rewrite = array(
				'slug'       => $this->get_rewrite_slug(),
				'with_front' => false,
			);
		}

		return array(
			'label'               => __( 'GoDAM Video', 'godam' ),
			'description'         => __( 'GoDAM Video posts for theme template support', 'godam' ),
			'labels'              => $this->get_labels(),
			'supports'            => array( 'title', 'editor', 'excerpt', 'author', 'custom-fields' ),
			'taxonomies'          => array( 'category', 'post_tag' ),
			'hierarchical'        => false,
			'public'              => true, 
			'publicly_queryable'  => true, // Always true for Query Loop compatibility.
			'exclude_from_search' => ! $allow_single, // Respect user setting for search visibility.
			'show_ui'             => false,
			'has_archive'         => $allow_archive,
			'show_in_rest'        => true, // Also needed for Query Loop block.
			'rewrite'             => $rewrite,
		);
	}

	/**
	 * Get rewrite slug from plugin settings or default.
	 *
	 * @return string
	 */
	private function get_rewrite_slug() {
		$settings = get_option( Video_Permalinks::OPTION_SLUG, false );
		
		// Fallback to old option if new settings don't exist.
		if ( false === $settings || ! isset( $settings['video_slug'] ) ) {
			return get_option( 'rtgodam_video_slug', Video_Permalinks::DEFAULT_VIDEO_SLUG );
		}
		
		return $settings['video_slug'];
	}
	
	/**
	 * Get allow_archive setting from plugin options.
	 * 
	 * @since 1.3.1
	 *
	 * @return bool
	 */
	private function get_allow_archive() {
		$settings = get_option( Video_Permalinks::OPTION_SLUG, array( 'allow_archive' => false ) );
		return (bool) ( isset( $settings['allow_archive'] ) ? $settings['allow_archive'] : false );
	}
	
	/**
	 * Get allow_single setting from plugin options.
	 * 
	 * @since 1.3.1
	 *
	 * @return bool
	 */
	private function get_allow_single() {
		$settings = get_option( Video_Permalinks::OPTION_SLUG, array( 'allow_single' => false ) );
		return (bool) ( isset( $settings['allow_single'] ) ? $settings['allow_single'] : false );
	}

	/**
	 * Create video post from attachment when media is uploaded.
	 *
	 * @param int $attachment_id Attachment ID.
	 * 
	 * @return int|false Post ID on success, false on failure.
	 */
	public function create_video_post_from_attachment( $attachment_id ) {

		// Check if attachment is a video.
		if ( ! $this->is_video_attachment( $attachment_id ) ) {
			return false;
		}

		$godam_video_id = $this->get_godam_video_from_attachment( $attachment_id );

		// Check if video post already exists for this attachment.
		if ( $godam_video_id ) {
			return $godam_video_id;
		}

		// Get attachment data.
		$attachment = get_post( $attachment_id );
		if ( ! $attachment ) {
			return false;
		}

		// Prepare post data.
		$post_data = array(
			'post_title'   => $attachment->post_title ?: __( 'Untitled Video', 'godam' ),
			'post_content' => $this->generate_video_content( $attachment_id ),
			'post_excerpt' => $attachment->post_content,
			'post_status'  => 'publish',
			'post_author'  => $attachment->post_author,
			'post_type'    => self::SLUG,
		);

		// Create the post entry.
		$post_id = wp_insert_post( $post_data );

		if ( empty( $post_id ) || is_wp_error( $post_id ) ) {
			return false;
		}

		// Store attachment ID as meta.
		update_post_meta( $post_id, '_godam_attachment_id', $attachment_id );

		// Sync taxonomies.
		$this->sync_attachment_taxonomies( $attachment_id, $post_id );

		return $post_id;
	}

	/**
	 * Update video post when attachment is updated.
	 *
	 * @param int $attachment_id Attachment ID.
	 * 
	 * @return void
	 */
	public function update_video_post_from_attachment( $attachment_id ) {

		if ( ! $this->is_video_attachment( $attachment_id ) ) {
			return;
		}

		$this->sync_attachment_to_video_post( $attachment_id );
	}

	/**
	 * Delete video post when attachment is deleted.
	 * Ideally only one post is deleted, but deletion handed by loop to ensure all related posts are removed.
	 *
	 * @param int $attachment_id Attachment ID.
	 * 
	 * @return void
	 */
	public function delete_video_post_from_attachment( $attachment_id ) {

		$batch_size = 50;
		$page       = 1;

		do {
			$query = new WP_Query(
				array(
					'post_type'              => self::SLUG,
					'posts_per_page'         => $batch_size,
					'paged'                  => $page,
					'post_status'            => 'any',
					'fields'                 => 'ids',
					'no_found_rows'          => true,
					'update_post_term_cache' => false,
					'meta_query'             => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- needed to check linked video post.
						array(
							'key'   => '_godam_attachment_id',
							'value' => $attachment_id,
						),
					),
				) 
			);

			if ( $query->have_posts() ) {
				foreach ( $query->posts as $post_id ) {
					wp_delete_post( $post_id, true );
				}
			}

			++$page;
			$has_more = count( $query->posts ) === $batch_size;

		} while ( $has_more );
	}

	/**
	 * Sync attachment data to video post.
	 *
	 * @param int     $post_id   Post ID.
	 * @param WP_Post $post Post object.
	 * 
	 * @return void
	 */
	public function sync_attachment_to_video_post( $post_id, $post = null ) {

		// If called from save_post hook, $post_id is the attachment ID.
		$attachment_id = $post_id;
		
		// If called directly, $post_id might be the video post ID.
		if ( $post && 'attachment' !== $post->post_type ) {
			return;
		}

		if ( ! $this->is_video_attachment( $attachment_id ) ) {
			return;
		}

		// Find the corresponding video post.
		$video_post_id = $this->get_godam_video_from_attachment( $attachment_id );
		if ( ! $video_post_id ) {
			// If no video post exists, create one.
			$this->create_video_post_from_attachment( $attachment_id );
			return;
		}
		
		$attachment = get_post( $attachment_id );
		$new_title  = $attachment->post_title ?: __( 'Untitled Video', 'godam' );

		// Get current title from the post we already have.
		$current_title = get_the_title( $video_post_id );

		// Prepare base update data.
		$updated_data = array(
			'ID'           => $video_post_id,
			'post_title'   => $new_title,
			'post_content' => $this->generate_video_content( $attachment_id ),
			'post_excerpt' => $attachment->post_content,
			'post_author'  => $attachment->post_author,
		);

		/**
		 * Update post slug if the title has changed.
		 */
		if ( $new_title !== $current_title ) {
			// Generate unique slug based on new title.
			$new_slug                  = wp_unique_post_slug(
				sanitize_title( $new_title ),
				$video_post_id,
				'publish',
				self::SLUG,
				0
			);
			$updated_data['post_name'] = $new_slug;
		}

		wp_update_post( $updated_data );

		// Sync taxonomies.
		$this->sync_attachment_taxonomies( $attachment_id, $video_post_id );
	}

	/**
	 * Sync taxonomies from attachment to video post.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @param int $post_id       Video post ID.
	 * 
	 * @return void
	 */
	private function sync_attachment_taxonomies( $attachment_id, $post_id ) {

		$categories = wp_get_post_terms( $attachment_id, 'category' );
		$tags       = wp_get_post_terms( $attachment_id, 'post_tag' );

		if ( ! is_wp_error( $categories ) && ! empty( $categories ) ) {
			$category_ids = wp_list_pluck( $categories, 'term_id' );
			wp_set_post_terms( $post_id, $category_ids, 'category' );
		}

		if ( ! is_wp_error( $tags ) && ! empty( $tags ) ) {
			$tag_ids = wp_list_pluck( $tags, 'term_id' );
			wp_set_post_terms( $post_id, $tag_ids, 'post_tag' );
		}
	}

	/**
	 * Generate video content with GoDAM player block.
	 *
	 * @param int $attachment_id Attachment ID.
	 * 
	 * @return string Generated content.
	 */
	private function generate_video_content( $attachment_id ) {
		return sprintf( 
			'<!-- wp:godam/video {"id":%d} -->
<div class="wp-block-godam-video"></div>
<!-- /wp:godam/video -->',
			esc_attr( $attachment_id )
		);
	}

	/**
	 * Check if attachment is a video.
	 *
	 * @param int $attachment_id Attachment ID.
	 * 
	 * @return bool True if video, false otherwise.
	 */
	private function is_video_attachment( $attachment_id ) {
		$mime_type = get_post_mime_type( $attachment_id );
		return 0 === strpos( $mime_type, 'video/' );
	}

	/**
	 * Migrate existing video attachments to create corresponding video posts.
	 * Handles all batch processing internally.
	 *
	 * @param int $batch_size Number of attachments to process per batch.
	 * 
	 * @return void
	 */
	public function migrate_existing_attachments( $batch_size = 50 ) {
		$page = 1;

		do {
			$query = new WP_Query(
				array(
					'post_type'      => 'attachment',
					'post_status'    => 'inherit',
					'posts_per_page' => $batch_size,
					'paged'          => $page,
					'orderby'        => 'ID',
					'order'          => 'ASC',
				) 
			);

			if ( ! $query->have_posts() ) {
				break;
			}

			foreach ( $query->posts as $attachment ) {
				/**
				 * Method checks if the attachment is a video and creates a video post.
				 * If the video post already exists, it will skip creating a new one.
				 */
				$this->create_video_post_from_attachment( $attachment->ID );
			}

			++$page;
			$has_more = count( $query->posts ) === $batch_size;

		} while ( $has_more );
	}

	/**
	 * Handle URL access for both single and archive pages based on user settings.
	 * This ensures videos appear in Query Loop but respect visibility settings for direct URLs.
	 * 
	 * @since 1.3.1
	 *
	 * @return void
	 */
	public function handle_url_access() {
		global $wp_query;
		
		// Block direct access to single video pages when single access is disabled.
		if ( is_singular( self::SLUG ) && ! $this->get_allow_single() ) {
			$wp_query->set_404();
			status_header( 404 );
			require get_query_template( '404' );
			exit;
		}
		
		// Block access to archive page when archive access is disabled.
		if ( is_post_type_archive( self::SLUG ) && ! $this->get_allow_archive() ) {
			$wp_query->set_404();
			status_header( 404 );
			require get_query_template( '404' );
			exit;
		}
	}

	/**
	 * Get the GoDAM video post ID from an attachment ID.
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return int|false Video post ID or false if not found.
	 */
	public function get_godam_video_from_attachment( $attachment_id ) {
		$query = new WP_Query(
			array(
				'post_type'              => self::SLUG,
				'posts_per_page'         => 1,
				'post_status'            => 'any',
				'fields'                 => 'ids',
				'no_found_rows'          => true,
				'update_post_term_cache' => false,
				'meta_query'             => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- needed to check linked video post.
					array(
						'key'   => '_godam_attachment_id',
						'value' => $attachment_id,
					),
				),
			)
		);
		
		// Check if the query returned post.
		if ( count( $query->posts ) > 0 ) {
			return $query->posts[0];
		}

		return false;
	}
}
