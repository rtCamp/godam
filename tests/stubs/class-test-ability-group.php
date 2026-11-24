<?php
/**
 * Test double for Ability_Group: exposes add() and limit_schema(), and lets a
 * test decide whether the site counts as connected to GoDAM.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use RTGODAM\Inc\Abilities\Ability_Group;

/**
 * Ability group whose plan check a test sets, exposing the protected helpers.
 */
class Test_Ability_Group extends Ability_Group {

	/**
	 * Whether the site counts as connected to GoDAM.
	 *
	 * @var bool
	 */
	public $has_plan = false;

	/**
	 * Unused; abilities are added one by one in the tests.
	 *
	 * @return void
	 */
	public function register() {}

	/**
	 * Registers one ability through the real add().
	 *
	 * @param string $name   Ability name.
	 * @param array  $args   Arguments.
	 * @param bool   $writes Whether it writes.
	 * @return void
	 */
	public function add_for_test( $name, array $args, $writes = false ) {
		$this->add( $name, $args, $writes );
	}

	/**
	 * Runs the real limit_schema().
	 *
	 * @param array $schema Schema.
	 * @return array
	 */
	public function limit( array $schema ) {
		return $this->limit_schema( $schema );
	}

	/**
	 * The plan check, set by the test.
	 *
	 * @return bool
	 */
	protected function site_has_plan() {
		return $this->has_plan;
	}
}
