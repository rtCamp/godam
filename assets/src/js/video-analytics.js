/* global d3 */
/**
 * External dependencies
 */
import videojs from 'video.js';
/**
 * Internal dependencies
 */
import ViewIcon from '../../src/images/views.png';
import DurationIcon from '../../src/images/duration.png';
import {
	generateMetricsOverTime,
} from '../../../pages/analytics/helper';
import DownArrow from '../images/down-arrow.svg';
import TopArrow from '../images/up-arrow.svg';

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

function generateCountryHeatmap( countryData, mapSelector, tableSelector ) {
	// Convert object to array for table sorting
	const countryDataArray = Object.entries( countryData ).map( ( [ country, views ] ) => ( {
		country,
		views,
	} ) ).sort( ( a, b ) => b.views - a.views );

	// ===== MAP VISUALIZATION =====
	const width = 800,
		height = 500;

	// Create the SVG for the map
	const svg = d3.select( mapSelector )
		.append( 'svg' )
		.attr( 'width', width )
		.attr( 'height', height );

	// Set up map projection
	const projection = d3
		.geoNaturalEarth1()
		.scale( 150 )
		.translate( [ width / 2, height / 2 ] );

	const path = d3.geoPath().projection( projection );

	// Set up tooltip
	const tooltip = d3
		.select( 'body' )
		.append( 'div' )
		.attr( 'class', 'tooltip' )
		.style( 'position', 'absolute' )
		.style( 'background', 'rgba(0, 0, 0, 0.8)' )
		.style( 'color', '#fff' )
		.style( 'padding', '5px 10px' )
		.style( 'border-radius', '5px' )
		.style( 'display', 'none' )
		.style( 'font-size', '14px' )
		.style( 'pointer-events', 'none' )
		.style( 'z-index', '100' );

	// Load and render the map
	d3.json(
		'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',
	).then( ( worldData ) => {
		// Create color scale
		const colorScale = d3
			.scaleSequential( d3.interpolateBlues )
			.domain( [ 0, d3.max( Object.values( countryData ) ) ] );

		svg
			.selectAll( 'path' )
			.data( worldData.features )
			.enter()
			.append( 'path' )
			.attr( 'd', path )
			.attr( 'fill', ( d ) => {
				const countryName = d.properties.name;
				return countryData[ countryName ]
					? colorScale( countryData[ countryName ] )
					: '#ddd';
			} )
			.attr( 'stroke', '#333' )
			.attr( 'stroke-width', '1px' )
			.on( 'mouseover', function( event, d ) {
				const countryName = d.properties.name;
				if ( countryData[ countryName ] ) {
					tooltip
						.style( 'display', 'block' )
						.html(
							`<strong>${ countryName }:</strong> ${ countryData[ countryName ] }`,
						)
						.style( 'left', ( event.pageX + 10 ) + 'px' )
						.style( 'top', ( event.pageY + 10 ) + 'px' );

					d3.select( this )
						.style( 'stroke', '#000' )
						.style( 'stroke-width', '2px' );
				}
			} )
			.on( 'mousemove', ( event ) => {
				tooltip
					.style( 'left', ( event.pageX + 10 ) + 'px' )
					.style( 'top', ( event.pageY + 10 ) + 'px' );
			} )
			.on( 'mouseout', function() {
				tooltip.style( 'display', 'none' );
				d3.select( this )
					.style( 'stroke', '#333' )
					.style( 'stroke-width', '1px' );
			} );
	} );

	// ===== TABLE VISUALIZATION =====
	// Create table as a completely separate element
	const tableDiv = d3.select( tableSelector );

	// Create table element
	const table = tableDiv
		.append( 'table' )
		.style( 'width', '100%' )
		.style( 'border-collapse', 'collapse' )
		.style( 'font-family', 'Arial, sans-serif' );

	// Add header
	const thead = table.append( 'thead' );
	thead
		.append( 'tr' )
		.selectAll( 'th' )
		.data( [ 'COUNTRY', 'VIEWS' ] )
		.enter()
		.append( 'th' )
		.text( ( d ) => d )
		.style( 'text-align', ( d, i ) => ( i === 1 ? 'right' : 'left' ) )
		.style( 'border-bottom', '1px solid #ddd' )
		.style( 'color', '#777' )
		.style( 'font-size', '12px' )
		.style( 'font-weight', '500' );

	// Add table body
	const tbody = table.append( 'tbody' );

	const maxViews = d3.max( countryDataArray, ( d ) => d.views );
	tbody
		.selectAll( 'tr' )
		.data( countryDataArray )
		.enter()
		.each( function( d ) {
			// Append the main row (Country + Views)
			const mainRow = d3.select( this ).append( 'tr' );

			// Add country column
			mainRow
				.append( 'td' )
				.style( 'border-bottom', '1px solid #eee' )
				.style( 'text-align', 'left' )
				.style( 'font-weight', '900' )
				.text( d.country );

			// Add views column
			mainRow
				.append( 'td' )
				.text( d.views )
				.style( 'text-align', 'right' )
				.style( 'padding', '10px' )
				.style( 'border-bottom', '1px solid #eee' )
				.style( 'font-weight', '500' );

			// Append the second row (Progress Bar)
			const barRow = d3.select( this ).append( 'tr' );

			// Add progress bar spanning across both columns
			barRow
				.append( 'td' )
				.attr( 'colspan', 2 )
				.append( 'div' )
				.style( 'height', '4px' )
				.style( 'background-color', 'blue' )
				.style( 'opacity', '0.6' )
				.style( 'margin-top', '-5px' )
				.style( 'width', `${ ( d.views / maxViews ) * 100 }%` );
		} );
}

