/* global d3 */

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

export function generateMetricsOverTime( parsedData, selector ) {
	// Set the dimensions and margins of the graph
	const margin = { top: 80, right: 30, bottom: 30, left: 60 },
		width = 900 - margin.left - margin.right,
		height = 500 - margin.top - margin.bottom;

	// Ensure the container exists
	const container = d3.select( selector );
	if ( container.empty() ) {
		return;
	}

	// Remove any existing SVG to prevent duplication
	container.select( 'svg' ).remove();

	// Create an SVG element
	const svg = container
		.append( 'svg' )
		.attr( 'width', width + margin.left + margin.right )
		.attr( 'height', height + margin.top + margin.bottom );

	// Add a background rectangle for the header area
	svg
		.append( 'rect' )
		.attr( 'x', 0 )
		.attr( 'y', 0 )
		.attr( 'width', width + margin.left + margin.right )
		.attr( 'height', 35 )
		.attr( 'fill', '#f0f0f0' )
		.attr( 'stroke', '#cccccc' );

	// Add text label for the date range dropdown
	svg
		.append( 'text' )
		.attr( 'x', 15 )
		.attr( 'y', 22 )
		.text( 'Date Range:' )
		.attr( 'font-weight', 'bold' )
		.attr( 'font-family', 'Arial, sans-serif' );

	// Add text label for the metrics dropdown
	svg
		.append( 'text' )
		.attr( 'x', 280 )
		.attr( 'y', 22 )
		.text( 'Metric:' )
		.attr( 'font-weight', 'bold' )
		.attr( 'font-family', 'Arial, sans-serif' );

	// Date range options
	const dateRanges = [
		{ label: 'Last 7 Days', value: 7 },
		{ label: 'Last 14 Days', value: 14 },
		{ label: 'Last 28 Days', value: 28 },
		{ label: 'Last 30 Days', value: 30 },
		{ label: 'Last 60 Days', value: 60 },
	];

	// Metrics options
	const metricsOptions = [
		{ label: 'Engagement Rate', value: 'engagement_rate', unit: '%' },
		{ label: 'Play Rate', value: 'play_rate', unit: '%' },
		{ label: 'Watch Time', value: 'watch_time', unit: 'sec' },
	];

	// Default selected options
	let selectedDateOption = dateRanges[ 0 ];
	let selectedMetricOption = metricsOptions[ 0 ];
	let isDateDropdownOpen = false;
	let isMetricDropdownOpen = false;

	// Create date dropdown button group
	const dateDropdownButton = svg
		.append( 'g' )
		.attr( 'cursor', 'pointer' )
		.attr( 'class', 'date-dropdown-button' );

	// Add date dropdown button rectangle
	dateDropdownButton
		.append( 'rect' )
		.attr( 'x', 100 )
		.attr( 'y', 5 )
		.attr( 'width', 150 )
		.attr( 'height', 25 )
		.attr( 'rx', 3 )
		.attr( 'ry', 3 )
		.attr( 'fill', 'white' )
		.attr( 'stroke', '#cccccc' );

	// Add date dropdown selected text
	const dateDropdownText = dateDropdownButton
		.append( 'text' )
		.attr( 'x', 110 )
		.attr( 'y', 22 )
		.text( selectedDateOption.label )
		.attr( 'font-family', 'Arial, sans-serif' )
		.attr( 'fill', '#333333' );

	// Add date dropdown arrow
	dateDropdownButton
		.append( 'path' )
		.attr( 'd', 'M235,15 L245,15 L240,25 Z' )
		.attr( 'fill', '#666666' );

	// Create date dropdown menu group (initially hidden)
	const dateDropdownMenu = svg
		.append( 'g' )
		.attr( 'class', 'date-dropdown-menu' )
		.attr( 'visibility', 'hidden' );

	// Add date dropdown menu background
	dateDropdownMenu
		.append( 'rect' )
		.attr( 'x', 100 )
		.attr( 'y', 33 )
		.attr( 'width', 150 )
		.attr( 'height', dateRanges.length * 25 )
		.attr( 'fill', 'white' )
		.attr( 'stroke', '#cccccc' )
		.attr( 'rx', 3 )
		.attr( 'ry', 3 );

	// Add date dropdown menu options
	const dateMenuOptions = dateDropdownMenu
		.selectAll( '.date-menu-option' )
		.data( dateRanges )
		.enter()
		.append( 'g' )
		.attr( 'class', 'date-menu-option' )
		.attr( 'cursor', 'pointer' )
		.attr( 'transform', ( d, i ) => `translate(0, ${ i * 25 })` );

	// Add background rect for each date option (for hover effects)
	dateMenuOptions
		.append( 'rect' )
		.attr( 'x', 100 )
		.attr( 'y', 33 )
		.attr( 'width', 150 )
		.attr( 'height', 25 )
		.attr( 'fill', 'white' )
		.attr( 'opacity', 0 )
		.on( 'mouseover', function() {
			d3.select( this ).attr( 'opacity', 0.3 );
		} )
		.on( 'mouseout', function() {
			d3.select( this ).attr( 'opacity', 0 );
		} );

	// Add text for each date option
	dateMenuOptions
		.append( 'text' )
		.attr( 'x', 110 )
		.attr( 'y', 50 )
		.text( ( d ) => d.label )
		.attr( 'font-family', 'Arial, sans-serif' )
		.attr( 'fill', '#333333' );

	// Create metrics dropdown button group
	const metricDropdownButton = svg
		.append( 'g' )
		.attr( 'cursor', 'pointer' )
		.attr( 'class', 'metric-dropdown-button' );

	// Add metric dropdown button rectangle
	metricDropdownButton
		.append( 'rect' )
		.attr( 'x', 340 )
		.attr( 'y', 5 )
		.attr( 'width', 150 )
		.attr( 'height', 25 )
		.attr( 'rx', 3 )
		.attr( 'ry', 3 )
		.attr( 'fill', 'white' )
		.attr( 'stroke', '#cccccc' );

	// Add metric dropdown selected text
	const metricDropdownText = metricDropdownButton
		.append( 'text' )
		.attr( 'x', 350 )
		.attr( 'y', 22 )
		.text( selectedMetricOption.label )
		.attr( 'font-family', 'Arial, sans-serif' )
		.attr( 'fill', '#333333' );

	// Add metric dropdown arrow
	metricDropdownButton
		.append( 'path' )
		.attr( 'd', 'M475,15 L485,15 L480,25 Z' )
		.attr( 'fill', '#666666' );

	// Create metric dropdown menu group (initially hidden)
	const metricDropdownMenu = svg
		.append( 'g' )
		.attr( 'class', 'metric-dropdown-menu' )
		.attr( 'visibility', 'hidden' );

	// Add metric dropdown menu background
	metricDropdownMenu
		.append( 'rect' )
		.attr( 'x', 340 )
		.attr( 'y', 33 )
		.attr( 'width', 150 )
		.attr( 'height', metricsOptions.length * 25 )
		.attr( 'fill', 'white' )
		.attr( 'stroke', '#cccccc' )
		.attr( 'rx', 3 )
		.attr( 'ry', 3 );

	// Add metric dropdown menu options
	const metricMenuOptions = metricDropdownMenu
		.selectAll( '.metric-menu-option' )
		.data( metricsOptions )
		.enter()
		.append( 'g' )
		.attr( 'class', 'metric-menu-option' )
		.attr( 'cursor', 'pointer' )
		.attr( 'transform', ( d, i ) => `translate(0, ${ i * 25 })` );

	// Add background rect for each metric option (for hover effects)
	metricMenuOptions
		.append( 'rect' )
		.attr( 'x', 340 )
		.attr( 'y', 33 )
		.attr( 'width', 150 )
		.attr( 'height', 25 )
		.attr( 'fill', 'white' )
		.attr( 'opacity', 0 )
		.on( 'mouseover', function() {
			d3.select( this ).attr( 'opacity', 0.3 );
		} )
		.on( 'mouseout', function() {
			d3.select( this ).attr( 'opacity', 0 );
		} );

	// Add text for each metric option
	metricMenuOptions
		.append( 'text' )
		.attr( 'x', 350 )
		.attr( 'y', 50 )
		.text( ( d ) => d.label )
		.attr( 'font-family', 'Arial, sans-serif' )
		.attr( 'fill', '#333333' );

	// Create main chart group
	const chartGroup = svg
		.append( 'g' )
		.attr( 'transform', `translate(${ margin.left },${ margin.top })` );

	// Ensure `parsedData` is properly formatted
	const parseDate = d3.timeParse( '%Y-%m-%d' );
	const data = parsedData.map( ( d ) => ( {
		date: parseDate( d.date ),
		engagement_rate: +d.engagement_rate,
		play_rate: +d.play_rate,
		watch_time: +d.watch_time,
	} ) );

	// Function to filter data based on selected date range
	function filterData( days ) {
		const today = new Date();
		const cutoffDate = new Date( today );
		cutoffDate.setDate( today.getDate() - days );

		return data.filter( ( d ) => d.date >= cutoffDate );
	}

	// Function to toggle date dropdown visibility
	function toggleDateDropdown() {
		isDateDropdownOpen = ! isDateDropdownOpen;
		dateDropdownMenu.attr(
			'visibility',
			isDateDropdownOpen ? 'visible' : 'hidden',
		);

		// Close other dropdown if open
		if ( isDateDropdownOpen && isMetricDropdownOpen ) {
			isMetricDropdownOpen = false;
			metricDropdownMenu.attr( 'visibility', 'hidden' );
		}
	}

	// Function to toggle metric dropdown visibility
	function toggleMetricDropdown() {
		isMetricDropdownOpen = ! isMetricDropdownOpen;
		metricDropdownMenu.attr(
			'visibility',
			isMetricDropdownOpen ? 'visible' : 'hidden',
		);

		// Close other dropdown if open
		if ( isMetricDropdownOpen && isDateDropdownOpen ) {
			isDateDropdownOpen = false;
			dateDropdownMenu.attr( 'visibility', 'hidden' );
		}
	}

	// Function to select a date option from the dropdown
	function selectDateOption( option ) {
		selectedDateOption = option;
		dateDropdownText.text( option.label );
		toggleDateDropdown();
		updateChart( selectedDateOption.value, selectedMetricOption.value );
	}

	// Function to select a metric option from the dropdown
	function selectMetricOption( option ) {
		selectedMetricOption = option;
		metricDropdownText.text( option.label );
		toggleMetricDropdown();
		updateChart( selectedDateOption.value, selectedMetricOption.value );
	}

	// Function to update the chart based on selected date range and metric
	function updateChart( selectedDays, selectedMetric ) {
		const filteredData = filterData( selectedDays );

		// Remove any existing chart elements before redrawing
		chartGroup.selectAll( '*' ).remove();

		// Validate data before rendering
		if ( filteredData.length === 0 ) {
			chartGroup
				.append( 'text' )
				.attr( 'x', width / 2 )
				.attr( 'y', height / 2 )
				.attr( 'text-anchor', 'middle' )
				.text( 'No data available for the selected range.' );
			return;
		}

		// Create X axis (Time)
		const x = d3
			.scaleTime()
			.domain( d3.extent( filteredData, ( d ) => d.date ) )
			.range( [ 0, width ] );

		chartGroup
			.append( 'g' )
			.attr( 'transform', `translate(0, ${ height })` )
			.call( d3.axisBottom( x ) );

		// Create Y axis (Values)
		const y = d3
			.scaleLinear()
			.domain( [ 0, d3.max( filteredData, ( d ) => d[ selectedMetric ] ) * 1.1 ] )
			.range( [ height, 0 ] );

		chartGroup.append( 'g' ).call( d3.axisLeft( y ) );

		const metricOption = metricsOptions.find(
			( option ) => option.value === selectedMetric,
		);

		// Add Y axis label
		chartGroup
			.append( 'text' )
			.attr( 'transform', 'rotate(-90)' )
			.attr( 'y', -40 )
			.attr( 'x', -height / 2 )
			.attr( 'text-anchor', 'middle' )
			.text( `${ metricOption.label } (${ metricOption.unit })` );

		// Generate line function
		const line = d3
			.line()
			.x( ( d ) => x( d.date ) )
			.y( ( d ) => y( d[ selectedMetric ] ) );

		// Add the line
		chartGroup
			.append( 'path' )
			.datum( filteredData )
			.attr( 'fill', 'none' )
			.attr( 'stroke', 'steelblue' )
			.attr( 'stroke-width', 2 )
			.attr( 'd', line );

		const tooltip = d3
			.select( 'body' )
			.append( 'div' )
			.style( 'position', 'absolute' )
			.style( 'background', 'rgba(0, 0, 0, 0.8)' )
			.style( 'color', '#fff' )
			.style( 'padding', '5px 10px' )
			.style( 'border-radius', '5px' )
			.style( 'display', 'none' )
			.style( 'font-size', '14px' );

		// Add dots for data points
		chartGroup
			.selectAll( 'dot' )
			.data( filteredData )
			.enter()
			.append( 'circle' )
			.attr( 'cx', ( d ) => x( d.date ) )
			.attr( 'cy', ( d ) => y( d[ selectedMetric ] ) )
			.attr( 'r', 4 )
			.attr( 'fill', 'steelblue' )
			.on( 'mouseover', function( event, d ) {
				tooltip
					.style( 'display', 'block' )
					.html(
						`<strong>${ d.date.getDate() }/${ d.date.getMonth() + 1 }/${ d.date.getFullYear() }</strong> <br/> <hr> ${ metricOption.label }: ${ d[ selectedMetric ].toFixed( 1 ) }${ metricOption.unit }`,
					)
					.style( 'left', event.pageX + 10 + 'px' )
					.style( 'top', event.pageY + 10 + 'px' );

				d3.select( this ).style( 'stroke', '#000' ).style( 'stroke-width', '2px' );
			} )
			.on( 'mousemove', ( event ) => {
				tooltip
					.style( 'left', event.pageX + 10 + 'px' )
					.style( 'top', event.pageY + 10 + 'px' );
			} )
			.on( 'mouseout', function() {
				tooltip.style( 'display', 'none' );
				d3.select( this ).style( 'stroke', '#333' ).style( 'stroke-width', '1px' );
			} );
	}

	// Add event handlers
	dateDropdownButton.on( 'click', toggleDateDropdown );
	metricDropdownButton.on( 'click', toggleMetricDropdown );

	dateMenuOptions.on( 'click', function( event, d ) {
		selectDateOption( d );
	} );

	metricMenuOptions.on( 'click', function( event, d ) {
		selectMetricOption( d );
	} );

	// Add click handler to close dropdowns when clicking elsewhere
	svg.on(
		'click',
		function( event ) {
			if (
				isDateDropdownOpen &&
        ! event.target.closest( '.date-dropdown-button' ) &&
        ! event.target.closest( '.date-dropdown-menu' )
			) {
				isDateDropdownOpen = false;
				dateDropdownMenu.attr( 'visibility', 'hidden' );
			}

			if (
				isMetricDropdownOpen &&
        ! event.target.closest( '.metric-dropdown-button' ) &&
        ! event.target.closest( '.metric-dropdown-menu' )
			) {
				isMetricDropdownOpen = false;
				metricDropdownMenu.attr( 'visibility', 'hidden' );
			}
		},
		true,
	);

	// Initial chart render with default options
	updateChart( selectedDateOption.value, selectedMetricOption.value );
}

