<?php
/**
 * Tests that godam/import-media-from-url keeps to the Media Library's upload size limit.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Library_Abilities;

/**
 * An agent's URL import must stop at the same size limit as an upload in the
 * Media Library, so it cannot fill the disk.
 *
 * Runs in its own process because it defines core functions.
 *
 * @covers \RTGODAM\Inc\Abilities\Library_Abilities::import_media_from_url
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class ImportMediaLimitTest extends TestCase {

	/**
	 * Loads the ability with stubs for the core functions it calls.
	 *
	 * @param int $max_size What wp_max_upload_size() returns.
	 * @param int $file_size Size of the file the URL serves.
	 *
	 * @return Library_Abilities
	 */
	private function ability( $max_size, $file_size ) {
		$GLOBALS['rtgodam_stub'] = array(
			'options'   => array(),
			'caps'      => array(),
			'max_size'  => $max_size,
			'file_size' => $file_size,
			'downloads' => array(),
			'args'      => array(),
			'deleted'   => array(),
			'sideload'  => 0,
		);

		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-abilities.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-library-abilities.php';
		require_once dirname( __DIR__ ) . '/stubs/hooks.php';

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		if ( ! function_exists( 'esc_url_raw' ) ) {
			eval( 'function esc_url_raw( $url, $protocols = null ) { return (string) $url; }' ); }
		if ( ! function_exists( 'wp_http_validate_url' ) ) {
			eval( 'function wp_http_validate_url( $url ) { return $url; }' ); }
		if ( ! function_exists( 'wp_max_upload_size' ) ) {
			eval( 'function wp_max_upload_size() { return $GLOBALS["rtgodam_stub"]["max_size"]; }' ); }
		if ( ! function_exists( 'size_format' ) ) {
			eval( 'function size_format( $bytes ) { return $bytes . " B"; }' ); }
		if ( ! function_exists( 'is_multisite' ) ) {
			eval( 'function is_multisite() { return false; }' ); }
		if ( ! function_exists( 'sanitize_file_name' ) ) {
			eval( 'function sanitize_file_name( $name ) { return $name; }' ); }
		if ( ! function_exists( 'wp_basename' ) ) {
			eval( 'function wp_basename( $path ) { return basename( (string) $path ); }' ); }
		if ( ! function_exists( 'wp_parse_url' ) ) {
			eval( 'function wp_parse_url( $url, $component = -1 ) { return parse_url( $url, $component ); }' ); }
		if ( ! function_exists( 'wp_delete_file' ) ) {
			eval( 'function wp_delete_file( $file ) { $GLOBALS["rtgodam_stub"]["deleted"][] = $file; return is_file( $file ) && unlink( $file ); }' ); }
		if ( ! function_exists( 'media_handle_sideload' ) ) {
			eval( 'function media_handle_sideload( $file ) { $GLOBALS["rtgodam_stub"]["sideload"]++; return 7; }' ); }
		eval(
			'function download_url( $url ) {
				$GLOBALS["rtgodam_stub"]["downloads"][] = $url;
				$GLOBALS["rtgodam_stub"]["args"][] = apply_filters( "http_request_args", array(), $url );
				$temp = tempnam( sys_get_temp_dir(), "godam-import-" );
				file_put_contents( $temp, str_repeat( "x", $GLOBALS["rtgodam_stub"]["file_size"] ) );
				return $temp;
			}'
		);
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		$reflection = new \ReflectionClass( Library_Abilities::class );

		return $reflection->newInstanceWithoutConstructor();
	}

	/**
	 * A file over the limit is refused, deleted, and never added to the library.
	 *
	 * @return void
	 */
	public function test_a_file_over_the_limit_is_refused() {
		$result = $this->ability( 100, 150 )->import_media_from_url( array( 'url' => 'https://example.com/big.mp4' ) );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'rest_upload_file_too_big', $result->get_error_code() );
		$this->assertStringContainsString( 'Use a smaller file', $result->get_error_message(), 'The error says what to do next.' );
		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['sideload'], 'Nothing is added to the library.' );
		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['deleted'], 'The downloaded file is deleted.' );
	}

	/**
	 * The download itself stops one byte past the limit, and the limit is lifted afterwards.
	 *
	 * @return void
	 */
	public function test_the_download_stops_at_the_limit() {
		$this->ability( 100, 150 )->import_media_from_url( array( 'url' => 'https://example.com/big.mp4' ) );

		$this->assertSame( 101, $GLOBALS['rtgodam_stub']['args'][0]['limit_response_size'] );
		$this->assertSame( array(), apply_filters( 'http_request_args', array(), 'https://example.com/other' ), 'Other requests are not limited.' );
	}

	/**
	 * When the site takes no uploads, nothing is downloaded at all.
	 *
	 * @return void
	 */
	public function test_nothing_is_downloaded_when_uploads_are_off() {
		$result = $this->ability( 0, 150 )->import_media_from_url( array( 'url' => 'https://example.com/clip.mp4' ) );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'rest_upload_limited_space', $result->get_error_code() );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['downloads'] );
	}
}
