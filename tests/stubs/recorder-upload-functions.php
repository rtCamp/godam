<?php
/**
 * Narrow WordPress and form-plugin stubs for the recorder upload tests.
 *
 * They stand in for what the form recorder upload handlers call: the upload and JSON
 * response functions, the allowed upload types, and the Fluent Forms and Ninja Forms
 * APIs. Each reads per-test state from `$GLOBALS['rtgodam_stub']`, matching the
 * convention in bootstrap.php:
 *  - `allowed_mimes`      the site's allowed upload types (default: a core-like list);
 *  - `max_upload_size`    what wp_max_upload_size() returns;
 *  - `upload_result`      what wp_handle_upload() returns (default: a stored file);
 *  - `handled_uploads`    every wp_handle_upload() call, as array( 'file', 'overrides' );
 *  - `fluent_forms`       form ID => Fluent form row; `fluent_fields` what getElement() returns;
 *  - `ninja_fields`       form ID => array( field ID => RTGODAM_Test_Ninja_Field ).
 * wp_send_json*() cannot end the request here, so each throws an
 * RTGODAM_Test_JSON_Response that carries what would have been sent.
 *
 * All guarded so a real WP test bootstrap that already defines these wins; the tests that
 * load this file run in separate processes, because other tests stub the same names
 * differently.
 *
 * @package GoDAM
 */

// phpcs:disable Generic.Files.OneObjectStructurePerFile.MultipleFound, Universal.Files.SeparateFunctionsFromOO.Mixed, WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedClassFound, WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, WordPress.NamingConventions.ValidFunctionName.FunctionNameInvalid, WordPress.Security.EscapeOutput.ExceptionNotEscaped

if ( ! class_exists( 'RTGODAM_Test_JSON_Response' ) ) {
	/**
	 * What a wp_send_json*() call would have sent.
	 */
	class RTGODAM_Test_JSON_Response extends Exception {

		/**
		 * Which function was called: json, json_error or json_success.
		 *
		 * @var string
		 */
		public $kind;

		/**
		 * The payload passed to it.
		 *
		 * @var mixed
		 */
		public $payload;

		/**
		 * The HTTP status passed to it.
		 *
		 * @var int|null
		 */
		public $status;

		/**
		 * @param string   $kind    Function called.
		 * @param mixed    $payload Payload.
		 * @param int|null $status  HTTP status.
		 */
		public function __construct( $kind, $payload, $status ) {
			parent::__construct( $kind );
			$this->kind    = $kind;
			$this->payload = $payload;
			$this->status  = $status;
		}
	}
}

if ( ! class_exists( 'RTGODAM_Test_Ninja_Field' ) ) {
	/**
	 * A Ninja Forms field with a few settings.
	 */
	class RTGODAM_Test_Ninja_Field {

		/**
		 * Settings by key.
		 *
		 * @var array
		 */
		private $settings;

		/**
		 * @param array $settings Settings by key.
		 */
		public function __construct( array $settings ) {
			$this->settings = $settings;
		}

		/**
		 * @param string $key     Setting key.
		 * @param mixed  $default Value when the setting is not set.
		 * @return mixed
		 */
		public function get_setting( $key, $default = false ) { // phpcs:ignore Universal.NamingConventions.NoReservedKeywordParameterNames.defaultFound -- mirrors Ninja Forms' signature.
			return $this->settings[ $key ] ?? $default;
		}
	}
}

if ( ! class_exists( 'RTGODAM_Test_Ninja_Form' ) ) {
	/**
	 * What Ninja_Forms()->form( $id ) returns.
	 */
	class RTGODAM_Test_Ninja_Form {

		/**
		 * Form ID.
		 *
		 * @var int
		 */
		private $id;

		/**
		 * @param int $id Form ID.
		 */
		public function __construct( $id ) {
			$this->id = $id;
		}

		/**
		 * @return array Field ID => field, as the test set them for this form.
		 */
		public function get_fields() {
			return $GLOBALS['rtgodam_stub']['ninja_fields'][ $this->id ] ?? array();
		}
	}
}

if ( ! class_exists( 'RTGODAM_Test_Fluent_Query' ) ) {
	/**
	 * What wpFluent()->table() returns: it finds forms the test set.
	 */
	class RTGODAM_Test_Fluent_Query {

		/**
		 * @param string $table Table name; ignored.
		 * @return self
		 */
		public function table( $table ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- mirrors Fluent Forms' signature.
			return $this;
		}

		/**
		 * @param mixed $id Form ID.
		 * @return object|null The form the test set for that ID.
		 */
		public function find( $id ) {
			return $GLOBALS['rtgodam_stub']['fluent_forms'][ $id ] ?? null;
		}
	}
}

if ( ! function_exists( 'Ninja_Forms' ) ) {

	/**
	 * @return object Entry point with form().
	 */
	function Ninja_Forms() {
		return new class() {

			/**
			 * @param int $id Form ID.
			 * @return RTGODAM_Test_Ninja_Form
			 */
			public function form( $id = '' ) {
				return new RTGODAM_Test_Ninja_Form( $id );
			}
		};
	}
}

