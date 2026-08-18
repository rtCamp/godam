/**
 * pdf.js worker setup for the Document block viewer.
 *
 * Exports one PDFWorker for the whole page, which every <Document> must be handed
 * explicitly as `options.worker` — see the note below on why it is NOT installed as
 * `GlobalWorkerOptions.workerPort`.
 */

/**
 * External dependencies
 */
import { pdfjs } from 'react-pdf';

/**
 * Internal dependencies
 */
import './promise-with-resolvers';

/**
 * The shared worker, or null when the browser refused to create one.
 *
 * `new Worker( new URL( …, import.meta.url ) )` is webpack 5's own worker syntax: it
 * compiles ./pdf-worker.js — the polyfill plus pdfjs-dist's worker — into a separate
 * CLASSIC .js chunk emitted alongside this bundle, and hands us a same-origin URL for it.
 *
 * That indirection is the point. Referencing pdfjs-dist's `.mjs` worker by URL directly
 * would need the web server to serve `.mjs` with a JavaScript MIME type, which plenty of
 * Apache and nginx installs do not — the browser then refuses the module worker and pdf.js
 * silently falls back to running on the main thread, janking the whole page while it
 * parses. Letting webpack own the file also means the plugin ships no non-JS runtime asset
 * and needs no CopyWebpackPlugin, and it is what makes it possible to run anything at all
 * before pdf.js inside the worker.
 *
 * Wrapped because a strict Content-Security-Policy can refuse the worker outright. Failing
 * soft leaves `worker` undefined in the options, and pdf.js then sets up its own in-process
 * fallback: slower, but the document still renders.
 */
let pdfWorker = null;

try {
	pdfWorker = new pdfjs.PDFWorker( {
		name: 'godam-pdf-worker',
		port: new Worker( new URL( './pdf-worker.js', import.meta.url ) ),
	} );
} catch ( error ) {
	global.console?.warn( 'GoDAM: could not start the pdf.js worker; rendering on the main thread instead', error );
}

/*
 * Why a PDFWorker instance passed per document, rather than the one-liner this used to be
 * (`pdfjs.GlobalWorkerOptions.workerPort = new Worker( … )`):
 *
 * With only the port set globally, pdf.js resolves it through PDFWorker.fromPort() on every
 * getDocument() call, which returns the SAME PDFWorker to every <Document> and records it on
 * that document's loading task. react-pdf destroys the loading task whenever a document
 * unmounts or its file changes — and PDFDocumentLoadingTask.destroy() flags the worker
 * `_pendingDestroy`, awaits the transport, then destroys the worker itself. So one document
 * going away tore down the worker the others were still using, and any document that mounted
 * inside that window hit `fromPort`'s guard:
 *
 *   Error: PDFWorker.fromPort - the worker is being destroyed.
 *
 * which is thrown synchronously out of react-pdf's load effect — in the editor that surfaces
 * as "This block has encountered an error and cannot be previewed", and it takes the whole
 * block down. Two Document blocks in one post were enough; so was a single block whose
 * preview URL was refined once the attachment record resolved.
 *
 * Handing getDocument() a `worker` it did not create makes it skip fromPort() entirely and
 * leave `task._worker` null, so destroy() has no worker to tear down. The worker's lifetime
 * then follows the page rather than whichever document happens to unmount first.
 */
export { pdfWorker, pdfjs };
