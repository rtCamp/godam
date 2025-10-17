<?php
/**
 * Class to handle file uploads using cURL.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Filesystem;

/**
 * Class Curl_Streamer
 *
 * This class handles file uploads using cURL by streaming the file content.
 */
class Curl_Streamer {

	/**
	 * The file path to upload.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	private $file_path;

	/**
	 * Constructor.
	 *
	 * @param string $file_path The path to the file to upload.
	 */
	public function __construct( $file_path ) {
		$this->file_path = $file_path;
	}

	/**
	 * Initialize the class by adding the necessary hooks.
	 *
	 * @since n.e.x.t
	 */
	public function init() {
		add_action( 'http_api_curl', array( $this, 'init_upload' ), 10 );
	}

	/**
	 * Deinitialize the class by removing
	 * the hooks added in the init method.
	 *
	 * @since n.e.x.t
	 */
	public function deinit() {
		remove_action( 'http_api_curl', array( $this, 'init_upload' ) );
	}

	/**
	 * Initialize the upload process by setting the necessary cURL options.
	 *
	 * @since n.e.x.t
	 *
	 * @param resource $curl_handle The cURL handle.
	 */
	public function init_upload( $curl_handle ) {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen -- FP - the file is opened read-only
		$file_stream = fopen( $this->file_path, 'r' );

		if ( ! $file_stream ) {
			return;
		}

		$file_size = filesize( $this->file_path );

		// phpcs:disable WordPress.WP.AlternativeFunctions.curl_curl_setopt
		curl_setopt( $curl_handle, CURLOPT_PUT, true ); // The Requests lib only sets `CURLOPT_CUSTOMREQUEST`; we need to explicitly set `CURLOPT_PUT` as well.
		curl_setopt( $curl_handle, CURLOPT_INFILE, $file_stream );
		curl_setopt( $curl_handle, CURLOPT_INFILESIZE, $file_size );
		curl_setopt( $curl_handle, CURLOPT_READFUNCTION, array( $this, 'handle_upload' ) );
		// phpcs:enable WordPress.WP.AlternativeFunctions.curl_curl_setopt
	}

	/**
	 * Handle the upload by reading the file stream.
	 *
	 * @since n.e.x.t
	 *
	 * @param resource $curl_handle The cURL handle.
	 * @param resource $file_stream The file stream to read from.
	 * @param int      $length      The length of data to read.
	 *
	 * @return string The data read from the file stream.
	 */
	public function handle_upload( $curl_handle, $file_stream, $length ) {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread
		$data = fread( $file_stream, $length );
		if ( ! $data ) {
			return '';
		}

		return $data;
	}
}
