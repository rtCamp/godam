<?php
/**
 * Narrow Gravity Forms field stubs, so the GoDAM Record field class can load outside WordPress.
 *
 * GF_Field_FileUpload mirrors only the submission-files cache of Gravity Forms 2.9.18+:
 * get_submission_files() returns what set_submission_files() stored, or the files the test
 * queued in $queued_files.
 *
 * @package GoDAM
 */

// phpcs:disable Generic.Files.OneObjectStructurePerFile.MultipleFound, WordPress.NamingConventions.ValidVariableName.PropertyNotSnakeCase

if ( ! class_exists( 'GF_Field' ) ) {
	/**
	 * Stub of Gravity Forms' base field.
	 */
	class GF_Field {}
}

if ( ! class_exists( 'GF_Field_FileUpload' ) ) {
	/**
	 * Stub of Gravity Forms' file upload field.
	 */
	class GF_Field_FileUpload extends GF_Field {

		/**
		 * Whether the field accepts several files.
		 *
		 * @var bool
		 */
		public $multipleFiles = false;

		/**
		 * Files the stub returns until set_submission_files() replaces them.
		 *
		 * @var array[]
		 */
		public $queued_files = array(
			'existing' => array(),
			'new'      => array(),
		);

		/**
		 * Files passed to set_submission_files(), or null when it was never called.
		 *
		 * @var array[]|null
		 */
		public $stored_files = null;

		/**
		 * Returns the cached submission files.
		 *
		 * @return array[]
		 */
		public function get_submission_files() {
			return null === $this->stored_files ? $this->queued_files : $this->stored_files;
		}

		/**
		 * Caches the submission files.
		 *
		 * @param array[] $files The files.
		 *
		 * @return void
		 */
		public function set_submission_files( $files ) {
			$this->stored_files = $files;
		}
	}
}
