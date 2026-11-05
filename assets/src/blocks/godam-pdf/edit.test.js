/**
 * Unit tests for the Document block's editor canvas: the "Download original" link
 * points at the document's URL only when that is an http(s) or mailto URL.
 */

/**
 * External dependencies
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Internal dependencies
 */
import PdfEdit from './edit';

// The attachment record the stubbed data store hands back for a block with an id.
let mockRecord = null;

// Editor chrome that needs a live block context; the canvas is what is under test.
jest.mock( '@wordpress/block-editor', () => ( {
	BlockControls: () => null,
	InspectorControls: () => null,
	MediaReplaceFlow: () => null,
	MediaUpload: () => null,
	MediaUploadCheck: ( { children } ) => children,
	useBlockProps: ( props ) => props,
} ) );
jest.mock( '@wordpress/data', () => ( {
	useSelect: ( mapSelect ) => mapSelect( () => ( {
		getEntityRecord: () => mockRecord,
		hasFinishedResolution: () => true,
	} ) ),
	useDispatch: () => ( { createErrorNotice: () => {}, createWarningNotice: () => {} } ),
} ) );
jest.mock( '@wordpress/core-data', () => ( { store: 'core' } ) );
jest.mock( '@wordpress/notices', () => ( { store: 'core/notices' } ) );
jest.mock( './caption', () => ( { Caption: () => null } ) );
jest.mock( './viewer', () => ( { __esModule: true, default: () => null } ) );

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Render the block and report the panel and download link it shows.
 *
 * @param {Object} attributes Block attributes.
 * @param {Object} record     Attachment record, for a block with an id.
 * @return {Object} The panel's element and its "Download original" link, if any.
 */
const renderBlock = ( attributes, record = null ) => {
	mockRecord = record;

	const container = document.createElement( 'div' );
	document.body.appendChild( container );
	const root = createRoot( container );

	act( () => {
		root.render(
			<PdfEdit
				attributes={ { height: 600, previewMode: 'default', ...attributes } }
				className=""
				setAttributes={ () => {} }
				isSelected={ false }
				insertBlocksAfter={ () => {} }
			/>,
		);
	} );

	const panel = container.querySelector( '.godam-pdf-unavailable, .godam-pdf-processing' );
	const result = {
		panel,
		link: panel ? panel.querySelector( 'a' ) : null,
	};

	act( () => root.unmount() );
	container.remove();

	return result;
};

describe( 'Document block editor canvas', () => {
	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
	} );

	describe( 'when no preview will be produced', () => {
		it.each( [
			[ 'a javascript: source', 'javascript:alert(1)//report.docx' ],
			[ 'a mixed-case javascript: source', 'JaVaScRiPt:alert(1)//report.docx' ],
			[ 'a data: source', 'data:text/html,<script>alert(1)</script>//report.docx' ],
		] )( 'offers no download link for %s', ( name, src ) => {
			const { panel, link } = renderBlock( { src } );

			// The panel is still shown, there is just nothing unsafe to link to.
			expect( panel ).not.toBeNull();
			expect( panel.className ).toBe( 'godam-pdf-unavailable' );
			expect( link ).toBeNull();
		} );

		it.each( [
			[ 'an https source', 'https://example.com/uploads/report.docx' ],
			[ 'an http source', 'http://example.com/uploads/report.docx' ],
		] )( 'links the download to %s', ( name, src ) => {
			const { panel, link } = renderBlock( { src } );

			expect( panel.className ).toBe( 'godam-pdf-unavailable' );
			expect( link.getAttribute( 'href' ) ).toBe( src );
			expect( link.getAttribute( 'target' ) ).toBe( '_blank' );
			expect( link.getAttribute( 'rel' ) ).toBe( 'noopener noreferrer' );
		} );

		it( 'prefers the attachment URL over the stored source', () => {
			const { link } = renderBlock(
				{ id: 7, src: 'https://old.example.com/report.docx' },
				{ source_url: 'https://cdn.example.com/report.docx', mime_type: DOCX, meta: {} },
			);

			expect( link.getAttribute( 'href' ) ).toBe( 'https://cdn.example.com/report.docx' );
		} );

		it( 'offers no download link when the attachment URL is not http(s)', () => {
			const { panel, link } = renderBlock(
				{ id: 7, src: 'https://example.com/report.docx' },
				{ source_url: 'javascript:alert(1)//report.docx', mime_type: DOCX, meta: {} },
			);

			expect( panel.className ).toBe( 'godam-pdf-unavailable' );
			expect( link ).toBeNull();
		} );
	} );

	describe( 'while the preview is being generated', () => {
		const record = ( sourceUrl ) => ( {
			source_url: sourceUrl,
			mime_type: DOCX,
			meta: { rtgodam_transcoding_status: 'Queued' },
		} );

		it( 'offers no download link for a javascript: source', () => {
			const { panel, link } = renderBlock(
				{ id: 7, src: 'https://example.com/report.docx' },
				record( 'javascript:alert(1)//report.docx' ),
			);

			expect( panel.className ).toBe( 'godam-pdf-processing' );
			expect( link ).toBeNull();
		} );

		it( 'links the download to an https source', () => {
			const { panel, link } = renderBlock(
				{ id: 7, src: 'https://example.com/report.docx' },
				record( 'https://example.com/uploads/report.docx' ),
			);

			expect( panel.className ).toBe( 'godam-pdf-processing' );
			expect( link.getAttribute( 'href' ) ).toBe( 'https://example.com/uploads/report.docx' );
		} );
	} );
} );
