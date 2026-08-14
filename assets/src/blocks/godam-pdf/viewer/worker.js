/**
 * pdf.js worker setup for the Document block viewer.
 *
 * Importing this module once, for its side effect, is enough — pdf.js keys its worker
 * cache off the port, so every <Document> on the page shares this single worker.
 */

/**
 * External dependencies
 */
import { pdfjs } from 'react-pdf';

/**
 * `new Worker( new URL( …, import.meta.url ) )` is webpack 5's own worker syntax: it
 * compiles the worker into a separate CLASSIC .js chunk emitted alongside this bundle,
 * and hands us a same-origin URL for it.
 *
 * That indirection is the point. Referencing pdfjs-dist's `.mjs` worker by URL directly
 * would need the web server to serve `.mjs` with a JavaScript MIME type, which plenty of
 * Apache and nginx installs do not — the browser then refuses the module worker and pdf.js
 * silently falls back to running on the main thread, janking the whole page while it
 * parses. Letting webpack own the file also means the plugin ships no non-JS runtime asset
 * and needs no CopyWebpackPlugin.
 *
 * `workerPort` rather than `workerSrc` because we are handing over a live Worker instance
 * rather than a URL for pdf.js to instantiate itself.
 */
pdfjs.GlobalWorkerOptions.workerPort = new Worker(
	new URL( 'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url ),
);

export { pdfjs };
