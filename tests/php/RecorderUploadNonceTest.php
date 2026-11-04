<?php
/**
 * The fresh upload nonce for the Fluent Forms and Ninja Forms recorder fields.
 *
 * A page cache can serve a form page for longer than its printed nonce lives, so
 * the recorder asks Recorder_Upload_Nonce for a fresh one before it uploads. The
 * nonce it hands out has to be for the same action the upload handler checks.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Recorder_Upload_Nonce;

/**
 * Runs in separate processes: the stubs below are defined with eval and must not
 * reach other tests.
 *
 * @covers \RTGODAM\Inc\Recorder_Upload_Nonce
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class RecorderUploadNonceTest extends TestCase {

	/**
	 * The class under test, built without its constructor (which adds hooks).
	 *
	 * @var Recorder_Upload_Nonce
	 */
	private $route;

	/**
	 * Load the class and stub the slice of WordPress it touches.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array();

		$root = dirname( __DIR__, 2 );
		require_once $root . '/inc/traits/trait-singleton.php';
		require_once $root . '/inc/classes/class-recorder-upload-nonce.php';

		// Stubs the shared bootstrap may already define are kept. The senders end the request,
		// so their stubs throw to let the test read what was sent.
		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		function_exists( 'sanitize_key' ) || eval( 'function sanitize_key( $key ) { return preg_replace( "/[^a-z0-9_\-]/", "", strtolower( $key ) ); }' );
		function_exists( 'wp_unslash' ) || eval( 'function wp_unslash( $value ) { return $value; }' );
		function_exists( '__' ) || eval( 'function __( $text ) { return $text; }' );
		function_exists( 'nocache_headers' ) || eval( 'function nocache_headers() { $GLOBALS["rtgodam_stub"]["nocache"] = true; }' );
		function_exists( 'wp_create_nonce' ) || eval( 'function wp_create_nonce( $action ) { return "nonce-for:" . $action; }' );
		function_exists( 'wp_send_json_error' ) || eval( 'function wp_send_json_error( $data = null, $status = null ) { $GLOBALS["rtgodam_stub"]["json"] = array( "success" => false, "data" => $data, "status" => $status ); throw new \RuntimeException( "json" ); }' );
		function_exists( 'wp_send_json_success' ) || eval( 'function wp_send_json_success( $data = null ) { $GLOBALS["rtgodam_stub"]["json"] = array( "success" => true, "data" => $data, "status" => null ); throw new \RuntimeException( "json" ); }' );
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		$this->route = ( new \ReflectionClass( Recorder_Upload_Nonce::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * Clear the request and stub state.
	 */
	protected function tearDown(): void {
		$_POST = array();
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Call the route with these POST fields and return what it sent.
	 *
	 * @param array $post POST fields.
	 *
	 * @return array The JSON response.
	 */
	private function send( array $post ): array {
		$_POST = $post;

		try {
			$this->route->send_nonce();
		} catch ( \RuntimeException $e ) {
			unset( $e );
		}

		return $GLOBALS['rtgodam_stub']['json'];
	}

	public function test_fluent_forms_gets_the_nonce_its_upload_handler_checks(): void {
		$json = $this->send( array( 'form' => 'fluentforms' ) );

		$this->assertTrue( $json['success'] );
		$this->assertSame( 'nonce-for:recorder-fluentforms', $json['data']['nonce'] );
		$this->assertTrue( $GLOBALS['rtgodam_stub']['nocache'] );
	}

	public function test_ninja_forms_gets_the_nonce_for_its_field(): void {
		$json = $this->send(
			array(
				'form'     => 'ninja-forms',
				'field_id' => '12',
			)
		);

		$this->assertTrue( $json['success'] );
		$this->assertSame( 'nonce-for:godam_recorder_12', $json['data']['nonce'] );
	}

	/**
	 * @dataProvider unknown_fields
	 *
	 * @param array $post POST fields.
	 */
	public function test_an_unknown_field_gets_no_nonce( array $post ): void {
		$json = $this->send( $post );

		$this->assertFalse( $json['success'] );
		$this->assertSame( 400, $json['status'] );
		$this->assertArrayNotHasKey( 'nocache', $GLOBALS['rtgodam_stub'] );
	}

	/**
	 * @return array
	 */
	public function unknown_fields(): array {
		return array(
			'no form'                 => array( array() ),
			'another form plugin'     => array( array( 'form' => 'gravity-forms' ) ),
			'ninja forms, no field'   => array( array( 'form' => 'ninja-forms' ) ),
			'ninja forms, field zero' => array(
				array(
					'form'     => 'ninja-forms',
					'field_id' => '0',
				),
			),
		);
	}

	/**
	 * The upload handlers still check these exact actions. If one is renamed there,
	 * this route would hand out a nonce that never verifies.
	 */
	public function test_the_upload_handlers_check_the_same_actions(): void {
		$root = dirname( __DIR__, 2 );

		$fluent = (string) file_get_contents( $root . '/inc/classes/fluentforms/fields/class-recorder-field.php' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reading a local source file in a test.
		$ninja  = (string) file_get_contents( $root . '/inc/classes/ninja-forms/class-ninja-forms-field-godam-recorder.php' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reading a local source file in a test.

		$this->assertStringContainsString( "check_ajax_referer( '" . Recorder_Upload_Nonce::get_nonce_action( 'fluentforms', 0 ) . "'", $fluent );
		$this->assertSame( 'godam_recorder_5', Recorder_Upload_Nonce::get_nonce_action( 'ninja-forms', 5 ) );
		$this->assertStringContainsString( "wp_verify_nonce( \$nonce, 'godam_recorder_' . \$field_id )", $ninja );
	}
}
