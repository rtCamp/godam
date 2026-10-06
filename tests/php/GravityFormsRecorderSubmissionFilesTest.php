<?php
/**
 * Unit tests for the GoDAM Record field's submission files on Gravity Forms 2.9.18+.
 *
 * Gravity Forms saves the field's recording on a page change or a failed submit and counts
 * that saved copy together with the file sent again, which failed forms with
 * "Number of files (2) exceeds limit (1)".
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Gravity_Forms\GF_Field_GoDAM_Video;

require_once dirname( __DIR__ ) . '/stubs/gravity-forms-fields.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/gravity-forms/class-gf-field-godam-video.php';

/**
 * @covers \RTGODAM\Inc\Gravity_Forms\GF_Field_GoDAM_Video::get_submission_files
 */
class GravityFormsRecorderSubmissionFilesTest extends TestCase {

	/**
	 * Builds a field whose parent returns the given files.
	 *
	 * @param array[] $existing Files Gravity Forms saved earlier.
	 * @param array[] $sent     Files sent in this request.
	 * @param bool    $multiple Whether the field accepts several files.
	 * @return GF_Field_GoDAM_Video
	 */
	private function field( array $existing, array $sent, $multiple = false ) {
		$field                = new GF_Field_GoDAM_Video();
		$field->multipleFiles = $multiple; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
		$field->queued_files  = array(
			'existing' => $existing,
			'new'      => $sent,
		);

		return $field;
	}

	/** A recording sent again replaces the saved copy, so Gravity Forms counts one file. */
	public function test_new_recording_replaces_saved_copy() {
		$saved = array( array( 'uploaded_filename' => 'audio-1.webm' ) );
		$new   = array( array( 'name' => 'audio-2.webm' ) );
		$field = $this->field( $saved, $new );

		$files = $field->get_submission_files();

		$this->assertSame( array(), $files['existing'] );
		$this->assertSame( $new, $files['new'] );
		$this->assertSame( $files, $field->stored_files, 'The trimmed list must be cached for later Gravity Forms calls.' );
	}

	/** With nothing sent again, the saved copy is the recording and must be kept. */
	public function test_saved_copy_kept_when_nothing_new_is_sent() {
		$saved = array( array( 'uploaded_filename' => 'audio-1.webm' ) );
		$field = $this->field( $saved, array() );

		$this->assertSame( $saved, $field->get_submission_files()['existing'] );
		$this->assertNull( $field->stored_files );
	}

	/** A first recording with nothing saved yet passes through unchanged. */
	public function test_first_recording_unchanged() {
		$new   = array( array( 'name' => 'audio-1.webm' ) );
		$field = $this->field( array(), $new );

		$this->assertSame( $new, $field->get_submission_files()['new'] );
		$this->assertNull( $field->stored_files );
	}

	/** A field set to accept several files keeps every file. */
	public function test_multiple_files_field_keeps_all_files() {
		$saved = array( array( 'uploaded_filename' => 'audio-1.webm' ) );
		$new   = array( array( 'name' => 'audio-2.webm' ) );
		$field = $this->field( $saved, $new, true );

		$this->assertSame( $saved, $field->get_submission_files()['existing'] );
		$this->assertNull( $field->stored_files );
	}
}
