/* global d3 */
/**
 * Internal dependencies
 */
import {
	generateCountryHeatmap,
} from '../../pages/analytics/helper';
import { formatNumber, formatWatchTime } from '../utils/formatters';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

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
	const formatWithCommas = ( num ) => {
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
					Views: ${ formatWithCommas( d.data.views ) }<br>
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
	const labelGroups = svg.selectAll( 'g.slice-label-group' )
		.data( pie( postsData ) )
		.enter()
		.append( 'g' )
		.attr( 'class', 'slice-label-group' )
		.attr( 'transform', ( d ) => `translate(${ arc.centroid( d ) })` );

	// Add background for labels: small for < 1K, increased for >= 1K
	labelGroups.append( 'rect' )
		.attr( 'x', ( d ) => ( d.data.views >= 1000 ? -20 : -11.5 ) )
		.attr( 'y', -9 )
		.attr( 'width', ( d ) => ( d.data.views >= 1000 ? 40 : 23 ) )
		.attr( 'height', 18 )
		.attr( 'rx', 4 )
		.style( 'fill', 'rgba(0, 0, 0, 0.4)' )
		.style( 'pointer-events', 'none' );

	labelGroups.append( 'text' )
		.attr( 'class', 'slice-label' )
		.attr( 'text-anchor', 'middle' )
		.attr( 'dy', '0.35em' )
		.style( 'fill', '#fff' )
		.style( 'font-size', '11px' )
		.style( 'font-weight', 'bold' )
		.style( 'pointer-events', 'none' )
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
		country_views: countryViews,
	} = analyticsData;

	// Calculate analytics metrics
	const playRate = pageLoad ? ( plays / pageLoad ) * 100 : 0; // Convert to percentage
	const totalPlays = plays;
	const engagementRate = plays && videoLength ? ( playTime / ( plays * videoLength ) ) * 100 : 0;

	// Update the UI with computed analytics
	const playRateEl = document.getElementById( 'play-rate' );
	if ( playRateEl ) {
		playRateEl.innerText = `${ playRate.toFixed( 2 ) }%`;
		playRateEl.setAttribute( 'title', `${ playRate.toFixed( 2 ) }%` );
	}

	const playsEl = document.getElementById( 'plays' );
	if ( playsEl ) {
		const formattedPlays = formatNumber( totalPlays );
		playsEl.innerText = formattedPlays;
		playsEl.setAttribute( 'title', totalPlays.toLocaleString() );
	}

	const engagementEl = document.getElementById( 'engagement-rate' );
	if ( engagementEl ) {
		engagementEl.innerText = `${ engagementRate.toFixed( 2 ) }%`;
		engagementEl.setAttribute( 'title', `${ engagementRate.toFixed( 2 ) }%` );
	}

	const watchTimeEl = document.getElementById( 'watch-time' );
	if ( watchTimeEl ) {
		const formattedTime = formatWatchTime( playTime );
		watchTimeEl.innerText = formattedTime;
		watchTimeEl.setAttribute( 'title', `${ playTime.toFixed( 2 ) }s` );
	}

	// Convert heatmap string into an array

	const postsData = ( window.analyticsDataFetched?.post_details || [] ).map( ( post ) => {
		const views = post.views || 0;
		return { post: post.title, views, url: post.url, id: post.id };
	} );

	// Generate visualizations
	generatePostViewsChart( postsData, '#post-views-count-chart' );

	// Note: Change percentages are calculated and updated by SingleMetrics.js component

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
