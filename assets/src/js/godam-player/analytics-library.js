/**
 * The analytics library, built as a standalone script.
 *
 * webpack.config.js builds this entry to `godam-analytics-library.min.js` with the
 * global name `_analytics`, and WordPress loads it as the `analytics-library`
 * script. The video-player bundle (`analytics.js`) and the layer-analytics bundle
 * (`layer-analytics-runtime.js`) both `import 'analytics'`; they do not bundle it,
 * they read this global, so a page loads the library once however many of them it
 * has. The same build also keeps `window._analytics` for any code that reads it.
 *
 * Re-exports everything the package exports, so the global has the same shape as
 * the `analytics` package itself: `Analytics`, `CONSTANTS`, `EVENTS`, `init` and
 * the default export.
 *
 * @package
 */

export * from 'analytics';
export { default } from 'analytics';
