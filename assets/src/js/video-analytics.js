/**
 * External dependencies
 */
import videojs from 'video.js';

function formatTime( seconds ) {
	const minutes = Math.floor( seconds / 60 );
	const remainingSeconds = seconds % 60;
	return `${ minutes }:${ remainingSeconds.toString().padStart( 2, '0' ) }`;
}

document.addEventListener( 'DOMContentLoaded', function() {
	const videoPlayer = videojs( 'analytics-video', {
		fluid: true,
		mute: true,
		controls: false,
	} );

	const data = [
		1,
		2,
		3,
		4,
		5,
		6,
		7,
		8,
		9,
		10,
		11,
		12,
		13,
		14,
		15,
		16,
		17,
		18,
		19,
		20,
		21,
		22,
		23,
		24,
		25,
		26,
		27,
		28,
		29,
		30,
		31,
		32,
		33,
		34,
		35,
		36,
		37,
		38,
		39,
		40,
		41,
		42,
		43,
		44,
		45,
		46,
		47,
		48,
		49,
		50,
		51,
		52,
		53,
		54,
		55,
		56,
		57,
		58,
		59,
		60,
		61,
		62,
		63,
		64,
		65,
		66,
		67,
		68,
		69,
		70,
		71,
		72,
		73,
		74,
		75,
		76,
		77,
		78,
		79,
		80,
		81,
		82,
		83,
		84,
		85,
		86,
		87,
		88,
		89,
		90,
		91,
		92,
		93,
		94,
		95,
		96,
		97,
		98,
		99,
		100,
		101,
		102,
		103,
		104,
		105,
		106,
		107,
		108,
		109,
		110,
		111,
		112,
		113,
		114,
		115,
		116,
		117,
		118,
		119,
		120,
		121,
		122,
		123,
		124,
		125,
		126,
		127,
		128,
		129,
		130,
		131,
		132,
		133,
		134,
		135,
		136,
		137,
		138,
		139,
		140,
		141,
		142,
		143,
		144,
		145,
		146,
		147,
		148,
		149,
		150,
		151,
		152,
		153,
		154,
		155,
		156,
		157,
		158,
		159,
		160,
		161,
		162,
	];

	function generateHeatmap( data, selector, videoPlayer ) {
		// Chart dimensions
		const margin = { top: 0, right: 0, bottom: 0, left: 0 };
		const width = 640 - margin.left - margin.right;
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

		// const colorScale = d3.scaleSequential(d3.interpolateReds)
		// 	.domain([d3.min(data), d3.max(data)]);

		const colorScale = d3.scaleLinear()
			.domain( [ 0, 100, 200, 400, 700, 1100, 1600, 3000, 4000, 5000 ] ) // Exact breakpoints for sequential scaling
			.range( [
				'#eab308', // Lime with low opacity
				'#f59e0b', // Yellow with medium opacity
				'#f97316', // Orange with higher opacity
				'#dc2626', //  Red with full opacity
				'#991b1b', // Dark red with full opacity
				'#450a0a', // Bold dark red with full opacity
				'#4c1d95',
				'#4c1d95',
				'#3730a3',
			] );

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
						.style( 'left', `${ mouseX + margin.left }px` )
						.style( 'top', `${ margin.top - 52 }px` ) // Fixed above the heatmap
						.html( `<div class="heatmap-tooltip-html">${ value } watches<br>${ formatTime( index ) }</div>` );

					// Update the vertical line
					verticalLine
						.style( 'opacity', 1 )
						.attr( 'x1', xScale( index ) + xScale.bandwidth() / 2 )
						.attr( 'x2', xScale( index ) + xScale.bandwidth() / 2 );

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
		const width = 640 - margin.left - margin.right;
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
						.style( 'left', `${ xScale( index ) + 8 }px` )
						.style( 'top', `${ yScale( value ) + margin.top - 20 }px` )
						.html( `${ formatTime( index ) }<br>${ value } watches` );

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

	generateLineChart( data, '#line-chart', videoPlayer );
	generateHeatmap( data, '#heatmap', videoPlayer );
} );

