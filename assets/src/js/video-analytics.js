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
					.style( 'left', `${ mouseX }px` )
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

// function generateMetricsOverTime( parsedData, selector ) {
// 	// Set the dimensions and margins of the graph
// 	const margin = { top: 10, right: 30, bottom: 30, left: 60 },
// 		width = 460 - margin.left - margin.right,
// 		height = 400 - margin.top - margin.bottom;

// 	// Ensure the container exists
// 	const container = d3.select( selector );
// 	if ( container.empty() ) {
// 		console.error( `Container '${ selector }' not found.` );
// 		return;
// 	}

// 	console.log(container);

// 	// Remove any existing elements to prevent duplication
// 	container.select( 'svg' ).remove();
// 	// container.select( '.dropdown-container' ).remove();

// 	// // Create a dropdown container with proper styling
// 	const dropdownContainer = container
// 		.append( 'div' )
// 		.attr( 'class', 'dropdown-container' )
// 		.style( 'margin-bottom', '10px' )
// 		.style( 'display', 'block' ); // Changed to block for better visibility

// 	// Add dropdown label
// 	dropdownContainer
// 		.append( 'label' )
// 		.attr( 'for', 'date-range-select' ) // Add for attribute for accessibility
// 		.text( 'Date Range: ' )
// 		.style( 'font-weight', 'bold' )
// 		.style( 'margin-right', '8px' )
// 		.style( 'display', 'inline-block' ); // Ensure label is visible

// 	// Append the dropdown menu with ID
// 	const dropdown = dropdownContainer
// 		.append( 'select' )
// 		.attr( 'id', 'date-range-select' )
// 		.attr( 'class', 'metric-dropdown' )
// 		.style( 'padding', '5px' )
// 		.style( 'border', '1px solid #ccc' )
// 		.style( 'border-radius', '4px' )
// 		.style( 'background-color', '#fff' ) // Add background color
// 		.style( 'cursor', 'pointer' )
// 		.style( 'display', 'inline-block' ) // Ensure dropdown is visible
// 		.style( 'min-width', '120px' ); // Give it a minimum width

// 	// Dropdown options for date ranges
// 	const dateRanges = [
// 		{ label: 'Last 7 Days', value: 7 },
// 		{ label: 'Last 14 Days', value: 14 },
// 		{ label: 'Last 28 Days', value: 28 },
// 		{ label: 'Last 30 Days', value: 30 },
// 		{ label: 'Last 60 Days', value: 60 },
// 	];

// 	// Populate dropdown options
// 	dropdown
// 		.selectAll( 'option' )
// 		.data( dateRanges )
// 		.enter()
// 		.append( 'option' )
// 		.text( ( d ) => d.label )
// 		.attr( 'value', ( d ) => d.value );

// 	// Append the SVG object to the selected container
// 	const svg = container
// 		.append( 'svg' )
// 		.attr( 'width', width + margin.left + margin.right )
// 		.attr( 'height', height + margin.top + margin.bottom )
// 		.append( 'g' )
// 		.attr( 'transform', `translate(${ margin.left },${ margin.top })` );

// 	// Ensure `parsedData` is properly formatted
// 	const parseDate = d3.timeParse( '%Y-%m-%d' );
// 	const data = parsedData.map( ( d ) => ( {
// 		date: parseDate( d.date ),
// 		engagement_rate: +d.engagement_rate,
// 		play_rate: +d.play_rate,
// 		watch_time: +d.watch_time,
// 	} ) );

// 	console.log( 'Formatted Data:', data ); // Debugging

// 	// Function to filter data based on selected date range
// 	function filterData( days ) {
// 		const today = new Date();
// 		const cutoffDate = new Date( today );
// 		cutoffDate.setDate( today.getDate() - days );

// 		return data.filter( ( d ) => d.date >= cutoffDate );
// 	}

// 	// Function to update the chart based on selected date range
// 	function updateChart( selectedDays ) {
// 		const filteredData = filterData( selectedDays );

// 		// Remove any existing chart elements before redrawing
// 		svg.selectAll( '*' ).remove();

// 		// Validate data before rendering
// 		if ( filteredData.length === 0 ) {
// 			svg
// 				.append( 'text' )
// 				.attr( 'x', width / 2 )
// 				.attr( 'y', height / 2 )
// 				.attr( 'text-anchor', 'middle' )
// 				.text( 'No data available for the selected range.' );
// 			return;
// 		}

// 		// Create X axis (Time)
// 		const x = d3
// 			.scaleTime()
// 			.domain( d3.extent( filteredData, ( d ) => d.date ) )
// 			.range( [ 0, width ] );

// 		svg
// 			.append( 'g' )
// 			.attr( 'transform', `translate(0, ${ height })` )
// 			.call( d3.axisBottom( x ) );

// 		// Create Y axis (Values)
// 		const y = d3
// 			.scaleLinear()
// 			.domain( [ 0, d3.max( filteredData, ( d ) => d.engagement_rate ) * 1.1 ] ) // Add 10% padding
// 			.range( [ height, 0 ] );

// 		svg.append( 'g' ).call( d3.axisLeft( y ) );