function generatePostViewsChart( postsData, selector ) {
	// Set dimensions
	const width = 500;
	const height = 400;
	const margin = 40;
	const radius = ( Math.min( width, height ) / 2 ) - margin;
	const innerRadius = radius * 0.6;

	// Calculate total views
	const totalViews = postsData.reduce( ( sum, entry ) => sum + entry.views, 0 );

	// Format numbers with commas
	const formatNumber = ( num ) => {
		return num.toString().replace( /\B(?=(\d{3})+(?!\d))/g, ',' );
	};

	// Color scale
	const color = d3
		.scaleOrdinal()
		.domain( postsData.map( ( d ) => d.post ) )
		.range( d3.schemeSet2 );

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
		.attr( 'fill', ( d ) => color( d.data.post ) )
		.attr( 'stroke', 'white' )
		.style( 'stroke-width', '2px' )
		.style( 'opacity', 0.8 )
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
					`<strong>${ d.data.post }</strong><br>
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
				.attr( 'd', arc )
				.style( 'opacity', 0.8 );

			tooltip.transition().duration( 500 ).style( 'opacity', 0 );
		} );

	// Add center text
	svg
		.append( 'text' )
		.attr( 'class', 'center-text' )
		.attr( 'dy', -10 )
		.text( 'Total Views' );

	svg
		.append( 'text' )
		.attr( 'class', 'center-text' )
		.attr( 'dy', 20 )
		.text( formatNumber( totalViews ) );

	// Create legend
	const legend = d3.select( '#legend' );

	postsData.forEach( ( d ) => {
		const legendItem = legend.append( 'div' ).attr( 'class', 'legend-item' );

		legendItem
			.append( 'div' )
			.attr( 'class', 'legend-color' )
			.style( 'background-color', color( d.post ) );

		legendItem.append( 'div' )
			.html( `<a href="${ d.url }" target="_blank" style="text-decoration: underline; color: inherit;">${ d.post }</a>: ${ formatNumber( d.views ) }` );
	} );

	// Add total views text
	d3.select( '#total-views' ).html(
		`Total Video Views: <strong>${ formatNumber( totalViews ) }</strong>`,
	);
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
	document.getElementById( 'total-plays' ).innerText = totalPlays;
	document.getElementById( 'engagement-rate' ).innerText = `${ engagementRate.toFixed( 2 ) }%`;
	document.getElementById( 'watch-time' ).innerText = `${ playTime.toFixed( 2 ) }s`;

	// Convert heatmap string into an array
	const heatmapData = JSON.parse( allTimeHeatmap );

	const videoPlayer = videojs( 'analytics-video', {
		fluid: true,
		mute: true,
		controls: false,
	} );

	const timeMetricsChartData = ( window.processedAnalyticsHistory || [] ).map( ( entry ) => {
		const {
			date,
			page_load: dailyPageLoad,
			play_time: dailyPlayTime,
			video_length: dailyVideoLength,
			plays: dailyPlays,
		} = entry;

		const dailyEngagementRate =
			dailyPlays && dailyVideoLength ? ( dailyPlayTime / ( dailyPlays * dailyVideoLength ) ) * 100 : 0;

		const dailyPlayRate =
			dailyPageLoad ? ( dailyPlays / dailyPageLoad ) * 100 : 0;

		return {
			date,
			engagement_rate: +dailyEngagementRate.toFixed( 2 ),
			play_rate: +dailyPlayRate.toFixed( 2 ),
			watch_time: +dailyPlayTime.toFixed( 2 ),
		};
	} );

	const postsData = ( window.analyticsDataFetched?.post_details || [] ).map( ( post ) => {
		const views = post.views || 0;
		return { post: post.title, views, url: post.url };
	} );

	// Generate visualizations
	generateLineChart( heatmapData, '#line-chart', videoPlayer );
	generateHeatmap( heatmapData, '#heatmap', videoPlayer );
	generateMetricsOverTime( timeMetricsChartData, '#metrics-chart', videoPlayer );
	generatePostViewsChart( postsData, '#post-views-count-chart' );

	const renderChange = ( changeValue ) => {
		const rounded = Math.abs( changeValue ).toFixed( 2 );
		const prefix = changeValue >= 0 ? '+' : '-';
		const arrow = changeValue >= 0 ? TopArrow : DownArrow;
		return `<img src="${ arrow }" alt="Arrow Icon" height="20" width="20"/>${ prefix }${ rounded }% this week`;
	};

	if ( document.getElementById( 'views-change' ) ) {
		document.getElementById( 'views-change' ).innerHTML = renderChange( viewsChange );
	}
	if ( document.getElementById( 'watch-time-change' ) ) {
		document.getElementById( 'watch-time-change' ).innerHTML = renderChange( watchTimeChange );
	}
	if ( document.getElementById( 'play-rate-change' ) ) {
		document.getElementById( 'play-rate-change' ).innerHTML = renderChange( playRateChange );
	}
	if ( document.getElementById( 'avg-engagement-change' ) ) {
		document.getElementById( 'avg-engagement-change' ).innerHTML = renderChange( avgEngagementChange );
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
