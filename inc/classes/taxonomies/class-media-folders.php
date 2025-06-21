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
		);

		return array_merge( $args, $extra );
	}

	/**
	 * Register term meta for media folder count.
	 *
	 * This meta will store the count of attachments in each media folder.
	 */
	public function register_term_meta() {
		register_term_meta(
			static::SLUG,
			'locked',
			array(
				'type'         => 'boolean',
				'single'       => true,
				'show_in_rest' => true,
			)
		);
	}
}