// 		// Add Y axis label
// 		svg
// 			.append( 'text' )
// 			.attr( 'transform', 'rotate(-90)' )
// 			.attr( 'y', -40 )
// 			.attr( 'x', -height / 2 )
// 			.attr( 'text-anchor', 'middle' )
// 			.text( 'Engagement Rate (%)' );

// 		// Generate line function
// 		const line = d3
// 			.line()
// 			.x( ( d ) => x( d.date ) )
// 			.y( ( d ) => y( d.engagement_rate ) );

// 		// Add the line
// 		svg
// 			.append( 'path' )
// 			.datum( filteredData )
// 			.attr( 'fill', 'none' )
// 			.attr( 'stroke', 'steelblue' )
// 			.attr( 'stroke-width', 2 )
// 			.attr( 'd', line );

// 		// Add dots for data points
// 		svg
// 			.selectAll( 'dot' )
// 			.data( filteredData )
// 			.enter()
// 			.append( 'circle' )
// 			.attr( 'cx', ( d ) => x( d.date ) )
// 			.attr( 'cy', ( d ) => y( d.engagement_rate ) )
// 			.attr( 'r', 4 )
// 			.attr( 'fill', 'steelblue' );
// 	}

// 	// Initial chart render with default date range (Last 7 Days)
// 	updateChart( 7 );

// 	// Update chart when dropdown selection changes
// 	//   dropdown.on("change", function () {
// 	//     const selectedDays = +this.value;
// 	//     updateChart(selectedDays);
// 	//   });

// 	document
// 		.getElementById( 'date-range-select' )
// 		?.addEventListener( 'change', function() {
// 			const selectedDays = +this.value;
// 			updateChart( selectedDays );
// 		} );
// }

//******************* Shows buttons as time */

// function generateMetricsOverTime( parsedData, selector ) {
// 	// Set the dimensions and margins of the graph
// 	const margin = { top: 50, right: 30, bottom: 30, left: 60 },
// 		width = 500 - margin.left - margin.right,
// 		height = 500 - margin.top - margin.bottom;

// 	// Ensure the container exists
// 	const container = d3.select( selector );
// 	if ( container.empty() ) {
// 		console.error( `Container '${ selector }' not found.` );
// 		return;
// 	}

// 	// Remove any existing SVG to prevent duplication
// 	container.select( 'svg' ).remove();

// 	// Create an SVG element with all controls built directly into it
// 	const svg = container
// 		.append( 'svg' )
// 		.attr( 'width', width + margin.left + margin.right )
// 		.attr( 'height', height + margin.top + margin.bottom );

// 	// Add a background rectangle for the header area
// 	svg
// 		.append( 'rect' )
// 		.attr( 'x', 0 )
// 		.attr( 'y', 0 )
// 		.attr( 'width', width + margin.left + margin.right )
// 		.attr( 'height', 35 )
// 		.attr( 'fill', '#f0f0f0' )
// 		.attr( 'stroke', '#cccccc' );

// 	// Add text label for the controls
// 	svg
// 		.append( 'text' )
// 		.attr( 'x', 15 )
// 		.attr( 'y', 22 )
// 		.text( 'Date Range:' )
// 		.attr( 'font-weight', 'bold' )
// 		.attr( 'font-family', 'Arial, sans-serif' );

// 	// Date range options
// 	const dateRanges = [
// 		{ label: '7 Days', value: 7, x: 100 },
// 		{ label: '14 Days', value: 14, x: 170 },
// 		{ label: '28 Days', value: 28, x: 240 },
// 		{ label: '30 Days', value: 30, x: 310 },
// 		{ label: '60 Days', value: 60, x: 380 },
// 	];

// 	// Create clickable text buttons
// 	const buttons = svg
// 		.selectAll( '.date-button' )
// 		.data( dateRanges )
// 		.enter()
// 		.append( 'g' )
// 		.attr( 'class', 'date-button' )
// 		.attr( 'cursor', 'pointer' );

// 	// Add text for each button
// 	buttons
// 		.append( 'text' )
// 		.attr( 'x', ( d ) => d.x )
// 		.attr( 'y', 22 )
// 		.text( ( d ) => d.label )
// 		.attr( 'text-anchor', 'middle' )
// 		.attr( 'font-family', 'Arial, sans-serif' );

// 	// Add underline for the selected button (default 7 days)
// 	let selectedButton = 7;
// 	const underlines = buttons
// 		.append( 'rect' )
// 		.attr( 'x', ( d ) => d.x - 25 )
// 		.attr( 'y', 25 )
// 		.attr( 'width', 50 )
// 		.attr( 'height', 2 )
// 		.attr( 'fill', ( d ) =>
// 			d.value === selectedButton ? 'steelblue' : 'transparent',
// 		);

// 	// Create main chart group
// 	const chartGroup = svg
// 		.append( 'g' )
// 		.attr( 'transform', `translate(${ margin.left },${ margin.top })` );

// 	// Ensure `parsedData` is properly formatted
// 	const parseDate = d3.timeParse( '%Y-%m-%d' );
// 	const data = parsedData.map( ( d ) => ( {
// 		date: parseDate( d.date ),
// 		engagement_rate: +d.engagement_rate,
// 		play_rate: +d.play_rate,
// 		watch_time: +d.watch_time,
// 	} ) );

