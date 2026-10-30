<?php
/**
 * Unit tests for the Fluent Forms recorder field's upload.
 *
 * The upload runs for any visitor, so it only takes a file for a form that has a recorder
 * field, only under the recorder's own file key, only within the field's own size limit,
 * and only as audio or video. A file WordPress refuses is an error, not a success.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\FluentForms\Fields\Recorder_Field;

/**
 * Runs in separate processes: the stubs it loads are stubbed differently by other tests.
 *
 * @covers \RTGODAM\Inc\FluentForms\Fields\Recorder_Field::upload_file_to_temp
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class FluentFormsRecorderUploadTest extends TestCase {

	/**
	 * Load the field and give the test a form with a recorder field.
	 */
	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/recorder-upload-functions.php';
		require_once dirname( __DIR__ ) . '/stubs/form-plugin-classes.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/fluentforms/fields/class-recorder-field.php';

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array(
			'fluent_forms'    => array( 7 => (object) array( 'id' => 7 ) ),
			'fluent_fields'   => array( 'godam-recorder-field' => $this->recorder_field( 5 * 1048576 ) ),
			'handled_uploads' => array(),
		);

		$_REQUEST = array( 'ff-form-id' => '7' );
		$_FILES   = array( 'ff-godam-input-recorder' => $this->file( 'webcam-1700000000000.webm', 2048 ) );
	}

	/**
	 * A recorder field as Fluent Forms parses it, with the editor's default file types.
	 *
	 * @param int $max_size Size limit in bytes.
	 * @return array
	 */
	private function recorder_field( $max_size ) {
		return array(
			'settings' => array(
				'validation_rules' => array(
					'max_file_size'      => array(
						'value'   => $max_size,
						'message' => 'File is too big',
					),
					'allowed_file_types' => array(
						'value'   => array( 'avi|divx|flv|mov|ogv|mkv|mp4|m4v|divx|mpg|mpeg|mpe|video/quicktime|qt|webm' ),
						'message' => 'Invalid file type',
					),
				),
			),
		);
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
		$field = ( new \ReflectionClass( Recorder_Field::class ) )->newInstanceWithoutConstructor();

		try {
			$field->upload_file_to_temp();
		} catch ( \RTGODAM_Test_JSON_Response $response ) {
			return $response;
		}

		$this->fail( 'The upload sent no response.' );
	}

	/**
	 * A recording for a form with a recorder field is stored and handed back with an encrypted name.
	 */
	public function test_a_recording_is_stored() {
		$response = $this->upload();

		$this->assertSame( 'json_success', $response->kind );
		$this->assertCount( 1, $response->payload );
		$this->assertSame( 'video/webm', $response->payload[0]['type'] );
		$this->assertStringStartsWith( 'enc-godam-ff-', $response->payload[0]['file'] );
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
		$_REQUEST['ff-form-id'] = '99';

		$response = $this->upload();

		$this->assertSame( 'json_error', $response->kind );
		$this->assertSame( 400, $response->status );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['handled_uploads'] );
	}

	/**
	 * A form without a recorder field stores nothing, whatever the file is.
	 */
	public function test_a_form_without_a_recorder_field_stores_nothing() {
		$GLOBALS['rtgodam_stub']['fluent_fields'] = array();

		$response = $this->upload();

		$this->assertSame( 'json_error', $response->kind );
		$this->assertSame( 400, $response->status );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['handled_uploads'] );
	}

	/**
	 * A recorder field renamed in the editor is still the form's recorder field, and its rules apply.
	 */
	public function test_a_renamed_recorder_field_is_found_and_its_rules_apply() {
		$GLOBALS['rtgodam_stub']['fluent_fields'] = array( 'my-recording' => $this->recorder_field( 1024 ) );

		$response = $this->upload();

		$this->assertSame( 'json', $response->kind );
		$this->assertSame( 422, $response->status );
		$this->assertSame( array( 'File is too big' ), $response->payload['error'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['handled_uploads'] );
	}

	/**
	 * A file posted under any other key is ignored.
	 */
	public function test_a_file_under_another_key_is_ignored() {
		$_FILES = array(
			'other-godam-input-recorder' => $this->file( 'webcam-1.webm', 2048 ),
			'file'                       => $this->file( 'webcam-2.webm', 2048 ),
		);

		$response = $this->upload();

		$this->assertSame( 'json_success', $response->kind );
		$this->assertSame( array(), $response->payload );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['handled_uploads'] );
	}

	/**
	 * A file over the field's own limit is refused.
	 */
	public function test_a_file_over_the_fields_limit_is_refused() {
		$_FILES['ff-godam-input-recorder'] = $this->file( 'webcam-1.webm', 6 * 1048576 );

		$response = $this->upload();

		$this->assertSame( 422, $response->status );
		$this->assertSame( array( 'File is too big' ), $response->payload['error'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['handled_uploads'] );
	}

	/**
	 * A file type the field does not allow is refused before WordPress is asked.
	 */
	public function test_a_file_type_the_field_does_not_allow_is_refused() {
		$_FILES['ff-godam-input-recorder'] = $this->file( 'document.pdf', 2048 );

		$response = $this->upload();

		$this->assertSame( 422, $response->status );
		$this->assertSame( array( 'Invalid file type' ), $response->payload['error'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['handled_uploads'] );
	}

	/**
	 * A file WordPress refuses is an error for the visitor, not an empty success.
	 */
	public function test_a_file_wordpress_refuses_is_an_error() {
		$GLOBALS['rtgodam_stub']['upload_result'] = array( 'error' => 'Sorry, you are not allowed to upload this file type.' );

		$response = $this->upload();

		$this->assertSame( 'json', $response->kind );
		$this->assertSame( 422, $response->status );
		$this->assertSame( array( 'Sorry, you are not allowed to upload this file type.' ), $response->payload['error'] );
	}

	/**
	 * A file with no content, or one the server could not take, is an error.
	 */
	public function test_an_empty_file_is_an_error() {
		$_FILES['ff-godam-input-recorder'] = $this->file( 'webcam-1.webm', 0 );

		$response = $this->upload();

		$this->assertSame( 'json_error', $response->kind );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['handled_uploads'] );
	}
}
