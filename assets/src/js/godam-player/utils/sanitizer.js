/**
 * Sanitizer Utility
 * Lazy loads DOMPurify to reduce initial bundle size
 */

let DOMPurifyInstance = null;

/**
 * Load DOMPurify dynamically
 *
 * @return {Promise<Object>} Promise that resolves with DOMPurify instance
 */
async function loadDOMPurify() {
	if ( DOMPurifyInstance ) {
		return DOMPurifyInstance;
	}

	try {
		const module = await import( 'isomorphic-dompurify' );
		DOMPurifyInstance = module.default || module;
		return DOMPurifyInstance;
	} catch ( error ) {
		// eslint-disable-next-line no-console
		console.error( 'Failed to load DOMPurify:', error );
		throw error;
	}
}

/**
 * Sanitize HTML string using DOMPurify
 * Dynamically loads DOMPurify on first use
 *
 * @param {string} dirty  - Dirty HTML string to sanitize
 * @param {Object} config - DOMPurify configuration options
 * @return {Promise<string>} Promise that resolves with sanitized HTML
 */
export async function sanitize( dirty, config = {} ) {
	const DOMPurify = await loadDOMPurify();
	return DOMPurify.sanitize( dirty, config );
}

/**
 * Get DOMPurify instance (loads it if not already loaded)
 *
 * @return {Promise<Object>} Promise that resolves with DOMPurify instance
 */
export async function getDOMPurify() {
	return loadDOMPurify();
}

/**
 * Check if DOMPurify is already loaded
 *
 * @return {boolean} True if DOMPurify is loaded
 */
export function isDOMPurifyLoaded() {
	return DOMPurifyInstance !== null;
}

