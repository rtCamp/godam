<?php
/**
 * Base class to register post type.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Post_Types;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Base.
 */
abstract class Base {

	use Singleton;

	/**
	 * Base constructor.
	 * 
	 * @return void
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

		add_action( 'init', array( $this, 'register_post_type' ) );
	}

	/**
	 * Register post type.
	 *
	 * @return void
	 */
	public function register_post_type() {

		if ( empty( static::SLUG ) ) {
			return;
		}

		$labels = $this->get_labels();
		$args   = $this->get_args();

		if ( ! empty( $labels ) ) {
			$args['labels'] = $labels;
		}

		register_post_type( static::SLUG, $args );
	}

	/**
	 * Get labels for post type.
	 *
	 * @return array
	 */
	abstract public function get_labels();

	/**
	 * Get arguments for post type.
	 *
	 * @return array
	 */
	abstract public function get_args();
}
