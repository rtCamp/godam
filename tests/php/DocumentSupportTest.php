<?php
/**
 * Unit tests for godam_is_supported_document().
 *
 * The Document block embeds through `<object type="application/pdf">`, so a
 * non-PDF gives the browser a type it cannot display: it paints an empty box (and
 * suppresses the `<object>` fallback, so nothing at all appears) or hands the file
 * to the download manager, starting a download on every page load. This helper is
 * the single gate that keeps a non-PDF from reaching that markup, so its edge
 * cases are worth pinning down.
 *
 * get_post_mime_type() is stubbed in tests/bootstrap.php and driven by
 * $GLOBALS['rtgodam_stub']['mime'].
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * @covers ::godam_is_supported_document
 */
class DocumentSupportTest extends TestCase {

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Point the stubbed get_post_mime_type() at a given MIME type.
	 *
	 * @param string $mime MIME type to report for any attachment id.
	 * @return void
	 */
	private function stub_mime( $mime ) {
		$GLOBALS['rtgodam_stub'] = array( 'mime' => $mime );
	}

	/**
	 * A numeric attachment id resolves via its stored MIME type, which wins over
	 * whatever the URL happens to look like.
	 *
	 * @return void
	 */
	public function test_attachment_mime_type_is_authoritative() {
		$this->stub_mime( 'application/pdf' );
		$this->assertTrue(
			godam_is_supported_document( 201, 'https://example.com/report.pdf' ),
			'A PDF attachment should be supported.'
		);

		// A .pdf URL must not rescue an attachment that is not actually a PDF:
		// this is the case QA hit, where a .docx rendered as a blank embed.
		$this->stub_mime( 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' );
		$this->assertFalse(
			godam_is_supported_document( 405, 'https://example.com/looks-like.pdf' ),
			'A DOCX attachment must be rejected even when the URL ends in .pdf.'
		);
	}

	/**
	 * A digit-string id is accepted, since shortcode attributes always arrive as
	 * strings.
	 *
	 * @return void
	 */
	public function test_digit_string_id_is_accepted() {
		$this->stub_mime( 'application/pdf' );
		$this->assertTrue( godam_is_supported_document( '201', '' ), 'A digit-string id should resolve via its MIME type.' );
		$this->assertTrue( godam_is_supported_document( ' 201 ', '' ), 'Surrounding whitespace should be tolerated.' );
	}

	/**
	 * Only whole positive numbers may be treated as attachment IDs.
	 *
	 * is_numeric() would accept '12.5' and '1e3', and absint() would then turn those
	 * into 12 and 1000 respectively: a different, possibly existing attachment whose
	 * MIME type would answer for the one that was actually requested. Such values
	 * must fall through to the URL check instead.
	 *
	 * @return void
	 */
	public function test_non_integer_ids_do_not_resolve_an_attachment() {
		// A PDF MIME is stubbed, so if any of these wrongly took the attachment
		// branch they would come back true despite the .docx URL.
		$this->stub_mime( 'application/pdf' );

		foreach ( array( '12.5', '1e3', '0x1A', '+201', '-201', '2 0 1', '', '0' ) as $bad_id ) {
			$this->assertFalse(
				godam_is_supported_document( $bad_id, 'https://example.com/notes.docx' ),
				sprintf( 'id "%s" must not resolve an attachment; it should fall through to the URL.', $bad_id )
			);
		}

		// Same inputs with a PDF URL prove the fall-through really happened rather
		// than the function simply rejecting everything.
		foreach ( array( '12.5', '1e3', '-201' ) as $bad_id ) {
			$this->assertTrue(
				godam_is_supported_document( $bad_id, 'https://example.com/report.pdf' ),
				sprintf( 'id "%s" should fall through to the URL check, which passes for a PDF.', $bad_id )
			);
		}
	}

	/**
	 * Other media types that share the media library are rejected too.
	 *
	 * @return void
	 */
	public function test_other_mime_types_are_rejected() {
		foreach ( array( 'audio/wav', 'video/mp4', 'image/jpeg', 'text/plain' ) as $mime ) {
			$this->stub_mime( $mime );
			$this->assertFalse(
				godam_is_supported_document( 406, '' ),
				$mime . ' must not be treated as an embeddable document.'
			);
		}
	}

	/**
	 * With no local attachment (GoDAM tab media keyed by a non-numeric id, or a
	 * document added by URL alone) the extension is the only signal available.
	 *
	 * @return void
	 */
	public function test_falls_back_to_url_extension_without_a_numeric_id() {
		$this->stub_mime( '' );

		$this->assertTrue(
			godam_is_supported_document( 0, 'https://cdn.example.com/media/report.pdf' ),
			'A .pdf URL should be supported when there is no attachment to check.'
		);
		$this->assertTrue(
			godam_is_supported_document( 'abc123', 'https://cdn.example.com/media/report.PDF' ),
			'The extension check should be case-insensitive.'
		);
		$this->assertFalse(
			godam_is_supported_document( 'abc123', 'https://cdn.example.com/media/notes.docx' ),
			'A .docx URL should be rejected.'
		);
	}

	/**
	 * Query strings and fragments are common on CDN URLs and must not be mistaken
	 * for part of the extension.
	 *
	 * @return void
	 */
	public function test_query_string_and_fragment_are_ignored() {
		$this->stub_mime( '' );

		$this->assertTrue(
			godam_is_supported_document( 0, 'https://cdn.example.com/report.pdf?v=2&token=abc' ),
			'A query string should not defeat the extension check.'
		);
		$this->assertTrue(
			godam_is_supported_document( 0, 'https://cdn.example.com/report.pdf#page=3' ),
			'A fragment should not defeat the extension check.'
		);
		$this->assertFalse(
			godam_is_supported_document( 0, 'https://cdn.example.com/notes.docx?download=1' ),
			'A non-PDF with a query string should still be rejected.'
		);
	}

	/**
	 * A deleted attachment reports no MIME type; content that still carries a valid
	 * PDF URL should keep rendering rather than silently disappearing.
	 *
	 * @return void
	 */
	public function test_missing_attachment_falls_through_to_the_url() {
		$this->stub_mime( '' );

		$this->assertTrue(
			godam_is_supported_document( 999999, 'https://example.com/still-here.pdf' ),
			'A stale id with a valid PDF URL should remain supported.'
		);
		$this->assertFalse(
			godam_is_supported_document( 999999, 'https://example.com/still-here.docx' ),
			'A stale id with a non-PDF URL should be rejected.'
		);
	}

	/**
	 * Nothing to inspect means nothing to embed.
	 *
	 * @return void
	 */
	public function test_empty_and_malformed_input_is_rejected() {
		$this->stub_mime( '' );

		$this->assertFalse( godam_is_supported_document(), 'No arguments should be rejected.' );
		$this->assertFalse( godam_is_supported_document( 0, '' ), 'Empty id and URL should be rejected.' );
		$this->assertFalse( godam_is_supported_document( 0, null ), 'A null URL should be rejected.' );
		$this->assertFalse( godam_is_supported_document( 0, array( 'x' ) ), 'A non-string URL should be rejected.' );
		$this->assertFalse(
			godam_is_supported_document( 0, 'https://example.com/no-extension' ),
			'A URL with no extension should be rejected.'
		);
		$this->assertFalse(
			godam_is_supported_document( 0, 'not a url at all' ),
			'A malformed URL should be rejected.'
		);
	}

	/**
	 * "pdf" appearing somewhere other than the extension must not pass.
	 *
	 * @return void
	 */
	public function test_pdf_elsewhere_in_the_url_does_not_pass() {
		$this->stub_mime( '' );

		$this->assertFalse(
			godam_is_supported_document( 0, 'https://example.com/pdf/notes.docx' ),
			'A "pdf" directory should not make a .docx supported.'
		);
		$this->assertFalse(
			godam_is_supported_document( 0, 'https://example.com/my-pdf-report.zip' ),
			'"pdf" inside the file name should not make a .zip supported.'
		);
	}
}
