/* global d3 */
/**
 * External dependencies
 */
import videojs from 'video.js';
/**
 * Internal dependencies
 */
import ViewIcon from '../../assets/src/images/views.svg';
import DurationIcon from '../../assets/src/images/duration.svg';
import {
	generateCountryHeatmap,
	generateLineChart,
} from '../../pages/analytics/helper';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

function formatTime( seconds ) {
	const minutes = Math.floor( seconds / 60 );
	const remainingSeconds = seconds % 60;
	return `${ minutes }:${ remainingSeconds.toString().padStart( 2, '0' ) }`;
}

function generateHeatmap( data, selector, videoPlayer ) {
	// Chart dimensions
	const margin = { top: 0, right: 0, bottom: 0, left: 0 };
	const width = 830 - margin.left - margin.right;
	const height = 60 - margin.top - margin.bottom;

	// Create the SVG canvas
	const heatmapSvg = d3.select( selector )
		.attr( 'width', width + margin.left + margin.right )
		.attr( 'height', height + margin.top + margin.bottom )
		.append( 'g' )
		.attr( 'transform', `translate(${ margin.left },${ margin.top })` );

	// Define scales
	const xScale = d3.scaleBand()
		.domain( d3.range( data.length ) )
		.range( [ 0, width ] )
		.padding( 0 ); // No space between rectangles

	const colorScale = d3.scaleSequential( d3.interpolateReds )
		.domain( [ 0, d3.max( data ) ] );

	// Add rectangles for the heatmap
	heatmapSvg.selectAll( 'rect' )
		.data( data )
		.enter()
		.append( 'rect' )
		.attr( 'class', 'heatmap-rect' )
		.attr( 'x', ( d, i ) => xScale( i ) )
		.attr( 'y', 0 )
		.attr( 'width', xScale.bandwidth() )
		.attr( 'height', height )
		.attr( 'fill', ( d ) => colorScale( d ) );

	// Add a vertical line for mouse hover
	const verticalLine = heatmapSvg.append( 'line' )
		.attr( 'class', 'heatmap-vertical-line' )
		.attr( 'y1', 0 )
		.attr( 'y2', height )
		.style( 'opacity', 0 );

	// Tooltip
	const heatmapTooltip = d3.select( '.heatmap-tooltip' );

	// Overlay for capturing mouse events
	heatmapSvg.append( 'rect' )
		.attr( 'width', width )
		.attr( 'height', height )
		.style( 'fill', 'none' )
		.style( 'pointer-events', 'all' )
		.on( 'mousemove', function( event ) {
			const [ mouseX ] = d3.pointer( event );
			const index = Math.floor( xScale.invert ? xScale.invert( mouseX ) : mouseX / xScale.step() );

			if ( index >= 0 && index < data.length ) {
				const value = data[ index ];
				const videoDuration = videoPlayer.duration();
				const videoTime = ( index / data.length ) * videoDuration;

				// Update the tooltip
				heatmapTooltip
					.style( 'opacity', 1 )
					.style( 'left', `${ xScale( index ) - 20 }px` )
					.style( 'top', `${ margin.top - 52 }px` ) // Fixed above the heatmap
					.html(
						`<div class="heatmap-tooltip-html">
							<div class="flex gap-2 items-center text-black">
								<img src=${ ViewIcon } alt="${ __( 'View', 'godam' ) }" height=${ 16 } width=${ 16 }/>
								${ value }
							</div>
							<div class="flex gap-2 items-center text-black">
								<img src=${ DurationIcon } alt="${ __( 'Duration', 'godam' ) }" height=${ 15 } width=${ 15 }/>
								${ formatTime( index ) }
							</div>
						</div>`,
					);

				// Update the vertical line
				verticalLine
					.style( 'opacity', 1 )
					.attr( 'x1', xScale( index ) + ( xScale.bandwidth() / 2 ) )
					.attr( 'x2', xScale( index ) + ( xScale.bandwidth() / 2 ) );

				videoPlayer.currentTime( videoTime );
			}
		} )
		.on( 'mouseout', () => {
			heatmapTooltip.style( 'opacity', 0 );
			verticalLine.style( 'opacity', 0 );
		} );
}

