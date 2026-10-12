<?php
/**
 * MCP abilities registration.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\MCP;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/trait-abilities-registration.php';
require_once __DIR__ . '/trait-abilities-permissions.php';
require_once __DIR__ . '/trait-abilities-execution.php';
require_once __DIR__ . '/trait-abilities-rest-dispatch.php';
require_once __DIR__ . '/trait-abilities-bridge.php';
require_once __DIR__ . '/trait-abilities-upload.php';
require_once __DIR__ . '/trait-abilities-search.php';
require_once __DIR__ . '/trait-abilities-analytics.php';

/**
 * Class Abilities.
 */
class Abilities {

	use Singleton;
	use Abilities_Registration;
	use Abilities_Permissions;
	use Abilities_Execution;
	use Abilities_REST_Dispatch;
	use Abilities_Bridge;
	use Abilities_Upload;
	use Abilities_Search;
	use Abilities_Analytics;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		add_action( 'wp_abilities_api_categories_init', array( $this, 'register_category' ) );
		add_action( 'wp_abilities_api_init', array( $this, 'register_abilities' ) );
	}
}
