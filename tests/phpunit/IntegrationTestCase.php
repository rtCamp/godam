<?php
/**
 * Base test case for tier-2 integration tests (boots WP via wp-phpunit).
 *
 * @package GoDAM
 */

declare(strict_types=1);

namespace GoDAM\Tests;

use WP_UnitTestCase;

abstract class IntegrationTestCase extends WP_UnitTestCase {
	// Add GoDAM-specific helpers here as patterns emerge.
}
