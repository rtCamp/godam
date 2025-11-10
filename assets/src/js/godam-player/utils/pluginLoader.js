/**
 * Dynamic Plugin Loader
 * Lazy loads video.js plugins to reduce initial bundle size
 */

/**
 * Cache for loaded plugins to avoid duplicate loads
 */
const loadedPlugins = {
	ads: false,
	ima: false,
	flvjs: false,
	quill: false,
};

/**
 * Load video.js ads plugins (videojs-contrib-ads and videojs-ima)
 * Only loads when ads are actually needed
 *
 * @return {Promise<void>} Promise that resolves when plugins are loaded
 */
export async function loadAdsPlugins() {
	if ( loadedPlugins.ads && loadedPlugins.ima ) {
		return; // Already loaded
	}

	try {
		// Load CSS and JS in parallel
		await Promise.all( [
			import( 'videojs-contrib-ads/dist/videojs.ads.css' ),
			import( 'videojs-ima/dist/videojs.ima.css' ),
			import( 'videojs-contrib-ads' ),
			import( 'videojs-ima' ),
		] );

		loadedPlugins.ads = true;
		loadedPlugins.ima = true;
	} catch ( error ) {
		// eslint-disable-next-line no-console
		console.error( 'Failed to load ads plugins:', error );
		throw error;
	}
}

/**
 * Load FLV.js plugin for FLV video support
 * Only loads when FLV videos are detected
 *
 * @return {Promise<void>} Promise that resolves when plugin is loaded
 */
export async function loadFlvPlugin() {
	if ( loadedPlugins.flvjs ) {
		return; // Already loaded
	}

	try {
		await import( 'videojs-flvjs-es6' );
		loadedPlugins.flvjs = true;
	} catch ( error ) {
		// eslint-disable-next-line no-console
		console.error( 'Failed to load FLV plugin:', error );
		throw error;
	}
}

/**
 * Load Quill editor for CTA text layers
 * Only loads when CTA layers with rich text are present
 *
 * @return {Promise<Object>} Promise that resolves with Quill module
 */
export async function loadQuill() {
	if ( loadedPlugins.quill ) {
		return window.Quill; // Return cached instance
	}

	try {
		// Load CSS and JS
		await import( 'quill/dist/quill.snow.css' );
		const Quill = await import( 'quill' );

		loadedPlugins.quill = true;
		window.Quill = Quill.default || Quill;

		return window.Quill;
	} catch ( error ) {
		// eslint-disable-next-line no-console
		console.error( 'Failed to load Quill:', error );
		throw error;
	}
}

/**
 * Check if a video source requires FLV plugin
 *
 * @param {string} src - Video source URL or type
 * @return {boolean} True if FLV plugin is needed
 */
export function requiresFlvPlugin( src ) {
	if ( ! src ) {
		return false;
	}

	const lowerSrc = src.toLowerCase();
	return lowerSrc.includes( '.flv' ) ||
		lowerSrc.includes( 'type=flv' ) ||
		lowerSrc.includes( 'video/flv' ) ||
		lowerSrc.includes( 'video/x-flv' );
}

/**
 * Get loaded plugins status
 *
 * @return {Object} Object with plugin load status
 */
export function getLoadedPluginsStatus() {
	return { ...loadedPlugins };
}