function generatePostViewsChart( postsData, selector ) {
	// Set dimensions
	const width = 200;
	const height = 200;
	const margin = 20;
	const radius = ( Math.min( width, height ) / 2 ) - margin;
	const innerRadius = radius * 0.7;

	// Calculate total views
	const totalViews = postsData.reduce( ( sum, entry ) => sum + entry.views, 0 );

	// Format numbers with commas
	const formatNumber = ( num ) => {
		return num.toString().replace( /\B(?=(\d{3})+(?!\d))/g, ',' );
	};

	// Color scale
	const color = d3
		.scaleOrdinal()
		.domain( postsData.map( ( d ) => d.post + d.id ) )
		.range( [
			'#1D4A4F',
			'#368071',
			'#4C9A88',
			'#5DB5A1',
			'#76CFC0',
			'#A8E4D7',
			'#D1F0EC',
			'#2C6660',
		] );

	// Create SVG
	const svg = d3
		.select( selector )
		.append( 'svg' )
		.attr( 'width', width )
		.attr( 'height', height )
		.append( 'g' )
		.attr( 'transform', `translate(${ width / 2 }, ${ height / 2 })` );

	// Create tooltip
	const tooltip = d3
		.select( 'body' )
		.append( 'div' )
		.attr( 'class', 'tooltip' )
		.style( 'opacity', 0 );

	// Pie generator
	const pie = d3
		.pie()
		.value( ( d ) => d.views )
		.sort( null );

	// Arc generator
	const arc = d3.arc().innerRadius( innerRadius ).outerRadius( radius );

	// Larger arc for hover effect
	const arcHover = d3
		.arc()
		.innerRadius( innerRadius )
		.outerRadius( radius * 1.05 );

	// Create donut chart
	svg
		.selectAll( 'a' )
		.data( pie( postsData ) )
		.enter()
		.append( 'a' )
		.attr( 'xlink:href', ( d ) => d.data.url )
		.attr( 'target', '_blank' )
		.append( 'path' )
		.attr( 'd', arc )
		.attr( 'fill', ( d ) => color( d.data.post + d.data.id ) )
		.attr( 'stroke', 'white' )
		.style( 'stroke-width', '2px' )
		.on( 'mouseover', function( event, d ) {
			d3.select( this )
				.transition()
				.duration( 200 )
				.attr( 'd', arcHover )
				.style( 'opacity', 1 );

			const rawPercent = totalViews ? ( d.data.views / totalViews ) * 100 : 0;
			const percent = Number.isFinite( rawPercent ) ? rawPercent.toFixed( 1 ) : '0.0';

			tooltip.transition().duration( 200 ).style( 'opacity', 0.9 );
			tooltip
				.html(
					`<strong>${ d.data.post === '' ? __( 'Untitled', ' godam' ) : d.data.post }</strong><br>
					Views: ${ formatNumber( d.data.views ) }<br>
					Percentage: ${ percent }%`,
				)
				.style( 'left', event.pageX + 10 + 'px' )
				.style( 'top', event.pageY - 28 + 'px' );
		} )
		.on( 'mouseout', function() {
			d3.select( this )
				.transition()
				.duration( 200 )
				.attr( 'd', arc );

			tooltip.transition().duration( 500 ).style( 'opacity', 0 );
		} );

	// Add view count text labels to each arc
	svg.selectAll( 'text.slice-label' )
		.data( pie( postsData ) )
		.enter()
		.append( 'text' )
		.attr( 'class', 'slice-label' )
		.attr( 'transform', ( d ) => `translate(${ arc.centroid( d ) })` )
		.attr( 'text-anchor', 'middle' )
		.attr( 'dy', '0.35em' )
		.style( 'fill', '#fff' )
		.style( 'font-size', '11px' )
		.style( 'font-weight', 'bold' )
		.text( ( d ) => formatNumber( d.data.views ) );

	// Add center text
	svg
		.append( 'text' )
		.attr( 'class', 'center-text-title' )
		.attr( 'dy', -10 )
		.text( 'Total' );

	svg
		.append( 'text' )
		.attr( 'class', 'center-text-views' )
		.attr( 'dy', 20 )
		.text( formatNumber( totalViews ) );

	// Create legend
	const legend = d3.select( '#legend' );

	postsData.forEach( ( d ) => {
		const legendItem = legend.append( 'div' ).attr( 'class', 'legend-item' );

		legendItem
			.append( 'div' )
			.attr( 'class', 'legend-color' )
			.style( 'background-color', color( d.post + d.id ) );

		legendItem.append( 'div' )
			.html( `<a href="${ d.url }" target="_blank" class="pie-chart-legend">${ d.post === '' ? __( 'Untitled', 'godam' ) : d.post }</a>` );
	} );
}

