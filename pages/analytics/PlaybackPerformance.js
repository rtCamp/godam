/* global d3 */

/**
 * External dependencies
 */
import { useEffect, useRef, useState } from 'react';
/**
 * Internal dependencies
 */
import { useFetchProcessedAnalyticsHistoryQuery } from './redux/api/analyticsApi';
import { useFetchDashboardMetricsHistoryQuery } from '../dashboard/redux/api/dashboardAnalyticsApi';
/**
 * WordPress dependencies
 */
import { __, _x } from '@wordpress/i18n';

export default function PlaybackPerformanceDashboard( {
	attachmentID,
	initialData,
	mode = 'analytics',
} ) {
	const chartRef = useRef( null );
	const [ selectedPeriod, setSelectedPeriod ] = useState( '7D' );
	const [ selectedMetrics, setSelectedMetrics ] = useState( [
		'engagement_rate',
		'play_rate',
	] );
	const [ parsedData, setParsedData ] = useState( initialData ); // Stores formatted data.

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
	const dashboardHistoryResult = useFetchDashboardMetricsHistoryQuery(
		{
			days: getDaysFromPeriod( selectedPeriod ),
			siteUrl: window.location.origin,
		},
		{ skip: mode !== 'dashboard' },
	);

	const analyticsHistoryResult = useFetchProcessedAnalyticsHistoryQuery(
		{
			videoId: attachmentID,
			siteUrl: window.location.origin,
			days: getDaysFromPeriod( selectedPeriod ),
		},
		{ skip: mode === 'dashboard' || ! attachmentID },
	);

	// Then pick the right one based on mode
	const processedAnalyticsHistory =
		mode === 'dashboard'
			? dashboardHistoryResult.data
			: analyticsHistoryResult.data;

	// Format data response for chart.
	useEffect( () => {
		const parseDate = d3.timeParse( '%Y-%m-%d' );
		const timeMetricsChartData = ( processedAnalyticsHistory || [] ).map(
			( entry ) => {
				const date = parseDate( entry.date );

				if ( mode === 'dashboard' ) {
					return {
						date,
						engagement_rate: +entry.avg_engagement?.toFixed( 2 ) || 0,
						play_rate: +( entry.play_rate * 100 || 0 ).toFixed( 2 ),
						watch_time: +( entry.watch_time || 0 ).toFixed( 2 ),
					};
				}

				const {
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
					date,
					engagement_rate: +dailyEngagementRate.toFixed( 2 ),
					play_rate: +dailyPlayRate.toFixed( 2 ),
					watch_time: +dailyPlayTime.toFixed( 2 ),
				};
			},
		);
		setParsedData( timeMetricsChartData );
	}, [ processedAnalyticsHistory, selectedMetrics, mode ] );

	const renderChart = () => {
		if ( ! chartRef.current || ! parsedData ) {
			return;
		}

		// For discontinous data, we generate dates between the range for continuous range render.
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

		// Filter data based on selected period
		const filterData = ( data, period ) => {
			const now = new Date();
			const today = new Date( now.getFullYear(), now.getMonth(), now.getDate() );
			let cutoffDate = new Date( today );

			switch ( period ) {
				case '7D':
					cutoffDate.setDate( today.getDate() - 6 ); // 6 days ago + today = 7 days
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
					// For "All", use the earliest date in data if available
					if ( data && data.length > 0 ) {
						cutoffDate = d3.min( data, ( d ) => d.date );
					}
					return data;
			}

			return data.filter( ( d ) => new Date( d.date ) >= cutoffDate );
		};

		const filteredData = filterData( parsedData, selectedPeriod );

		// Calculate date range based on the selected period, not just the available data
		const now = new Date();
		const today = new Date( now.getFullYear(), now.getMonth(), now.getDate() );
		let startDate;

		if ( selectedPeriod === 'All' && filteredData.length > 0 ) {
			startDate = d3.min( filteredData, ( d ) => d.date );
		} else {
			// Calculate start date based on period to ensure all days are included
			startDate = new Date( today );
			switch ( selectedPeriod ) {
				case '7D':
					startDate.setDate( today.getDate() - 6 ); // 6 days ago + today = 7 days
					break;
				case '1M':
					startDate.setMonth( today.getMonth() - 1 );
					break;
				case '6M':
					startDate.setMonth( today.getMonth() - 6 );
					break;
				case '1Y':
					startDate.setFullYear( today.getFullYear() - 1 );
					break;
			}
		}

		const endDate = today; // Always end at today

		const allDates = generateDateRange( startDate, endDate );

		// For discontinuous data, after the dates are generated, for dates with no data, add a 0 value.
		const completeData = allDates?.map( ( date ) => {
			const match = filteredData?.find(
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
					return `${ month } '${ String( year ).slice( -2 ) }`;
				}

				return month;
			};
		} else if ( dateRangeInDays > 10 && dateRangeInDays <= 31 ) {
			// Show tick for each day
			tickValues = completeData.map( ( d ) => new Date( d.date ) );

			xTickFormat = ( d ) => {
				const date = new Date( d );
				const day = date.getDate();
				const month = d3.timeFormat( '%b' )( date ); // e.g., "Apr"

				if ( day === 1 ) {
					return `${ month } ${ day }`;
				}

				return `${ day }`;
			};
		} else {
			// Show daily ticks with full date
			tickValues = completeData.map( ( d ) => d.date );
			xTickFormat = d3.timeFormat( '%b %d' ); // e.g., Jan 12
		}

		// Add X axis.
		const xAxis = svg
			.append( 'g' )
			.attr( 'transform', `translate(0, ${ height })` )
			.call( d3.axisBottom( x ).tickValues( tickValues ).tickFormat( xTickFormat ) )
			.selectAll( 'text' )
			.style( 'fill', '#71717a' );

		svg.selectAll( '.domain' ).style( 'stroke', '#71717a' ); // Set axis line color to zinc-500

		if ( dateRangeInDays > 31 ) {
			//if date range is greater than 31 days, vertically place the month to prevent tick clustering.
			xAxis
				.style( 'text-anchor', 'end' )
				.attr( 'dx', '-0.85em' ) // small shift right
				.attr( 'dy', '-1em' ) // slight vertical nudge
				.attr( 'transform', 'rotate(-90)' );
		}

		// Adds a vertical axis when tooltip is hovered over.
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
		const maxValue = d3.max( completeData, ( d ) => {
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
				.datum( completeData )
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
				.datum( completeData )
				.attr( 'fill', 'none' )
				.attr( 'stroke', color )
				.attr( 'stroke-width', 2 )
				.attr( 'd', line );

			// Add dots for data points - always render them to show all days including zeros
			svg
				.selectAll( `.dot-${ metric }` )
				.data( completeData )
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
							<p class="text-zinc-500">${ __( 'Engagement Rate', 'godam' ) }</p>
						</div>
						<span class="text-zinc-950 font-medium">${ d.engagement_rate.toFixed( 2 ) }${ unit }</span>
					</div>
					<div class="flex justify-between items-center h-9">
						<div class="flex items-center gap-2">
							<span style="color: #5CC8BE">●</span>
							<p class="text-zinc-500">${ __( 'Play Rate', 'godam' ) }</p>
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

	useEffect( () => {
		if ( ! chartRef.current ) {
			return;
		}

		const resizeObserver = new ResizeObserver( () => {
			if ( parsedData && parsedData.length > 0 ) {
				// Small delay to ensure the DOM has updated.
				setTimeout( () => renderChart(), 20 );
			}
		} );

		resizeObserver.observe( chartRef.current );

		return () => {
			resizeObserver.disconnect();
		};
	}, [ parsedData, selectedMetrics, selectedPeriod ] );

	return (
		<div className="w-full border rounded-lg p-4 shadow-sm h-[400px]">
			<div className="flex flex-col justify-between gap-2 lg:gap-8 lg:flex-row lg:w-full">
				<h2 className="text-base font-bold text-gray-800 m-0 whitespace-nowrap">
					{ __( 'Playback Performance', 'godam' ) }
				</h2>
				<div className="flex gap-4 flex-col">
					<div className="flex">
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
							<span className="whitespace-nowrap">{ __( 'Engagement Rate', 'godam' ) }</span>
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
							<span className="whitespace-nowrap">{ __( 'Play Rate', 'godam' ) }</span>
						</button>
					</div>

					<div className="flex gap-1 text-sm">
						<button
							className={ `px-3 py-1 rounded-md cursor-pointer ${ selectedPeriod === 'All' ? 'bg-[#AB3A6C1A] text-[#AB3A6C]' : 'bg-zinc-50' }` }
							onClick={ () => setSelectedPeriod( 'All' ) }
						>
							{ _x( 'All', 'All time period', 'godam' ) }
						</button>
						<button
							className={ `px-3 py-1 rounded-md cursor-pointer ${ selectedPeriod === '7D' ? 'bg-[#AB3A6C1A] text-[#AB3A6C]' : 'bg-zinc-50' }` }
							onClick={ () => setSelectedPeriod( '7D' ) }
						>
							{ _x( '7D', '7 days period', 'godam' ) }
						</button>
						<button
							className={ `px-3 py-1 rounded-md cursor-pointer ${ selectedPeriod === '1M' ? 'bg-[#AB3A6C1A] text-[#AB3A6C]' : 'bg-zinc-50' }` }
							onClick={ () => setSelectedPeriod( '1M' ) }
						>
							{ _x( '1M', '1 month period', 'godam' ) }
						</button>
						<button
							className={ `px-3 py-1 rounded-md cursor-pointer ${ selectedPeriod === '6M' ? 'bg-[#AB3A6C1A] text-[#AB3A6C]' : 'bg-zinc-50' }` }
							onClick={ () => setSelectedPeriod( '6M' ) }
						>
							{ _x( '6M', '6 months period', 'godam' ) }
						</button>
						<button
							className={ `px-3 py-1 rounded-md cursor-pointer ${ selectedPeriod === '1Y' ? 'bg-[#AB3A6C1A] text-[#AB3A6C]' : 'bg-zinc-50' }` }
							onClick={ () => setSelectedPeriod( '1Y' ) }
						>
							{ _x( '1Y', '1 year period', 'godam' ) }
						</button>
					</div>
				</div>
			</div>

			<div className="w-full" style={ { height: '300px', overflow: 'none',
				width: '100%' } } ref={ chartRef }></div>
		</div>
	);
}
