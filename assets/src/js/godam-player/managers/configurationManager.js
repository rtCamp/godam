/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

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
		this.globalAdsSettings = this.parseDataAttribute( 'global_ads_settings', {} );
		this.adTagUrl = this.video.dataset.ad_tag_url;
		this.videoSetupOptions = this.parseDataAttribute( 'options', {} );
		this.videoSetupControls = this.parseDataAttribute( 'controls', this.getDefaultControls() );
		this.isPreviewEnabled = this.videoSetupOptions?.preview;

		this.ensureControlBarDefaults();
	}

	/**
	 * Parse data attribute safely
	 *
	 * @param {string} attribute    - Data attribute to parse
	 * @param {*}      defaultValue - Default value if parsing fails
	 * @return {*} Parsed value or default
	 */
	parseDataAttribute( attribute, defaultValue ) {
		try {
			return this.video.dataset[ attribute ] ? JSON.parse( this.video.dataset[ attribute ] ) : defaultValue;
		} catch {
			return defaultValue;
		}
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

	/**
	 * Get chapters data from video options
	 *
	 * @return {Array} Processed chapters data
	 */
	getChaptersData() {
		const chapters = this.videoSetupOptions?.chapters;

		if ( ! Array.isArray( chapters ) || chapters.length === 0 ) {
			return [];
		}

		const seenTimes = new Set();

		// Filter out invalid entries
		const filteredChapters = chapters.filter( ( chapter ) => {
			const time = parseFloat( chapter.startTime );

			if ( ! chapter.startTime || isNaN( time ) || time < 0 || seenTimes.has( time ) ) {
				return false;
			}

			seenTimes.add( time );
			return true;
		} );

		// Convert to required format
		return filteredChapters.map( ( chapter ) => ( {
			startTime: parseFloat( chapter.startTime ) || 0,
			text: chapter.text || __( 'Chapter', 'godam' ),
			originalTime: chapter.originalTime,
			endTime: null,
		} ) );
	}
}
