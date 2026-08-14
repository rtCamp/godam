/**
 * External dependencies
 */
import { Document, Page } from 'react-pdf';

/**
 * WordPress dependencies
 */
import { useState, useRef, useEffect, useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import './worker';

/*
 * The viewer's styles — ours plus react-pdf's TextLayer/AnnotationLayer sheets — are
 * deliberately NOT imported here. They live in the block's style.scss instead.
 *
 * Importing CSS from a lazily-imported module makes webpack emit it as an async stylesheet
 * that its runtime injects with document.head.appendChild() when the chunk loads. In the
 * block editor `document` is the outer admin page, while the block renders inside the
 * editor-canvas iframe; WordPress copies stylesheets into that iframe when it mounts, so a
 * link element appended afterwards never arrives. The editor lost every rule below —
 * most visibly TextLayer.css, which is what makes the selectable text layer transparent,
 * so its spans painted as opaque text over the page. The front end was unaffected because
 * there is no iframe there.
 *
 * Routing them through `style` also means the rules are in place before React mounts,
 * rather than racing the chunk.
 */

const MAX_PAGE_WIDTH = 1000;
const HORIZONTAL_PADDING = 24;

/**
 * Renders a PDF as a plain scrollable stack of pages, deliberately with no viewer chrome.
 *
 * Why not `<object>` / `<iframe>`, which is what this block used before: those hand the file
 * to the browser's built-in PDF viewer, which draws its own toolbar showing the file name.
 * For a document the author uploaded as report.xlsx, a toolbar reading "preview.pdf" looks
 * like a bug. The `#toolbar=0` hint that is supposed to suppress it is only honoured by
 * Chrome and Edge — Firefox ignores it and Safari does nothing with it. Rendering the pages
 * ourselves is the only approach that behaves the same everywhere.
 *
 * The text layer is kept so visitors can still select, copy and find text.
 *
 * Note: cMaps and standard font data are not configured, matching GoDAM Central's own
 * viewer. Preview PDFs come out of LibreOffice with fonts embedded, so this only affects
 * author-uploaded PDFs that rely on predefined CJK CMaps — those fall back to substituted
 * glyphs rather than failing. Embedded fonts need no external data, but they DO need
 * `ownerDocument` to be right; see the `options` comment below.
 *
 * The text layer is invisible, so turning it off changes nothing visually — the editor does
 * that so the layer cannot intercept the clicks that select the block.
 *
 * @param {Object}   props                   Component props.
 * @param {string}   props.url               URL of the PDF to render.
 * @param {string}   [props.title]           Accessible name for the document region.
 * @param {Function} [props.onLoadSuccess]   Called with the pdf.js document proxy on load.
 * @param {Function} [props.onError]         Called when the document cannot be rendered.
 * @param {boolean}  [props.renderTextLayer] Draw the selectable text layer.
 *
 * @return {JSX.Element} The rendered PDF viewer.
 */
export default function DocumentViewer( {
	url,
	title = '',
	onLoadSuccess,
	onError,
	renderTextLayer = true,
} ) {
	const [ numPages, setNumPages ] = useState( 0 );
	const [ hasError, setHasError ] = useState( false );
	const containerRef = useRef( null );
	const [ width, setWidth ] = useState( 0 );
	const [ ownerDocument, setOwnerDocument ] = useState( null );

	// Pages are rendered to a canvas at a fixed pixel width, so they have to be re-rendered
	// when the container resizes — a CSS-scaled canvas just goes blurry.
	useEffect( () => {
		const element = containerRef.current;

		if ( ! element ) {
			return;
		}

		// Which document the pages live in — see the `options` note below.
		setOwnerDocument( element.ownerDocument );

		const update = () => setWidth( element.clientWidth );

		update();

		const observer = new ResizeObserver( update );
		observer.observe( element );

		return () => observer.disconnect();
	}, [] );

	// A new file is a fresh attempt: clear the previous document's error and page count.
	useEffect( () => {
		setHasError( false );
		setNumPages( 0 );
	}, [ url ] );

	/*
	 * `ownerDocument` tells pdf.js which document to register the PDF's fonts in. It defaults
	 * to `globalThis.document`, and getting it wrong is not a subtle failure: pdf.js converts
	 * each embedded font and installs it with `document.fonts.add()` plus an injected
	 * <style> rule, then draws glyphs onto the canvas via `ctx.font`. A canvas can only resolve
	 * font families registered in ITS OWN document, so registering them anywhere else renders
	 * every glyph as a tofu box.
	 *
	 * That is exactly what happens in the block editor, where the canvas is inside the
	 * `editor-canvas` iframe while `globalThis.document` is the surrounding admin page — the
	 * front end was unaffected because there is no iframe there. Reading it off the container
	 * covers both, and the non-iframed editor, without having to detect which one we are in.
	 *
	 * react-pdf reloads the document whenever `options` changes identity, so this must stay
	 * memoized — an inline object literal would restart the load on every render.
	 */
	const options = useMemo( () => ( { ownerDocument } ), [ ownerDocument ] );

	const pageWidth = Math.min( width - HORIZONTAL_PADDING, MAX_PAGE_WIDTH );

	const handleError = ( error ) => {
		// Most commonly a CORS or network failure fetching the PDF: pdf.js fetches over XHR,
		// where an <object> tag did not, so a CDN that omits Access-Control-Allow-Origin
		// breaks here and nowhere else.
		global.console?.error( 'GoDAM: document preview failed to load', url, error );
		setHasError( true );
		onError?.( error );
	};

	const errorView = (
		<p className="godam-pdf-viewer__message" data-test-id="godam-pdf-viewer-error">
			{ __( 'This preview could not be loaded.', 'godam' ) }
		</p>
	);

	const loadingView = (
		<p className="godam-pdf-viewer__message" data-test-id="godam-pdf-viewer-loading">
			{ __( 'Loading preview…', 'godam' ) }
		</p>
	);

	if ( hasError ) {
		return <div className="godam-pdf-viewer">{ errorView }</div>;
	}

	return (
		<div
			className="godam-pdf-viewer"
			ref={ containerRef }
			data-test-id="godam-pdf-viewer"
		>
			{ /* Nothing is loaded until the container is mounted and its document is known:
			     starting earlier would register the fonts against globalThis.document, and the
			     reload triggered by the corrected `options` would leave those stale rules
			     behind in the wrong document. */ }
			{ ! ownerDocument ? loadingView : (
				<Document
					file={ url }
					options={ options }
					loading={ loadingView }
					error={ errorView }
					onLoadSuccess={ ( pdf ) => {
						setNumPages( pdf.numPages );
						onLoadSuccess?.( pdf );
					} }
					onLoadError={ handleError }
					onSourceError={ handleError }
					onPassword={ () => {
						// Always handled here. react-pdf's default onPassword pops a native
						// window.prompt(), which is exactly the browser password box this viewer
						// exists to avoid. Not calling the callback leaves the load pending, so
						// surface it as an error and let the caller show its download panel.
						handleError( new Error( 'Password required' ) );
					} }
					className="godam-pdf-viewer__doc"
					aria-label={ title || __( 'Document preview', 'godam' ) }
				>
					{ pageWidth > 0 &&
						Array.from( { length: numPages }, ( _, index ) => (
							<Page
								key={ index }
								pageNumber={ index + 1 }
								width={ pageWidth }
								className="godam-pdf-viewer__page"
								renderAnnotationLayer={ false }
								renderTextLayer={ renderTextLayer }
							/>
						) ) }
				</Document>
			) }
		</div>
	);
}