// 	// Function to filter data based on selected date range
// 	function filterData( days ) {
// 		const today = new Date();
// 		const cutoffDate = new Date( today );
// 		cutoffDate.setDate( today.getDate() - days );

// 		return data.filter( ( d ) => d.date >= cutoffDate );
// 	}

// 	// Function to update the chart based on selected date range
// 	function updateChart( selectedDays ) {
// 		// Update button styling
// 		selectedButton = selectedDays;
// 		underlines.attr( 'fill', ( d ) =>
// 			d.value === selectedDays ? 'steelblue' : 'transparent',
// 		);

// 		const filteredData = filterData( selectedDays );

// 		// Remove any existing chart elements before redrawing
// 		chartGroup.selectAll( '*' ).remove();

// 		// Validate data before rendering
// 		if ( filteredData.length === 0 ) {
// 			chartGroup
// 				.append( 'text' )
// 				.attr( 'x', width / 2 )
// 				.attr( 'y', height / 2 )
// 				.attr( 'text-anchor', 'middle' )
// 				.text( 'No data available for the selected range.' );
// 			return;
// 		}

// 		// Create X axis (Time)
// 		const x = d3
// 			.scaleTime()
// 			.domain( d3.extent( filteredData, ( d ) => d.date ) )
// 			.range( [ 0, width ] );

// 		chartGroup
// 			.append( 'g' )
// 			.attr( 'transform', `translate(0, ${ height })` )
// 			.call( d3.axisBottom( x ) );

// 		// Create Y axis (Values)
// 		const y = d3
// 			.scaleLinear()
// 			.domain( [ 0, d3.max( filteredData, ( d ) => d.engagement_rate ) * 1.1 ] )
// 			.range( [ height, 0 ] );

// 		chartGroup.append( 'g' ).call( d3.axisLeft( y ) );

// 		// Add Y axis label
// 		chartGroup
// 			.append( 'text' )
// 			.attr( 'transform', 'rotate(-90)' )
// 			.attr( 'y', -40 )
// 			.attr( 'x', -height / 2 )
// 			.attr( 'text-anchor', 'middle' )
// 			.text( 'Engagement Rate (%)' );

// 		// Add chart title
// 		chartGroup
// 			.append( 'text' )
// 			.attr( 'x', width / 2 )
// 			.attr( 'y', -20 )
// 			.attr( 'text-anchor', 'middle' )
// 			.attr( 'font-size', '16px' )
// 			.attr( 'font-weight', 'bold' )
// 			.attr( 'font-family', 'Arial, sans-serif' )
// 			.text( 'Engagement Rate Over Time' );

// 		// Generate line function
// 		const line = d3
// 			.line()
// 			.x( ( d ) => x( d.date ) )
// 			.y( ( d ) => y( d.engagement_rate ) );

// 		// Add the line
// 		chartGroup
// 			.append( 'path' )
// 			.datum( filteredData )
// 			.attr( 'fill', 'none' )
// 			.attr( 'stroke', 'steelblue' )
// 			.attr( 'stroke-width', 2 )
// 			.attr( 'd', line );

// 		// Add dots for data points
// 		chartGroup
// 			.selectAll( 'dot' )
// 			.data( filteredData )
// 			.enter()
// 			.append( 'circle' )
// 			.attr( 'cx', ( d ) => x( d.date ) )
// 			.attr( 'cy', ( d ) => y( d.engagement_rate ) )
// 			.attr( 'r', 4 )
// 			.attr( 'fill', 'steelblue' );
// 	}

// 	// Add click event handlers to the buttons
// 	buttons.on( 'click', function( event, d ) {
// 		updateChart( d.value );
// 	} );

// 	// Initial chart render with default date range (Last 7 Days)
// 	updateChart( 7 );
// }

// function generateMetricsOverTime( parsedData, selector ) {
// 	// Set the dimensions and margins of the graph
// 	const margin = { top: 50, right: 30, bottom: 30, left: 60 },
// 		width = 900 - margin.left - margin.right,
// 		height = 500 - margin.top - margin.bottom;

// 	// Ensure the container exists
// 	const container = d3.select( selector );
// 	if ( container.empty() ) {
// 		console.error( `Container '${ selector }' not found.` );
// 		return;
// 	}

// 	// Remove any existing SVG to prevent duplication
// 	container.select( 'svg' ).remove();

// 	// Create an SVG element
// 	const svg = container
// 		.append( 'svg' )
// 		.attr( 'width', width + margin.left + margin.right )
// 		.attr( 'height', height + margin.top + margin.bottom );

// 	// Add a background rectangle for the header area
// 	svg
// 		.append( 'rect' )
// 		.attr( 'x', 0 )
// 		.attr( 'y', 0 )
// 		.attr( 'width', width + margin.left + margin.right )
// 		.attr( 'height', 35 )
// 		.attr( 'fill', '#f0f0f0' )
// 		.attr( 'stroke', '#cccccc' );

// 	// Add text label for the dropdown
// 	svg
// 		.append( 'text' )
// 		.attr( 'x', 15 )
// 		.attr( 'y', 22 )
// 		.text( 'Date Range:' )
// 		.attr( 'font-weight', 'bold' )
// 		.attr( 'font-family', 'Arial, sans-serif' );

