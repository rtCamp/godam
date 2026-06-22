/* global d3, godamPluginData */
/**
 * Internal dependencies
 */
import { d3CountryToIso } from './countryFlagMapping';
import ViewIcon from '../../assets/src/images/views.svg';
import DurationIcon from '../../assets/src/images/duration.svg';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Resolve the active WP admin accent colour. GoDAM 2.0 follows the admin
 * colour scheme on the analytics surface, so data-viz that used the hardcoded
 * brand pink reads the live `--wp-admin-theme-color` instead.
 *
 * @return {string} A colour string, falling back to the GoDAM pink.
 */
function getGodamAccent() {
	return (
		getComputedStyle( document.body )
			.getPropertyValue( '--wp-admin-theme-color' )
			.trim() || '#ab3a6c'
	);
}

function formatTime( seconds ) {
	const minutes = Math.floor( seconds / 60 );
	const remainingSeconds = seconds % 60;
	return `${ minutes }:${ remainingSeconds.toString().padStart( 2, '0' ) }`;
}

export async function fetchAnalyticsData( videoId, siteUrl ) {
	try {
		const params = new URLSearchParams( {
			video_id: videoId,
			site_url: siteUrl,
		} );

		const restUrl = window.godamRestRoute?.url || '/wp-json/';
		const response = await fetch(
			`${ restUrl }godam/v1/analytics/fetch?${ params.toString() }`,
			{
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings.nonce,
				},
			},
		);

		const result = await response.json();

		if (
			result.status === 'error' &&
      result.message.includes( 'Invalid or unverified API key' )
		) {
			showAPIActivationMessage();
			return null;
		}

		if ( result.status !== 'success' ) {
			throw new Error( result.message );
		}

		return result.data;
	} catch ( error ) {
		return null;
	}
}

function showAPIActivationMessage() {
	// Remove loading animation
	const loadingElement = document.getElementById( 'loading-analytics-animation' );
	if ( loadingElement ) {
		loadingElement.style.display = 'none';
	}

	// Show analytics container
	const analyticsContainer = document.getElementById(
		'video-analytics-container',
	);
	if ( analyticsContainer ) {
		analyticsContainer.classList.remove( 'hidden' );
		analyticsContainer.classList.add( 'blurred' ); // Apply blur effect
	}

	// Add a message overlay
	const licenseOverlay = document.getElementById( 'license-overlay' );
	if ( licenseOverlay ) {
		licenseOverlay.classList.remove( 'hidden' );
	}
}

export function calculateEngagementRate( plays, videoLength, playTime ) {
	const engagementRate =
    plays && videoLength ? ( playTime / ( plays * videoLength ) ) * 100 : 0;
	return engagementRate.toFixed( 2 );
}

export function calculatePlayRate( pageLoad, plays ) {
	const playRate = pageLoad ? ( plays / pageLoad ) * 100 : 0;
	return playRate.toFixed( 2 );
}

