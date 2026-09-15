<?php
/**
 * Register `rtgodam_media_category` taxonomy for the media attachments.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Taxonomies;

defined( 'ABSPATH' ) || exit;

/**
 * Class Media_Category
 */
class Media_Category extends Base {

	/**
	 * Slug of taxonomy.
	 *
	 * @var string
	 */
	const SLUG = 'rtgodam_media_category';

	/**
	 * To setup action/filter.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		parent::setup_hooks();

		add_action( 'restrict_manage_posts', array( $this, 'add_category_filter_dropdown' ) );
	}

	/**
	 * Labels for taxonomy.
	 *
	 * @return array
	 */
	public function get_labels(): array {

		return array(
			'name'              => _x( 'Categories', 'Category', 'godam' ),
			'singular_name'     => _x( 'Category', 'Category', 'godam' ),
			'search_items'      => __( 'Search Categories', 'godam' ),
			'all_items'         => __( 'All Categories', 'godam' ),
			'parent_item'       => __( 'Parent Folder', 'godam' ),
			'parent_item_colon' => __( 'Parent Folder:', 'godam' ),
			'edit_item'         => __( 'Edit Category', 'godam' ),
			'update_item'       => __( 'Update Category', 'godam' ),
			'add_new_item'      => __( 'Add New Category', 'godam' ),
			'new_item_name'     => __( 'New Category Name', 'godam' ),
			'menu_name'         => __( 'Categories', 'godam' ),
		);
	}

	/**
	 * List of post types for taxonomy.
	 *
	 * @return array
	 */
	public function get_post_types(): array {

		return array(
			'attachment',
		);
	}

	/**
	 * To get argument to register taxonomy.
	 *
	 * @return array
	 */
	public function get_args(): array {

		$args = parent::get_args();

		$extra = array(
			'hierarchical' => false,
			'show_ui'      => true,
			'show_in_rest' => true,
			'query_var'    => true,
		);

		return array_merge( $args, $extra );
	}

	/**
	 * Add Category filter dropdown to media library list view.
	 *
	 * Displays a dropdown filter in the media library admin page to filter
	 * attachments by Category. Uses WordPress native `wp_dropdown_categories` function.
	 *
	 * @return void
	 */
	public function add_category_filter_dropdown() {

		global $pagenow;

		if ( 'upload.php' !== $pagenow ) {
			return;
		}

		$taxonomy = 'rtgodam_media_category';
		$selected = isset( $_GET[ $taxonomy ] ) ? sanitize_text_field( wp_unslash( $_GET[ $taxonomy ] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- The media filter form has nonce verification, so this is safe to use without additional nonce checks.

		$has_terms = wp_count_terms( array( 'taxonomy' => $taxonomy ) );

		$dropdown_args = array(
			'show_option_all' => __( 'All Categories', 'godam' ),
			'taxonomy'        => $taxonomy,
			'name'            => $taxonomy,
			'orderby'         => 'name',
			'value_field'     => 'slug',
			'selected'        => $selected,
			'depth'           => 3,
			'hide_empty'      => false,
		);

		wp_dropdown_categories(
			$has_terms ? $dropdown_args : array_merge( $dropdown_args, array( 'show_option_none' => __( 'No Categories', 'godam' ) ) )
		);
		// phpcs:enable WordPress.Security.NonceVerification.Recommended
	}
}