// 	// Date range options
// 	const dateRanges = [
// 		{ label: 'Last 7 Days', value: 7 },
// 		{ label: 'Last 14 Days', value: 14 },
// 		{ label: 'Last 28 Days', value: 28 },
// 		{ label: 'Last 30 Days', value: 30 },
// 		{ label: 'Last 60 Days', value: 60 },
// 	];

// 	// Default selected option
// 	let selectedOption = dateRanges[ 0 ];
// 	let isDropdownOpen = false;

// 	// Create dropdown button group
// 	const dropdownButton = svg
// 		.append( 'g' )
// 		.attr( 'cursor', 'pointer' )
// 		.attr( 'class', 'dropdown-button' );

// 	// Add dropdown button rectangle
// 	dropdownButton
// 		.append( 'rect' )
// 		.attr( 'x', 100 )
// 		.attr( 'y', 5 )
// 		.attr( 'width', 150 )
// 		.attr( 'height', 25 )
// 		.attr( 'rx', 3 )
// 		.attr( 'ry', 3 )
// 		.attr( 'fill', 'white' )
// 		.attr( 'stroke', '#cccccc' );

// 	// Add dropdown selected text
// 	const dropdownText = dropdownButton
// 		.append( 'text' )
// 		.attr( 'x', 110 )
// 		.attr( 'y', 22 )
// 		.text( selectedOption.label )
// 		.attr( 'font-family', 'Arial, sans-serif' )
// 		.attr( 'fill', '#333333' );

// 	// Add dropdown arrow
// 	dropdownButton
// 		.append( 'path' )
// 		.attr( 'd', 'M235,15 L245,15 L240,25 Z' )
// 		.attr( 'fill', '#666666' );

// 	// Create dropdown menu group (initially hidden)
// 	const dropdownMenu = svg
// 		.append( 'g' )
// 		.attr( 'class', 'dropdown-menu' )
// 		.attr( 'visibility', 'hidden' );

// 	// Add dropdown menu background
// 	dropdownMenu
// 		.append( 'rect' )
// 		.attr( 'x', 100 )
// 		.attr( 'y', 33 )
// 		.attr( 'width', 150 )
// 		.attr( 'height', dateRanges.length * 25 )
// 		.attr( 'fill', 'white' )
// 		.attr( 'stroke', '#cccccc' )
// 		.attr( 'rx', 3 )
// 		.attr( 'ry', 3 );

// 	// Add dropdown menu options
// 	const menuOptions = dropdownMenu
// 		.selectAll( '.menu-option' )
// 		.data( dateRanges )
// 		.enter()
// 		.append( 'g' )
// 		.attr( 'class', 'menu-option' )
// 		.attr( 'cursor', 'pointer' )
// 		.attr( 'transform', ( d, i ) => `translate(0, ${ i * 25 })` );

// 	// Add background rect for each option (for hover effects)
// 	menuOptions
// 		.append( 'rect' )
// 		.attr( 'x', 100 )
// 		.attr( 'y', 33 )
// 		.attr( 'width', 150 )
// 		.attr( 'height', 25 )
// 		.attr( 'fill', 'white' )
// 		.attr( 'opacity', 0 )
// 		.on( 'mouseover', function() {
// 			d3.select( this ).attr( 'opacity', 0.3 );
// 		} )
// 		.on( 'mouseout', function() {
// 			d3.select( this ).attr( 'opacity', 0 );
// 		} );

// 	// Add text for each option
// 	menuOptions
// 		.append( 'text' )
// 		.attr( 'x', 110 )
// 		.attr( 'y', 50 )
// 		.text( ( d ) => d.label )
// 		.attr( 'font-family', 'Arial, sans-serif' )
// 		.attr( 'fill', '#333333' );

// 	// Create main chart group
// 	const chartGroup = svg
// 		.append( 'g' )
// 		.attr( 'transform', `translate(${ margin.left },${ margin.top })` );

// 	// Ensure `parsedData` is properly formatted
// 	const parseDate = d3.timeParse( '%Y-%m-%d' );
// 	const data = parsedData.map( ( d ) => ( {
// 		date: parseDate( d.date ),
// 		engagement_rate: +d.engagement_rate,
// 		play_rate: +d.play_rate,
// 		watch_time: +d.watch_time,
// 	} ) );

// 	// Function to filter data based on selected date range
// 	function filterData( days ) {
// 		const today = new Date();
// 		const cutoffDate = new Date( today );
// 		cutoffDate.setDate( today.getDate() - days );

// 		console.log( cutoffDate );

// 		return data.filter( ( d ) => d.date >= cutoffDate );
// 	}

// 	// Function to toggle dropdown visibility
// 	function toggleDropdown() {
// 		isDropdownOpen = ! isDropdownOpen;
// 		dropdownMenu.attr( 'visibility', isDropdownOpen ? 'visible' : 'hidden' );
// 	}

// 	// Function to select an option from the dropdown
// 	function selectOption( option ) {
// 		selectedOption = option;
// 		dropdownText.text( option.label );
// 		toggleDropdown();
// 		updateChart( option.value );
// 	}

// 	// Function to update the chart based on selected date range
// 	function updateChart( selectedDays ) {
// 		console.log( selectedDays );
// 		const filteredData = filterData( selectedDays );

