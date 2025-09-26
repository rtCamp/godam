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

/**
 * Renders a grouped bar chart for layer analytics using D3.js.
 *
 * @param {Array<Object>} data        - The analytics data array where each object contains date and interaction metrics.
 * @param {string}        containerId - The DOM selector (ID or class) of the container to render the chart in.
 * @param {string}        duration    - The selected duration for data aggregation ('7d', '30d', '60d', '1y').
 * @param {Object}        labelMap    - An object mapping metric keys to their display labels.
 * @param {string}        layerType   - The type of layer being analyzed ('form', 'hotspot', 'cta').
 *
 * @return {void}
 */
export function layerAnalyticsBarChart(
	data,
	containerId,
	duration,
	labelMap,
	layerType,
) {
	// Set dimensions and margins
	const margin = { top: 40, right: 30, bottom: 80, left: 60 };
	const width = 500;
	const height = 350 - margin.top - margin.bottom;
	const metricsByLayerType = {
		form: [ 'submitted', 'skipped' ],
		hotspot: [ 'clicked', 'hovered' ],
		cta: [ 'clicked', 'skipped' ],
	};

	const subgroups = metricsByLayerType[ layerType ] || [];

	// REMOVE previous chart
	d3.select( containerId ).select( 'svg' ).remove();

	// SVG SETUP
	const svg = d3
		.select( containerId )
		.append( 'svg' )
		.attr( 'width', width + margin.left + margin.right )
		.attr( 'height', height + margin.top + margin.bottom )
		.append( 'g' )
		.attr( 'transform', `translate(${ margin.left },${ margin.top })` );

	// If yearly, aggregate by month
	let chartData = data;

	if ( duration === '1y' ) {
		const monthMap = d3.rollup(
			data,
			( v ) => {
				const agg = {};
				subgroups.forEach( ( key ) => {
					agg[ key ] = d3.sum( v, ( d ) => d[ key ] || 0 );
				} );
				return agg;
			},
			( d ) => d.date.slice( 0, 7 ), // group by "YYYY-MM"
		);

		chartData = Array.from( monthMap, ( [ date, vals ] ) => ( {
			date,
			...vals,
		} ) );
	}

	// SCALE
	const x0 = d3
		.scaleBand()
		.domain( chartData.map( ( d ) => d.date ) ) // use aggregated data if 1y
		.range( [ 0, width ] )
		.padding( 0.2 );

	const x1 = d3
		.scaleBand()
		.domain( subgroups )
		.range( [ 0, x0.bandwidth() ] )
		.padding( 0.05 );

	const y = d3
		.scaleLinear()
		.domain( [
			0,
			d3.max( chartData, ( d ) => d3.max( subgroups, ( key ) => d[ key ] || 0 ) ) * 1.1,
		] ).range( [ height, 0 ] );

	const color = d3
		.scaleOrdinal()
		.domain( subgroups )
		.range( [ '#3775d1', '#62c2b3' ] );

	// Pick fewer ticks for long durations
	let tickValues = chartData.map( ( d ) => d.date );

	if ( duration === '30d' ) {
		tickValues = tickValues.filter( ( d, i ) => i % 5 === 0 );
	} else if ( duration === '60d' ) {
		tickValues = tickValues.filter( ( d, i ) => i % 10 === 0 );
	}

	// X AXIS
	svg
		.append( 'g' )
		.attr( 'transform', `translate(0,${ height })` )
		.call(
			d3
				.axisBottom( x0 )
				.tickValues( tickValues )
				.tickFormat( ( d ) => formatLabel( d, duration ) ),
		)
		.selectAll( 'text' )
		.attr( 'transform', 'rotate(0)' )
		.style( 'text-anchor', 'middle' );

	// Y AXIS
	svg.append( 'g' ).call( d3.axisLeft( y ) );

	// TOOLTIP DIV
	let tooltip = d3.select( '.bar-tooltip' );
	if ( tooltip.empty() ) {
		tooltip = d3.select( 'body' ).append( 'div' ).attr( 'class', 'bar-tooltip' );
	}

	/**
	 * Formats a given label into a human-readable date string
	 * based on the current duration and label format.
	 *
	 * - If `duration` is `'1y'`, expects labels in `YYYY-MM` format and returns a formatted string like `"Jan'25"`.
	 * - If the label matches `YYYY-MM-DD`, it returns a formatted date like `"05 Sep 2025"`.
	 * - Otherwise, the label is returned unchanged.
	 *
	 * @param {string} label - The label value to format (e.g., a date string).
	 * @return {string} The formatted label for display on charts.
	 */
	function formatLabel( label ) {
		if ( duration === '1y' ) {
			const dt = d3.timeParse( '%Y-%m' )( label );
			return d3.timeFormat( "%b'%y" )( dt ); // "Jan 2025"
		}
		if ( /^\d{4}-\d{2}-\d{2}$/.test( label ) ) {
			const dt = d3.timeParse( '%Y-%m-%d' )( label );
			return d3.timeFormat( '%d %b %Y' )( dt );
		}
		return label;
	}

	// BARS
	svg
		.append( 'g' )
		.selectAll( 'g' )
		.data( chartData )
		.join( 'g' )
		.attr( 'transform', ( d ) => `translate(${ x0( d.date ) },0)` )
		.selectAll( 'rect' )
		.data( ( d ) => subgroups.map( ( key ) => ( { key, value: d[ key ], parent: d } ) ) )
		.join( 'rect' )
		.attr( 'x', ( d ) => x1( d.key ) )
		.attr( 'y', ( d ) => y( d.value ) )
		.attr( 'width', x1.bandwidth() )
		.attr( 'height', ( d ) => height - y( d.value ) )
		.attr( 'fill', ( d ) => color( d.key ) )
		.on( 'mousemove', function( event, d ) {
			const parent = d.parent;
			const displayDate = formatLabel( parent.date );

			const metrics = [
				{ key: 'clicked', label: __( 'Clicks', 'godam' ), color: '#3775d1' },
				{ key: 'hovered', label: __( 'Hovers', 'godam' ), color: '#62c2b3' },
				{ key: 'submitted', label: __( 'Submissions', 'godam' ), color: '#3775d1' },
				{ key: 'skipped', label: __( 'Skips', 'godam' ), color: '#62c2b3' },
			];

			// Tooltip HTML with classes
			let html = `
				<div class="tooltip-header">${ displayDate }</div>
			`;

			metrics.forEach( ( metric ) => {
				if (
					parent[ metric.key ] === undefined ||
					! subgroups.includes( metric.key )
				) {
					return;
				}

				html += `
				<div class="tooltip-row">
					<div class="tooltip-label">
						<span class="tooltip-dot" style="background:${ metric.color };"></span>
						<span>${ metric.label }</span>
					</div>
					<div class="tooltip-value">${ parent[ metric.key ] }</div>
				</div>`;
			} );

			tooltip
				.html( html )
				.style( 'opacity', 1 )
				.style( 'left', `${ event.pageX + 18 }px` )
				.style( 'top', `${ event.pageY - 48 }px` );
		} )
		.on( 'mouseleave', function() {
			tooltip.style( 'opacity', 0 );
		} );

	// LEGEND AT THE BOTTOM, CENTERED
	const legend = svg
		.append( 'g' )
		.attr( 'class', 'legend' )
		.attr( 'transform', `translate(${ ( width / 2 ) - 90 }, ${ height + 40 })` );

	const legendItem = legend
		.selectAll( '.legend-item' )
		.data( subgroups )
		.enter()
		.append( 'g' )
		.attr( 'class', 'legend-item' )
		.attr( 'transform', ( d, i ) => `translate(${ i * 120 }, 0)` );

	// background box
	legendItem
		.append( 'rect' )
		.attr( 'class', 'legend-bg' )
		.attr( 'width', 105 )
		.attr( 'height', 22 )
		.attr( 'rx', 4 ) // rounded corners optional
		.attr( 'fill', '#F2F2F7' );

	// color square
	legendItem
		.append( 'rect' )
		.attr( 'x', 8 )
		.attr( 'y', 5 )
		.attr( 'width', 12 )
		.attr( 'height', 12 )
		.attr( 'fill', ( d ) => color( d ) );

	// label
	legendItem
		.append( 'text' )
		.attr( 'x', 28 )
		.attr( 'y', 15 ) // vertically aligned with rect
		.text( ( d ) => labelMap[ d ] || d )
		.style( 'font-size', '12px' );
}