export function calculateEngagementRate( plays, videoLength, playTime ) {
	const engagementRate =
    plays && videoLength ? ( playTime / ( plays * videoLength ) ) * 100 : 0;
	return `${ engagementRate.toFixed( 2 ) }%`;
}

export function calculatePlayRate( pageLoad, plays ) {
	const playRate = pageLoad ? ( plays / pageLoad ) * 100 : 0;
	return `${ playRate.toFixed( 2 ) }%`;
}

export function generateCountryHeatmap( countryData, mapSelector, tableSelector ) {
	// Convert object to array for table sorting
	const countryDataArray = Object.entries( countryData ).map( ( [ country, views ] ) => ( {
		country,
		views,
	} ) ).sort( ( a, b ) => b.views - a.views );

	// ===== MAP VISUALIZATION =====
	const width = 800,
		height = 500;

	// Create a container div inside mapSelector
	const container = d3.select( mapSelector )
		.style( 'position', 'relative' )
		.style( 'width', `${ width }px` )
		.style( 'height', `${ height }px` );

	// Create the SVG for the map
	const svg = container
		.append( 'svg' )
		.attr( 'width', width )
		.attr( 'height', height );

	// Group for zoom + pan
	const g = svg.append( 'g' );

	// Define zoom behavior
	const zoom = d3.zoom()
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
		.style( 'right', '20px' )
		.style( 'display', 'flex' )
		.style( 'flex-direction', 'column' )
		.style( 'gap', '10px' )
		.style( 'z-index', '10' );

	zoomControls.append( 'button' )
		.text( '+' )
		.style( 'width', '40px' )
		.style( 'height', '40px' )
		.style( 'font-size', '24px' )
		.style( 'cursor', 'pointer' )
		.style( 'border', '1px solid #ccc' )
		.style( 'border-radius', '5px' )
		.style( 'background', '#fff' )
		.on( 'click', () => {
			svg.transition().call( zoom.scaleBy, 1.3 );
		} );

	zoomControls.append( 'button' )
		.text( '–' )
		.style( 'width', '40px' )
		.style( 'height', '40px' )
		.style( 'font-size', '24px' )
		.style( 'cursor', 'pointer' )
		.style( 'border', '1px solid #ccc' )
		.style( 'border-radius', '5px' )
		.style( 'background', '#fff' )
		.on( 'click', () => {
			svg.transition().call( zoom.scaleBy, 1 / 1.3 );
		} );

	zoomControls.append( 'button' )
		.text( '⟳' )
		.style( 'width', '40px' )
		.style( 'height', '40px' )
		.style( 'font-size', '20px' )
		.style( 'cursor', 'pointer' )
		.style( 'border', '1px solid #ccc' )
		.style( 'border-radius', '5px' )
		.style( 'background', '#fff' )
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

	// Load and render the map
	d3.json( 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson' )
		.then( ( worldData ) => {
			const colorScale = d3.scaleSequential()
				.domain( [ 0, maxViews ] )
				.interpolator( ( t ) => d3.interpolateRgb( '#ddd', '#AB3A6C' )( t ) );

			const features = worldData.features
				.filter( ( f ) => f.properties.name !== 'Antarctica' );

			const projection = d3.geoEquirectangular();

			projection.fitExtent(
				[ [ 20, 20 ], [ width - 20, height - 20 ] ],
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
					const totalViews = d3.sum( countryDataArray, ( data ) => data.views );

					if ( views ) {
						// Compute percentage of maxViews
						const pct = Math.round( ( views / totalViews ) * 100 );
						const radius = 20;
						const circumference = 2 * Math.PI * radius;
						const dash = ( circumference * pct ) / 100;

						// Build tooltip content with SVG circle
						tooltip
							.style( 'display', 'block' )
							.html( `
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
							` )
							.style( 'left', ( x + 10 ) + 'px' )
							.style( 'top', ( y + 10 ) + 'px' );

						// Darken fill on hover
						const orig = colorScale( views );
						const darker = d3.color( orig ).darker( 1 ).formatHex();
						d3.select( this ).attr( 'fill', darker );
					}
				} )
				.on( 'mousemove', ( event ) => {
					const [ x, y ] = d3.pointer( event, container.node() );
					tooltip
						.style( 'left', ( x + 10 ) + 'px' )
						.style( 'top', ( y + 10 ) + 'px' );
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

	const tbody = table.append( 'tbody' );

	tbody
		.selectAll( 'tr' )
		.data( countryDataArray )
		.enter()
		.each( function( d ) {
			const mainRow = d3.select( this ).append( 'tr' );

			mainRow
				.append( 'td' )
				.style( 'border-bottom', '1px solid #eee' )
				.style( 'text-align', 'left' )
				.style( 'font-weight', '900' )
				.text( d.country );

			mainRow
				.append( 'td' )
				.text( d.views )
				.style( 'text-align', 'right' )
				.style( 'padding', '10px' )
				.style( 'border-bottom', '1px solid #eee' )
				.style( 'font-weight', '500' );

			const barRow = d3.select( this ).append( 'tr' );

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
