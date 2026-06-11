<?php
/**
 * Smoke test confirming the tier-1 PHPUnit harness boots correctly.
 *
 * @package GoDAM
 */

declare(strict_types=1);

namespace GoDAM\Tests\Unit\Harness;

use Brain\Monkey\Functions;
use GoDAM\Tests\TestCase;

final class HarnessTest extends TestCase {

	public function test_brain_monkey_is_loaded(): void {
		$this->assertTrue(
			class_exists( \Brain\Monkey\Container::class ),
			'Brain\Monkey must autoload via composer.'
		);
	}

	public function test_wp_function_can_be_faked(): void {
		Functions\expect( 'wp_kses_post' )
			->once()
			->with( 'hello' )
			->andReturn( 'hello' );

		$this->assertSame( 'hello', wp_kses_post( 'hello' ) );
	}
}
