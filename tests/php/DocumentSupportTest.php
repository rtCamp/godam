<?php
/**
 * Unit tests for the Document block's format gate and URL resolvers.
 *
 * The block renders a PDF: either the file itself, or the preview PDF GoDAM Central
 * generates for a Word / Excel / PowerPoint / OpenDocument / text upload. Three things have
 * to hold for that to be safe, and all three are easy to get subtly wrong:
 *
 * 1. godam_is_supported_document() must accept exactly the formats Central can convert —
 *    letting anything else through puts a file on the page that cannot be displayed.
 * 2. rtgodam_get_document_preview_url() must never return a non-PDF. For a converted
 *    document, rtgodam_transcoded_url holds the ORIGINAL .docx/.xlsx, so falling back to it
 *    indiscriminately would hand the viewer a file it cannot parse.
 * 3. rtgodam_get_document_download_url() must never return the generated preview. A visitor
 *    who uploaded report.xlsx and downloads preview.pdf will think something broke.
 *
 * get_post_mime_type(), get_post_meta() and wp_get_attachment_url() are stubbed in
 * tests/bootstrap.php and driven by $GLOBALS['rtgodam_stub'].
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * @covers ::godam_is_supported_document
 * @covers ::rtgodam_get_supported_document_types
 * @covers ::rtgodam_get_supported_document_extensions
 * @covers ::rtgodam_get_document_preview_url
 * @covers ::rtgodam_get_document_download_url
 */
class DocumentSupportTest extends TestCase {

