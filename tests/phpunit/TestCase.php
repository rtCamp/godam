<?php
/**
 * Base test case for tier-1 unit tests (Brain Monkey, no WordPress).
 *
 * @package GoDAM
 */

declare(strict_types=1);

namespace GoDAM\Tests;

use Brain\Monkey;
use PHPUnit\Framework\TestCase as PHPUnitTestCase;

abstract class TestCase extends PHPUnitTestCase {

	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();
	}

	protected function tearDown(): void {
		Monkey\tearDown();
		parent::tearDown();
	}
}