export function generateCountryHeatmap(
	countryData,
	mapSelector,
	tableSelector,
) {
	// Convert object to array for table sorting
	const countryDataArray = Object.entries( countryData || {} )
		.map( ( [ country, views ] ) => ( {
			country,
			views,
		} ) )
		.sort( ( a, b ) => b.views - a.views );

	// Clear the table container on every render (the map is rebuilt below) so a
	// refetch replaces rows instead of appending a second <table>.
	d3.select( tableSelector ).html( '' );

	// ===== MAP VISUALIZATION =====
	const width = 800,
		height = 500;

	// Create a container div inside mapSelector
	const container = d3
		.select( mapSelector )
		.style( 'position', 'relative' )
		.style( 'width', '100%' )
		.style( 'height', 'auto' );

	// Idempotent: clear any previous render before redrawing.
	container.selectAll( '*' ).remove();

	container
		.append( 'h2' )
		.text( __( 'Views by Location', 'godam' ) )
		.style( 'font-size', '16px' )
		.style( 'font-weight', '700' )
		.style( 'text-align', 'left' )
		.style( 'margin-bottom', '16px' );

	// Empty state — no geography recorded yet (e.g. a brand-new site).
	if ( countryDataArray.length === 0 ) {
		d3.select( tableSelector ).html( '' );
		container
			.append( 'p' )
			.text( __( 'Views by location will show up here', 'godam' ) )
			.style( 'color', '#757575' )
			.style( 'font-size', '13px' )
			.style( 'text-align', 'center' )
			.style( 'padding', '28px 8px' )
			.style( 'margin', '0' );
		return;
	}

	// Create the SVG for the map
	const svg = container
		.append( 'svg' )
		.attr( 'viewBox', `0 0 ${ width } ${ height }` )
		.attr( 'preserveAspectRatio', 'xMidYMid meet' )
		.style( 'width', '100%' )
		.style( 'height', 'auto' );

	// Group for zoom + pan
	const g = svg.append( 'g' );

	// Define zoom behavior
	const zoom = d3
		.zoom()
		.scaleExtent( [ 1, 8 ] )
		.on( 'zoom', ( event ) => {
			g.attr( 'transform', event.transform );
		} );

	svg.call( zoom );

	const initialTransform = d3.zoomIdentity; // Identity transform for reset

	// Add Zoom Buttons
	const zoomControls = container
		.append( 'div' )
		.attr( 'class', 'zoom-controls' )
		.style( 'position', 'absolute' )
		.style( 'top', '20px' )
		.style( 'right', '0px' )
		.style( 'display', 'flex' )
		.style( 'flex-direction', 'column' )
		.style( 'gap', '10px' )
		.style( 'z-index', '10' );

	zoomControls
		.append( 'button' )
		.text( '+' )
		.style( 'width', '20px' )
		.style( 'height', '20px' )
		.style( 'font-size', '14px' )
		.style( 'cursor', 'pointer' )
		.style( 'border-radius', '5px' )
		.style( 'background', '#52525B' )
		.style( 'color', '#fff' )
		.on( 'click', () => {
			svg.transition().call( zoom.scaleBy, 1.3 );
		} );

	zoomControls
		.append( 'button' )
		.text( '–' )
		.style( 'width', '20px' )
		.style( 'height', '20px' )
		.style( 'font-size', '14px' )
		.style( 'cursor', 'pointer' )
		.style( 'border-radius', '5px' )
		.style( 'background', '#52525B' )
		.style( 'color', '#fff' )
		.on( 'click', () => {
			svg.transition().call( zoom.scaleBy, 1 / 1.3 );
		} );

	zoomControls
		.append( 'button' )
		.text( '⟳' )
		.style( 'width', '20px' )
		.style( 'height', '20px' )
		.style( 'font-size', '14px' )
		.style( 'cursor', 'pointer' )
		.style( 'border-radius', '5px' )
		.style( 'background', '#52525B' )
		.style( 'color', '#fff' )
		.on( 'click', () => {
			svg.transition().duration( 500 ).call( zoom.transform, initialTransform );
		} );

	// Set up tooltip
	const tooltip = container
		.append( 'div' )
		.attr( 'class', 'map-tooltip' )
		.style( 'position', 'absolute' )
		.style( 'background', 'rgba(0, 0, 0, 0.8)' )
		.style( 'color', '#fff' )
		.style( 'padding', '5px 10px' )
		.style( 'border-radius', '5px' )
		.style( 'display', 'none' )
		.style( 'font-size', '14px' )
		.style( 'pointer-events', 'none' )
		.style( 'z-index', '100' );

	const maxViews = d3.max( countryDataArray, ( d ) => d.views );
	const totalViews = d3.sum( countryDataArray, ( d ) => d.views );

	// Load and render the map
	d3.json(
		'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',
	).then( ( worldData ) => {
		const colorScale = d3
			.scaleSequential()
			.domain( [ 0, maxViews ] )
			.interpolator( ( t ) => d3.interpolateRgb( '#ddd', getGodamAccent() )( t ) );

		const features = worldData.features.filter(
			( f ) => f.properties.name !== 'Antarctica',
		);

		const projection = d3.geoEquirectangular();

		projection.fitExtent(
			[
				[ 20, 20 ],
				[ width - 20, height - 20 ],
			],
			{ type: 'FeatureCollection', features },
		);

		const path = d3.geoPath().projection( projection );

		g.selectAll( 'path' )
			.data( features )
			.enter()
			.append( 'path' )
			.attr( 'd', path )
			.attr( 'fill', ( d ) => {
				const countryName = d.properties.name;
				return countryData[ countryName ]
					? colorScale( countryData[ countryName ] )
					: '#ddd';
			} )
			.attr( 'stroke', 'none' )
			.attr( 'stroke-width', 0 )
			.on( 'mouseover', function( event, d ) {
				const countryName = d.properties.name;
				const views = countryData[ countryName ];
				const [ x, y ] = d3.pointer( event, container.node() );

				if ( views ) {
					// Compute percentage of maxViews
					const pct = Math.round( ( views / totalViews ) * 100 );
					const radius = 20;
					const circumference = 2 * Math.PI * radius;
					const dash = ( circumference * pct ) / 100;

					// Build tooltip content with SVG circle
					tooltip
						.style( 'display', 'block' )
						.html(
							`
							<div style="text-align:center; font-family:Arial,sans-serif">
								<strong>${ countryName }</strong><br/>
								<svg width="50" height="50">
								<!-- background circle -->
								<circle cx="25" cy="25" r="${ radius }"
										fill="none" stroke="#eee" stroke-width="4"/>
								<!-- progress arc -->
								<circle cx="25" cy="25" r="${ radius }"
										fill="none" stroke="${ getGodamAccent() }" stroke-width="4"
										stroke-dasharray="${ dash } ${ circumference - dash }"
										transform="rotate(-90 25 25)"/>
								 <text
									x="25" y="30"
									text-anchor="middle"
									font-size="12"
									fill="#fff"
									font-family="Arial, sans-serif"
									>${ pct }%</text>
								</svg>
								<div style="margin-top:4px; font-size:12px; color:#fff">
								${ views } plays
								</div>
							</div>
							`,
						)
						.style( 'left', x + 10 + 'px' )
						.style( 'top', y + 10 + 'px' );

					// Darken fill on hover
					const orig = colorScale( views );
					const darker = d3.color( orig ).darker( 1 ).formatHex();
					d3.select( this ).attr( 'fill', darker );
				}
			} )
			.on( 'mousemove', ( event ) => {
				const [ x, y ] = d3.pointer( event, container.node() );
				tooltip.style( 'left', x + 10 + 'px' ).style( 'top', y + 10 + 'px' );
			} )
			.on( 'mouseout', function( event, d ) {
				tooltip.style( 'display', 'none' );
				const countryName = d.properties.name;
				const orig = countryData[ countryName ]
					? colorScale( countryData[ countryName ] )
					: '#ddd';
				d3.select( this )
					.attr( 'stroke', 'none' )
					.attr( 'stroke-width', 0 )
					.attr( 'fill', orig );
			} );
	} );

	// ===== TABLE VISUALIZATION =====
	const tableDiv = d3.select( tableSelector );

	const table = tableDiv
		.append( 'table' )
		.style( 'width', '100%' )
		.style( 'border-collapse', 'collapse' )
		.style( 'font-family', 'Arial, sans-serif' );

	const tbody = table.append( 'tbody' );

	tbody
		.selectAll( 'tr' )
		.data( countryDataArray )
		.enter()
		.each( function( d ) {
			const mainRow = d3.select( this ).append( 'tr' );

			const countryCell = mainRow
				.append( 'td' )
				.style( 'text-align', 'left' )
				.style( 'font-weight', '500' )
				.style( 'vertical-align', 'middle' );

			const flagWrapper = countryCell
				.append( 'div' )
				.style( 'display', 'flex' )
				.style( 'align-items', 'center' )
				.style( 'gap', '8px' );

			const flagCode = d3CountryToIso[ d.country ];

			if ( flagCode ) {
				flagWrapper
					.append( 'img' )
					.attr( 'src', `${ godamPluginData.flagBasePath }/${ flagCode }.svg` )
					.attr( 'alt', `${ d.country } flag` )
					.style( 'width', '18px' )
					.style( 'height', '18px' )
					.style( 'border-radius', '50%' )
					.style( 'object-fit', 'cover' )
					.style( 'flex-shrink', '0' );
			}

			flagWrapper.append( 'span' ).text( d.country );

			mainRow
				.append( 'td' )
				.text( `${ Math.round( ( d.views / totalViews ) * 100 ) }%` )
				.style( 'text-align', 'right' )
				.style( 'font-weight', '500' )
				.style( 'padding', '10px' );

			const barRow = d3.select( this ).append( 'tr' );

			const progressContainer = barRow
				.append( 'td' )
				.attr( 'colspan', 2 )
				.append( 'div' )
				.style( 'height', '6px' )
				.style( 'width', '100%' )
				.style( 'background-color', '#E4E4E7' )
				.style( 'border-radius', '8px' )
				.style( 'overflow', 'hidden' );

			progressContainer
				.append( 'div' )
				.style( 'height', '100%' )
				.style( 'width', `${ ( d.views / totalViews ) * 100 }%` )
				.style( 'background-color', 'var(--wp-admin-theme-color)' )
				.style( 'border-radius', '8px' );
		} );
}

