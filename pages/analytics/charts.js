/**
 * External dependencies
 */
import videojs from 'video.js';

/**
 * Internal dependencies
 */
import PostViewsChart from './charts/PostViewChart';
import HeatmapChart from './charts/HeatmapChart';
import VideoLineChart from './charts/VideoLineChart';
import CountryHeatmapChart from './charts/CountryHeatmapChart';

import {
	formatWatchTime,
	renderChange,
	updateElement,
	toggleElementVisibility,
} from './utils';

/**
 * Main Analytics Dashboard Class
 */
class AnalyticsDashboard {
	/**
	 * Initialize the analytics dashboard
	 */
	constructor() {
		this.analyticsData = null;
		this.videoPlayer = null;
		this.charts = {};

		this.init();
	}

	/**
	 * Initialize the dashboard
	 */
	async init() {
		await this.loadData();
		this.setupVideoPlayer();
		this.updateMetrics();
		this.renderCharts();
		this.updateChangeIndicators();
		this.showContent();
	}

	/**
	 * Load analytics data from global variable
	 */
	async loadData() {
		this.analyticsData = window.analyticsDataFetched;

		if ( ! this.analyticsData ) {
			throw new Error( 'Analytics data not available' );
		}
	}

	/**
	 * Setup VideoJS player
	 */
	setupVideoPlayer() {
		this.videoPlayer = videojs( 'analytics-video', {
			fluid: true,
			mute: true,
			controls: false,
			// VHS (HLS/DASH) initial configuration to prefer a ~14 Mbps start.
			// This only affects the initial bandwidth guess; VHS will continue to measure actual throughput and adapt.
			html5: {
				vhs: {
					bandwidth: 14_000_000, // Pretend network can do ~14 Mbps at startup
					bandwidthVariance: 1.0, // allow renditions close to estimate
					limitRenditionByPlayerDimensions: false, // don't cap by video element size
				},
			},
		} );
	}

	/**
	 * Update dashboard metrics
	 */
	updateMetrics() {
		const {
			plays,
			page_load: pageLoad,
			play_time: playTime,
			video_length: videoLength,
		} = this.analyticsData;

		const playRate = pageLoad ? ( plays / pageLoad ) * 100 : 0;
		const engagementRate = plays && videoLength ? ( playTime / ( plays * videoLength ) ) * 100 : 0;

		updateElement( 'play-rate', `${ playRate.toFixed( 2 ) }%` );
		updateElement( 'plays', plays.toString() );
		updateElement( 'engagement-rate', `${ engagementRate.toFixed( 2 ) }%` );
		updateElement( 'watch-time', formatWatchTime( playTime.toFixed( 2 ) ) );
	}

	/**
	 * Render all charts
	 */
	renderCharts() {
		const { all_time_heatmap: allTimeHeatmap, country_views: countryViews } = this.analyticsData;
		const heatmapData = JSON.parse( allTimeHeatmap );

		// Generate heatmap
		this.charts.heatmap = new HeatmapChart( heatmapData, '#heatmap', this.videoPlayer );
		this.charts.videoLineChart = new VideoLineChart( heatmapData, '#line-chart', this.videoPlayer, {
			width: 830,
			height: 300,
			margin: { top: 0, right: 0, bottom: 0, left: 0 },
		} );
		this.charts.countryHeatmap = new CountryHeatmapChart( countryViews, '#map-container', '#table-container' );

		// Generate post views chart
		const postsData = ( this.analyticsData?.post_details || [] ).map( ( post ) => ( {
			post: post.title,
			views: post.views || 0,
			url: post.url,
			id: post.id,
		} ) );

		this.charts.postViews = new PostViewsChart( postsData, '#post-views-count-chart' );
	}

	/**
	 * Update change indicators
	 */
	updateChangeIndicators() {
		const {
			views_change: viewsChange,
			watch_time_change: watchTimeChange,
			play_rate_change: playRateChange,
			avg_engagement_change: avgEngagementChange,
		} = this.analyticsData;

		this.updateChangeElement( 'plays-change', viewsChange );
		this.updateChangeElement( 'watch-time-change', watchTimeChange );
		this.updateChangeElement( 'play-rate-change', playRateChange );
		this.updateChangeElement( 'engagement-rate-change', avgEngagementChange );
	}

	/**
	 * Update individual change element
	 *
	 * @param {string} elementId   - Element ID
	 * @param {number} changeValue - Change value
	 */
	updateChangeElement( elementId, changeValue ) {
		const changeText = renderChange( changeValue );
		const changeClass = changeValue >= 0 ? 'change-rise' : 'change-drop';
		const removeClass = changeValue >= 0 ? 'change-drop' : 'change-rise';

		updateElement( elementId, changeText, changeClass, removeClass );
	}

	/**
	 * Show dashboard content and hide loading
	 */
	showContent() {
		toggleElementVisibility( 'video-analytics-container', true );
		toggleElementVisibility( 'analytics-content', true );
		toggleElementVisibility( 'loading-analytics-animation', false );
	}
}

/**
 * Application Entry Point
 */
class App {
	/**
	 * Initialize the application
	 */
	static init() {
		document.addEventListener( 'DOMContentLoaded', () => {
			const checkInterval = setInterval( () => {
				const videoElement = document.getElementById( 'analytics-video' );
				const videoId = videoElement?.dataset.id;
				const analyticsDataFetched = window.analyticsDataFetched;
				const processedAnalyticsHistory = window.processedAnalyticsHistory;

				if ( videoId && analyticsDataFetched && processedAnalyticsHistory ) {
					clearInterval( checkInterval );
					new AnalyticsDashboard();
				}
			}, 500 );
		} );
	}
}

// Initialize the application
App.init();
