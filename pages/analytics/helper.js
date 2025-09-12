/* global d3 */
/**
 * Internal dependencies
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

export async function fetchAnalyticsData( videoId, siteUrl ) {
	try {
		const params = new URLSearchParams( {
			video_id: videoId,
			site_url: siteUrl,
		} );

		const response = await fetch(
			// url,
			`/wp-json/godam/v1/analytics/fetch?${ params.toString() }`,
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

export function singleMetricsChart(
	parsedData,
	selector,
	selectedMetric,
	selectedDays,
	changeTrend,
) {
	// Set the dimensions and margins of the graph - smaller to match card design
	const margin = { top: 10, right: 10, bottom: 0, left: 0 },
		width = 170 - margin.left - margin.right,
		height = 40 - margin.top - margin.bottom;

	// Define metric options to display proper labels and units with color
	const metricsOptions = [
		{
			value: 'engagement_rate',
			label: __( 'Engagement Rate', 'godam' ),
			unit: '%',
			color: changeTrend >= 0 ? '#4caf50' : '#e05252',
		},
		{
			value: 'play_rate',
			label: __( 'Play Rate', 'godam' ),
			unit: '%',
			color: changeTrend >= 0 ? '#4caf50' : '#e05252',
		},
		{
			value: 'watch_time',
			label: __( 'Watch Time', 'godam' ),
			unit: 's',
			color: changeTrend >= 0 ? '#4caf50' : '#e05252',
		},
		{
			value: 'plays',
			label: __( 'Plays', 'godam' ),
			unit: '',
			color: changeTrend >= 0 ? '#4caf50' : '#e05252',
		},
		{
			value: 'total_videos',
			label: __( 'Total Videos', 'godam' ),
			unit: '',
			color: changeTrend >= 0 ? '#4caf50' : '#e05252',
		},
	];

	// Ensure the container exists - add # to the selector if it doesn't have one
	const selectorWithHash = selector.startsWith( '#' ) ? selector : `#${ selector }`;
	const container = d3.select( selectorWithHash );

	if ( container.empty() ) {
		return;
	}

	// Remove any existing SVG to prevent duplication
	container.select( 'svg' ).remove();

	// Create an SVG element
	const svg = container
		.append( 'svg' )
		.attr(
			'viewBox',
			`0 0 ${ width + margin.left + margin.right } ${ height + margin.top + margin.bottom }`,
		)
		.attr( 'preserveAspectRatio', 'xMidYMid meet' )
		.style( 'width', '100%' )
		.style( 'height', 'auto' );

	// Create main chart group
	const chartGroup = svg
		.append( 'g' )
		.attr( 'transform', `translate(${ margin.left },${ margin.top })` );

	// Ensure `parsedData` is properly formatted
	const parseDate = d3.timeParse( '%Y-%m-%d' );

	// Function to filter data based on selected date range
	function filterData( days ) {
		const today = new Date();
		const cutoffDate = new Date( today );
		cutoffDate.setDate( today.getDate() - days );

		return parsedData.filter( ( d ) => new Date( d.date ) >= cutoffDate );
	}

	const filteredData = filterData( selectedDays ).map( ( d ) => ( {
		date: parseDate( d.date ),
		engagement_rate: +d.engagement_rate,
		play_rate: +d.play_rate || 0,
		watch_time: +d.watch_time || 0,
		plays: +d.plays || 0,
		total_videos: +d.total_videos || 0,
	} ) ).sort( ( a, b ) => a.date - b.date );

	// Remove any existing chart elements before redrawing
	chartGroup.selectAll( '*' ).remove();

	// Validate data before rendering
	if ( filteredData.length === 0 ) {
		chartGroup
			.append( 'text' )
			.attr( 'x', width / 2 )
			.attr( 'y', height / 2 )
			.attr( 'text-anchor', 'middle' )
			.text( __( 'No data available.', 'godam' ) );
		return;
	}

	// Create X axis (Time)
	const x = d3
		.scaleTime()
		.domain( d3.extent( filteredData, ( d ) => d.date ) )
		.range( [ 0, width ] );

	const y = d3
		.scaleLinear()
		.domain( [ 0, d3.max( filteredData, ( d ) => d[ selectedMetric ] ) * 1.1 ] )
		.range( [ height, 0 ] );

	const metricOption = metricsOptions.find(
		( option ) => option.value === selectedMetric,
	);

	// Generate line function
	const line = d3
		.line()
		.x( ( d ) => x( d.date ) )
		.y( ( d ) => y( d[ selectedMetric ] ) )
		.curve( d3.curveMonotoneX ); // Add curve for smoother line

	// Add the line with metric-specific color
	chartGroup
		.append( 'path' )
		.datum( filteredData )
		.attr( 'fill', 'none' )
		.attr( 'stroke', metricOption.color )
		.attr( 'stroke-linecap', 'round' )
		.attr( 'stroke-width', 1.5 )
		.attr( 'd', line );

	// Add subtle area fill below the line
	const area = d3
		.area()
		.x( ( d ) => x( d.date ) )
		.y0( height )
		.y1( ( d ) => y( d[ selectedMetric ] ) )
		.curve( d3.curveMonotoneX );

	chartGroup
		.append( 'path' )
		.datum( filteredData )
		.attr( 'fill', changeTrend >= 0 ? '#4caf50' : '#e05252' )
		.attr( 'fill-opacity', 0.1 )
		.attr( 'd', area );

	// Tooltip container
	const tooltip = container
		.append( 'div' )
		.attr( 'class', 'mini-chart-tooltip' )
		.style( 'position', 'absolute' )
		.style( 'background', '#fff' )
		.style( 'padding', '4px 8px' )
		.style( 'border', '1px solid #ccc' )
		.style( 'border-radius', '4px' )
		.style( 'font-size', '12px' )
		.style( 'pointer-events', 'none' )
		.style( 'opacity', 0 );

	// Add an invisible overlay to capture mouse events
	chartGroup
		.append( 'rect' )
		.attr( 'width', width )
		.attr( 'height', height )
		.attr( 'fill', 'transparent' )
		.on( 'mousemove', function( event ) {
			const [ xPos ] = d3.pointer( event );
			const xDate = x.invert( xPos );

			// Find closest point
			const bisectDate = d3.bisector( ( d ) => d.date ).left;
			const index = bisectDate( filteredData, xDate, 1 );
			const d0 = filteredData[ index - 1 ];
			const d1 = filteredData[ index ];
			let d;
			if ( ! d0 ) {
				d = d1;
			} else if ( ! d1 ) {
				d = d0;
			} else {
				d = xDate - d0.date > d1.date - xDate ? d1 : d0;
			}

			// Format value
			const val = d[ selectedMetric ];
			const formattedVal =
        selectedMetric === 'watch_time' ? `${ val.toFixed( 2 ) }s` : `${ val.toFixed( 2 ) }${ metricOption.unit }`;

			// Position tooltip
			const tooltipX = x( d.date );
			const tooltipY = y( d[ selectedMetric ] ) + margin.top;

			tooltip
				.html(
					`<strong>${ d3.timeFormat( '%b %d' )( d.date ) }</strong><br>${ formattedVal }`,
				)
				.style( 'left', `${ tooltipX - 10 }px` )
				.style( 'top', `${ tooltipY }px` )
				.style( 'opacity', 1 );
		} )
		.on( 'mouseleave', () => {
			tooltip.style( 'opacity', 0 );
		} );
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
