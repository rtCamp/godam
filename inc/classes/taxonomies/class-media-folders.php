<?php
/**
 * Register taxonomy of the Media Folders.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Taxonomies;

defined( 'ABSPATH' ) || exit;

/**
 * Class Media_Folders
 */
class Media_Folders extends Base {

	/**
	 * Slug of taxonomy.
	 *
	 * @var string
	 */
	const SLUG = 'media-folder';

	/**
	 * Setup hooks for the taxonomy.
	 *
	 * @since 1.3.0
	 * 
	 * @return void
	 */
	protected function setup_hooks() {
		parent::setup_hooks();

		add_action( 'init', array( $this, 'register_term_meta' ) );
	}

	/**
	 * Labels for taxonomy.
	 *
	 * @return array
	 */
	public function get_labels() {

		return array(
			'name'              => _x( 'Media Folders', 'Media Folder', 'godam' ),
			'singular_name'     => _x( 'Media Folder', 'Media Folder', 'godam' ),
			'search_items'      => __( 'Search Media Folders', 'godam' ),
			'all_items'         => __( 'All Media Folders', 'godam' ),
			'parent_item'       => __( 'Parent Folder', 'godam' ),
			'parent_item_colon' => __( 'Parent Folder:', 'godam' ),
			'edit_item'         => __( 'Edit Media Folder', 'godam' ),
			'update_item'       => __( 'Update Media Folder', 'godam' ),
			'add_new_item'      => __( 'Add New Media Folder', 'godam' ),
			'new_item_name'     => __( 'New Media Folder Name', 'godam' ),
			'menu_name'         => __( 'Media Folders', 'godam' ),
		);
	}

	/**
	 * List of post types for taxonomy.
	 *
	 * @return array
	 */
	public function get_post_types() {

		return array(
			'attachment',
		);
	}

	/**
	 * To get argument to register taxonomy.
	 *
	 * @return array
	 */
	public function get_args() {

		$args = parent::get_args();

		$extra = array(
			'hierarchical'      => true,
			'show_ui'           => false,
			'show_admin_column' => false,
			'rewrite'           => array( 'slug' => 'media-folder' ),
			'show_in_rest'      => true,
			'query_var'         => true,
			// Media folders organise the media library, so their management tracks media
			// access rather than the default `manage_categories` (only Editors/Admins hold
			// that — which is why an Author got a 403 `rest_cannot_create` on New Folder).
			// create + rename share `edit_terms`, so `upload_files` lets Authors and above
			// create/rename folders (Contributors/Subscribers can't upload media anyway).
			// Deleting is restricted to administrators (`manage_options`) to match the
			// admin-only Delete UI and the `bulk_delete_folders` REST endpoint — Editors
			// hold `manage_categories`, so using that here would have left them a delete path.
			'capabilities'      => array(
				'manage_terms' => 'upload_files',
				'edit_terms'   => 'upload_files',
				'delete_terms' => 'manage_options',
				'assign_terms' => 'upload_files',
			),
		);

		return array_merge( $args, $extra );
	}

	/**
	 * Register term meta for media folder count.
	 *
	 * This meta will store the count of attachments in each media folder.
	 * 
	 * @since 1.3.0
	 * 
	 * @return void
	 */
	public function register_term_meta() {
		/*
		 * Writing `locked`/`bookmark` via the native REST route is gated to Editors and
		 * above (`manage_categories`) — the same level the Lock/Bookmark bulk endpoints
		 * and UI use. Without an explicit auth_callback these meta inherit the taxonomy's
		 * `edit_terms` cap, which this feature lowered to `upload_files` so Authors could
		 * create/rename folders — that would also let an Author POST `meta.locked = true`
		 * on any folder and lock it against everyone (see issue #1239 review).
		 */
		$manage_meta_auth_callback = static function () {
			return current_user_can( 'manage_categories' );
		};

		register_term_meta(
			static::SLUG,
			'locked',
			array(
				'type'          => 'boolean',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => $manage_meta_auth_callback,
			)
		);

		register_term_meta(
			static::SLUG,
			'bookmark',
			array(
				'type'          => 'boolean',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => $manage_meta_auth_callback,
			)
		);
	}
}