// 		console.log( filteredData );

// 		// Remove any existing chart elements before redrawing
// 		chartGroup.selectAll( '*' ).remove();

// 		// Validate data before rendering
// 		if ( filteredData.length === 0 ) {
// 			chartGroup
// 				.append( 'text' )
// 				.attr( 'x', width / 2 )
// 				.attr( 'y', height / 2 )
// 				.attr( 'text-anchor', 'middle' )
// 				.text( 'No data available for the selected range.' );
// 			return;
// 		}

// 		// Create X axis (Time)
// 		const x = d3
// 			.scaleTime()
// 			.domain( d3.extent( filteredData, ( d ) => d.date ) )
// 			.range( [ 0, width ] );

// 		chartGroup
// 			.append( 'g' )
// 			.attr( 'transform', `translate(0, ${ height })` )
// 			.call( d3.axisBottom( x ) );

// 		// Create Y axis (Values)
// 		const y = d3
// 			.scaleLinear()
// 			.domain( [ 0, d3.max( filteredData, ( d ) => d.engagement_rate ) * 1.1 ] )
// 			.range( [ height, 0 ] );

// 		chartGroup.append( 'g' ).call( d3.axisLeft( y ) );

// 		// Add Y axis label
// 		chartGroup
// 			.append( 'text' )
// 			.attr( 'transform', 'rotate(-90)' )
// 			.attr( 'y', -40 )
// 			.attr( 'x', -height / 2 )
// 			.attr( 'text-anchor', 'middle' )
// 			.text( 'Engagement Rate (%)' );

// 		// Add chart title
// 		// chartGroup
// 		// 	.append( 'text' )
// 		// 	.attr( 'x', width / 2 )
// 		// 	.attr( 'y', -20 )
// 		// 	.attr( 'text-anchor', 'middle' )
// 		// 	.attr( 'font-size', '16px' )
// 		// 	.attr( 'font-weight', 'bold' )
// 		// 	.attr( 'font-family', 'Arial, sans-serif' )
// 		// 	.text( 'Engagement Rate Over Time' );

// 		// Generate line function
// 		const line = d3
// 			.line()
// 			.x( ( d ) => x( d.date ) )
// 			.y( ( d ) => y( d.engagement_rate ) );

// 		// Add the line
// 		chartGroup
// 			.append( 'path' )
// 			.datum( filteredData )
// 			.attr( 'fill', 'none' )
// 			.attr( 'stroke', 'steelblue' )
// 			.attr( 'stroke-width', 2 )
// 			.attr( 'd', line );

// 		const tooltip = d3
// 			.select( 'body' )
// 			.append( 'div' )
// 			.style( 'position', 'absolute' )
// 			.style( 'background', 'rgba(0, 0, 0, 0.8)' )
// 			.style( 'color', '#fff' )
// 			.style( 'padding', '5px 10px' )
// 			.style( 'border-radius', '5px' )
// 			.style( 'display', 'none' )
// 			.style( 'font-size', '14px' );

// 		// Add dots for data points
// 		chartGroup
// 			.selectAll( 'dot' )
// 			.data( filteredData )
// 			.enter()
// 			.append( 'circle' )
// 			.attr( 'cx', ( d ) => x( d.date ) )
// 			.attr( 'cy', ( d ) => y( d.engagement_rate ) )
// 			.attr( 'r', 4 )
// 			.attr( 'fill', 'steelblue' )
// 			.on( 'mouseover', function( event, d ) {
// 				// if ( countryData[ countryName ] ) {
// 				tooltip
// 					.style( 'display', 'block' )
// 					.html(
// 						`<strong>${ d.date.getDate() }/${ d.date.getMonth() + 1 }/${ d.date.getFullYear() }</strong> <br/> <hr> ${ d.engagement_rate }`,
// 					)
// 					.style( 'left', event.pageX + 10 + 'px' )
// 					.style( 'top', event.pageY + 10 + 'px' );

// 				d3.select( this ).style( 'stroke', '#000' ).style( 'stroke-width', '2px' );
// 				// }
// 			} )
// 			.on( 'mousemove', ( event ) => {
// 				tooltip
// 					.style( 'left', event.pageX + 10 + 'px' )
// 					.style( 'top', event.pageY + 10 + 'px' );
// 			} )
// 			.on( 'mouseout', function() {
// 				tooltip.style( 'display', 'none' );

// 				d3.select( this ).style( 'stroke', '#333' ).style( 'stroke-width', '1px' );
// 			} );
// 	}

// 	// Add event handlers
// 	dropdownButton.on( 'click', toggleDropdown );
// 	menuOptions.on( 'click', function( event, d ) {
// 		selectOption( d );
// 	} );

// 	// Add click handler to close dropdown when clicking elsewhere
// 	svg.on(
// 		'click',
// 		function( event ) {
// 			if (
// 				isDropdownOpen &&
//         ! event.target.closest( '.dropdown-button' ) &&
//         ! event.target.closest( '.dropdown-menu' )
// 			) {
// 				isDropdownOpen = false;
// 				dropdownMenu.attr( 'visibility', 'hidden' );
// 			}
// 		},
// 		true,
// 	);

// 	// Initial chart render with default date range
// 	updateChart( selectedOption.value );
// }

