<?php

declare(strict_types = 1);

/**
 * Base class to register taxonomy.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Taxonomies;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Base
 */
abstract class Base {
	use Singleton;

	/**
	 * Base constructor.
	 */
	protected function __construct() {

		$this->setup_hooks();
	}

	/**
	 * To setup action/filter.
	 *
	 * @return void
	 */
	protected function setup_hooks() {

		add_action( 'init', [ $this, 'register_taxonomy' ] );
	}

	/**
	 * Register taxonomy.
	 *
	 * @return void
	 */
	public function register_taxonomy() {

		if ( empty( self::SLUG ) ) {
			return;
		}

		$post_types = $this->get_post_types();

		if ( empty( $post_types ) || ! is_array( $post_types ) ) {
			return;
		}

		$args = $this->get_args();
		$args = ! empty( $args ) && is_array( $args ) ? $args : [];

		$labels = $this->get_labels();
		$labels = ! empty( $labels ) && is_array( $labels ) ? $labels : [];

		if ( ! empty( $labels ) && is_array( $labels ) ) {
			$args['labels'] = $labels;
		}

		register_taxonomy( self::SLUG, $post_types, $args );
	}

	/**
	 * To get argument to register taxonomy.
	 *
	 * @return array
	 */
	public function get_args() {

		return [
			'hierarchical'      => true,
			'show_ui'           => true,
			'show_admin_column' => true,
			'query_var'         => true,
			'show_in_rest'      => true,
		];
	}

	/**
	 * Labels for taxonomy.
	 *
	 * @return array
	 */
	abstract public function get_labels();

	/**
	 * List of post types for taxonomy.
	 *
	 * @return array
	 */
	abstract public function get_post_types();
}
