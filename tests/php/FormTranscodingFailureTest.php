<?php
/**
 * A form recording that couldn't be sent for transcoding leaves the visitor's
 * submission alone and tells the site owner why.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * Runs in separate processes: each test defines its own GFAPI stand-in.
 *
 * @covers ::rtgodam_handle_form_transcoding_failure
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class FormTranscodingFailureTest extends TestCase {

	/**
	 * Record notes and the action's arguments.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_notes']  = array();
		$GLOBALS['rtgodam_failed'] = array();

		// phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
		eval( 'class GFAPI { public static function add_note( $entry_id, $user_id, $user_name, $note ) { $GLOBALS["rtgodam_notes"][] = compact( "entry_id", "user_name", "note" ); return 1; } }' );

		add_action(
			'rtgodam_form_transcoding_failed',
			function ( $form_type, $entry_id, $reason ) {
				$GLOBALS['rtgodam_failed'][] = array( $form_type, $entry_id, $reason );
			},
			10,
			3
		);
	}

	/**
	 * A refusal's plain reason goes on the Gravity Forms entry, not to the visitor.
	 */
	public function test_gravity_forms_entry_gets_the_reason_as_a_note() {
		rtgodam_handle_form_transcoding_failure(
			'gf',
			12,
			new \WP_Error( 400, 'Transcoding failed | entry Id: 12', array( 'reason' => 'Your GoDAM storage is full. Upgrade your plan or delete unused files.' ) )
		);

		$this->assertCount( 1, $GLOBALS['rtgodam_notes'] );
		$this->assertSame( 12, $GLOBALS['rtgodam_notes'][0]['entry_id'] );
		$this->assertStringStartsWith( "The recording couldn't be transcoded. Your GoDAM storage is full. Upgrade your plan or delete unused files.", $GLOBALS['rtgodam_notes'][0]['note'] );
		$this->assertStringContainsString( 'Contact Support', $GLOBALS['rtgodam_notes'][0]['note'] );
		$this->assertSame( array( array( 'gf', 12, 'Your GoDAM storage is full. Upgrade your plan or delete unused files.' ) ), $GLOBALS['rtgodam_failed'] );
	}

	/**
	 * Without a refusal reason (server error, timeout, no job returned) the owner still
	 * gets a plain sentence.
	 *
	 * @dataProvider failures_without_a_reason
	 *
	 * @param mixed $response What the send returned.
	 */
	public function test_failure_without_a_reason_gets_plain_copy( $response ) {
		rtgodam_handle_form_transcoding_failure( 'gf', 7, $response );

		$this->assertStringStartsWith( "The recording couldn't be transcoded. The transcoding service couldn't accept the recording.", $GLOBALS['rtgodam_notes'][0]['note'] );
	}

	/**
	 * Failures that carry no reason.
	 *
	 * @return array[]
	 */
	public function failures_without_a_reason() {
		return array(
			'server error' => array( new \WP_Error( 400, 'Transcoding failed | entry Id: 7', array( 'reason' => '' ) ) ),
			'no job'       => array( (object) array( 'data' => null ) ),
		);
	}

	/**
	 * Transcoding turned off by the site owner says so.
	 */
	public function test_disabled_transcoding_keeps_its_message() {
		rtgodam_handle_form_transcoding_failure( 'gf', 7, new \WP_Error( 'transcoding_disabled', 'Form transcoding has been disabled by the site administrator.' ) );

		$this->assertSame( "The recording couldn't be transcoded. Form transcoding has been disabled by the site administrator.", $GLOBALS['rtgodam_notes'][0]['note'] );
	}

	/**
	 * Other form plugins get no Gravity Forms note, but the action carries the reason.
	 */
	public function test_other_forms_fire_the_action_only() {
		rtgodam_handle_form_transcoding_failure( 'wpforms', 3, new \WP_Error( 400, 'Transcoding failed | entry Id: 3', array( 'reason' => 'This site\'s API key wasn\'t recognised.' ) ) );

		$this->assertSame( array(), $GLOBALS['rtgodam_notes'] );
		$this->assertSame( array( array( 'wpforms', 3, 'This site\'s API key wasn\'t recognised.' ) ), $GLOBALS['rtgodam_failed'] );
	}
}
