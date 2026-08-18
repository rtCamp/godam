/**
 * Internal dependencies
 */
import './promise-with-resolvers';

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
 * How far outside the scroll container a page is still worth having rendered.
 *
 * Every mounted page is a canvas the size of the rendered page, at the device pixel ratio.
 * Measured on a 1000px-wide viewer at DPR 2, that is ~20 MB per page — so mounting a whole
 * document at once cost 3.1 GB of canvas backing store for a 160-page file, and rasterised
 * 160 pages nobody had scrolled to yet. Only the pages near the viewport are mounted; the
 * rest are placeholders of exactly the right height (see pageRatios), so the scrollbar and
 * every scroll position behave as though the whole document were rendered.
 *
 * Generous enough that scrolling at a normal reading pace, or a page-down, lands on a page
 * that is already drawn rather than on a blank placeholder.
 */
const RENDER_MARGIN_PX = 1500;

/*
 * Placeholder shape for pages whose real dimensions are not known yet: ISO A4 portrait,
 * which is what LibreOffice gives every preview PDF Central generates. Only ever visible for
 * the moment between the document loading and its page sizes arriving.
 */
const DEFAULT_PAGE_RATIO = 297 / 210;

/*
 * Pages mounted before the observer has said anything.
 *
 * IntersectionObserver reports nothing at all while a document is hidden — a background tab,
 * or a viewer inside a collapsed panel — so without a floor the reader could arrive at a
 * document of blank placeholders. These pages are handed to the observer like any other once
 * it does report, so they are released if they turn out to be off-screen.
 */
const INITIAL_PAGES = 2;

/*
 * Whether pages can be mounted on demand at all. Without IntersectionObserver there is no way
 * to know what is on screen, so every page is rendered as it was before — heavy for a long
 * document, but a rendered document beats an empty one.
 */
const CAN_OBSERVE = 'undefined' !== typeof IntersectionObserver;

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
	// height/width of each page, so an unmounted page still occupies its real space.
	const [ pageRatios, setPageRatios ] = useState( [] );
	// Indices currently close enough to the viewport to be worth rendering.
	const [ pagesInView, setPagesInView ] = useState( () => new Set() );
	const [ hasError, setHasError ] = useState( false );
	const containerRef = useRef( null );
	const slotRefs = useRef( new Map() );
	// The file whose geometry is wanted, for discarding a previous document's late reply.
	const currentUrlRef = useRef( url );
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

	// A new file is a fresh attempt: clear the previous document's error, page count and
	// geometry. Slot refs go too, or the observer below would watch elements React has dropped.
	useEffect( () => {
		currentUrlRef.current = url;
		setHasError( false );
		setNumPages( 0 );
		setPageRatios( [] );
		setPagesInView( new Set() );
		slotRefs.current.clear();
	}, [ url ] );

	/**
	 * Read every page's aspect ratio off the document.
	 *
	 * Done up front, in one pass, because a placeholder is only safe if it is exactly as tall
	 * as the page it stands in for: guessing would make the scrollbar lie, and would shift the
	 * document under the reader each time a page mounted or was released. These are metadata
	 * reads — pdf.js parses the page dictionary, not its content — so the cost is small next to
	 * rendering even one page.
	 *
	 * @param {Object} pdf pdf.js document proxy.
	 * @return {void}
	 */
	function readPageRatios( pdf ) {
		const requestedUrl = url;

		Promise.all(
			Array.from( { length: pdf.numPages }, ( _, index ) =>
				pdf.getPage( index + 1 ).then( ( page ) => {
					const viewport = page.getViewport( { scale: 1 } );

					return viewport.width > 0
						? viewport.height / viewport.width
						: DEFAULT_PAGE_RATIO;
				} ),
			),
		)
			.then( ( ratios ) => {
				// react-pdf destroys the document when the file changes; a reply that arrives
				// after that belongs to a file nobody is looking at any more, and applying its
				// page heights would missize every placeholder in the current one.
				if ( currentUrlRef.current === requestedUrl ) {
					setPageRatios( ratios );
				}
			} )
			.catch( () => {
				// Sizes are an optimisation, not a requirement: without them every placeholder
				// keeps the A4 default, which is right for generated previews anyway.
			} );
	}

	/*
	 * Track which pages are near the viewport.
	 *
	 * Rooted on the scroll container rather than the viewport, because that is the element that
	 * scrolls — on the editor canvas the viewer is a fixed-height box, so a viewport-rooted
	 * observer would report every page as visible and mount the entire document.
	 */
	useEffect( () => {
		const container = containerRef.current;

		if ( ! CAN_OBSERVE || ! container || ! numPages ) {
			return;
		}

		const observer = new IntersectionObserver(
			( entries ) => {
				setPagesInView( ( previous ) => {
					const next = new Set( previous );

					entries.forEach( ( entry ) => {
						const index = Number( entry.target.dataset.pageIndex );

						if ( entry.isIntersecting ) {
							next.add( index );
						} else {
							next.delete( index );
						}
					} );

					return next;
				} );
			},
			{ root: container, rootMargin: `${ RENDER_MARGIN_PX }px 0px` },
		);

		slotRefs.current.forEach( ( slot ) => slot && observer.observe( slot ) );

		return () => observer.disconnect();
		// Re-observes when the page count changes, which is when the slots themselves are
		// replaced. Page width is deliberately not a dependency: a resize moves the same slots.
	}, [ numPages ] );

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
		 * The scroll container has to be reachable from the keyboard: without a tabindex a
		 * keyboard-only visitor can never move focus into it, so arrow / Page Down scroll the
		 * page past the document instead of through it. Named as a region so a screen-reader
		 * user knows what they have landed in — the aria-label on <Document> below cannot do
		 * that job, since react-pdf does not forward unknown props to its wrapper element.
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
						setPagesInView(
							new Set(
								Array.from(
									{ length: Math.min( INITIAL_PAGES, pdf.numPages ) },
									( _, index ) => index,
								),
							),
						);
						readPageRatios( pdf );
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
							/*
							 * One slot per page, always present and always the height of its page,
							 * whether or not the page itself is currently rendered. That is what
							 * keeps the scroll height honest while the pages inside come and go.
							 */
							<div
								key={ index }
								className="godam-pdf-viewer__slot"
								data-page-index={ index }
								ref={ ( element ) => {
									if ( element ) {
										slotRefs.current.set( index, element );
									} else {
										slotRefs.current.delete( index );
									}
								} }
								style={ {
									width: `${ pageWidth }px`,
									height: `${ Math.round(
										pageWidth * ( pageRatios[ index ] || DEFAULT_PAGE_RATIO ),
									) }px`,
								} }
							>
								{ ( ! CAN_OBSERVE || pagesInView.has( index ) ) && (
									<Page
										pageNumber={ index + 1 }
										width={ pageWidth }
										className="godam-pdf-viewer__page"
										renderAnnotationLayer={ false }
										renderTextLayer={ renderTextLayer }
									/>
								) }
							</div>
						) ) }
				</Document>
			) }
		</div>
	);
}