function generateMetricsOverTime( parsedData, selector ) {
	// Set the dimensions and margins of the graph
	const margin = { top: 80, right: 30, bottom: 30, left: 60 },
		width = 900 - margin.left - margin.right,
		height = 500 - margin.top - margin.bottom;

	// Ensure the container exists
	const container = d3.select( selector );
	if ( container.empty() ) {
		console.error( `Container '${ selector }' not found.` );
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
		const metricOption = metricsOptions.find(
			( option ) => option.value === selectedMetric,
		);

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

	const tooltip = d3.select( '.tooltip' );

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

async function fetchAnalyticsData( videoId, siteUrl ) {
	try {
		const params = new URLSearchParams( {
			video_id: videoId,
			site_url: siteUrl,
		} );

		const url = `${ window.godamRestRoute.url }godam/v1/analytics/fetch?${ params.toString() }`;

		const sampleCountryData = {
			USA: 120,
			India: 95,
			'United Kingdom': 45,
			Germany: 30,
			Canada: 25,
			Australia: 20,
			France: 18,
			Brazil: 15,
			Japan: 10,
			'South Africa': 8,
		};

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

		if ( result.status === 'error' && result.message.includes( 'Invalid or unverified API key' ) ) {
			showAPIActivationMessage();
			return null;
		}

		if ( result.status !== 'success' ) {
			throw new Error( result.message );
		}

		result.data.country_views = sampleCountryData;

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
	const analyticsContainer = document.getElementById( 'video-analytics-container' );
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

// function generateCountryHeatmap( countryData, selector ) {
// 	const width = 800,
// 		height = 500;

// 	const svg = d3.select( selector ).attr( 'width', width ).attr( 'height', height );

// 	const projection = d3
// 		.geoNaturalEarth1()
// 		.scale( 150 )
// 		.translate( [ width / 2, height / 2 ] );

// 	const path = d3.geoPath().projection( projection );

// 	const tooltip = d3
// 		.select( 'body' )
// 		.append( 'div' )
// 		.style( 'position', 'absolute' )
// 		.style( 'background', 'rgba(0, 0, 0, 0.8)' )
// 		.style( 'color', '#fff' )
// 		.style( 'padding', '5px 10px' )
// 		.style( 'border-radius', '5px' )
// 		.style( 'display', 'none' )
// 		.style( 'font-size', '14px' );

// 	const tableContainer = svg
// 		.append( 'div' )
// 		.style( 'flex', '0 0 250px' );

// 	// Create table structure
// 	const table = tableContainer
// 		.append( 'table' )
// 		.style( 'width', '100%' )
// 		.style( 'border-collapse', 'collapse' )
// 		.style( 'font-family', 'Arial, sans-serif' );

// 	// Add header
// 	const thead = table.append( 'thead' );
// 	thead
// 		.append( 'tr' )
// 		.selectAll( 'th' )
// 		.data( [ 'COUNTRY', 'VIEWS' ] )
// 		.enter()
// 		.append( 'th' )
// 		.text( ( d ) => d )
// 		.style( 'padding', '10px' )
// 		.style( 'text-align', ( d, i ) => ( i === 1 ? 'right' : 'left' ) )
// 		.style( 'border-bottom', '1px solid #ddd' )
// 		.style( 'color', '#777' )
// 		.style( 'font-size', '12px' )
// 		.style( 'font-weight', '500' );

// 	// Add table body
// 	const tbody = table.append( 'tbody' );
// 	const rows = tbody.selectAll( 'tr' ).data( countryData ).enter().append( 'tr' );

// 	// Add country column with colored bar
// 	const countryCell = rows
// 		.append( 'td' )
// 		.style( 'padding', '10px 10px 10px 0' )
// 		.style( 'border-bottom', '1px solid #eee' );

// 	countryCell
// 		.append( 'div' )
// 		.style( 'display', 'flex' )
// 		.style( 'align-items', 'center' )
// 		.each( function( d ) {
// 			const container = d3.select( this );

// 			// Add blue bar
// 			container
// 				.append( 'div' )
// 				.style( 'width', '30px' )
// 				.style( 'height', '4px' )
// 				.style( 'background-color', '#4285f4' )
// 				.style( 'margin-right', '10px' );

// 			// Add country name
// 			container
// 				.append( 'span' )
// 				.text( d.country )
// 				.style( 'color', '#555' )
// 				.style( 'font-weight', '500' );
// 		} );

// 	// Add views column
// 	rows
// 		.append( 'td' )
// 		.text( ( d ) => d.views )
// 		.style( 'text-align', 'right' )
// 		.style( 'padding', '10px' )
// 		.style( 'border-bottom', '1px solid #eee' )
// 		.style( 'font-weight', '500' );

// 	d3.json(
// 		'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',
// 	).then( ( worldData ) => {
// 		const colorScale = d3
// 			.scaleSequential( d3.interpolateBlues )
// 			.domain( [ 0, d3.max( Object.values( countryData ) ) ] );

// 		svg
// 			.selectAll( 'path' )
// 			.data( worldData.features )
// 			.enter()
// 			.append( 'path' )
// 			.attr( 'd', path )
// 			.attr( 'fill', ( d ) => {
// 				const countryName = d.properties.name;
// 				return countryData[ countryName ]
// 					? colorScale( countryData[ countryName ] )
// 					: '#ddd';
// 			} )
// 			.attr( 'stroke', '#333' )
// 			.on( 'mouseover', function( event, d ) {
// 				const countryName = d.properties.name;
// 				if ( countryData[ countryName ] ) {
// 					tooltip
// 						.style( 'display', 'block' )
// 						.html(
// 							`<strong>${ countryName }:</strong> ${ countryData[ countryName ] }`,
// 						)
// 						.style( 'left', event.pageX + 10 + 'px' )
// 						.style( 'top', event.pageY + 10 + 'px' );

// 					d3.select( this ).style( 'stroke', '#000' ).style( 'stroke-width', '2px' );
// 				}
// 			} )
// 			.on( 'mousemove', ( event ) => {
// 				tooltip
// 					.style( 'left', event.pageX + 10 + 'px' )
// 					.style( 'top', event.pageY + 10 + 'px' );
// 			} )
// 			.on( 'mouseout', function() {
// 				tooltip.style( 'display', 'none' );

// 				d3.select( this ).style( 'stroke', '#333' ).style( 'stroke-width', '1px' );
// 			} );
// 	} );
// }

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
	const rows = tbody
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

async function main() {
	const videoElement = document.getElementById( 'analytics-video' );
	const videoId = videoElement?.dataset.id;
	const siteUrl = window.location.origin;

	const analyticsData = await fetchAnalyticsData( videoId, siteUrl );

	if ( ! analyticsData ) {
		return;
	}

	// Extract values from the analytics response
	const { plays, page_load: pageLoad, play_time: playTime, video_length: videoLength, all_time_heatmap: allTimeHeatmap, country_views: countryViews } = analyticsData;

	// Calculate analytics metrics
	const playRate = pageLoad ? ( plays / pageLoad ) * 100 : 0; // Convert to percentage
	const totalPlays = plays;
	const engagementRate = plays && videoLength ? ( playTime / ( plays * videoLength ) ) * 100 : 0;

	// Update the UI with computed analytics
	document.getElementById( 'play-rate' ).innerText = `${ playRate.toFixed( 2 ) }%`;
	document.getElementById( 'total-plays' ).innerText = totalPlays;
	document.getElementById( 'engagement-rate' ).innerText = `${ engagementRate.toFixed( 2 ) }%`;

	// Convert heatmap string into an array
	const heatmapData = JSON.parse( allTimeHeatmap );

	const videoPlayer = videojs( 'analytics-video', {
		fluid: true,
		mute: true,
		controls: false,
	} );

	const timeMeticsChartData = [
		{ date: '2025-04-02', engagement_rate: 47.8, play_rate: 64.3, watch_time: 132 },
		{ date: '2025-04-01', engagement_rate: 45.2, play_rate: 60.1, watch_time: 120 },
		{ date: '2025-03-31', engagement_rate: 46.5, play_rate: 62.7, watch_time: 125 },
		{ date: '2025-03-30', engagement_rate: 44.9, play_rate: 59.8, watch_time: 118 },
		{ date: '2025-03-29', engagement_rate: 42.3, play_rate: 58.4, watch_time: 114 },
		{ date: '2025-03-28', engagement_rate: 43.7, play_rate: 61.2, watch_time: 124 },
		{ date: '2025-03-27', engagement_rate: 48.6, play_rate: 65.0, watch_time: 138 },
		// Last 7 days complete here
		{ date: '2025-03-26', engagement_rate: 44.1, play_rate: 59.6, watch_time: 121 },
		{ date: '2025-03-25', engagement_rate: 41.5, play_rate: 57.8, watch_time: 112 },
		{ date: '2025-03-24', engagement_rate: 45.9, play_rate: 62.5, watch_time: 126 },
		{ date: '2025-03-23', engagement_rate: 51.2, play_rate: 67.8, watch_time: 145 },
		{ date: '2025-03-22', engagement_rate: 49.7, play_rate: 66.1, watch_time: 141 },
		{ date: '2025-03-21', engagement_rate: 47.3, play_rate: 63.4, watch_time: 130 },
		{ date: '2025-03-20', engagement_rate: 45.8, play_rate: 61.9, watch_time: 128 },
		// Last 14 days complete here
		{ date: '2025-03-19', engagement_rate: 42.6, play_rate: 58.1, watch_time: 115 },
		{ date: '2025-03-18', engagement_rate: 44.5, play_rate: 60.5, watch_time: 122 },
		{ date: '2025-03-17', engagement_rate: 46.8, play_rate: 63.0, watch_time: 131 },
		{ date: '2025-03-16', engagement_rate: 48.9, play_rate: 64.7, watch_time: 135 },
		{ date: '2025-03-15', engagement_rate: 52.3, play_rate: 68.4, watch_time: 147 },
		{ date: '2025-03-14', engagement_rate: 50.6, play_rate: 67.1, watch_time: 143 },
		{ date: '2025-03-13', engagement_rate: 47.5, play_rate: 63.8, watch_time: 133 },
		{ date: '2025-03-12', engagement_rate: 45.0, play_rate: 60.9, watch_time: 123 },
		{ date: '2025-03-11', engagement_rate: 43.2, play_rate: 59.2, watch_time: 119 },
		{ date: '2025-03-10', engagement_rate: 41.8, play_rate: 58.6, watch_time: 116 },
		{ date: '2025-03-09', engagement_rate: 44.3, play_rate: 61.4, watch_time: 127 },
		{ date: '2025-03-08', engagement_rate: 46.2, play_rate: 62.0, watch_time: 129 },
		{ date: '2025-03-07', engagement_rate: 48.3, play_rate: 64.2, watch_time: 136 },
		{ date: '2025-03-06', engagement_rate: 50.1, play_rate: 66.7, watch_time: 140 },
		// Last 28 days complete here (also covers the 30-day option)
		{ date: '2025-03-05', engagement_rate: 47.9, play_rate: 64.0, watch_time: 134 },
		{ date: '2025-03-04', engagement_rate: 45.3, play_rate: 61.5, watch_time: 125 },
		// Additional data for 30 days
		{ date: '2025-03-03', engagement_rate: 43.8, play_rate: 60.3, watch_time: 122 },
		{ date: '2025-03-02', engagement_rate: 42.1, play_rate: 57.5, watch_time: 113 },
		// 30 days complete here
		{ date: '2025-03-01', engagement_rate: 44.0, play_rate: 59.5, watch_time: 120 },
		{ date: '2025-02-28', engagement_rate: 41.0, play_rate: 56.8, watch_time: 110 },
		{ date: '2025-02-27', engagement_rate: 43.5, play_rate: 59.9, watch_time: 121 },
		{ date: '2025-02-26', engagement_rate: 45.7, play_rate: 61.8, watch_time: 127 },
		{ date: '2025-02-25', engagement_rate: 48.0, play_rate: 64.5, watch_time: 134 },
		{ date: '2025-02-24', engagement_rate: 50.8, play_rate: 67.3, watch_time: 144 },
		{ date: '2025-02-23', engagement_rate: 49.2, play_rate: 65.9, watch_time: 139 },
		{ date: '2025-02-22', engagement_rate: 46.7, play_rate: 62.9, watch_time: 130 },
		{ date: '2025-02-21', engagement_rate: 44.4, play_rate: 60.7, watch_time: 123 },
		{ date: '2025-02-20', engagement_rate: 42.9, play_rate: 58.7, watch_time: 117 },
		{ date: '2025-02-19', engagement_rate: 40.7, play_rate: 57.0, watch_time: 111 },
		{ date: '2025-02-18', engagement_rate: 43.3, play_rate: 59.3, watch_time: 120 },
		{ date: '2025-02-17', engagement_rate: 45.4, play_rate: 61.6, watch_time: 126 },
		{ date: '2025-02-16', engagement_rate: 47.6, play_rate: 63.5, watch_time: 132 },
		{ date: '2025-02-15', engagement_rate: 49.5, play_rate: 66.0, watch_time: 140 },
		{ date: '2025-02-14', engagement_rate: 51.7, play_rate: 68.5, watch_time: 148 },
		{ date: '2025-02-13', engagement_rate: 48.7, play_rate: 65.3, watch_time: 137 },
		{ date: '2025-02-12', engagement_rate: 45.6, play_rate: 62.4, watch_time: 128 },
		{ date: '2025-02-11', engagement_rate: 42.4, play_rate: 59.0, watch_time: 119 },
		{ date: '2025-02-10', engagement_rate: 40.0, play_rate: 56.5, watch_time: 109 },
		{ date: '2025-02-09', engagement_rate: 41.3, play_rate: 57.3, watch_time: 112 },
		{ date: '2025-02-08', engagement_rate: 43.9, play_rate: 60.0, watch_time: 122 },
		{ date: '2025-02-07', engagement_rate: 46.1, play_rate: 62.3, watch_time: 129 },
		{ date: '2025-02-06', engagement_rate: 48.4, play_rate: 64.8, watch_time: 136 },
		{ date: '2025-02-05', engagement_rate: 50.9, play_rate: 67.6, watch_time: 146 },
		{ date: '2025-02-04', engagement_rate: 49.9, play_rate: 66.5, watch_time: 142 },
		{ date: '2025-02-03', engagement_rate: 47.2, play_rate: 63.6, watch_time: 131 },
		{ date: '2025-02-02', engagement_rate: 44.6, play_rate: 60.4, watch_time: 124 },
		{ date: '2025-02-01', engagement_rate: 42.0, play_rate: 58.0, watch_time: 115 },
		// Complete 60-day dataset
	];

	// Generate visualizations
	generateLineChart( heatmapData, '#line-chart', videoPlayer );
	generateHeatmap( heatmapData, '#heatmap', videoPlayer );
	generateMetricsOverTime( timeMeticsChartData, '#metrics-chart', videoPlayer );

	if ( countryViews ) {
		// generateCountryHeatmap( countryViews, '#country-heatmap' );
		generateCountryHeatmap( countryViews, '#map-container', '#table-container' );
	}

	const analyticsContainer = document.getElementById( 'video-analytics-container' );
	if ( analyticsContainer ) {
		analyticsContainer.classList.remove( 'hidden' );
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

		if ( videoId ) {
			clearInterval( videoCheckInterval );
			main();
		}
	}, 500 );
} );
