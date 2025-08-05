/* global d3 */
/**
 * External dependencies
 */
import videojs from 'video.js';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import ViewIcon from '../../assets/src/images/views.svg';
import DurationIcon from '../../assets/src/images/duration.svg';
import {
	generateCountryHeatmap,
	generateLineChart,
} from '../../pages/analytics/helper';
import {
	formatTime,
	formatNumber,
	formatWatchTime,
	renderChange,
	updateElement,
	toggleElementVisibility,
} from './utils';

/**
 * Heatmap Visualization Class
 */
class HeatmapChart {
	/**
	 * @param {Array}  data        - Heatmap data array
	 * @param {string} selector    - SVG selector
	 * @param {Object} videoPlayer - VideoJS player instance
	 */
	constructor( data, selector, videoPlayer ) {
		this.data = data;
		this.selector = selector;
		this.videoPlayer = videoPlayer;
		this.config = {
			margin: { top: 0, right: 0, bottom: 0, left: 0 },
			width: 830,
			height: 60,
		};

		this.initializeChart();
	}

	/**
	 * Initialize the heatmap chart
	 */
	initializeChart() {
		const { margin, width, height } = this.config;
		const chartWidth = width - margin.left - margin.right;
		const chartHeight = height - margin.top - margin.bottom;

		this.svg = d3.select( this.selector )
			.attr( 'width', width )
			.attr( 'height', height )
			.append( 'g' )
			.attr( 'transform', `translate(${ margin.left },${ margin.top })` );

		this.setupScales( chartWidth, chartHeight );
		this.renderHeatmap( chartWidth, chartHeight );
		this.setupInteractions( chartWidth, chartHeight );
	}

	/**
	 * Setup D3 scales for the heatmap
	 *
	 * @param {number} width  - Chart width
	 * @param {number} height - Chart height
	 */
	setupScales( width, height ) {
		// height is not used in this heatmap, but kept for consistency -- and eslint.
		void height;

		this.xScale = d3.scaleBand()
			.domain( d3.range( this.data.length ) )
			.range( [ 0, width ] )
			.padding( 0 );

		this.colorScale = d3.scaleSequential( d3.interpolateReds )
			.domain( [ 0, d3.max( this.data ) ] );
	}

	/**
	 * Render heatmap rectangles
	 *
	 * @param {number} width  - Chart width
	 * @param {number} height - Chart height
	 */
	renderHeatmap( width, height ) {
		this.svg.selectAll( 'rect.heatmap-rect' )
			.data( this.data )
			.enter()
			.append( 'rect' )
			.attr( 'class', 'heatmap-rect' )
			.attr( 'x', ( d, i ) => this.xScale( i ) )
			.attr( 'y', 0 )
			.attr( 'width', this.xScale.bandwidth() )
			.attr( 'height', height )
			.attr( 'fill', ( d ) => this.colorScale( d ) );

		this.verticalLine = this.svg.append( 'line' )
			.attr( 'class', 'heatmap-vertical-line' )
			.attr( 'y1', 0 )
			.attr( 'y2', height )
			.style( 'opacity', 0 );

		this.tooltip = d3.select( '.heatmap-tooltip' );
	}

	/**
	 * Setup mouse interactions for the heatmap
	 *
	 * @param {number} width  - Chart width
	 * @param {number} height - Chart height
	 */
	setupInteractions( width, height ) {
		const overlay = this.svg.append( 'rect' )
			.attr( 'width', width )
			.attr( 'height', height )
			.style( 'fill', 'none' )
			.style( 'pointer-events', 'all' );

		overlay.on( 'mousemove', ( event ) => this.handleMouseMove( event ) )
			.on( 'mouseout', () => this.handleMouseOut() );
	}

	/**
	 * Handle mouse move events
	 *
	 * @param {Event} event - Mouse event
	 */
	handleMouseMove( event ) {
		const [ mouseX ] = d3.pointer( event );
		const index = Math.floor( mouseX / this.xScale.step() );

		if ( index >= 0 && index < this.data.length ) {
			const value = this.data[ index ];
			const videoDuration = this.videoPlayer.duration();
			const videoTime = ( index / this.data.length ) * videoDuration;

			this.updateTooltip( index, value );
			this.updateVerticalLine( index );
			this.videoPlayer.currentTime( videoTime );
		}
	}

