/**
 * Promise.withResolvers() for browsers that predate it.
 *
 * pdf.js 4.8 calls this in 31 places across both threads — including the PDFWorker and
 * PDFDocumentLoadingTask constructors, so every single document load goes through it — and it
 * guards none of them. The API shipped in Safari 17.4 (Chrome 119, Firefox 121), which leaves
 * Safari 16.4–17.3 throwing `TypeError: Promise.withResolvers is not a function` out of
 * getDocument(): the viewer never resolves, and because the throw comes from react-pdf's load
 * effect React unmounts the tree, leaving the visitor an empty box rather than an error.
 *
 * pdfjs-dist's `legacy` build polyfills this through core-js. Pulling the whole legacy build in
 * for one missing method would mean a webpack alias for react-pdf's own `pdfjs-dist` import and
 * a much larger bundle, so the method is supplied here instead. Imported first by both
 * viewer/index.js (main thread) and viewer/pdf-worker.js (worker thread) — pdf.js needs it in
 * whichever context is doing the parsing, and the worker cannot see the main thread's globals.
 *
 * Assigned only when missing, so a browser that has it keeps its native implementation.
 */
if ( 'function' !== typeof Promise.withResolvers ) {
	Promise.withResolvers = function withResolvers() {
		let resolve;
		let reject;

		const promise = new Promise( ( resolveFn, rejectFn ) => {
			resolve = resolveFn;
			reject = rejectFn;
		} );

		return { promise, resolve, reject };
	};
}
