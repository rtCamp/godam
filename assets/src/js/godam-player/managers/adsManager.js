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
	 * Dynamically loads ads plugins only when ads are configured
	 *
	 * @return {Promise<void>} Promise that resolves when ads are set up
	 */
	async setupAdsIntegration() {
		if ( ! this.hasAdsConfigured() ) {
			return; // No ads configured, skip loading
		}

		try {
			// Dynamically load ads plugins
			await loadAdsPlugins();
			this.adsLoaded = true;

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
			console.error( 'Failed to setup ads integration:', error );
		}
	}
}
