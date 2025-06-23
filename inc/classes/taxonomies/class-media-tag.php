<?php
/**
 * Adds default WordPress `post_tag` taxonomy to media library (attachments).
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Taxonomies;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Media_Tag
 */
class Media_Tag {

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
		add_action( 'init', array( $this, 'register_tag_for_media' ) );
		add_action( 'restrict_manage_posts', array( $this, 'add_tag_filter_dropdown' ) );
		add_filter( 'manage_media_columns', array( $this, 'manage_tag_columns' ) );
		add_filter( 'parse_query', array( $this, 'filter_media_by_tag' ) );
	}

	/**
	 * Register tag taxonomy for `attachment` post type.
	 *
	 * Enables tags to be assigned to media attachments in the media library.
	 *
	 * @return void
	 */
	public function register_tag_for_media() {
		register_taxonomy_for_object_type( 'post_tag', 'attachment' );
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

		$taxonomy = 'post_tag';
		$selected = isset( $_GET[ $taxonomy ] ) ? sanitize_text_field( wp_unslash( $_GET[ $taxonomy ] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- The media filter form has nonce verification, so this is safe to use without additional nonce checks.

		wp_dropdown_categories(
			array(
				'show_option_all' => __( 'All Tags', 'godam' ),
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
	 * Filter media library query by selected tag.
	 *
	 * Modifies the WordPress query to filter media attachments based on
	 * the selected tag from the dropdown filter.
	 *
	 * @param WP_Query $query The WordPress query object.
	 *
	 * @return WP_Query Modified query object.
	 */
	public function filter_media_by_tag( $query ) {
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- The media filter form has nonce verification, so this is safe to use without additional nonce checks.
		global $pagenow;

		if ( ! is_admin() || 'upload.php' !== $pagenow ) {
			return $query;
		}

		$taxonomy = 'post_tag';

		if ( isset( $_GET[ $taxonomy ] ) && ! empty( $_GET[ $taxonomy ] ) ) {
			$term                           = sanitize_text_field( wp_unslash( $_GET[ $taxonomy ] ) );
			$query->query_vars['tax_query'] = array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query -- This is a standard query modification for filtering media by tag.
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

	/**
	 * Hide the `tags` column created after registering `post_tag` taxonomy.
	 *
	 * @param Array $columns  of columns in the media library.
	 *
	 * @return mixed
	 */
	public function manage_tag_columns( array $columns ) {
		unset( $columns['tags'] );

		return $columns;
	}
}
