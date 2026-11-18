<?php
/**
 * Saving why a transcode failed, from GoDAM Central's two callbacks.
 *
 * @see https://github.com/rtCamp/godam-plugin-wp/issues/109
 * @see https://github.com/rtCamp/godam-core/pull/1969
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * Runs in separate processes: each test stubs the meta writes.
 *
 * @covers ::rtgodam_save_transcoding_failure_reason
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class TranscodingFailureReasonSaveTest extends TestCase {

	const ID  = 42;
	const KEY = 'rtgodam_transcoding_failure_reason';

	/**
	 * Stub the meta writes and load the helpers.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_saved_meta'] = array();

		$stubs = array(
			'update_post_meta' => 'function update_post_meta( $id, $key, $value ) { $GLOBALS["rtgodam_saved_meta"][ $id ][ $key ] = $value; return true; }',
			'sanitize_key'     => 'function sanitize_key( $key ) { return preg_replace( "/[^a-z0-9_\\\\-]/", "", strtolower( (string) $key ) ); }',
		);

		foreach ( $stubs as $name => $code ) {
			if ( ! function_exists( $name ) ) {
				eval( $code ); // phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
			}
		}

		require_once dirname( __DIR__, 2 ) . '/inc/helpers/custom-functions.php';
	}

	/**
	 * The reason saved for the attachment, or null.
	 *
	 * @return string|null
	 */
	private function saved() {
		return $GLOBALS['rtgodam_saved_meta'][ self::ID ][ self::KEY ] ?? null;
	}

	public function test_a_failed_update_saves_its_reason() {
		$this->assertTrue( rtgodam_save_transcoding_failure_reason( self::ID, 'oom' ) );
		$this->assertSame( 'oom', $this->saved() );
	}

	/**
	 * The status callback and the main callback can land in either order; a progress update
	 * (or an older Central) sends "" and must not wipe the reason.
	 */
	public function test_an_empty_reason_keeps_the_one_already_saved() {
		rtgodam_save_transcoding_failure_reason( self::ID, 'timeout' );

		$this->assertFalse( rtgodam_save_transcoding_failure_reason( self::ID, '' ) );
		$this->assertFalse( rtgodam_save_transcoding_failure_reason( self::ID, null ) );
		$this->assertSame( 'timeout', $this->saved() );
	}

	public function test_the_reason_is_saved_as_a_code() {
		rtgodam_save_transcoding_failure_reason( self::ID, 'Storage_Limit' );
		$this->assertSame( 'storage_limit', $this->saved() );
	}

	public function test_nothing_is_saved_without_an_attachment() {
		$this->assertFalse( rtgodam_save_transcoding_failure_reason( 0, 'oom' ) );
		$this->assertSame( array(), $GLOBALS['rtgodam_saved_meta'] );
	}
}