if ( ! function_exists( 'wpFluent' ) ) {

	/**
	 * @return RTGODAM_Test_Fluent_Query
	 */
	function wpFluent() {
		return new RTGODAM_Test_Fluent_Query();
	}
}

if ( ! function_exists( 'get_allowed_mime_types' ) ) {

	/**
	 * @return array The test's allowed upload types, or a list like core's default.
	 */
	function get_allowed_mime_types() {
		return $GLOBALS['rtgodam_stub']['allowed_mimes'] ?? array(
			'jpg|jpeg|jpe' => 'image/jpeg',
			'png'          => 'image/png',
			'txt|asc|c|cc' => 'text/plain',
			'pdf'          => 'application/pdf',
			'zip'          => 'application/zip',
			'mp3|m4a|m4b'  => 'audio/mpeg',
			'ogg|oga'      => 'audio/ogg',
			'wav'          => 'audio/x-wav',
			'mp4|m4v'      => 'video/mp4',
			'mov|qt'       => 'video/quicktime',
			'webm'         => 'video/webm',
			'mkv'          => 'video/x-matroska',
			'ogv'          => 'video/ogg',
		);
	}
}

if ( ! function_exists( 'wp_max_upload_size' ) ) {

	/**
	 * @return int
	 */
	function wp_max_upload_size() {
		return $GLOBALS['rtgodam_stub']['max_upload_size'] ?? 10485760;
	}
}

if ( ! function_exists( 'wp_handle_upload' ) ) {

	/**
	 * Records the call and returns the result the test set.
	 *
	 * @param array $file      The uploaded file.
	 * @param array $overrides Overrides passed to wp_handle_upload().
	 * @return array
	 */
	function wp_handle_upload( $file, $overrides = array() ) {
		$GLOBALS['rtgodam_stub']['handled_uploads'][] = array(
			'file'      => $file,
			'overrides' => $overrides,
		);

		return $GLOBALS['rtgodam_stub']['upload_result'] ?? array(
			'file' => '/uploads/godam/stored/' . $file['name'],
			'url'  => 'https://example.test/wp-content/uploads/godam/stored/' . $file['name'],
			'type' => 'video/webm',
		);
	}
}

if ( ! function_exists( 'wp_send_json' ) ) {

	/**
	 * @param mixed    $payload Payload.
	 * @param int|null $status  HTTP status.
	 * @throws RTGODAM_Test_JSON_Response Always.
	 */
	function wp_send_json( $payload, $status = null ) {
		throw new RTGODAM_Test_JSON_Response( 'json', $payload, $status );
	}
}

if ( ! function_exists( 'wp_send_json_error' ) ) {

	/**
	 * @param mixed    $payload Payload.
	 * @param int|null $status  HTTP status.
	 * @throws RTGODAM_Test_JSON_Response Always.
	 */
	function wp_send_json_error( $payload = null, $status = null ) {
		throw new RTGODAM_Test_JSON_Response( 'json_error', $payload, $status );
	}
}

if ( ! function_exists( 'wp_send_json_success' ) ) {

	/**
	 * @param mixed    $payload Payload.
	 * @param int|null $status  HTTP status.
	 * @throws RTGODAM_Test_JSON_Response Always.
	 */
	function wp_send_json_success( $payload = null, $status = null ) {
		throw new RTGODAM_Test_JSON_Response( 'json_success', $payload, $status );
	}
}

if ( ! function_exists( 'check_ajax_referer' ) ) {

	/**
	 * @return bool True; the nonce itself is not what these tests are about.
	 */
	function check_ajax_referer() {
		return true;
	}
}

if ( ! function_exists( 'wp_verify_nonce' ) ) {

	/**
	 * @return bool True; the nonce itself is not what these tests are about.
	 */
	function wp_verify_nonce() {
		return true;
	}
}

if ( ! function_exists( 'wp_unslash' ) ) {

	/**
	 * @param mixed $value Value.
	 * @return mixed
	 */
	function wp_unslash( $value ) {
		return $value;
	}
}

if ( ! function_exists( 'wp_basename' ) ) {

	/**
	 * @param string $path Path.
	 * @return string
	 */
	function wp_basename( $path ) {
		return basename( $path );
	}
}

if ( ! function_exists( 'wp_rand' ) ) {

	/**
	 * @return int
	 */
	function wp_rand() {
		return mt_rand(); // phpcs:ignore WordPress.WP.AlternativeFunctions.rand_mt_rand -- this stub stands in for wp_rand().
	}
}

if ( ! function_exists( 'sanitize_file_name' ) ) {

	/**
	 * @param string $name File name.
	 * @return string The name with spaces turned into dashes.
	 */
	function sanitize_file_name( $name ) {
		return str_replace( ' ', '-', (string) $name );
	}
}