	/**
	 * Update tooltip content and position
	 *
	 * @param {number} index - Data index
	 * @param {number} value - Data value
	 */
	updateTooltip( index, value ) {
		const tooltipContent = `
			<div class="heatmap-tooltip-html">
				<div class="flex gap-2 items-center text-black">
					<img src="${ ViewIcon }" alt="${ __( 'View', 'godam' ) }" height="16" width="16"/>
					${ value }
				</div>
				<div class="flex gap-2 items-center text-black">
					<img src="${ DurationIcon }" alt="${ __( 'Duration', 'godam' ) }" height="15" width="15"/>
					${ formatTime( index ) }
				</div>
			</div>
		`;

		this.tooltip
			.style( 'opacity', 1 )
			.style( 'left', `${ this.xScale( index ) - 20 }px` )
			.style( 'top', `${ this.config.margin.top - 52 }px` )
			.html( tooltipContent );
	}

	/**
	 * Update vertical line position
	 *
	 * @param {number} index - Data index
	 */
	updateVerticalLine( index ) {
		const xPosition = this.xScale( index ) + ( this.xScale.bandwidth() / 2 );
		this.verticalLine
			.style( 'opacity', 1 )
			.attr( 'x1', xPosition )
			.attr( 'x2', xPosition );
	}

	/**
	 * Handle mouse out events
	 */
	handleMouseOut() {
		this.tooltip.style( 'opacity', 0 );
		this.verticalLine.style( 'opacity', 0 );
	}
}

/**
 * Post Views Donut Chart Class
 */
class PostViewsChart {
	/**
	 * @param {Array}  data     - Posts data array
	 * @param {string} selector - Container selector
	 */
	constructor( data, selector ) {
		this.data = data;
		this.selector = selector;
		this.config = {
			width: 200,
			height: 200,
			margin: 20,
			innerRadiusRatio: 0.7,
			hoverScale: 1.05,
		};

		this.initializeChart();
	}

	/**
	 * Initialize the donut chart
	 */
	initializeChart() {
		const { width, height, margin, innerRadiusRatio } = this.config;
		this.radius = ( Math.min( width, height ) / 2 ) - margin;
		this.innerRadius = this.radius * innerRadiusRatio;
		this.totalViews = this.data.reduce( ( sum, entry ) => sum + entry.views, 0 );

		this.setupColorScale();
		this.createSVG();
		this.createTooltip();
		this.setupGenerators();
		this.renderChart();
		this.addCenterText();
		this.createLegend();
	}

	/**
	 * Setup color scale for the chart
	 */
	setupColorScale() {
		this.colorScale = d3.scaleOrdinal()
			.domain( this.data.map( ( d ) => d.post + d.id ) )
			.range( [
				'#1D4A4F', '#368071', '#4C9A88', '#5DB5A1',
				'#76CFC0', '#A8E4D7', '#D1F0EC', '#2C6660',
			] );
	}

	/**
	 * Create SVG container
	 */
	createSVG() {
		const { width, height } = this.config;
		this.svg = d3.select( this.selector )
			.append( 'svg' )
			.attr( 'width', width )
			.attr( 'height', height )
			.append( 'g' )
			.attr( 'transform', `translate(${ width / 2 }, ${ height / 2 })` );
	}

	/**
	 * Create tooltip element
	 */
	createTooltip() {
		this.tooltip = d3.select( 'body' )
			.append( 'div' )
			.attr( 'class', 'tooltip' )
			.style( 'opacity', 0 );
	}

	/**
	 * Setup D3 pie and arc generators
	 */
	setupGenerators() {
		this.pie = d3.pie()
			.value( ( d ) => d.views )
			.sort( null );

		this.arc = d3.arc()
			.innerRadius( this.innerRadius )
			.outerRadius( this.radius );

		this.arcHover = d3.arc()
			.innerRadius( this.innerRadius )
			.outerRadius( this.radius * this.config.hoverScale );
	}

