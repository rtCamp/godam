/* global d3 */
/**
 * External dependencies
 */
import videojs from 'video.js';
/**
 * Internal dependencies
 */
import ViewIcon from '../../assets/src/images/views.png';
import DurationIcon from '../../assets/src/images/duration.png';
import {
	generateCountryHeatmap,
} from '../../pages/analytics/helper';

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

	// const colorScale = d3.scaleLinear()
	// 	.domain( [ 0, 100, 200, 400, 700, 1100, 1600, 3000, 4000, 5000 ] ) // Exact breakpoints for sequential scaling
	// 	.range( [
	// 		'#eab308', // Lime with low opacity
	// 		'#f59e0b', // Yellow with medium opacity
	// 		'#f97316', // Orange with higher opacity
	// 		'#dc2626', //  Red with full opacity
	// 		'#991b1b', // Dark red with full opacity
	// 		'#450a0a', // Bold dark red with full opacity
	// 		'#4c1d95',
	// 		'#4c1d95',
	// 		'#3730a3',
	// 	] );

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
								<img src=${ ViewIcon } alt="View" height=${ 16 } width=${ 16 }/>
								${ value }
							</div>
							<div class="flex gap-2 items-center text-black">
								<img src=${ DurationIcon } alt="Duration" height=${ 15 } width=${ 15 }/>
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

