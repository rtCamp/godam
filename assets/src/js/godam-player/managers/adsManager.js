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
	}
}