	/**
	 * Formats outside the supported set. `.md` and `.rtf` are called out as unsupported by
	 * Central's own document pipeline spec; the rest are things that share a media library.
	 */
	private const UNSUPPORTED_EXTENSIONS = array( 'zip', 'exe', 'md', 'rtf', 'pages', 'key', 'epub' );

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
		$GLOBALS['rtgodam_stub']['mime'] = $mime;
	}

	/**
	 * Populate the stubbed get_post_meta().
	 *
	 * @param array $meta Meta key => value.
	 * @return void
	 */
	private function stub_meta( array $meta ) {
		$GLOBALS['rtgodam_stub']['post_meta'] = $meta;
	}

	/**
	 * Populate the stubbed wp_get_attachment_url().
	 *
	 * @param string $url URL to report.
	 * @return void
	 */
	private function stub_attachment_url( $url ) {
		$GLOBALS['rtgodam_stub']['attachment_url'] = $url;
	}

	// -----------------------------------------------------------------------------------
	// The format list itself.
	// -----------------------------------------------------------------------------------

	/**
	 * Every format Central's document pipeline converts is accepted, and PDF alongside them.
	 *
	 * Enumerated rather than looped over the helper's own output, so a MIME accidentally
	 * dropped from the helper fails here instead of quietly shrinking the test.
	 *
	 * @return void
	 */
	public function test_every_central_supported_mime_is_accepted() {
		$expected = array(
			'application/pdf',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'application/msword',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'application/vnd.ms-excel',
			'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			'application/vnd.ms-powerpoint',
			'application/vnd.oasis.opendocument.text',
			'application/vnd.oasis.opendocument.spreadsheet',
			'application/vnd.oasis.opendocument.presentation',
			'text/plain',
			'text/csv',
			'application/csv',
		);

		foreach ( $expected as $mime ) {
			$this->stub_mime( $mime );
			$this->assertTrue(
				godam_is_supported_document( 201, '' ),
				$mime . ' should be an accepted document type.'
			);
		}

		$this->assertSame(
			$expected,
			array_keys( rtgodam_get_supported_document_types() ),
			'The helper should list exactly the MIME types Central converts, in a stable order.'
		);
	}

	/**
	 * Every supported extension is accepted when the extension is all we have.
	 *
	 * @return void
	 */
	public function test_every_supported_extension_is_accepted_by_url() {
		$this->stub_mime( '' );

		foreach ( array( 'pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'odt', 'ods', 'odp', 'txt', 'csv' ) as $extension ) {
			$this->assertTrue(
				godam_is_supported_document( 0, 'https://cdn.example.com/media/report.' . $extension ),
				'.' . $extension . ' should be accepted via the URL fallback.'
			);
			$this->assertTrue(
				godam_is_supported_document( 0, 'https://cdn.example.com/media/report.' . strtoupper( $extension ) ),
				'.' . $extension . ' should be accepted case-insensitively.'
			);
		}
	}

	/**
	 * Formats with no conversion path stay out, by MIME and by extension alike.
	 *
	 * @return void
	 */
	public function test_unsupported_formats_are_rejected() {
		foreach ( array( 'application/zip', 'application/x-msdownload', 'text/markdown', 'application/rtf', 'audio/wav', 'video/mp4', 'image/jpeg' ) as $mime ) {
			$this->stub_mime( $mime );
			$this->assertFalse(
				godam_is_supported_document( 406, '' ),
				$mime . ' must not be treated as a displayable document.'
			);
		}

		$this->stub_mime( '' );

		foreach ( self::UNSUPPORTED_EXTENSIONS as $extension ) {
			$this->assertFalse(
				godam_is_supported_document( 0, 'https://cdn.example.com/media/file.' . $extension ),
				'.' . $extension . ' must be rejected by the URL fallback.'
			);
		}
	}

	/**
	 * The PHP list and the editor's JavaScript copy must not drift apart.
	 *
	 * They are deliberately duplicated — the editor cannot call into PHP — so this is the
	 * only thing keeping the media library's upload filter in step with the server's gate.
	 * Drift is silent and one-directional: the picker would offer a format the front end
	 * then refuses to render.
	 *
	 * @return void
	 */
	public function test_javascript_constants_match_the_php_list() {
		$constants_file = dirname( __DIR__, 2 ) . '/assets/src/blocks/godam-pdf/constants.js';

		$this->assertFileExists( $constants_file, 'The block constants module should exist.' );

		$source = file_get_contents( $constants_file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reading a repo file in a unit test.

		$this->assertSame(
			1,
			preg_match( '/SUPPORTED_DOCUMENT_TYPES\s*=\s*\{(.+?)\n\};/s', $source, $block ),
			'SUPPORTED_DOCUMENT_TYPES should be a single object literal in constants.js.'
		);

		preg_match_all( "/'([^']+)'\s*:\s*'([^']+)'/", $block[1], $pairs, PREG_SET_ORDER );

		$javascript_types = array();
		foreach ( $pairs as $pair ) {
			$javascript_types[ $pair[1] ] = $pair[2];
		}

		$this->assertSame(
			rtgodam_get_supported_document_types(),
			$javascript_types,
			'constants.js and rtgodam_get_supported_document_types() must list the same MIME => extension pairs.'
		);
	}

	// -----------------------------------------------------------------------------------
	// Attachment id handling.
	// -----------------------------------------------------------------------------------

	/**
	 * A numeric attachment id resolves via its stored MIME type, which wins over
	 * whatever the URL happens to look like.
	 *
	 * @return void
	 */
	public function test_attachment_mime_type_is_authoritative() {
		$this->stub_mime( 'application/pdf' );
		$this->assertTrue(
			godam_is_supported_document( 201, 'https://example.com/report.zip' ),
			'A PDF attachment should be supported whatever the passed-in URL suggests.'
		);

		// A .pdf URL must not rescue an attachment that is genuinely unsupported.
		$this->stub_mime( 'application/zip' );
		$this->assertFalse(
			godam_is_supported_document( 405, 'https://example.com/looks-like.pdf' ),
			'A ZIP attachment must be rejected even when the URL ends in .pdf.'
		);
	}

	/**
	 * ...but a MIME type shared with an unconvertible format does not carry an attachment
	 * on its own.
	 *
	 * The library picker filters by MIME, so every .srt/.asc/.c/.cc/.h in the library is
	 * offered alongside real documents. Nothing will ever convert those — the transcoder skips
	 * them — so the block could only show its "no preview" panel forever. The stored file has
	 * to agree with the MIME type, exactly as rtgodam_is_supported_document_attachment()
	 * requires before dispatching a job.
	 *
	 * @return void
	 */
	public function test_text_plain_lookalike_attachments_are_not_supported_documents() {
		$this->stub_mime( 'text/plain' );

		foreach ( array( 'captions.srt', 'notes.asc', 'main.c', 'lib.cc', 'header.h' ) as $file ) {
			$this->stub_meta( array( '_wp_attached_file' => '2026/08/' . $file ) );
			$this->assertFalse(
				godam_is_supported_document( 201, '' ),
				$file . ' shares text/plain but cannot be previewed, so it must not be offered as a document.'
			);
		}

		$this->stub_meta( array( '_wp_attached_file' => '2026/08/readme.txt' ) );
		$this->assertTrue(
			godam_is_supported_document( 201, '' ),
			'A .txt attachment is still supported, so the guard discriminates by extension.'
		);
	}

	/**
	 * When the attachment has no resolvable file, the MIME type answers alone.
	 *
	 * Virtual GoDAM-tab media carries no `_wp_attached_file`, and a file already removed from
	 * disk carries no URL either. Rejecting those would stop published content rendering for
	 * a check that cannot be performed, so the MIME type stands.
	 *
	 * @return void
	 */
	public function test_supported_mime_stands_when_no_file_can_be_resolved() {
		$this->stub_mime( 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' );
		$this->stub_meta( array() );
		$this->stub_attachment_url( '' );

		$this->assertTrue(
			godam_is_supported_document( 201, '' ),
			'With no file to cross-check, a supported MIME type should be accepted.'
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
		// branch they would come back true despite the .zip URL.
		$this->stub_mime( 'application/pdf' );

		foreach ( array( '12.5', '1e3', '0x1A', '+201', '-201', '2 0 1', '', '0' ) as $bad_id ) {
			$this->assertFalse(
				godam_is_supported_document( $bad_id, 'https://example.com/notes.zip' ),
				sprintf( 'id "%s" must not resolve an attachment; it should fall through to the URL.', $bad_id )
			);
		}

		// Same inputs with a supported URL prove the fall-through really happened rather
		// than the function simply rejecting everything.
		foreach ( array( '12.5', '1e3', '-201' ) as $bad_id ) {
			$this->assertTrue(
				godam_is_supported_document( $bad_id, 'https://example.com/report.pdf' ),
				sprintf( 'id "%s" should fall through to the URL check, which passes for a PDF.', $bad_id )
			);
		}
	}

	// -----------------------------------------------------------------------------------
	// URL parsing edge cases.
	// -----------------------------------------------------------------------------------

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
			godam_is_supported_document( 0, 'https://cdn.example.com/sheet.xlsx#page=3' ),
			'A fragment should not defeat the extension check.'
		);
		$this->assertFalse(
			godam_is_supported_document( 0, 'https://cdn.example.com/notes.zip?download=1' ),
			'An unsupported format with a query string should still be rejected.'
		);
	}

	/**
	 * A deleted attachment reports no MIME type; content that still carries a valid
	 * document URL should keep rendering rather than silently disappearing.
	 *
	 * @return void
	 */
	public function test_missing_attachment_falls_through_to_the_url() {
		$this->stub_mime( '' );

		$this->assertTrue(
			godam_is_supported_document( 999999, 'https://example.com/still-here.pdf' ),
			'A stale id with a valid document URL should remain supported.'
		);
		$this->assertFalse(
			godam_is_supported_document( 999999, 'https://example.com/still-here.zip' ),
			'A stale id with an unsupported URL should be rejected.'
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
	 * A supported extension appearing somewhere other than the extension must not pass.
	 *
	 * @return void
	 */
	public function test_extension_elsewhere_in_the_url_does_not_pass() {
		$this->stub_mime( '' );

		$this->assertFalse(
			godam_is_supported_document( 0, 'https://example.com/pdf/notes.zip' ),
			'A "pdf" directory should not make a .zip supported.'
		);
		$this->assertFalse(
			godam_is_supported_document( 0, 'https://example.com/my-pdf-report.zip' ),
			'"pdf" inside the file name should not make a .zip supported.'
		);
	}

	// -----------------------------------------------------------------------------------
	// Attachment-level classification.
	// -----------------------------------------------------------------------------------

	/**
	 * A convertible document is recognised from its MIME type and its extension together.
	 *
	 * @return void
	 */
	public function test_document_attachment_is_recognised() {
		$this->stub_mime( 'application/vnd.openxmlformats-officedocument.presentationml.presentation' );
		$this->stub_meta( array( '_wp_attached_file' => '2026/08/slides.pptx' ) );

		$this->assertTrue(
			rtgodam_is_supported_document_attachment( 300 ),
			'A .pptx attachment should be treated as a convertible document.'
		);
	}

	/**
	 * The formats that merely share text/plain must not be treated as documents.
	 *
	 * WordPress maps txt|asc|c|cc|h|srt to a single MIME type, so a MIME-only test classifies
	 * every subtitle and C source file in the library as a document. That is not cosmetic:
	 * such a file passes the transcoder's MIME gate, then matches none of the extension-keyed
	 * job-type branches and falls through to the default 'stream', so each one is dispatched
	 * to GoDAM Central as a video transcode that consumes quota and can only fail. It also
	 * earns a transcoding spinner in the media library that never resolves.
	 *
	 * @return void
	 */
	public function test_text_plain_lookalikes_are_not_documents() {
		$this->stub_mime( 'text/plain' );

		foreach ( array( 'captions.srt', 'notes.asc', 'main.c', 'lib.cc', 'header.h' ) as $file ) {
			$this->stub_meta( array( '_wp_attached_file' => '2026/08/' . $file ) );
			$this->assertFalse(
				rtgodam_is_supported_document_attachment( 301 ),
				$file . ' shares text/plain but has no conversion path, so it must not be treated as a document.'
			);
		}

		// The extension that genuinely is a document still passes, proving the guard above
		// discriminates by extension rather than rejecting text/plain outright.
		$this->stub_meta( array( '_wp_attached_file' => '2026/08/readme.txt' ) );
		$this->assertTrue(
			rtgodam_is_supported_document_attachment( 301 ),
			'A .txt attachment is a convertible document.'
		);
	}

	/**
	 * Non-document attachments and unusable ids are rejected.
	 *
	 * @return void
	 */
	public function test_non_document_attachments_are_rejected() {
		$this->stub_mime( 'video/mp4' );
		$this->stub_meta( array( '_wp_attached_file' => '2026/08/clip.mp4' ) );
		$this->assertFalse( rtgodam_is_supported_document_attachment( 302 ), 'A video is not a document.' );

		$this->stub_mime( 'application/pdf' );
		$this->stub_meta( array() );
		$this->stub_attachment_url( '' );
		$this->assertFalse(
			rtgodam_is_supported_document_attachment( 303 ),
			'With no file path and no URL there is no extension to confirm, so the answer is no.'
		);

		$this->assertFalse( rtgodam_is_supported_document_attachment( 0 ), 'A zero id is rejected.' );
	}

	/**
	 * The attachment URL stands in when no stored path is available, as for GoDAM tab media.
	 *
	 * @return void
	 */
	public function test_document_attachment_falls_back_to_the_url() {
		$this->stub_mime( 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' );
		$this->stub_meta( array() );
		$this->stub_attachment_url( 'https://cdn.example.com/job_9/quarterly.xlsx?v=v2' );

		$this->assertTrue(
			rtgodam_is_supported_document_attachment( 304 ),
			'The URL should be consulted when no path is stored, query string and all.'
		);
	}

	// -----------------------------------------------------------------------------------
	// Preview URL resolution.
	// -----------------------------------------------------------------------------------

	/**
	 * The stored preview PDF wins for every format, converted or not.
	 *
	 * @return void
	 */
	public function test_preview_url_prefers_the_stored_preview() {
		$this->stub_mime( 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' );
		$this->stub_meta(
			array(
				'rtgodam_preview_pdf_url' => 'https://cdn.example.com/job_1/preview.pdf',
				'rtgodam_transcoded_url'  => 'https://cdn.example.com/job_1/sheet.xlsx',
			)
		);

		$this->assertSame(
			'https://cdn.example.com/job_1/preview.pdf',
			rtgodam_get_document_preview_url( 77 ),
			'The generated preview PDF should be used for a converted document.'
		);
	}

	/**
	 * With no preview stored, a converted document has nothing renderable.
	 *
	 * This is the case worth pinning down: rtgodam_transcoded_url is set for a document too,
	 * but it points at the original .docx/.xlsx. Returning it would hand pdf.js a file it
	 * cannot parse — the visitor would see a broken viewer rather than a download offer.
	 *
	 * @return void
	 */
	public function test_preview_url_never_falls_back_to_a_non_pdf_original() {
		$this->stub_mime( 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' );
		$this->stub_meta( array( 'rtgodam_transcoded_url' => 'https://cdn.example.com/job_2/report.docx' ) );
		$this->stub_attachment_url( 'https://example.com/wp-content/uploads/report.docx' );

		$this->assertSame(
			'',
			rtgodam_get_document_preview_url( 78 ),
			'A document with no preview must report none, not its original file.'
		);
	}

	/**
	 * A PDF falls back through the pre-document-support key and then the local file, so blocks
	 * published before preview URLs existed keep rendering with no migration.
	 *
	 * @return void
	 */
	public function test_preview_url_falls_back_for_legacy_pdfs() {
		$this->stub_mime( 'application/pdf' );

		$this->stub_meta( array( 'rtgodam_transcoded_url' => 'https://cdn.example.com/job_3/report.pdf' ) );
		$this->stub_attachment_url( 'https://example.com/wp-content/uploads/report.pdf' );
		$this->assertSame(
			'https://cdn.example.com/job_3/report.pdf',
			rtgodam_get_document_preview_url( 79 ),
			'A PDF with only the legacy transcoded URL should still render.'
		);

		$this->stub_meta( array() );
		$this->assertSame(
			'https://example.com/wp-content/uploads/report.pdf',
			rtgodam_get_document_preview_url( 79 ),
			'An untranscoded PDF should render from its local file.'
		);
	}

	/**
	 * Without a local attachment, only a URL that is already a PDF can be previewed.
	 *
	 * @return void
	 */
	public function test_preview_url_for_url_only_documents() {
		$this->stub_mime( '' );
		$this->stub_meta( array() );
		$this->stub_attachment_url( '' );

		$this->assertSame(
			'https://cdn.example.com/report.pdf',
			rtgodam_get_document_preview_url( 0, 'https://cdn.example.com/report.pdf' ),
			'A URL-only PDF is its own preview.'
		);
		$this->assertSame(
			'',
			rtgodam_get_document_preview_url( 0, 'https://cdn.example.com/report.docx' ),
			'A URL-only .docx has no preview to resolve.'
		);
		$this->assertSame(
			'',
			rtgodam_get_document_preview_url( 0, '' ),
			'Nothing in, nothing out.'
		);
	}

	// -----------------------------------------------------------------------------------
	// Download URL resolution.
	// -----------------------------------------------------------------------------------

	/**
	 * The download URL is the uploaded file, never the generated preview.
	 *
	 * @return void
	 */
	public function test_download_url_serves_the_original() {
		$this->stub_mime( 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' );
		$this->stub_meta( array( 'rtgodam_preview_pdf_url' => 'https://cdn.example.com/job_4/preview.pdf' ) );
		$this->stub_attachment_url( 'https://example.com/wp-content/uploads/quarterly.xlsx' );

		$this->assertSame(
			'https://example.com/wp-content/uploads/quarterly.xlsx',
			rtgodam_get_document_download_url( 80 ),
			'The download should serve the uploaded .xlsx, not the preview PDF.'
		);
	}

	/**
	 * Virtual media with no usable guid downloads from the CDN, not a local path.
	 *
	 * A GoDAM tab import has no file on disk. When its post guid is empty,
	 * filter_attachment_url_for_virtual_media() leaves WordPress's own value alone and
	 * WordPress joins the bare `_wp_attached_file` name onto the uploads base URL — a link
	 * that looks right and 404s. rtgodam_transcoded_url is the same file on the CDN.
	 *
	 * @return void
	 */
	public function test_download_url_for_virtual_media_prefers_the_transcoded_url() {
		$this->stub_mime( 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' );
		$this->stub_meta(
			array(
				'_godam_original_id'     => 'md0r9phqa4',
				'rtgodam_transcoded_url' => 'https://cdn.example.com/md0r9phqa4/report.docx',
			)
		);
		// What WordPress builds for virtual media once the CDN lookup falls through.
		$this->stub_attachment_url( 'https://example.com/wp-content/uploads/report.docx' );

		$this->assertSame(
			'https://cdn.example.com/md0r9phqa4/report.docx',
			rtgodam_get_document_download_url( 90 ),
			'Virtual media should download from the CDN, not a local uploads path with no file behind it.'
		);

		// Same attachment, nothing resolved at all.
		$this->stub_attachment_url( '' );

		$this->assertSame(
			'https://cdn.example.com/md0r9phqa4/report.docx',
			rtgodam_get_document_download_url( 90 ),
			'An unresolved virtual attachment should still fall back to the transcoded URL.'
		);
	}

	/**
	 * A resolved CDN URL is left alone — the fallback must not override a good answer.
	 *
	 * @return void
	 */
	public function test_download_url_for_virtual_media_keeps_a_resolved_cdn_url() {
		$this->stub_mime( 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' );
		$this->stub_meta(
			array(
				'_godam_original_id'     => 'md0r9phqa4',
				// Deliberately different, so preferring the wrong one would show up here.
				'rtgodam_transcoded_url' => 'https://cdn.example.com/md0r9phqa4/stale.docx',
			)
		);
		$this->stub_attachment_url( 'https://cdn.example.com/md0r9phqa4/report.docx' );

		$this->assertSame(
			'https://cdn.example.com/md0r9phqa4/report.docx',
			rtgodam_get_document_download_url( 90 ),
			'The guid-resolved CDN URL is authoritative when wp_get_attachment_url() supplies one.'
		);
	}

	/**
	 * An ordinary local upload is untouched: its uploads-directory URL is the real file.
	 *
	 * @return void
	 */
	public function test_download_url_for_local_uploads_is_untouched() {
		$this->stub_mime( 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' );
		// No _godam_original_id: transcoded by GoDAM, but the original still lives on disk.
		$this->stub_meta( array( 'rtgodam_transcoded_url' => 'https://cdn.example.com/job_9/quarterly.xlsx' ) );
		$this->stub_attachment_url( 'https://example.com/wp-content/uploads/quarterly.xlsx' );

		$this->assertSame(
			'https://example.com/wp-content/uploads/quarterly.xlsx',
			rtgodam_get_document_download_url( 91 ),
			'A real local upload downloads from the local file, transcoded copy or not.'
		);
	}

	/**
	 * With no attachment to resolve, the supplied source URL is used verbatim.
	 *
	 * @return void
	 */
	public function test_download_url_falls_back_to_the_source() {
		$this->stub_mime( '' );
		$this->stub_meta( array() );
		$this->stub_attachment_url( '' );

		$this->assertSame(
			'https://cdn.example.com/report.docx',
			rtgodam_get_document_download_url( 0, 'https://cdn.example.com/report.docx' ),
			'A URL-only document downloads from that URL.'
		);
		$this->assertSame(
			'',
			rtgodam_get_document_download_url( 0, null ),
			'A non-string fallback yields an empty string rather than a type error.'
		);
	}
}
