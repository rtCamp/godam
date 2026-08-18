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
import { pdfWorker } from './worker';

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

/*
 * How many pages to mount at a time.
 *
 * Every mounted Page is a canvas the size of the rendered page, at the device pixel ratio —
 * several megabytes each on a retina screen. Mounting all of them at once, which is what
 * react-pdf does if you hand it the whole range, means a 300-page report allocates hundreds
 * of those before the visitor has scrolled anywhere, and blocks the main thread rasterising
 * pages nobody is looking at. A batch at a time keeps the cost proportional to how far the
 * visitor actually reads.
 *
 * Pages already mounted are deliberately NOT released on the way back up: re-rasterising on
 * every scroll reversal is its own kind of bad, and the batch cap is what bounds the damage.
 */
const PAGES_PER_BATCH = 5;

/*
 * How far below the last mounted page to start the next batch. Larger than a page is tall,
 * so scrolling at a normal reading pace finds the next page already rendered.
 */
const PRELOAD_MARGIN = '1500px';

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
	const [ mountedPages, setMountedPages ] = useState( PAGES_PER_BATCH );
	const [ hasError, setHasError ] = useState( false );
	const containerRef = useRef( null );
	const sentinelRef = useRef( null );
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

	// A new file is a fresh attempt: clear the previous document's error and page count, and
	// go back to rendering a single batch.
	useEffect( () => {
		setHasError( false );
		setNumPages( 0 );
		setMountedPages( PAGES_PER_BATCH );
	}, [ url ] );

	const pagesToRender = Math.min( numPages, mountedPages );

	/*
	 * Mount the next batch when the end of the rendered stack comes into view.
	 *
	 * Observed against the scroll container rather than the viewport, because that is what
	 * scrolls — in the editor the whole viewer is a fixed-height box, so a viewport-rooted
	 * observer would never fire again after the first batch.
	 */
	useEffect( () => {
		const sentinel = sentinelRef.current;

		if ( ! sentinel || pagesToRender >= numPages ) {
			return;
		}

		const observer = new IntersectionObserver(
			( entries ) => {
				if ( entries.some( ( entry ) => entry.isIntersecting ) ) {
					setMountedPages( ( current ) => current + PAGES_PER_BATCH );
				}
			},
			{ root: containerRef.current, rootMargin: PRELOAD_MARGIN },
		);

		observer.observe( sentinel );

		return () => observer.disconnect();
	}, [ pagesToRender, numPages ] );

	/*
	 * `worker`: the page-wide pdf.js worker, handed over explicitly. It must NOT be left to
	 * GlobalWorkerOptions.workerPort — see viewer/worker.js for why that made one document
	 * unmounting break every other document on the page.
	 *
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
	const options = useMemo(
		// Spread so the key is absent, not undefined, when no worker could be started: pdf.js
		// only skips its own worker setup for an actual PDFWorker instance.
		() => ( { ownerDocument, ...( pdfWorker ? { worker: pdfWorker } : {} ) } ),
		[ ownerDocument ],
	);

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
		/*
		 * This is the scroll container, so it has to be reachable from the keyboard: without a
		 * tabindex a keyboard-only visitor can never put focus inside it, and arrow / Page Down
		 * would scroll the page past the document instead of through it. Labelled as a region so
		 * screen-reader users know what they have landed in.
		 */
		<div
			className="godam-pdf-viewer"
			ref={ containerRef }
			data-test-id="godam-pdf-viewer"
			role="region"
			aria-label={ title || __( 'Document preview', 'godam' ) }
			tabIndex={ 0 }
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
				>
					{ pageWidth > 0 &&
						Array.from( { length: pagesToRender }, ( _, index ) => (
							<Page
								key={ index }
								pageNumber={ index + 1 }
								width={ pageWidth }
								className="godam-pdf-viewer__page"
								renderAnnotationLayer={ false }
								renderTextLayer={ renderTextLayer }
							/>
						) ) }
					{ /* Watched by the effect above to mount the next batch. Zero-height and
					     aria-hidden: it is a scroll marker, not content. */ }
					<div
						ref={ sentinelRef }
						className="godam-pdf-viewer__sentinel"
						aria-hidden="true"
					/>
				</Document>
			) }
		</div>
	);
}