async function main() {
	const analyticsData = window.analyticsDataFetched;

	if ( ! analyticsData ) {
		return;
	}

	// Extract values from the analytics response
	const {
		plays,
		page_load: pageLoad,
		play_time: playTime,
		video_length: videoLength,
		all_time_heatmap: allTimeHeatmap,
		country_views: countryViews,
		views_change: viewsChange,
		watch_time_change: watchTimeChange,
		play_rate_change: playRateChange,
		avg_engagement_change: avgEngagementChange,
	} = analyticsData;

	// Calculate analytics metrics
	const playRate = pageLoad ? ( plays / pageLoad ) * 100 : 0; // Convert to percentage
	const totalPlays = plays;
	const engagementRate = plays && videoLength ? ( playTime / ( plays * videoLength ) ) * 100 : 0;

	// Update the UI with computed analytics
	document.getElementById( 'play-rate' ).innerText =
    Number.isFinite( playRate ) ? `${ playRate.toFixed( 2 ) }%` : '0%';

	document.getElementById( 'plays' ).innerText =
    typeof totalPlays === 'number' ? totalPlays : '0';

	document.getElementById( 'engagement-rate' ).innerText =
    Number.isFinite( engagementRate ) ? `${ engagementRate.toFixed( 2 ) }%` : '0%';

	document.getElementById( 'watch-time' ).innerText =
    Number.isFinite( playTime ) ? formatWatchTime( playTime.toFixed( 2 ) ) : formatWatchTime( 0 );

	// Convert heatmap string into an array
	const heatmapData = allTimeHeatmap ? JSON.parse( allTimeHeatmap ) : [];

	const videoPlayer = videojs( 'analytics-video', {
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

	const postsData = ( window.analyticsDataFetched?.post_details || [] ).map( ( post ) => {
		const views = post.views || 0;
		return { post: post.title, views, url: post.url, id: post.id };
	} );

	// Generate visualizations
	generateLineChart(
		heatmapData,
		'#line-chart',
		videoPlayer,
		'.line-chart-tooltip',
		Math.min( 830, window.innerWidth - 100 ),
		300,
	);
	generateHeatmap( heatmapData, '#heatmap', videoPlayer );
	// generateMetricsOverTime( timeMetricsChartData, '#metrics-chart', videoPlayer );
	generatePostViewsChart( postsData, '#post-views-count-chart' );

	const renderChange = ( changeValue ) => {
		if ( ! Number.isFinite( changeValue ) ) {
			return '';
		}
		const rounded = Math.abs( changeValue ).toFixed( 2 );
		const prefix = changeValue >= 0 ? '+' : '-';
		return `${ prefix }${ rounded }%`;
	};

	function formatWatchTime( seconds ) {
		const hrs = Math.floor( seconds / 3600 );
		const mins = Math.floor( ( seconds % 3600 ) / 60 );
		const secs = Math.floor( seconds % 60 );

		const parts = [];
		if ( hrs > 0 ) {
			parts.push( `${ hrs }h` );
		}
		if ( mins > 0 ) {
			parts.push( `${ mins }m` );
		}
		if ( secs > 0 || parts.length === 0 ) {
			parts.push( `${ secs }s` );
		}

		return parts.join( ' ' );
	}

	if ( document.getElementById( 'plays-change' ) ) {
		document.getElementById( 'plays-change' ).innerHTML = renderChange( viewsChange );
		document
			.getElementById( 'plays-change' )
			.classList.add( viewsChange >= 0 ? 'change-rise' : 'change-drop' );
	}
	if ( document.getElementById( 'watch-time-change' ) ) {
		document.getElementById( 'watch-time-change' ).innerHTML = renderChange( watchTimeChange );
		document
			.getElementById( 'watch-time-change' )
			.classList.add( watchTimeChange >= 0 ? 'change-rise' : 'change-drop' );
	}
	if ( document.getElementById( 'play-rate-change' ) ) {
		document.getElementById( 'play-rate-change' ).innerHTML = renderChange( playRateChange );
		document
			.getElementById( 'play-rate-change' )
			.classList.add( playRateChange >= 0 ? 'change-rise' : 'change-drop' );
	}
	if ( document.getElementById( 'engagement-rate-change' ) ) {
		document.getElementById( 'engagement-rate-change' ).innerHTML = renderChange( avgEngagementChange );
		document
			.getElementById( 'engagement-rate-change' )
			.classList.add( avgEngagementChange >= 0 ? 'change-rise' : 'change-drop' );
	}

	if ( countryViews ) {
		generateCountryHeatmap( countryViews, '#map-container', '#table-container' );
	}

	const analyticsContainer = document.getElementById( 'video-analytics-container' );
	if ( analyticsContainer ) {
		analyticsContainer.classList.remove( 'hidden' );
	}

	const analyticsContent = document.getElementById( 'analytics-content' );
	if ( analyticsContent ) {
		analyticsContent.classList.remove( 'hidden' );
	}

	// Hide the loading animation
	const loadingElement = document.getElementById( 'loading-analytics-animation' );
	if ( loadingElement ) {
		loadingElement.style.display = 'none';
	}
}

document.addEventListener( 'DOMContentLoaded', () => {
	const videoCheckInterval = setInterval( () => {
		const videoElement = document.getElementById( 'analytics-video' );
		const videoId = videoElement?.dataset.id;
		const analyticsDataFetched = window.analyticsDataFetched;
		const processedAnalyticsHistory = window.processedAnalyticsHistory;

		if ( videoId && analyticsDataFetched && processedAnalyticsHistory ) {
			clearInterval( videoCheckInterval );
			main();
		}
	}, 500 );
} );