export function generateCountryHeatmap(
	countryData,
	mapSelector,
	tableSelector,
) {
	// Convert object to array for table sorting
	const countryDataArray = Object.entries( countryData )
		.map( ( [ country, views ] ) => ( {
			country,
			views,
		} ) )
		.sort( ( a, b ) => b.views - a.views );

	// ===== MAP VISUALIZATION =====
	const width = 800,
		height = 500;

	// Create a container div inside mapSelector
	const container = d3
		.select( mapSelector )
		.style( 'position', 'relative' )
		.style( 'width', '100%' )
		.style( 'height', 'auto' );

	container
		.append( 'h2' )
		.text( 'Views by Location' )
		.style( 'font-size', '16px' )
		.style( 'font-weight', '700' )
		.style( 'text-align', 'left' )
		.style( 'margin-bottom', '16px' );

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
			.interpolator( ( t ) => d3.interpolateRgb( '#ddd', '#AB3A6C' )( t ) );

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
										fill="none" stroke="#AB3A6C" stroke-width="4"
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
				.style( 'background-color', '#AB3A6C' )
				.style( 'border-radius', '8px' );
		} );
}

export function generateLineChart( data, selector, videoPlayer, tooltipSelector, chartWidth, chartHeight ) {
	const margin = { top: 0, right: 0, bottom: 0, left: 0 };
	const width = chartWidth - margin.left - margin.right;
	const height = chartHeight - margin.top - margin.bottom;

	const svg = d3
		.select( selector )
		.attr( 'width', width + margin.left + margin.right )
		.attr( 'height', height + margin.top + margin.bottom )
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

				tooltip
					.style( 'opacity', 1 )
					.style( 'left', `${ xScale( index ) - 30 }px` )
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