function generateLineChart( data, selector, videoPlayer ) {
	const margin = { top: 0, right: 0, bottom: 0, left: 0 };
	const width = 830 - margin.left - margin.right;
	const height = 300 - margin.top - margin.bottom;

	const svg = d3.select( selector )
		.attr( 'width', width + margin.left + margin.right )
		.attr( 'height', height + margin.top + margin.bottom )
		.append( 'g' )
		.attr( 'transform', `translate(${ margin.left },${ margin.top })` );

	const xScale = d3.scaleLinear()
		.domain( [ 0, data.length - 1 ] )
		.range( [ 0, width ] );

	const yScale = d3.scaleLinear()
		.domain( [ d3.min( data ) - 10, d3.max( data ) + 10 ] )
		.range( [ height, 0 ] );

	const line = d3.line()
		.x( ( d, i ) => xScale( i ) )
		.y( ( d ) => yScale( d ) );

	const area = d3.area()
		.x( ( d, i ) => xScale( i ) )
		.y0( height )
		.y1( ( d ) => yScale( d ) );

	svg.append( 'path' )
		.datum( data )
		.attr( 'class', 'line' )
		.attr( 'd', line );

	const hoverLine = svg.append( 'line' )
		.attr( 'class', 'hover-line' )
		.attr( 'y1', 0 )
		.attr( 'y2', height )
		.style( 'opacity', 0 );

	const focus = svg.append( 'circle' )
		.attr( 'class', 'focus-circle' )
		.style( 'opacity', 0 );

	const filledArea = svg.append( 'path' )
		.datum( data )
		.attr( 'class', 'area' )
		.style( 'opacity', 0 );

	const tooltip = d3.select( '.line-chart-tooltip' );

	svg.append( 'rect' )
		.attr( 'width', width )
		.attr( 'height', height )
		.style( 'fill', 'none' )
		.style( 'pointer-events', 'all' )
		.on( 'mousemove', function( event ) {
			const [ mouseX ] = d3.pointer( event );
			const xValue = xScale.invert( mouseX );
			const index = Math.round( xValue );

			if ( index >= 0 && index < data.length ) {
				const value = data[ index ];
				const videoDuration = videoPlayer.duration();
				const videoTime = ( index / data.length ) * videoDuration;

				focus
					.style( 'opacity', 1 )
					.attr( 'cx', xScale( index ) )
					.attr( 'cy', yScale( value ) );

				hoverLine
					.style( 'opacity', 1 )
					.attr( 'x1', xScale( index ) )
					.attr( 'x2', xScale( index ) );

				tooltip
					.style( 'opacity', 1 )
					.style( 'left', `${ xScale( index ) - 30 }px` )
					.style( 'top', 0 )
					.html(
						`<div class="heatmap-tooltip-html">
							<div class="flex gap-2 items-center text-black">
								<img src=${ ViewIcon } alt="View" height=${ 16 } width=${ 16 }/>
								${ value }
							</div>
							<div class="flex gap-2 items-center text-black">
								<img src=${ DurationIcon } alt="Duration" height=${ 15 } width=${ 15 }/>
								${ formatTime( index ) }
							</div>
						</div>`,
					);

				videoPlayer.currentTime( videoTime );

				// Update the filled area
				filledArea
					.style( 'opacity', 1 )
					.attr( 'd', area( data.slice( 0, index + 1 ) ) );
			}
		} )
		.on( 'mouseout', () => {
			focus.style( 'opacity', 0 );
			hoverLine.style( 'opacity', 0 );
			tooltip.style( 'opacity', 0 );
			filledArea.style( 'opacity', 0 );
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

			const percent = ( ( d.data.views / totalViews ) * 100 ).toFixed( 1 );

			tooltip.transition().duration( 200 ).style( 'opacity', 0.9 );
			tooltip
				.html(
					`<strong>${ d.data.post === '' ? 'Untitled' : d.data.post }</strong><br>
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
			.html( `<a href="${ d.url }" target="_blank" class="pie-chart-legend">${ d.post === '' ? 'Untitled' : d.post }</a>` );
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
	document.getElementById( 'play-rate' ).innerText = `${ playRate.toFixed( 2 ) }%`;
	document.getElementById( 'plays' ).innerText = totalPlays;
	document.getElementById( 'engagement-rate' ).innerText = `${ engagementRate.toFixed( 2 ) }%`;
	document.getElementById( 'watch-time' ).innerText = `${ playTime.toFixed( 2 ) }s`;

	// Convert heatmap string into an array
	const heatmapData = JSON.parse( allTimeHeatmap );

	const videoPlayer = videojs( 'analytics-video', {
		fluid: true,
		mute: true,
		controls: false,
	} );

	// const timeMetricsChartData = ( window.processedAnalyticsHistory || [] ).map( ( entry ) => {
	// 	const {
	// 		date,
	// 		page_load: dailyPageLoad,
	// 		play_time: dailyPlayTime,
	// 		video_length: dailyVideoLength,
	// 		plays: dailyPlays,
	// 	} = entry;

	// 	const dailyEngagementRate =
	// 		dailyPlays && dailyVideoLength ? ( dailyPlayTime / ( dailyPlays * dailyVideoLength ) ) * 100 : 0;

	// 	const dailyPlayRate =
	// 		dailyPageLoad ? ( dailyPlays / dailyPageLoad ) * 100 : 0;

	// 	return {
	// 		date,
	// 		engagement_rate: +dailyEngagementRate.toFixed( 2 ),
	// 		play_rate: +dailyPlayRate.toFixed( 2 ),
	// 		watch_time: +dailyPlayTime.toFixed( 2 ),
	// 	};
	// } );

	const postsData = ( window.analyticsDataFetched?.post_details || [] ).map( ( post ) => {
		const views = post.views || 0;
		return { post: post.title, views, url: post.url, id: post.id };
	} );

	// Generate visualizations
	generateLineChart( heatmapData, '#line-chart', videoPlayer );
	generateHeatmap( heatmapData, '#heatmap', videoPlayer );
	// generateMetricsOverTime( timeMetricsChartData, '#metrics-chart', videoPlayer );
	generatePostViewsChart( postsData, '#post-views-count-chart' );

	const renderChange = ( changeValue ) => {
		const rounded = Math.abs( changeValue ).toFixed( 2 );
		const prefix = changeValue >= 0 ? '+' : '-';
		return `${ prefix }${ rounded }%`;
	};

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
