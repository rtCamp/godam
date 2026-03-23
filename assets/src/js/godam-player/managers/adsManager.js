/**
 * Internal dependencies
 */
import { loadAdsPlugins } from '../utils/pluginLoader.js';

/**
 * Ads Manager
 * Handles advertisement integration for the video player
 * Uses dynamic imports to load ads plugins only when needed
 */
export default class AdsManager {
	constructor( player, config ) {
		this.player = player;
		this.config = config;
		this.adsLoaded = false;
	}

	/**
	 * Check if ads are configured
	 *
	 * @return {boolean} True if ads are configured
	 */
	hasAdsConfigured() {
		return !! (
			this.config.adTagUrl ||
			( this.config.globalAdsSettings?.enable_global_video_ads && this.config.globalAdsSettings?.adTagUrl )
		);
	}

	/**
	 * Setup ads integration
	 * NOTE: Ads plugins should already be loaded by videoPlayer.loadRequiredPlugins()
	 * before player initialization. This call to loadAdsPlugins() is a safety check
	 * that will skip if plugins are already loaded.
	 *
	 * @return {Promise<void>} Promise that resolves when ads are set up
	 */
	async setupAdsIntegration() {
		if ( ! this.hasAdsConfigured() ) {
			return; // No ads configured, skip loading
		}

		try {
			// Ensure ads plugins are loaded (will skip if already loaded)
			await loadAdsPlugins();
			this.adsLoaded = true;

			// Check if IMA plugin is available
			if ( typeof this.player.ima !== 'function' ) {
				// eslint-disable-next-line no-console
				console.warn( 'GoDAM: VideoJS IMA plugin not available. Ads will be disabled.' );
				return;
			}

			// Check if Google IMA SDK is loaded (blocked by ad blockers)
			if ( typeof window.google === 'undefined' || typeof window.google.ima === 'undefined' ) {
				// eslint-disable-next-line no-console
				console.warn( 'GoDAM: Google IMA SDK not available (likely blocked by ad blocker). Ads will be disabled.' );
				return;
			}

			// Setup IMA plugin after loading
			const adTagUrl = this.config.adTagUrl || this.config.globalAdsSettings?.adTagUrl;

			if ( this.player.ima ) {
				this.player.ima( {
					id: 'content_video',
					adTagUrl,
				} );
			}
		} catch ( error ) {
			// eslint-disable-next-line no-console
			console.warn( 'GoDAM: Failed to initialize ads. Ad layers will be disabled, but other layers will continue to work.', error );
			// Continue with player initialization, don't let ad failures break the player.
		}
	}
}
