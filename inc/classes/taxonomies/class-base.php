<?php
/**
 * Base class to register taxonomy.
 *
 * @since 1.0.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Taxonomies;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Base
 *
 * @since 1.0.0
 */
abstract class Base {

	use Singleton;

	/**
	 * Base constructor.
	 *
	 * @since 1.0.0
	 */
	protected function __construct() {

		$this->setup_hooks();
	}

	/**
	 * To setup action/filter.
	 *
	 * @since 1.0.0
	 *
	 * @return void
	 */
	protected function setup_hooks() {

		add_action( 'init', array( $this, 'register_taxonomy' ) );
	}

	/**
	 * Register taxonomy.
	 *
	 * @since 1.0.0
	 *
	 * @return void
	 */
	public function register_taxonomy() {

		if ( empty( static::SLUG ) ) {
			return;
		}

		$post_types = $this->get_post_types();

		if ( empty( $post_types ) || ! is_array( $post_types ) ) {
			return;
		}

		$args = $this->get_args();
		$args = ( ! empty( $args ) && is_array( $args ) ) ? $args : array();

		$labels = $this->get_labels();
		$labels = ( ! empty( $labels ) && is_array( $labels ) ) ? $labels : array();

		if ( ! empty( $labels ) && is_array( $labels ) ) {
			$args['labels'] = $labels;
		}

		register_taxonomy( static::SLUG, $post_types, $args );
	}

	/**
	 * To get argument to register taxonomy.
	 *
	 * @since 1.0.0
	 *
	 * @return array
	 */
	public function get_args() {

		return array(
			'hierarchical'      => true,
			'show_ui'           => true,
			'show_admin_column' => true,
			'query_var'         => true,
			'show_in_rest'      => true,
		);
	}

	/**
	 * Labels for taxonomy.
	 *
	 * @since 1.0.0
	 *
	 * @return array
	 */
	abstract public function get_labels();

	/**
	 * List of post types for taxonomy.
	 *
	 * @since 1.0.0
	 *
	 * @return array
	 */
	abstract public function get_post_types();
}
