/**
 * Internal dependencies
 */
import { parseDataAttribute } from '../utils/dataHelpers.js';

/**
 * Configuration Manager
 * Handles video configuration setup and data parsing
 */
export default class ConfigurationManager {
	constructor( video ) {
		this.video = video;
		this.globalAdsSettings = {};
		this.adTagUrl = null;
		this.videoSetupOptions = {};
		this.videoSetupControls = {};
		this.isPreviewEnabled = false;

		this.initialize();
	}

	/**
	 * Initialize configuration
	 */
	initialize() {
		this.globalAdsSettings = parseDataAttribute( this.video, 'global_ads_settings', {} );
		this.adTagUrl = this.video.dataset.ad_tag_url;
		this.videoSetupOptions = parseDataAttribute( this.video, 'options', {} );
		const videoSetupControls = parseDataAttribute( this.video, 'controls', this.getDefaultControls() );
		this.videoSetupControls = {
			...videoSetupControls,
			html5: {
				vhs: {
					bandwidth: 14_000_000, // Pretend network can do ~14 Mbps at startup
					bandwidthVariance: 1.0, // allow renditions close to estimate
					limitRenditionByPlayerDimensions: false, // don't cap by video element size
				},
			},
		};
		this.isPreviewEnabled = this.videoSetupOptions?.preview;

		this.ensureControlBarDefaults();
	}

	/**
	 * Get default control configuration
	 *
	 * @return {Object} Default controls configuration
	 */
	getDefaultControls() {
		return {
			controls: true,
			autoplay: false,
			preload: 'auto',
			fluid: true,
			preview: false,
		};
	}

	/**
	 * Ensure control bar has default settings
	 */
	ensureControlBarDefaults() {
		if ( ! ( 'controlBar' in this.videoSetupControls ) ) {
			this.videoSetupControls.controlBar = {
				playToggle: true,
				volumePanel: true,
				currentTimeDisplay: true,
				timeDivider: true,
				durationDisplay: true,
				fullscreenToggle: true,
				subsCapsButton: true,
				skipButtons: {
					forward: 10,
					backward: 10,
				},
			};
		}
	}
}
