<?php
/**
 * Unit tests for the rules every GoDAM ability gets from Ability_Group::add():
 * input limits, the destructive and open-world flags, writes on by default,
 * and the GoDAM-plan gate. Also covers the MCP server's connect check and the
 * on/off switch's starting value.
 *
 * wp_register_ability() and add_option() are stubbed in tests/stubs/abilities-functions.php to record what each ability was
 * registered with. get_option() and current_user_can() are the bootstrap
 * stubs, driven by $GLOBALS['rtgodam_stub'].
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Abilities;
use RTGODAM\Inc\Abilities\Ability_Group;
use RTGODAM\Inc\Abilities\Mcp_Server;

require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-abilities.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-mcp-server.php';

require_once dirname( __DIR__ ) . '/stubs/abilities-functions.php';
require_once dirname( __DIR__ ) . '/stubs/class-test-ability-group.php';

/**
 * @covers \RTGODAM\Inc\Abilities\Ability_Group
 * @covers \RTGODAM\Inc\Abilities\Abilities::writes_enabled
 * @covers \RTGODAM\Inc\Abilities\Abilities::mcp_enabled
 * @covers \RTGODAM\Inc\Abilities\Mcp_Server::can_connect
 */
class AbilityRulesTest extends TestCase {

	/**
	 * Resets the stubs.
	 *
	 * @return void
	 */
	protected function setUp(): void {
		$GLOBALS['rtgodam_stub'] = array(
			'options'   => array( Abilities::MCP_ENABLED_OPTION => '1' ),
			'caps'      => array(),
			'abilities' => array(),
		);
	}

	/**
	 * Registers an ability and returns what it was registered with.
	 *
	 * @param string $name     Ability name.
	 * @param bool   $writes   Whether it writes.
	 * @param bool   $has_plan Whether the site counts as connected to GoDAM.
	 * @return array
	 */
	private function register( $name, $writes = false, $has_plan = false ) {
		$group           = new Test_Ability_Group();
		$group->has_plan = $has_plan;
		$group->add_for_test(
			$name,
			array(
				'label'            => 'Test',
				'description'      => 'Does a thing.',
				'input_schema'     => array(
					'type'       => 'object',
					'properties' => array( 'id' => array( 'type' => 'integer' ) ),
				),
				'execute_callback' => function () {
					return array( 'ran' => true );
				},
			),
			$writes
		);

		return $GLOBALS['rtgodam_stub']['abilities'][ $name ];
	}

	/**
	 * Objects reject unknown keys; strings and arrays get limits.
	 *
	 * @return void
	 */
	public function test_input_schema_gets_limits() {
		$limited = ( new Test_Ability_Group() )->limit(
			array(
				'type'       => 'object',
				'properties' => array(
					'title'       => array( 'type' => 'string' ),
					'description' => array( 'type' => 'string' ),
					'status'      => array(
						'type' => 'string',
						'enum' => array( 'draft', 'publish' ),
					),
					'short'       => array(
						'type'      => 'string',
						'maxLength' => 10,
					),
					'ids'         => array(
						'type'  => 'array',
						'items' => array(
							'type'       => 'object',
							'properties' => array( 'text' => array( 'type' => 'string' ) ),
						),
					),
					'open'        => array( 'type' => 'object' ),
				),
			)
		);

		$this->assertFalse( $limited['additionalProperties'] );
		$this->assertSame( Ability_Group::MAX_STRING_LENGTH, $limited['properties']['title']['maxLength'] );
		$this->assertSame( Ability_Group::MAX_TEXT_LENGTH, $limited['properties']['description']['maxLength'] );
		$this->assertArrayNotHasKey( 'maxLength', $limited['properties']['status'], 'An enum needs no length limit.' );
		$this->assertSame( 10, $limited['properties']['short']['maxLength'], 'A limit the schema sets is kept.' );
		$this->assertSame( Ability_Group::MAX_ITEMS, $limited['properties']['ids']['maxItems'] );
		$this->assertFalse( $limited['properties']['ids']['items']['additionalProperties'] );
		$this->assertSame( Ability_Group::MAX_TEXT_LENGTH, $limited['properties']['ids']['items']['properties']['text']['maxLength'] );
		$this->assertArrayNotHasKey( 'additionalProperties', $limited['properties']['open'], 'An object without listed properties stays open.' );
	}

	/**
	 * Writes that overwrite data are flagged destructive; other writes are not.
	 *
	 * @return void
	 */
	public function test_overwriting_writes_are_destructive() {
		$this->assertTrue( $this->register( 'godam/update-media-details', true )['meta']['annotations']['destructive'] );
		$this->assertTrue( $this->register( 'godam/add-media-to-page', true )['meta']['annotations']['destructive'] );
		$this->assertTrue( $this->register( 'godam/retranscode-media', true )['meta']['annotations']['destructive'] );
		$this->assertFalse( $this->register( 'godam/create-folder', true )['meta']['annotations']['destructive'] );
		$this->assertTrue( $this->register( 'godam/list-media' )['meta']['annotations']['readonly'] );
	}

	/**
	 * Tools that reach outside the site say so.
	 *
	 * @return void
	 */
	public function test_outside_tools_are_open_world() {
		$this->assertTrue( $this->register( 'godam/import-media-from-url', true )['meta']['annotations']['openWorldHint'] );
		$this->assertTrue( $this->register( 'godam/get-top-videos' )['meta']['annotations']['openWorldHint'] );
		$this->assertArrayNotHasKey( 'openWorldHint', $this->register( 'godam/list-media' )['meta']['annotations'] );
	}

