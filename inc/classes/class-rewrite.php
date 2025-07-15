<?php
/**
 * Rewrite class.
 *
 * @package godam
 * @since 1.2.0
 */

namespace RTGODAM\Inc;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Rewrite
 * 
 * @since 1.2.0
 */
class Rewrite {

	use Singleton;

	/**
	 * Construct method.
	 * 
	 * @since 1.2.0
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * To setup action/filter.
	 *
	 * @since 1.2.0
	 * 
	 * @return void
	 */
	protected function setup_hooks() {
		add_filter( 'query_vars', array( $this, 'add_query_vars' ) );
	}

	/**
	 * Adds a query vars to identify and render video preview page.
	 * 
	 * @since 1.2.0
	 * 
	 * @param array $vars The existing query variables.
	 * @return array The modified query variables.
	 */
	public function add_query_vars( $vars ) {
		// Add 'godam_page' to the list of query vars.
		$vars[] = 'godam_page';
		return $vars;
	}
}
