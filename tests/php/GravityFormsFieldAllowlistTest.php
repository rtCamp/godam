<?php
/**
 * Unit tests for the Gravity Forms collection field allowlist.
 *
 * Regression cover for the unauthenticated disclosure fixed in #1289: the
 * `/godam/v1/gforms` response used to be narrowed only when the caller passed a
 * `fields` parameter, so omitting it returned the whole form object —
 * notifications, confirmations and any add-on settings held in form meta.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\GF;

/**
 * @covers \RTGODAM\Inc\REST_API\GF::resolve_requested_fields
 */
class GravityFormsFieldAllowlistTest extends TestCase {

	/** No `fields` parameter must still return only the allowlist, never everything. */
	public function test_missing_fields_returns_allowlist() {
		$this->assertSame( array( 'id', 'title', 'description' ), GF::resolve_requested_fields( null ) );
	}

	/** An empty string is the same case as omitting the parameter. */
	public function test_empty_fields_returns_allowlist() {
		$this->assertSame( array( 'id', 'title', 'description' ), GF::resolve_requested_fields( '' ) );
	}

	/** The Video Editor's own request is honoured unchanged. */
	public function test_video_editor_request_is_honoured() {
		$this->assertSame(
			array( 'id', 'title', 'description' ),
			GF::resolve_requested_fields( 'id,title,description' )
		);
	}

	/** A caller may narrow the response further. */
	public function test_caller_may_narrow_selection() {
		$this->assertSame( array( 'id', 'title' ), GF::resolve_requested_fields( 'id,title' ) );
	}

	/**
	 * Privileged keys are dropped even when named explicitly.
	 *
	 * A selection naming nothing allowed falls back to the allowlist rather
	 * than returning an empty set, which would render as a list of empty
	 * objects. The privileged fields are absent either way.
	 */
	public function test_privileged_fields_are_rejected() {
		foreach ( array( 'notifications', 'confirmations,fields,feeds' ) as $requested ) {
			$resolved = GF::resolve_requested_fields( $requested );

			$this->assertSame( array( 'id', 'title', 'description' ), $resolved );
			foreach ( explode( ',', $requested ) as $privileged ) {
				$this->assertNotContains( $privileged, $resolved );
			}
		}
	}

	/** The exact shape reported in #1289 — an add-on credential blob in form meta. */
	public function test_addon_credential_key_is_rejected() {
		$resolved = GF::resolve_requested_fields( 'atd-salesforce' );

		$this->assertNotContains( 'atd-salesforce', $resolved );
		$this->assertSame( array( 'id', 'title', 'description' ), $resolved );
	}

	/** Repeated names must not produce duplicate entries. */
	public function test_duplicates_are_collapsed() {
		$this->assertSame( array( 'id', 'title' ), GF::resolve_requested_fields( 'id,id,title,id' ) );
	}

	/** Mixing an allowed field with a privileged one keeps only the allowed field. */
	public function test_mixed_selection_keeps_only_allowed() {
		$this->assertSame( array( 'id' ), GF::resolve_requested_fields( 'id,notifications' ) );
	}

	/** Whitespace around names must not smuggle a field past the allowlist. */
	public function test_whitespace_is_trimmed() {
		$this->assertSame( array( 'id', 'title' ), GF::resolve_requested_fields( ' id , title ' ) );
	}

	/** Matching is case-sensitive; a cased variant is not an allowed field. */
	public function test_matching_is_case_sensitive() {
		$resolved = GF::resolve_requested_fields( 'ID,Title' );

		$this->assertNotContains( 'ID', $resolved );
		$this->assertNotContains( 'Title', $resolved );
		$this->assertSame( array( 'id', 'title', 'description' ), $resolved );
	}

	/** Non-string input (e.g. `fields[]=x`) falls back to the allowlist. */
	public function test_non_string_input_returns_allowlist() {
		$this->assertSame( array( 'id', 'title', 'description' ), GF::resolve_requested_fields( array( 'notifications' ) ) );
	}

	/** Result is a list, so it JSON-encodes as an array rather than an object. */
	public function test_result_is_a_list() {
		$this->assertSame( array( 'title' ), GF::resolve_requested_fields( 'notifications,title' ) );
	}
}