	/**
	 * Render the donut chart
	 */
	renderChart() {
		const arcs = this.svg.selectAll( 'a' )
			.data( this.pie( this.data ) )
			.enter()
			.append( 'a' )
			.attr( 'xlink:href', ( d ) => d.data.url )
			.attr( 'target', '_blank' );

		arcs.append( 'path' )
			.attr( 'd', this.arc )
			.attr( 'fill', ( d ) => this.colorScale( d.data.post + d.data.id ) )
			.attr( 'stroke', 'white' )
			.style( 'stroke-width', '2px' )
			.on( 'mouseover', ( event, d ) => this.handleMouseOver( event, d ) )
			.on( 'mouseout', ( event, d ) => this.handleMouseOut( event, d ) );

		this.addSliceLabels();
	}

	/**
	 * Add view count labels to chart slices
	 */
	addSliceLabels() {
		this.svg.selectAll( 'text.slice-label' )
			.data( this.pie( this.data ) )
			.enter()
			.append( 'text' )
			.attr( 'class', 'slice-label' )
			.attr( 'transform', ( d ) => `translate(${ this.arc.centroid( d ) })` )
			.attr( 'text-anchor', 'middle' )
			.attr( 'dy', '0.35em' )
			.style( 'fill', '#fff' )
			.style( 'font-size', '11px' )
			.style( 'font-weight', 'bold' )
			.text( ( d ) => formatNumber( d.data.views ) );
	}

	/**
	 * Add center text displaying total views
	 */
	addCenterText() {
		this.svg.append( 'text' )
			.attr( 'class', 'center-text-title' )
			.attr( 'dy', -10 )
			.text( 'Total' );

		this.svg.append( 'text' )
			.attr( 'class', 'center-text-views' )
			.attr( 'dy', 20 )
			.text( formatNumber( this.totalViews ) );
	}

	/**
	 * Create legend for the chart
	 */
	createLegend() {
		const legend = d3.select( '#legend' );

		this.data.forEach( ( d ) => {
			const legendItem = legend.append( 'div' )
				.attr( 'class', 'legend-item' );

			legendItem.append( 'div' )
				.attr( 'class', 'legend-color' )
				.style( 'background-color', this.colorScale( d.post + d.id ) );

			const postTitle = d.post === '' ? __( 'Untitled', 'godam' ) : d.post;
			legendItem.append( 'div' )
				.html( `<a href="${ d.url }" target="_blank" class="pie-chart-legend">${ postTitle }</a>` );
		} );
	}

	/**
	 * Handle mouse over events
	 *
	 * @param {Event}  event - Mouse event
	 * @param {Object} d     - Data object
	 */
	handleMouseOver( event, d ) {
		d3.select( event.currentTarget.querySelector( 'path' ) )
			.transition()
			.duration( 200 )
			.attr( 'd', this.arcHover )
			.style( 'opacity', 1 );

		const percent = ( ( d.data.views / this.totalViews ) * 100 ).toFixed( 1 );
		const postTitle = d.data.post === '' ? __( 'Untitled', 'godam' ) : d.data.post;

		this.tooltip.transition()
			.duration( 200 )
			.style( 'opacity', 0.9 );

		this.tooltip.html(
			`<strong>${ postTitle }</strong><br>
				Views: ${ formatNumber( d.data.views ) }<br>
				Percentage: ${ percent }%
			` )
			.style( 'left', ( event.pageX + 10 ) + 'px' )
			.style( 'top', ( event.pageY - 28 ) + 'px' );
	}

	/**
	 * Handle mouse out events
	 *
	 * @param {Event} event - Mouse event
	 */
	handleMouseOut( event ) {
		d3.select( event.currentTarget.querySelector( 'path' ) )
			.transition()
			.duration( 200 )
			.attr( 'd', this.arc );

		this.tooltip.transition()
			.duration( 500 )
			.style( 'opacity', 0 );
	}
}

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

		// Generate line chart
		generateLineChart(
			heatmapData,
			'#line-chart',
			this.videoPlayer,
			'.line-chart-tooltip',
			830,
			300,
		);

		// Generate heatmap
		this.charts.heatmap = new HeatmapChart( heatmapData, '#heatmap', this.videoPlayer );

		// Generate post views chart
		const postsData = ( this.analyticsData?.post_details || [] ).map( ( post ) => ( {
			post: post.title,
			views: post.views || 0,
			url: post.url,
			id: post.id,
		} ) );

		this.charts.postViews = new PostViewsChart( postsData, '#post-views-count-chart' );

		// Generate country heatmap if data exists
		if ( countryViews ) {
			generateCountryHeatmap( countryViews, '#map-container', '#table-container' );
		}
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
