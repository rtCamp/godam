<?php
/**
 * Unit tests for the Ninja Forms recorder field's upload.
 *
 * The upload runs for any visitor holding the field's nonce, so it only takes a file for a
 * recorder field that belongs to the form named in the request, within the field's own
 * size limit (the server's when it has none), and only as audio or video. A file
 * WordPress refuses is an error, not a success.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Ninja_Forms\Ninja_Forms_Field_Godam_Recorder;

/**
 * Runs in separate processes: the stubs it loads are stubbed differently by other tests.
 *
 * @covers \RTGODAM\Inc\Ninja_Forms\Ninja_Forms_Field_Godam_Recorder::ajax_upload
 * @covers \RTGODAM\Inc\Ninja_Forms\Ninja_Forms_Field_Godam_Recorder::get_recorder_field
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class NinjaFormsRecorderUploadTest extends TestCase {

	/**
	 * Load the field and give the test a form with a recorder field and a text field.
	 */
	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/recorder-upload-functions.php';
		require_once dirname( __DIR__ ) . '/stubs/form-plugin-classes.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/ninja-forms/class-ninja-forms-field-godam-recorder.php';

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array(
			'handled_uploads' => array(),
			'max_upload_size' => 4 * 1048576,
			'ninja_fields'    => array(
				3 => array(
					9  => new \RTGODAM_Test_Ninja_Field(
						array(
							'type'          => 'godam_recorder',
							'max_file_size' => '2',
						)
					),
					10 => new \RTGODAM_Test_Ninja_Field( array( 'type' => 'textbox' ) ),
					11 => new \RTGODAM_Test_Ninja_Field( array( 'type' => 'godam_recorder' ) ),
				),
				4 => array(
					12 => new \RTGODAM_Test_Ninja_Field( array( 'type' => 'textbox' ) ),
				),
			),
		);

		$_POST  = array(
			'form_id'  => '3',
			'field_id' => '9',
			'nonce'    => 'nonce',
		);
		$_FILES = array( 'files-9' => $this->file( 'webcam-1700000000000.webm', 1024 ) );
	}

	/**
	 * An entry of $_FILES.
	 *
	 * @param string $name Original file name.
	 * @param int    $size Size in bytes.
	 * @return array
	 */
	private function file( $name, $size ) {
		return array(
			'name'     => $name,
			'type'     => 'video/webm',
			'tmp_name' => '/tmp/php-upload',
			'error'    => 0,
			'size'     => $size,
		);
	}

	/**
	 * Run the upload and return what it sent.
	 *
	 * @return \RTGODAM_Test_JSON_Response
	 */
	private function upload() {
		$field = ( new \ReflectionClass( Ninja_Forms_Field_Godam_Recorder::class ) )->newInstanceWithoutConstructor();

		try {
			$field->ajax_upload();
		} catch ( \RTGODAM_Test_JSON_Response $response ) {
			return $response;
		}

		$this->fail( 'The upload sent no response.' );
	}

	/**
	 * A recording for a recorder field of the form is stored and its address handed back.
	 */
	public function test_a_recording_is_stored() {
		$response = $this->upload();

		$this->assertSame( 'json_success', $response->kind );
		$this->assertStringStartsWith( 'godam-nf-', $response->payload['file_name'] );
		$this->assertStringContainsString( '/godam/stored/', $response->payload['file_path'] );
		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['handled_uploads'] );
	}

	/**
	 * The upload is limited to audio and video, whatever the site's other upload types are.
	 */
	public function test_only_audio_and_video_types_are_passed_to_wordpress() {
		$this->upload();

		$overrides = $GLOBALS['rtgodam_stub']['handled_uploads'][0]['overrides'];

		$this->assertFalse( $overrides['test_form'] );
		$this->assertSame( rtgodam_get_recorder_upload_mimes(), $overrides['mimes'] );
		$this->assertArrayHasKey( 'webm', $overrides['mimes'] );
		$this->assertArrayNotHasKey( 'pdf', $overrides['mimes'] );
	}

	/**
	 * A form that does not exist stores nothing.
	 */
	public function test_a_form_that_does_not_exist_stores_nothing() {
		$_POST['form_id'] = '99';

		$response = $this->upload();

		$this->assertSame( 'json_error', $response->kind );
		$this->assertSame( 404, $response->status );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['handled_uploads'] );
	}

	/**
	 * A recorder field of another form cannot be used through this form.
	 */
	public function test_a_field_of_another_form_stores_nothing() {
		$_POST['form_id'] = '4';

		$response = $this->upload();

		$this->assertSame( 404, $response->status );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['handled_uploads'] );
	}

	/**
	 * A field that is not a recorder field stores nothing.
	 */
	public function test_a_field_that_is_not_a_recorder_stores_nothing() {
		$_POST['field_id'] = '10';
		$_FILES            = array( 'files-10' => $this->file( 'webcam-1.webm', 1024 ) );

		$response = $this->upload();

		$this->assertSame( 404, $response->status );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['handled_uploads'] );
	}

	/**
	 * A request that names no form or field stores nothing.
	 */
	public function test_a_request_without_a_form_or_field_stores_nothing() {
		$_POST['form_id'] = '';

		$this->assertSame( 404, $this->upload()->status );

		$_POST['form_id']  = '3';
		$_POST['field_id'] = '';

		$this->assertSame( 404, $this->upload()->status );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['handled_uploads'] );
	}

	/**
	 * A file posted under another field's key is not the field's file.
	 */
	public function test_a_file_under_another_key_stores_nothing() {
		$_FILES = array( 'files-10' => $this->file( 'webcam-1.webm', 1024 ) );

		$response = $this->upload();

		$this->assertSame( 'json_error', $response->kind );
		$this->assertSame( 400, $response->status );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['handled_uploads'] );
	}

	/**
	 * A file over the field's own limit is refused.
	 */
	public function test_a_file_over_the_fields_limit_is_refused() {
		$_FILES = array( 'files-9' => $this->file( 'webcam-1.webm', 3 * 1048576 ) );

		$response = $this->upload();

		$this->assertSame( 'json_error', $response->kind );
		$this->assertSame( 400, $response->status );
		$this->assertStringContainsString( '2MB', $response->payload );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['handled_uploads'] );
	}

	/**
	 * A field with no limit set takes files up to the server's limit and no more.
	 */
	public function test_a_field_without_a_limit_uses_the_servers() {
		$_POST['field_id'] = '11';

		$_FILES = array( 'files-11' => $this->file( 'webcam-1.webm', 3 * 1048576 ) );
		$this->assertSame( 'json_success', $this->upload()->kind );

		$_FILES   = array( 'files-11' => $this->file( 'webcam-2.webm', 5 * 1048576 ) );
		$response = $this->upload();

		$this->assertSame( 'json_error', $response->kind );
		$this->assertStringContainsString( '4MB', $response->payload );
		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['handled_uploads'] );
	}

	/**
	 * A file WordPress refuses is an error for the visitor, not a success with no file.
	 */
	public function test_a_file_wordpress_refuses_is_an_error() {
		$GLOBALS['rtgodam_stub']['upload_result'] = array( 'error' => 'Sorry, you are not allowed to upload this file type.' );

		$response = $this->upload();

		$this->assertSame( 'json_error', $response->kind );
		$this->assertSame( 400, $response->status );
		$this->assertSame( 'Sorry, you are not allowed to upload this file type.', $response->payload );
	}
}
