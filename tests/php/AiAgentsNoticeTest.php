<?php
/**
 * Tests for who sees the "use GoDAM from your AI agent" notice.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Abilities;
use RTGODAM\Inc\Abilities\Ai_Agents_Notice;

require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-abilities.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-mcp-server.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ai-agents-notice.php';

require_once dirname( __DIR__ ) . '/stubs/abilities-functions.php';

/**
 * The notice shows only to administrators, on a site where the MCP Adapter is
 * active and the MCP switch is on, until that administrator dismisses it.
 *
 * Runs in its own process because it defines WP_MCP_VERSION, the constant the
 * MCP Adapter plugin defines.
 *
 * @covers \RTGODAM\Inc\Abilities\Ai_Agents_Notice
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class AiAgentsNoticeTest extends TestCase {

	/**
	 * Resets the stubs to an administrator on a site with the switch on.
	 *
	 * @return void
	 */
	protected function setUp(): void {
		require_once dirname( __DIR__ ) . '/stubs/ai-agents-notice-functions.php';

		$GLOBALS['rtgodam_stub'] = array(
			'options'   => array(),
			'caps'      => array( 'manage_options' ),
			'user_meta' => array(),
		);
	}

	/**
	 * Without the MCP Adapter plugin nobody can connect, so nothing is shown.
	 *
	 * @return void
	 */
	public function test_hidden_without_the_mcp_adapter() {
		$this->assertFalse( Ai_Agents_Notice::should_show() );
	}

	/**
	 * An adapter older than the version GoDAM supports counts as missing.
	 *
	 * @return void
	 */
	public function test_hidden_with_an_old_mcp_adapter() {
		define( 'WP_MCP_VERSION', '0.5.0' );

		$this->assertFalse( Ai_Agents_Notice::should_show() );
	}

	/**
	 * With the adapter active it shows to an administrator, and only to one.
	 *
	 * @return void
	 */
	public function test_shows_to_administrators_when_the_adapter_is_active() {
		define( 'WP_MCP_VERSION', '0.7.1' );

		$this->assertTrue( Ai_Agents_Notice::should_show() );

		$GLOBALS['rtgodam_stub']['caps'] = array( 'upload_files' );
		$this->assertFalse( Ai_Agents_Notice::should_show(), 'An editor or author does not see it.' );
	}

	/**
	 * Turning the MCP switch off hides it.
	 *
	 * @return void
	 */
	public function test_hidden_when_the_mcp_switch_is_off() {
		define( 'WP_MCP_VERSION', '0.7.1' );

		$GLOBALS['rtgodam_stub']['options'][ Abilities::MCP_ENABLED_OPTION ] = '0';

		$this->assertFalse( Ai_Agents_Notice::should_show() );
	}

	/**
	 * Dismissing it hides it for that administrator for good.
	 *
	 * @return void
	 */
	public function test_dismissing_hides_it_for_that_user() {
		define( 'WP_MCP_VERSION', '0.7.1' );

		$reflection = new \ReflectionClass( Ai_Agents_Notice::class );
		$notice     = $reflection->newInstanceWithoutConstructor();

		$this->assertTrue( $notice->get_notice()['show'] );

		$notice->dismiss_notice();

		$this->assertFalse( Ai_Agents_Notice::should_show() );
		$this->assertNotEmpty( $GLOBALS['rtgodam_stub']['user_meta'][1][ Ai_Agents_Notice::DISMISSED_META_KEY ] );
	}
}
