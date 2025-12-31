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
	fontAwesome: false,
};

/**
 * Promise cache to prevent concurrent loading of the same plugins
 */
let adsPluginsPromise = null;
let flvPluginPromise = null;
let quillPromise = null;
let fontAwesomePromise = null;

/**
 * Load video.js ads plugins (videojs-contrib-ads and videojs-ima)
 * Only loads when ads are actually needed
 * Uses promise caching to prevent duplicate concurrent loads
 *
 * @return {Promise<void>} Promise that resolves when plugins are loaded
 */
export async function loadAdsPlugins() {
	if ( loadedPlugins.ads && loadedPlugins.ima ) {
		return; // Already loaded
	}

	// Return existing promise if already loading
	if ( adsPluginsPromise ) {
		return adsPluginsPromise;
	}

	adsPluginsPromise = Promise.all( [
		import( /* webpackChunkName: "videojs-contrib-ads-css" */ 'videojs-contrib-ads/dist/videojs.ads.css' ),
		import( /* webpackChunkName: "videojs-ima-css" */ 'videojs-ima/dist/videojs.ima.css' ),
		import( /* webpackChunkName: "videojs-contrib-ads" */ 'videojs-contrib-ads' ),
		import( /* webpackChunkName: "videojs-ima" */ 'videojs-ima' ),
	] ).then( () => {
		loadedPlugins.ads = true;
		loadedPlugins.ima = true;
		adsPluginsPromise = null; // Clear promise cache after success
	} ).catch( ( error ) => {
		adsPluginsPromise = null; // Clear promise cache on error to allow retry
		// eslint-disable-next-line no-console
		console.error( 'Failed to load ads plugins:', error );
		throw error;
	} );

	return adsPluginsPromise;
}

/**
 * Load FLV.js plugin for FLV video support
 * Only loads when FLV videos are detected
 * Uses promise caching to prevent duplicate concurrent loads
 *
 * @return {Promise<void>} Promise that resolves when plugin is loaded
 */
export async function loadFlvPlugin() {
	if ( loadedPlugins.flvjs ) {
		return; // Already loaded
	}

	// Return existing promise if already loading
	if ( flvPluginPromise ) {
		return flvPluginPromise;
	}

	flvPluginPromise = import( /* webpackChunkName: "videojs-flvjs-es6" */ 'videojs-flvjs-es6' )
		.then( () => {
			loadedPlugins.flvjs = true;
			flvPluginPromise = null; // Clear promise cache after success
		} )
		.catch( ( error ) => {
			flvPluginPromise = null; // Clear promise cache on error to allow retry
			// eslint-disable-next-line no-console
			console.error( 'Failed to load FLV plugin:', error );
			throw error;
		} );

	return flvPluginPromise;
}

/**
 * Load Quill editor for CTA text layers
 * Only loads when CTA layers with rich text are present
 * Uses promise caching to prevent duplicate concurrent loads
 *
 * @return {Promise<Object>} Promise that resolves with Quill module
 */
export async function loadQuill() {
	if ( loadedPlugins.quill ) {
		return window.Quill; // Return cached instance
	}

	// Return existing promise if already loading
	if ( quillPromise ) {
		return quillPromise;
	}

	quillPromise = ( async () => {
		// Load CSS and JS
		await import( /* webpackChunkName: "quill-css" */ 'quill/dist/quill.snow.css' );
		const Quill = await import( /* webpackChunkName: "quill" */ 'quill' );

		loadedPlugins.quill = true;
		window.Quill = Quill.default || Quill;

		return window.Quill;
	} )()
		.then( ( result ) => {
			quillPromise = null; // Clear promise cache after success
			return result;
		} )
		.catch( ( error ) => {
			quillPromise = null; // Clear promise cache on error to allow retry
			// eslint-disable-next-line no-console
			console.error( 'Failed to load Quill:', error );
			throw error;
		} );

	return quillPromise;
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
 * Load FontAwesome icons for hotspot layers
 * Only loads when hotspot layers with icons are present
 * Uses promise caching to prevent duplicate concurrent loads
 *
 * @return {Promise<void>} Promise that resolves when FontAwesome is loaded
 */
export async function loadFontAwesome() {
	if ( loadedPlugins.fontAwesome ) {
		return; // Already loaded
	}

	// Return existing promise if already loading
	if ( fontAwesomePromise ) {
		return fontAwesomePromise;
	}

	fontAwesomePromise = ( async () => {
		// Load FontAwesome core and solid icons
		const { library, dom } = await import( /* webpackChunkName: "fontawesome-core" */ '@fortawesome/fontawesome-svg-core' );
		const { fas } = await import( /* webpackChunkName: "fontawesome-icons" */ '@fortawesome/free-solid-svg-icons' );

		library.add( fas );
		dom.watch();

		loadedPlugins.fontAwesome = true;
	} )()
		.then( () => {
			fontAwesomePromise = null; // Clear promise cache after success
		} )
		.catch( ( error ) => {
			fontAwesomePromise = null; // Clear promise cache on error to allow retry
			// eslint-disable-next-line no-console
			console.error( 'Failed to load FontAwesome:', error );
			throw error;
		} );

	return fontAwesomePromise;
}

/**
 * Check if any hotspots in layers have icons
 *
 * @param {Array} layers - Array of layer configurations
 * @return {boolean} True if any hotspot has an icon
 */
export function hasHotspotsWithIcons( layers ) {
	if ( ! layers || ! Array.isArray( layers ) ) {
		return false;
	}

	return layers.some( ( layer ) => {
		// Check if it's a hotspot layer
		if ( layer.type !== 'hotspot' ) {
			return false;
		}

		// Check if any hotspot in this layer has an icon
		return layer.hotspots?.some( ( hotspot ) => hotspot.showIcon );
	} );
}

/**
 * Get loaded plugins status
 *
 * @return {Object} Object with plugin load status
 */
export function getLoadedPluginsStatus() {
	return { ...loadedPlugins };
}

