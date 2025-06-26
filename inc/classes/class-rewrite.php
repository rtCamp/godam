<?php
/**
 * Rewrite class.
 *
 * @package godam
 * @since n.e.x.t
 */

namespace RTGODAM\Inc;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Rewrite
 * 
 * @since n.e.x.t
 */
class Rewrite {

	use Singleton;

	/**
	 * Construct method.
	 * 
	 * @since n.e.x.t
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * To setup action/filter.
	 *
	 * @since n.e.x.t
	 * 
	 * @return void
	 */
	protected function setup_hooks() {
		add_filter( 'query_vars', array( $this, 'add_query_vars' ) );
	}

	/**
	 * Adds a query vars to identify and render video preview page.
	 * 
	 * @since n.e.x.t
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
