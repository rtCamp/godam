<?php
/**
 * Unit tests for the Retranscode tool's media-type => MIME map.
 *
 * The `not-transcoded` route lets the user pick which kind of media to fetch, and every
 * downstream decision keys off the map returned by Transcoding::get_media_type_mime_map():
 *
 * 1. The route's `media_type` enum is `array_keys()` of this map, so a key added or dropped
 *    here silently changes which values the REST API accepts.
 * 2. get_media_require_retranscoding() splits each type's MIME list into a document half
 *    (array_intersect with the document MIME types) and a plain half (array_diff). That split
 *    is only correct while the top-level types and the document MIME types stay disjoint.
 * 3. The transcoder converts `application/ogg` audio, but WordPress files typed that way are
 *    not caught by the bare `audio` top-level match — so `audio` and `all` must name it
 *    explicitly. This is the exact gap the map fix closed, and the one most likely to regress.
 *
 * These are pure-array assertions: the methods under test only read
 * rtgodam_get_supported_document_types(), which is itself dependency-free.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Transcoding;

/**
 * @covers \RTGODAM\Inc\REST_API\Transcoding::get_media_type_mime_map
 * @covers \RTGODAM\Inc\REST_API\Transcoding::get_document_mime_types
 */
class RetranscodeMediaTypeMapTest extends TestCase {

	/**
	 * Invoke a private static method on Transcoding by reflection.
	 *
	 * @param string $method Method name.
	 * @return mixed Return value of the method.
	 */
	private function invoke_static( $method ) {
		$m = new \ReflectionMethod( Transcoding::class, $method );
		$m->setAccessible( true );
		return $m->invoke( null );
	}

	/**
	 * The document MIME types the map builds on are exactly the helper's keys — no more, no
	 * fewer — so document fetching covers precisely what Central's document pipeline accepts.
	 *
	 * @return void
	 */
	public function test_document_mime_types_match_the_helper() {
		$this->assertSame(
			array_keys( rtgodam_get_supported_document_types() ),
			$this->invoke_static( 'get_document_mime_types' ),
		);
	}

	/**
	 * The map exposes exactly the five selectable types, and the default type is one of them —
	 * the JS MEDIA_TYPE_OPTIONS list and the route enum both derive from these keys.
	 *
	 * @return void
	 */
	public function test_map_exposes_the_expected_media_types() {
		$map = $this->invoke_static( 'get_media_type_mime_map' );

		$this->assertSame(
			array( 'all', 'video', 'audio', 'document', 'image' ),
			array_keys( $map ),
		);
		$this->assertArrayHasKey( Transcoding::DEFAULT_MEDIA_TYPE, $map );
	}

	/**
	 * Video and image resolve to their bare top-level type, nothing else.
	 *
	 * @return void
	 */
	public function test_single_type_entries() {
		$map = $this->invoke_static( 'get_media_type_mime_map' );

		$this->assertSame( array( 'video' ), $map['video'] );
		$this->assertSame( array( 'image' ), $map['image'] );
	}

	/**
	 * Audio carries application/ogg alongside the top-level type, so a file WordPress typed as
	 * application/ogg — which the bare `audio` match misses — is still fetched.
	 *
	 * @return void
	 */
	public function test_audio_includes_application_ogg() {
		$map = $this->invoke_static( 'get_media_type_mime_map' );

		$this->assertContains( 'audio', $map['audio'] );
		$this->assertContains( 'application/ogg', $map['audio'] );
	}

	/**
	 * Document resolves to every convertible document MIME type and nothing else.
	 *
	 * @return void
	 */
	public function test_document_entry_is_the_document_mimes() {
		$map = $this->invoke_static( 'get_media_type_mime_map' );

		$this->assertSame(
			array_keys( rtgodam_get_supported_document_types() ),
			$map['document'],
		);
	}

	/**
	 * `all` is the union: every top-level media type (audio, video, image), application/ogg, and
	 * every document MIME. Missing any one would leave that kind unreachable through "All media".
	 *
	 * @return void
	 */
	public function test_all_covers_every_supported_type() {
		$map = $this->invoke_static( 'get_media_type_mime_map' );

		foreach ( array( 'video', 'audio', 'image', 'application/ogg' ) as $expected ) {
			$this->assertContains( $expected, $map['all'] );
		}

		foreach ( array_keys( rtgodam_get_supported_document_types() ) as $document_mime ) {
			$this->assertContains( $document_mime, $map['all'] );
		}
	}

	/**
	 * The route splits each MIME list into a document half and a plain half by set difference,
	 * so the top-level types and application/ogg must never collide with a document MIME —
	 * otherwise a plain type would be misrouted into the document scan, or vice versa.
	 *
	 * @return void
	 */
	public function test_plain_types_are_disjoint_from_document_mimes() {
		$document_mimes = array_keys( rtgodam_get_supported_document_types() );

		foreach ( array( 'video', 'audio', 'image', 'application/ogg' ) as $plain_type ) {
			$this->assertNotContains( $plain_type, $document_mimes );
		}
	}
}
