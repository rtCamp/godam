<?php
/**
 * Adds default WordPress `category` taxonomy to media library (attachments).
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Taxonomies;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Media_Category
 */
class Media_Category {

	use Singleton;

	/**
	 * Constructor.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 */
	protected function setup_hooks() {
		add_action( 'init', array( $this, 'register_category_for_media' ) );
		add_action( 'restrict_manage_posts', array( $this, 'add_category_filter_dropdown' ) );
		add_filter( 'parse_query', array( $this, 'filter_media_by_category' ) );
	}

	/**
	 * Register category taxonomy for `attachment` post type.
	 *
	 * Enables categories to be assigned to media attachments in the media library.
	 *
	 * @return void
	 */
	public function register_category_for_media() {
		register_taxonomy_for_object_type( 'category', 'attachment' );
	}

	/**
	 * Add category filter dropdown to media library list view.
	 *
	 * Displays a dropdown filter in the media library admin page to filter
	 * attachments by category. Uses WordPress native `wp_dropdown_categories` function.
	 *
	 * @return void
	 */
	public function add_category_filter_dropdown() {

		global $pagenow;

		if ( 'upload.php' !== $pagenow ) {
			return;
		}

		$taxonomy = 'category';
		$selected = isset( $_GET[ $taxonomy ] ) ? sanitize_text_field( wp_unslash( $_GET[ $taxonomy ] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- The media filter form has nonce verification, so this is safe to use without additional nonce checks.


		wp_dropdown_categories(
			array(
				'show_option_all' => __( 'All Categories', 'godam' ),
				'taxonomy'        => $taxonomy,
				'name'            => $taxonomy,
				'orderby'         => 'name',
				'selected'        => $selected,
				'depth'           => 3,
				'hide_empty'      => false,
			)
		);
		// phpcs:enable WordPress.Security.NonceVerification.Recommended
	}

	/**
	 * Filter media library query by selected category.
	 *
	 * Modifies the WordPress query to filter media attachments based on
	 * the selected category from the dropdown filter.
	 *
	 * @param WP_Query $query The WordPress query object.
	 *
	 * @return WP_Query Modified query object.
	 */
	public function filter_media_by_category( $query ) {
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- The media filter form has nonce verification, so this is safe to use without additional nonce checks.
		global $pagenow;

		if ( ! is_admin() || 'upload.php' !== $pagenow ) {
			return $query;
		}

		$taxonomy = 'category';

		if ( isset( $_GET[ $taxonomy ] ) && ! empty( $_GET[ $taxonomy ] ) ) {
			$term                           = sanitize_text_field( wp_unslash( $_GET[ $taxonomy ] ) );
			$query->query_vars['tax_query'] = array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query -- This is a standard query modification for filtering media by category.
				array(
					'taxonomy' => $taxonomy,
					'field'    => 'term_id',
					'terms'    => $term,
				),
			);
		}

		return $query;
		// phpcs:enable WordPress.Security.NonceVerification.Recommended -- The media filter form has nonce verification, so this is safe to use without additional nonce checks.
	}
}
