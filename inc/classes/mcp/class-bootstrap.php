<?php
/**
 * MCP bootstrap class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\MCP;

use RTGODAM\Inc\Traits\Singleton;
use RTGODAM\Inc\MCP\Abilities;
use RTGODAM\Inc\MCP\Route_Contract;

defined( 'ABSPATH' ) || exit;

/**
 * Class Bootstrap.
 */
class Bootstrap {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		Route_Contract::get_instance();

		if ( function_exists( 'wp_register_ability' ) && function_exists( 'wp_register_ability_category' ) ) {
			Abilities::get_instance();
		}
	}
}
