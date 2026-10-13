/**
 * Worker entry for pdf.js.
 *
 * Exists so the worker thread gets the Promise.withResolvers polyfill before pdf.js runs:
 * pointing the Worker straight at pdfjs-dist's own worker file, as this did before, left the
 * parsing thread throwing on Safari 17.3 and older with no way to inject anything ahead of it.
 * A worker shares no globals with the page, so the main thread's polyfill does not reach here.
 */

/**
 * Internal dependencies
 */
import './promise-with-resolvers';

/**
 * External dependencies
 */
import 'pdfjs-dist/build/pdf.worker.min.mjs';
