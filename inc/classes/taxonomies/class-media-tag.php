<?php
/**
 * Register `rtgodam_media_tag` taxonomy for the media attachments.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Taxonomies;

defined( 'ABSPATH' ) || exit;

/**
 * Class Media_Tag
 */
class Media_Tag extends Base {

	/**
	 * Slug of taxonomy.
	 *
	 * @var string
	 */
	const SLUG = 'rtgodam_media_tag';

	/**
	 * To setup action/filter.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		parent::setup_hooks();

		add_action( 'restrict_manage_posts', array( $this, 'add_tag_filter_dropdown' ) );
	}

	/**
	 * Labels for taxonomy.
	 *
	 * @return array
	 */
	public function get_labels(): array {

		return array(
			'name'              => _x( 'Tags', 'Tag', 'godam' ),
			'singular_name'     => _x( 'Tag', 'Tag', 'godam' ),
			'search_items'      => __( 'Search Tags', 'godam' ),
			'all_items'         => __( 'All Tags', 'godam' ),
			'parent_item'       => __( 'Parent Folder', 'godam' ),
			'parent_item_colon' => __( 'Parent Folder:', 'godam' ),
			'edit_item'         => __( 'Edit Tag', 'godam' ),
			'update_item'       => __( 'Update Tag', 'godam' ),
			'add_new_item'      => __( 'Add New Tag', 'godam' ),
			'new_item_name'     => __( 'New Tag Name', 'godam' ),
			'menu_name'         => __( 'Tags', 'godam' ),
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
			'hierarchical'      => false,
			'show_ui'           => true,
			'show_admin_column' => false,
			'show_in_rest'      => true,
			'query_var'         => true,
		);

		return array_merge( $args, $extra );
	}

	/**
	 * Add tag filter dropdown to media library list view.
	 *
	 * Displays a dropdown filter in the media library admin page to filter
	 * attachments by tag. Uses WordPress native `wp_dropdown_categories` function.
	 *
	 * @return void
	 */
	public function add_tag_filter_dropdown() {

		global $pagenow;

		if ( 'upload.php' !== $pagenow ) {
			return;
		}

		$taxonomy = 'rtgodam_media_tag';
		$selected = isset( $_GET[ $taxonomy ] ) ? sanitize_text_field( wp_unslash( $_GET[ $taxonomy ] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- The media filter form has nonce verification, so this is safe to use without additional nonce checks.

		$has_terms = wp_count_terms( array( 'taxonomy' => $taxonomy ) );

		$dropdown_args = array(
			'show_option_all' => __( 'All Tags', 'godam' ),
			'taxonomy'        => $taxonomy,
			'name'            => $taxonomy,
			'orderby'         => 'name',
			'selected'        => $selected,
			'value_field'     => 'slug',
			'depth'           => 3,
			'hide_empty'      => false,
		);

		wp_dropdown_categories(
			$has_terms ? $dropdown_args : array_merge( $dropdown_args, array( 'show_option_none' => __( 'No Tags', 'godam' ) ) )
		);
		// phpcs:enable WordPress.Security.NonceVerification.Recommended
	}
}
