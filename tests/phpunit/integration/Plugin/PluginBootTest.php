<?php
/**
 * Smoke test confirming the tier-2 PHPUnit harness boots WordPress
 * and the GoDAM plugin loads under it.
 *
 * @package GoDAM
 */

declare(strict_types=1);

namespace GoDAM\Tests\Integration\Plugin;

use GoDAM\Tests\IntegrationTestCase;

final class PluginBootTest extends IntegrationTestCase {

	public function test_wordpress_is_loaded(): void {
		$this->assertTrue(
			function_exists( 'wp_get_current_user' ),
			'WordPress core functions must be available under wp-phpunit.'
		);
	}

	public function test_plugin_main_file_constant_is_defined(): void {
		// godam.php defines RTGODAM_VERSION near the top; if the plugin
		// loaded under muplugins_loaded the constant must be set.
		$this->assertTrue(
			defined( 'RTGODAM_VERSION' ),
			'RTGODAM_VERSION must be defined after the plugin loads.'
		);
	}
}
