/**
 * Ads Manager
 * Handles advertisement integration for the video player
 */
export default class AdsManager {
	constructor( player, config ) {
		this.player = player;
		this.config = config;
	}

	/**
	 * Setup ads integration
	 */
	setupAdsIntegration() {
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

		try {
			if ( this.config.adTagUrl ) {
				this.player.ima( {
					id: 'content_video',
					adTagUrl: this.config.adTagUrl,
				} );
			} else if ( this.config.globalAdsSettings?.enable_global_video_ads && this.config.globalAdsSettings?.adTagUrl ) {
				this.player.ima( {
					id: 'content_video',
					adTagUrl: this.config.globalAdsSettings.adTagUrl,
				} );
			}
		} catch ( error ) {
			// eslint-disable-next-line no-console
			console.warn( 'GoDAM: Failed to initialize ads. Ad layers will be disabled, but other layers will continue to work.', error );
			// Continue with player initialization, don't let ad failures break the player.
		}
	}
}
