/* global d3 */

/**
 * External dependencies
 */
import { useEffect, useRef, useState } from 'react';
/**
 * Internal dependencies
 */
import { useFetchProcessedAnalyticsHistoryQuery } from './redux/api/analyticsApi';
/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

export default function PlaybackPerformanceDashboard( {
	attachmentID,
	initialData,
} ) {
	const chartRef = useRef( null );
	const [ selectedPeriod, setSelectedPeriod ] = useState( '7D' );
	const [ selectedMetrics, setSelectedMetrics ] = useState( [
		'engagement_rate',
		'play_rate',
	] );
	const [ parsedData, setParsedData ] = useState( initialData );

	// useEffect( () => {
	// 	console.log( 'here' );

	// 	setTimeout( () => {
	// 		renderChart();
	// 		setParsedData( initialData );
	// 	}, 500 );
	// }, [] );

	// Get days value from selected period
	const getDaysFromPeriod = ( period ) => {
		switch ( period ) {
			case '7D':
				return 7;
			case '1M':
				return 30;
			case '6M':
				return 180;
			case '1Y':
				return 365;
			case 'All':
				return 730; // Set a large value for "All"
			default:
				return 7;
		}
	};

	// Fetch analytics data based on selected period
	const { data: processedAnalyticsHistory } =
	useFetchProcessedAnalyticsHistoryQuery(
		{
			videoId: attachmentID,
			siteUrl: window.location.origin,
			days: getDaysFromPeriod( selectedPeriod ),
		},
		{ skip: ! attachmentID },
	);

	useEffect( () => {
		const parseDate = d3.timeParse( '%Y-%m-%d' );
		const timeMetricsChartData = ( processedAnalyticsHistory || [] ).map(
			( entry ) => {
				const {
					date,
					page_load: dailyPageLoad,
					play_time: dailyPlayTime,
					video_length: dailyVideoLength,
					plays: dailyPlays,
				} = entry;

				const dailyEngagementRate =
dailyPlays && dailyVideoLength
	? ( dailyPlayTime / ( dailyPlays * dailyVideoLength ) ) * 100
	: 0;

				const dailyPlayRate = dailyPageLoad
					? ( dailyPlays / dailyPageLoad ) * 100
					: 0;

				return {
					date: parseDate( date ),
					engagement_rate: +dailyEngagementRate.toFixed( 2 ),
					play_rate: +dailyPlayRate.toFixed( 2 ),
					watch_time: +dailyPlayTime.toFixed( 2 ),
				};
			},
		);
		setParsedData( timeMetricsChartData );
	}, [ processedAnalyticsHistory, selectedMetrics ] );

	const renderChart = () => {
		if ( ! chartRef.current || ! parsedData ) {
			return;
		}

		const generateDateRange = ( start, end ) => {
			const dates = [];
			const current = new Date( start );
			while ( current <= end ) {
				dates.push( new Date( current ) );
				current.setDate( current.getDate() + 1 );
			}
			return dates;
		};

		let mousex; // Define mousex here

		// Clear previous chart
		d3.select( chartRef.current ).selectAll( '*' ).remove();

		// Set the dimensions and margins of the graph
		const margin = { top: 20, right: 30, bottom: 50, left: 60 },
			width = chartRef.current.clientWidth - margin.left - margin.right,
			height = 300 - margin.top - margin.bottom;

		// Create an SVG element
		const svg = d3
			.select( chartRef.current )
			.append( 'svg' )
			.attr( 'width', width + margin.left + margin.right )
			.attr( 'height', height + margin.top + margin.bottom )
			.append( 'g' )
			.attr( 'transform', `translate(${ margin.left },${ margin.top })` );

		// Parse dates
		// const parseDate = d3.timeParse( '%Y-%m-%d' );
		// const data = parsedData.map( ( d ) => ( {
		// 	date: parseDate( d.date ),
		// 	engagement_rate: +d.engagement_rate,
		// 	play_rate: +d.play_rate,
		// 	watch_time: +d.watch_time,
		// } ) );

		// Filter data based on selected period
		const filterData = ( data, period ) => {
			const today = new Date();
			const cutoffDate = new Date( today );

			switch ( period ) {
				case '7D':
					cutoffDate.setDate( today.getDate() - 7 );
					break;
				case '1M':
					cutoffDate.setMonth( today.getMonth() - 1 );
					break;
				case '6M':
					cutoffDate.setMonth( today.getMonth() - 6 );
					break;
				case '1Y':
					cutoffDate.setFullYear( today.getFullYear() - 1 );
					break;
				case 'All':
				default:
					return data;
			}

			return data.filter( ( d ) => new Date( d.date ) >= cutoffDate );
		};

		const filteredData = filterData( parsedData, selectedPeriod );

		// const filteredData = [
		// 	{
		// 		date: new Date( '2023-05-06T18:30:00.000Z' ),
		// 		engagement_rate: 15.3,
		// 		play_rate: 45.1,
		// 		watch_time: 4.22,
		// 	},
		// 	{
		// 		date: new Date( '2023-07-12T18:30:00.000Z' ),
		// 		engagement_rate: 18.7,
		// 		play_rate: 52.0,
		// 		watch_time: 6.14,
		// 	},
		// 	{
		// 		date: new Date( '2023-09-30T18:30:00.000Z' ),
		// 		engagement_rate: 21.9,
		// 		play_rate: 39.6,
		// 		watch_time: 7.85,
		// 	},
		// 	{
		// 		date: new Date( '2023-12-15T18:30:00.000Z' ),
		// 		engagement_rate: 23.2,
		// 		play_rate: 60.0,
		// 		watch_time: 5.77,
		// 	},
		// 	{
		// 		date: new Date( '2024-03-10T18:30:00.000Z' ),
		// 		engagement_rate: 19.6,
		// 		play_rate: 48.5,
		// 		watch_time: 8.13,
		// 	},
		// 	{
		// 		date: new Date( '2024-07-01T18:30:00.000Z' ),
		// 		engagement_rate: 17.2,
		// 		play_rate: 50.0,
		// 		watch_time: 6.25,
		// 	},
		// 	{
		// 		date: new Date( '2024-10-18T18:30:00.000Z' ),
		// 		engagement_rate: 20.4,
		// 		play_rate: 55.3,
		// 		watch_time: 9.02,
		// 	},
		// 	{
		// 		date: new Date( '2025-01-22T18:30:00.000Z' ),
		// 		engagement_rate: 22.1,
		// 		play_rate: 63.9,
		// 		watch_time: 10.54,
		// 	},
		// 	{
		// 		date: new Date( '2025-04-30T18:30:00.000Z' ),
		// 		engagement_rate: 24.7,
		// 		play_rate: 70.2,
		// 		watch_time: 11.76,
		// 	},
		// 	// New data points in April 2025
		// 	{
		// 		date: new Date( '2025-04-10T18:30:00.000Z' ),
		// 		engagement_rate: 23.5,
		// 		play_rate: 68.9,
		// 		watch_time: 10.87,
		// 	},
		// 	{
		// 		date: new Date( '2025-04-18T18:30:00.000Z' ),
		// 		engagement_rate: 25.1,
		// 		play_rate: 72.4,
		// 		watch_time: 12.34,
		// 	},
		// ];

		const startDate = d3.min( filteredData, ( d ) => d.date );
		const endDate = d3.max( filteredData, ( d ) => d.date );
		const allDates = generateDateRange( startDate, endDate );

		const completeData = allDates.map( ( date ) => {
			const match = filteredData.find(
				( d ) => d.date.getTime() === date.getTime(),
			);
			return (
				match || {
					date: new Date( date ),
					engagement_rate: 0,
					play_rate: 0,
					watch_time: 0,
				}
			);
		} );

		// Create X axis (Time)
		const x = d3
			.scaleTime()
			.domain( d3.extent( completeData, ( d ) => d.date ) )
			.range( [ 0, width ] );

		// 	const tickFormat =
		//   selectedPeriod === '7D' || selectedPeriod === '1M' ? d3.timeFormat( '%b %d' ) : d3.timeFormat( '%b' );

		let tickValues, xTickFormat;

		// Calculate number of days in the dataset
		const dateRangeInDays =
      ( d3.max( completeData, ( d ) => d.date ) -
        d3.min( completeData, ( d ) => d.date ) ) /
      ( 1000 * 60 * 60 * 24 );

		if ( dateRangeInDays > 31 ) {
			// Show ticks for each unique month
			const uniqueMonths = Array.from(
				new Set(
					completeData.map( ( d ) => {
						const date = new Date( d.date );
						return new Date( date.getFullYear(), date.getMonth(), 1 ).getTime();
					} ),
				),
			).map( ( ts ) => new Date( parseInt( ts ) ) );

			tickValues = uniqueMonths;
			xTickFormat = ( d ) => {
				const month = d3.timeFormat( '%b' )( d ); // "Jan", "Feb", etc.
				const year = d.getFullYear();

				// If it's January, append the year
				if ( month === 'Jan' ) {
					return `${ month } '${ String( year ).slice( -2 ) }`; // Example: Jan '24
				}

				return month;
			};
		} else {
			// Show daily ticks with full date
			tickValues = completeData.map( ( d ) => d.date );
			xTickFormat = d3.timeFormat( '%b %d' ); // e.g., Jan 12
		}
		// Add X axis with month name
		svg
			.append( 'g' )
			.attr( 'transform', `translate(0, ${ height })` )
			.call( d3.axisBottom( x ).tickValues( tickValues ).tickFormat( xTickFormat ) )
			.selectAll( 'text' )
			.style( 'fill', '#71717a' );

		svg.selectAll( '.domain' )
			.style( 'stroke', '#71717a' ); // Set axis line color to zinc-500

		// Add month name in center
		// svg
		// 	.append( 'text' )
		// 	.attr( 'x', width / 2 )
		// 	.attr( 'y', height + 40 )
		// 	.attr( 'text-anchor', 'middle' )
		// 	.text( 'April' )
		// 	.attr( 'fill', '#333' )
		// 	.attr( 'font-family', 'Arial, sans-serif' )
		// 	.attr( 'font-size', '14px' );

		// // Add left arrow
		// svg
		// 	.append( 'text' )
		// 	.attr( 'x', width / 2 - 60 )
		// 	.attr( 'y', height + 40 )
		// 	.attr( 'text-anchor', 'middle' )
		// 	.text( '←' )
		// 	.attr( 'fill', '#333' )
		// 	.attr( 'font-family', 'Arial, sans-serif' )
		// 	.attr( 'font-size', '14px' )
		// 	.attr( 'cursor', 'pointer' );

		// // Add right arrow
		// svg
		// 	.append( 'text' )
		// 	.attr( 'x', width / 2 + 60 )
		// 	.attr( 'y', height + 40 )
		// 	.attr( 'text-anchor', 'middle' )
		// 	.text( '→' )
		// 	.attr( 'fill', '#333' )
		// 	.attr( 'font-family', 'Arial, sans-serif' )
		// 	.attr( 'font-size', '14px' )
		// 	.attr( 'cursor', 'pointer' );

		const vertical = svg
			.append( 'line' )
			.attr( 'class', 'vertical-line' )
			.attr( 'y1', 0 )
			.attr( 'y2', height )
			.attr( 'stroke', '#aaa' )
			.attr( 'stroke-width', 1 )
			.attr( 'stroke-dasharray', '4 2' )
			.style( 'opacity', 0 );

		// Find the maximum value across all selected metrics
		const maxValue = d3.max( filteredData, ( d ) => {
			return d3.max( selectedMetrics.map( ( metric ) => d[ metric ] ) );
		} );

		// Create Y axis with some padding
		const y = d3
			.scaleLinear()
			.domain( [ 0, maxValue * 1.1 ] )
			.range( [ height, 0 ] );

		svg
			.append( 'g' )
			.call( d3.axisLeft( y ) )
			.selectAll( 'text' )
			.style( 'fill', '#71717a' );

		svg
			.append( 'text' )
			.attr( 'transform', 'rotate(-90)' )
			.attr( 'y', -50 )
			.attr( 'x', -height / 2 )
			.attr( 'dy', '1em' )
			.attr( 'text-anchor', 'middle' )
			.text( __( 'Performance', 'godam' ) )
			.style( 'fill', '#71717a' )
			.style( 'font-family', 'sans-serif' )
			.style( 'font-size', '12px' );

		// Define color scale for different metrics
		const colorScale = d3
			.scaleOrdinal()
			.domain( [ 'engagement_rate', 'play_rate' ] )
			.range( [ '#9333EA', '#5CC8BE' ] );

		// Create a tooltip div
		const tooltip = d3
			.select( 'body' )
			.append( 'div' )
			.attr( 'id', 'chart-tooltip' )
			.style( 'position', 'absolute' )
			.style( 'background', 'white' )
			.style( 'border', '1px solid #ddd' )
			.style( 'border-radius', '5px' )
			.style( 'padding', '10px' )
			.style( 'box-shadow', '0 0 10px rgba(0,0,0,0.1)' )
			.style( 'pointer-events', 'none' )
			.style( 'opacity', 0 )
			.style( 'min-width', 300 )
			.style( 'z-index', 1000 );

		// Add a vertical dotted line for April 19
		// const april19 = parseDate( '2025-04-19' );
		// if ( filteredData.some( ( d ) => d.date.getTime() === april19.getTime() ) ) {
		// 	svg
		// 		.append( 'line' )
		// 		.attr( 'x1', x( april19 ) )
		// 		.attr( 'x2', x( april19 ) )
		// 		.attr( 'y1', 0 )
		// 		.attr( 'y2', height )
		// 		.attr( 'stroke', '#999' )
		// 		.attr( 'stroke-width', 1 )
		// 		.attr( 'stroke-dasharray', '3,3' );
		// }

		// Add area and line for each selected metric
		selectedMetrics.forEach( ( metric ) => {
			const color = colorScale( metric );

			// Add filled area
			const area = d3
				.area()
				.x( ( d ) => x( d.date ) )
				.y0( height )
				.y1( ( d ) => y( d[ metric ] ) );

			svg
				.append( 'path' )
				.datum( filteredData )
				.attr( 'fill', color )
				.attr( 'fill-opacity', 0.2 )
				.attr( 'd', area );

			// Add the line
			const line = d3
				.line()
				.x( ( d ) => x( d.date ) )
				.y( ( d ) => y( d[ metric ] ) );

			svg
				.append( 'path' )
				.datum( filteredData )
				.attr( 'fill', 'none' )
				.attr( 'stroke', color )
				.attr( 'stroke-width', 2 )
				.attr( 'd', line );

			// Add dots for data points
			svg
				.selectAll( `.dot-${ metric }` )
				.data( filteredData )
				.enter()
				.append( 'circle' )
				.attr( 'class', `dot-${ metric }` )
				.attr( 'cx', ( d ) => x( d.date ) )
				.attr( 'cy', ( d ) => y( d[ metric ] ) )
				.attr( 'r', 4 )
				.attr( 'fill', color )
				.attr( 'stroke', 'white' )
				.attr( 'stroke-width', 1 )
				.on( 'mouseover', function( event, d ) {
					const unit = '%';

					tooltip
						.style( 'opacity', 1 )
						.html(
							`
              <div class="text-zinc-500">
                ${ d.date.getDate() } ${ d.date.toLocaleString( 'default', { month: 'short' } ) } ${ d.date.getFullYear() }
              </div>
              <hr />
				<div class="flex flex-col min-w-[250px]">
					<div class="flex justify-between items-center h-9">
						<div class="flex items-center gap-2">
							<span style="color: #9333EA">●</span> 
							<p class="text-zinc-500">Engagement Rate</p>
						</div>
						<span class="text-zinc-950 font-medium">${ d.engagement_rate.toFixed( 2 ) }${ unit }</span>
					</div>
					<div class="flex justify-between items-center h-9">
						<div class="flex items-center gap-2">
							<span style="color: #5CC8BE">●</span> 
							<p class="text-zinc-500">Play Rate</p>
						</div>
						<span class="text-zinc-950 font-medium">${ d.play_rate.toFixed( 2 ) }${ unit }</span>
					</div>
				</div>

            `,
						)
						.style( 'left', event.pageX + 10 + 'px' )
						.style( 'top', event.pageY - 30 + 'px' );

					d3.select( this ).attr( 'r', 6 ).attr( 'stroke-width', 2 );

					const [ mouseX ] = d3.pointer( event );
					mousex = mouseX + 5;
					vertical.style( 'left', mousex + 'px' );
					vertical.style( 'opacity', 1 );
				} )
				.on( 'mouseout', function() {
					tooltip.style( 'opacity', 0 );
					d3.select( this ).attr( 'r', 4 ).attr( 'stroke-width', 1 );
					vertical.style( 'opacity', 0 );
				} )
				.on( 'mousemove', function() {
					// mousex = d3.mouse( this );
					// mousex = mousex[ 0 ] + 5;
					// vertical.style( 'left', mousex + 'px' );
					const [ mouseX ] = d3.pointer( event );
					vertical.attr( 'x1', mouseX ).attr( 'x2', mouseX );
				} );
		} );
	};
	// Handle metric toggling
	const toggleMetric = ( metric ) => {
		if ( selectedMetrics.includes( metric ) ) {
			if ( selectedMetrics.length > 1 ) {
				setSelectedMetrics( selectedMetrics.filter( ( m ) => m !== metric ) );
			}
		} else {
			setSelectedMetrics( [ ...selectedMetrics, metric ] );
		}
	};

	useEffect( () => {
		const interval = setInterval( () => {
			if ( parsedData && parsedData.length > 0 && chartRef.current ) {
				clearInterval( interval );
				renderChart();
			}
		}, 500 );
		return () => {
			clearInterval( interval );
			d3.select( '#chart-tooltip' ).remove();
		};
	}, [ selectedPeriod, selectedMetrics, parsedData ] );

	// useEffect( () => {
	// 	const handleResize = () => {
	// 		renderChart();
	// 	};

	// 	window.addEventListener( 'resize', handleResize );
	// 	return () => window.removeEventListener( 'resize', handleResize );
	// }, [ selectedPeriod, selectedMetrics, parsedData ] );

	return (
		<div className="w-full border rounded-lg p-4 shadow-sm h-[400px]">
			<div className="flex justify-between items-center mb-6">
				<h2 className="text-base font-bold text-gray-800">
					Playback Performance
				</h2>
				<div className="flex items-center gap-4">
					<div className="flex items-center">
						<button
							className={ `flex items-center gap-1 rounded-md bg-transparent` }
							onClick={ () => toggleMetric( 'engagement_rate' ) }
						>
							<div
								className={ `w-4 h-4 rounded ${
									selectedMetrics.includes( 'engagement_rate' )
										? 'bg-[#AB3A6C]'
										: 'bg-gray-300'
								} flex items-center justify-center` }
							>
								{ selectedMetrics.includes( 'engagement_rate' ) && (
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="10"
										height="10"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="3"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="text-white"
									>
										<polyline points="20 6 9 17 4 12"></polyline>
									</svg>
								) }
							</div>
							<span className="whitespace-nowrap">Engagement Rate</span>
						</button>

						<button
							className={ `flex items-center gap-1 rounded-md bg-transparent` }
							onClick={ () => toggleMetric( 'play_rate' ) }
						>
							<div
								className={ `w-4 h-4 rounded ${
									selectedMetrics.includes( 'play_rate' )
										? 'bg-[#AB3A6C]'
										: 'bg-gray-300'
								} flex items-center justify-center` }
							>
								{ selectedMetrics.includes( 'play_rate' ) && (
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="10"
										height="10"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="3"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="text-white"
									>
										<polyline points="20 6 9 17 4 12"></polyline>
									</svg>
								) }
							</div>
							<span className="whitespace-nowrap">Play Rate</span>
						</button>
					</div>

					<div className="flex gap-1">
						<button
							className={ `px-3 py-1 rounded-md cursor-pointer ${ selectedPeriod === 'All' ? 'bg-[#AB3A6C1A] text-[#AB3A6C]' : 'bg-zinc-50' }` }
							onClick={ () => setSelectedPeriod( 'All' ) }
						>
							All
						</button>
						<button
							className={ `px-3 py-1 rounded-md cursor-pointer ${ selectedPeriod === '7D' ? 'bg-[#AB3A6C1A] text-[#AB3A6C]' : 'bg-zinc-50' }` }
							onClick={ () => setSelectedPeriod( '7D' ) }
						>
							7D
						</button>
						<button
							className={ `px-3 py-1 rounded-md cursor-pointer ${ selectedPeriod === '1M' ? 'bg-[#AB3A6C1A] text-[#AB3A6C]' : 'bg-zinc-50' }` }
							onClick={ () => setSelectedPeriod( '1M' ) }
						>
							1M
						</button>
						<button
							className={ `px-3 py-1 rounded-md cursor-pointer ${ selectedPeriod === '6M' ? 'bg-[#AB3A6C1A] text-[#AB3A6C]' : 'bg-zinc-50' }` }
							onClick={ () => setSelectedPeriod( '6M' ) }
						>
							6M
						</button>
						<button
							className={ `px-3 py-1 rounded-md cursor-pointer ${ selectedPeriod === '1Y' ? 'bg-[#AB3A6C1A] text-[#AB3A6C]' : 'bg-zinc-50' }` }
							onClick={ () => setSelectedPeriod( '1Y' ) }
						>
							1Y
						</button>
					</div>
				</div>
			</div>

			<div className="w-full" style={ { height: '300px' } } ref={ chartRef }></div>
		</div>
	);
}
