<?php
/**
 * Register taxonomy of the Media Folders.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\Taxonomies;

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
	 * Labels for taxonomy.
	 *
	 * @return array
	 */
	public function get_labels() {

		return array(
			'name'              => _x( 'Media Folders', 'Media Folder', 'transcoder' ),
			'singular_name'     => _x( 'Media Folder', 'Media Folder', 'transcoder' ),
			'search_items'      => __( 'Search Media Folders', 'transcoder' ),
			'all_items'         => __( 'All Media Folders', 'transcoder' ),
			'parent_item'       => __( 'Parent Folder', 'transcoder' ),
			'parent_item_colon' => __( 'Parent Folder:', 'transcoder' ),
			'edit_item'         => __( 'Edit Media Folder', 'transcoder' ),
			'update_item'       => __( 'Update Media Folder', 'transcoder' ),
			'add_new_item'      => __( 'Add New Media Folder', 'transcoder' ),
			'new_item_name'     => __( 'New Media Folder Name', 'transcoder' ),
			'menu_name'         => __( 'Media Folders', 'transcoder' ),
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
			'query_var'         => true,
			'rewrite'           => array( 'slug' => 'media-folder' ),
			'show_in_rest'      => true,
			'query_var'         => true,
		);

		return array_merge( $args, $extra );

	}
}