export function generateLineChart( data, selector, videoPlayer, tooltipSelector, chartWidth, chartHeight ) {
	const margin = { top: 0, right: 0, bottom: 0, left: 0 };
	const width = chartWidth - margin.left - margin.right;
	const height = chartHeight - margin.top - margin.bottom;

	const svg = d3
		.select( selector )
		.attr( 'viewBox', `0 0 ${ width + margin.left + margin.right } ${ height + margin.top + margin.bottom }` )
		// Allow SVG to stretch to fill container without maintaining aspect ratio - required for bottom-anchored responsive video overlay
		.attr( 'preserveAspectRatio', 'none' )
		.append( 'g' )
		.attr( 'transform', `translate(${ margin.left },${ margin.top })` );

	const xScale = d3
		.scaleLinear()
		.domain( [ 0, data.length - 1 ] )
		.range( [ 0, width ] );

	const yScale = d3
		.scaleLinear()
		.domain( [ d3.min( data ) - 10, d3.max( data ) + 10 ] )
		.range( [ height, 0 ] );

	const line = d3
		.line()
		.x( ( d, i ) => xScale( i ) )
		.y( ( d ) => yScale( d ) );

	const area = d3
		.area()
		.x( ( d, i ) => xScale( i ) )
		.y0( height )
		.y1( ( d ) => yScale( d ) );

	svg.append( 'path' ).datum( data ).attr( 'class', 'line' ).attr( 'd', line );

	const hoverLine = svg
		.append( 'line' )
		.attr( 'class', 'hover-line' )
		.attr( 'y1', 0 )
		.attr( 'y2', height )
		.style( 'opacity', 0 );

	const focus = svg
		.append( 'circle' )
		.attr( 'class', 'focus-circle' )
		.style( 'opacity', 0 );

	const filledArea = svg
		.append( 'path' )
		.datum( data )
		.attr( 'class', 'area' )
		.style( 'opacity', 0 );

	const tooltip = d3.select( tooltipSelector );

	svg
		.append( 'rect' )
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

				if ( isNaN( videoTime ) || ! isFinite( videoTime ) ) {
					return;
				}

				focus
					.style( 'opacity', 1 )
					.attr( 'cx', xScale( index ) )
					.attr( 'cy', yScale( value ) );

				hoverLine
					.style( 'opacity', 1 )
					.attr( 'x1', xScale( index ) )
					.attr( 'x2', xScale( index ) );

				const svgElement = d3.select( selector ).node();
				const containerRect = svgElement.parentElement.getBoundingClientRect();
				const scaleX = containerRect.width / width;
				const scaledX = xScale( index ) * scaleX;

				tooltip
					.style( 'opacity', 1 )
					.style( 'left', `${ scaledX }px` )
					.style( 'top', 0 )
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

/**
 * Ensure all 7 days are represented in a data array, filling missing dates with zeros.
 *
 * Produces an array of exactly 7 entries ordered oldest → newest, where any date
 * absent from `dataArray` is replaced with a zero-value sentinel object.
 *
 * @param {Array} dataArray Array of data objects, each with at minimum a `date` (YYYY-MM-DD) field.
 * @return {Array} Array of 7 objects spanning the last 7 days (including today).
 */
export function ensureAll7Days( dataArray ) {
	const now = new Date();
	const today = new Date( now.getFullYear(), now.getMonth(), now.getDate() );
	const last7Days = [];
	for ( let i = 6; i >= 0; i-- ) {
		const date = new Date( today );
		date.setDate( today.getDate() - i );
		const year = date.getFullYear();
		const month = String( date.getMonth() + 1 ).padStart( 2, '0' );
		const day = String( date.getDate() ).padStart( 2, '0' );
		last7Days.push( `${ year }-${ month }-${ day }` );
	}
	const dataMap = {};
	dataArray.forEach( ( d ) => {
		dataMap[ d.date ] = d;
	} );
	return last7Days.map( ( dateStr ) => dataMap[ dateStr ] || {
		date: dateStr,
		plays: 0,
		engagement_rate: 0,
		play_rate: 0,
		watch_time: 0,
		total_videos: 0,
	} );
}

/**
 * Calculate the percentage trend between the first and last values of a sorted data array.
 *
 * @param {Array}  sortedData Chronologically sorted data array (oldest first).
 * @param {string} key        The numeric property name to compare.
 * @return {number} Trend percentage (positive = growth, negative = decline).
 */
export function calculateTrendPercentage( sortedData, key ) {
	if ( sortedData.length < 2 ) {
		return 0;
	}
	const first = parseFloat( sortedData[ 0 ][ key ] );
	const last = parseFloat( sortedData[ sortedData.length - 1 ][ key ] );
	if ( isNaN( first ) || isNaN( last ) ) {
		return 0;
	}
	if ( first === 0 ) {
		// last > 0 ? 100 : last < 0 ? -100 : 0;
		if ( last > 0 ) {
			return 100;
		} else if ( last < 0 ) {
			return -100;
		}
		return 0;
	}
	return ( ( last - first ) / first ) * 100;
}