	/**
	 * The GoDAM Central tools reach outside the site, and adding from Central is a write that overwrites nothing.
	 *
	 * @return void
	 */
	public function test_central_media_tools_are_flagged() {
		$list = $this->register( 'godam/list-central-media' );
		$this->assertTrue( $list['meta']['annotations']['openWorldHint'] );
		$this->assertTrue( $list['meta']['annotations']['readonly'] );

		$add = $this->register( 'godam/add-central-media', true );
		$this->assertTrue( $add['meta']['annotations']['openWorldHint'] );
		$this->assertFalse( $add['meta']['annotations']['readonly'] );
		$this->assertFalse( $add['meta']['annotations']['destructive'] );
		$this->assertContains( 'godam/list-central-media', \RTGODAM\Inc\Abilities\Ability_Group::PLAN_REQUIRED );
		$this->assertContains( 'godam/add-central-media', \RTGODAM\Inc\Abilities\Ability_Group::PLAN_REQUIRED );
	}

	/**
	 * Write tools are listed unless an administrator turned them off.
	 *
	 * @return void
	 */
	public function test_writes_are_on_by_default() {
		$this->assertTrue( Abilities::writes_enabled() );
		$this->assertTrue( $this->register( 'godam/create-folder', true )['meta']['mcp']['public'] );

		$GLOBALS['rtgodam_stub']['options'][ Abilities::WRITE_ABILITIES_OPTION ] = false;

		$this->assertFalse( $this->register( 'godam/create-folder', true )['meta']['mcp']['public'] );
		$this->assertTrue( $this->register( 'godam/list-media' )['meta']['mcp']['public'], 'Reads stay listed.' );
	}

	/**
	 * With the MCP switch off, no GoDAM ability is offered to any MCP server or over REST.
	 *
	 * @return void
	 */
	public function test_mcp_switch_off_hides_every_ability() {
		$GLOBALS['rtgodam_stub']['options'][ Abilities::MCP_ENABLED_OPTION ] = '0';

		$read = $this->register( 'godam/list-media' );
		$this->assertFalse( $read['meta']['mcp']['public'] );
		$this->assertFalse( $read['meta']['public'] );
		$this->assertFalse( $read['meta']['show_in_rest'], 'Off also hides it from the WordPress Abilities REST API.' );
		$this->assertFalse( $this->register( 'godam/create-folder', true )['meta']['mcp']['public'] );
	}

	/**
	 * On a free site a Central-backed tool says it needs a plan and returns one clear error.
	 *
	 * @return void
	 */
	public function test_plan_tools_need_a_plan() {
		$free = $this->register( 'godam/get-top-videos' );

		$this->assertStringContainsString( 'Needs a GoDAM plan', $free['description'] );

		$error = call_user_func( $free['execute_callback'], array() );
		$this->assertInstanceOf( \WP_Error::class, $error );
		$this->assertSame( 'rtgodam_plan_required', $error->get_error_code() );

		$paid = $this->register( 'godam/get-top-videos', false, true );
		$this->assertSame( array( 'ran' => true ), call_user_func( $paid['execute_callback'], array() ) );

		$local = $this->register( 'godam/list-media' );
		$this->assertStringNotContainsString( 'GoDAM plan', $local['description'] );
		$this->assertSame( array( 'ran' => true ), call_user_func( $local['execute_callback'], array() ), 'Local tools work without a plan.' );
	}

	/**
	 * Only users who can upload files may open the GoDAM MCP server.
	 *
	 * @return void
	 */
	public function test_server_needs_upload_files() {
		$reflection = new \ReflectionClass( Mcp_Server::class );
		$server     = $reflection->newInstanceWithoutConstructor();

		$this->assertFalse( $server->can_connect(), 'A subscriber cannot list the tools.' );

		$GLOBALS['rtgodam_stub']['caps'] = array( 'upload_files' );
		$this->assertTrue( $server->can_connect() );
	}

	/**
	 * The MCP switch is on until an administrator turns it off, on new and
	 * updated sites alike.
	 *
	 * @return void
	 */
	public function test_mcp_switch_is_on_by_default() {
		$GLOBALS['rtgodam_stub']['options'] = array();
		$this->assertTrue( Abilities::mcp_enabled(), 'Never saved: on.' );

		$GLOBALS['rtgodam_stub']['options'] = array( 'rtgodam_plugin_version' => '2.9.0' );
		$this->assertTrue( Abilities::mcp_enabled(), 'Updated site: on.' );

		$GLOBALS['rtgodam_stub']['options'][ Abilities::MCP_ENABLED_OPTION ] = '0';
		$this->assertFalse( Abilities::mcp_enabled(), 'An admin\'s choice stays.' );
	}

	/**
	 * Switches are stored as 1 or 0, never an empty string the settings REST route rejects.
	 *
	 * @return void
	 */
	public function test_switches_are_stored_as_one_or_zero() {
		$this->assertSame( 0, Abilities::sanitize_switch( false ) );
		$this->assertSame( 0, Abilities::sanitize_switch( '' ) );
		$this->assertSame( 0, Abilities::sanitize_switch( '0' ) );
		$this->assertSame( 1, Abilities::sanitize_switch( true ) );
		$this->assertSame( 1, Abilities::sanitize_switch( '1' ) );
	}
}
