<?php
/**
 * Register GoDAM Video custom post type.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Post_Types;

defined( 'ABSPATH' ) || exit;

/**
 * Class GoDAM_Video
 */
class GoDAM_Video extends Base {

	/**
	 * Slug of post type.
	 *
	 * @var string
	 */
	const SLUG = 'godam_video';

	/**
	 * Setup hooks for the post type.
	 *
	 * @return void
	 */
	protected function setup_hooks() { // phpcs:ignore Generic.CodeAnalysis.UselessOverridingMethod.Found -- Method will be used later to create post entries automatically.
		parent::setup_hooks();
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

		return array(
			'label'        => __( 'GoDAM Video', 'godam' ),
			'description'  => __( 'GoDAM Video posts for theme template support', 'godam' ),
			'labels'       => $this->get_labels(),
			'supports'     => array( 'title', 'editor', 'excerpt', 'author', 'custom-fields' ),
			'taxonomies'   => array( 'category', 'post_tag' ),
			'hierarchical' => false,
			'public'       => true,
			'show_ui'      => false,
			'has_archive'  => true,
			'show_in_rest' => true,
		);
	}
}
