<?php
/**
 * Tests which GoDAM abilities WordPress's Abilities REST route runs with DELETE.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Abilities;

/**
 * Core's run route wants DELETE for an ability that is both destructive and
 * idempotent, and POST for every other write. An update sent as POST to a
 * DELETE-only ability fails with 405, so only a real removal may be both.
 *
 * Runs in its own process because it loads every ability class.
 *
 * @covers \RTGODAM\Inc\Abilities\Ability_Group
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class AbilityRestMethodTest extends TestCase {

	/**
	 * Only godam/remove-layer is a DELETE; every other write is a POST.
	 *
	 * @return void
	 */
	public function test_only_removals_need_delete() {
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-abilities.php';

		$GLOBALS['rtgodam_stub'] = array(
			'options'   => array( Abilities::MCP_ENABLED_OPTION => '1' ),
			'caps'      => array(),
			'abilities' => array(),
		);

		require_once dirname( __DIR__ ) . '/stubs/abilities-functions.php';

		foreach ( glob( dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-*.php' ) as $file ) {
			require_once $file;
		}

		$reflection = new \ReflectionClass( Abilities::class );
		$reflection->newInstanceWithoutConstructor()->register_abilities();

		$this->assertNotEmpty( $GLOBALS['rtgodam_stub']['abilities'] );

		$delete_only = array();

		foreach ( $GLOBALS['rtgodam_stub']['abilities'] as $name => $args ) {
			$annotations = $args['meta']['annotations'] ?? array();

			if ( ! empty( $annotations['destructive'] ) && ! empty( $annotations['idempotent'] ) ) {
				$delete_only[] = $name;
			}
		}

		$this->assertSame( array( 'godam/remove-layer' ), $delete_only );
	}
}
