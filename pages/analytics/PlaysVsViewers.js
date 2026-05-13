/**
 * External dependencies
 */
import React, { useEffect } from 'react';

/**
 * Internal dependencies
 */
import { calculateEngagementRate, calculatePlayRate, singleMetricsChart } from './helper';
import './charts.js';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * PlaysVsViewers — combined stat card that replaces the standalone "Total Plays" card.
 * Inherits the sparkline chart and percentage-change badge from SingleMetrics (plays),
 * and adds Unique Viewers and a Replay Ratio footer.
 *
 * unique_viewers is an all-time distinct-person count, never a daily figure.
 * It must never be summed across date rows for display.
 *
 * replayRatioDenominator:
 * - Per-video page: omit (defaults to uniqueViewers). Ratio = plays / uniqueViewers.
 * - Dashboard: pass total_unique_viewer_engagements = SUM(per-video unique_viewers).
 * This counts unique viewer-video pairs — the correct denominator at account level.
 *
 * @param {Object}  props
 * @param {string}  [props.mode='analytics']          'analytics' | 'dashboard'
 * @param {number}  props.plays                       Total plays count.
 * @param {number}  props.uniqueViewers               Distinct-person count shown in the card.
 * @param {number}  [props.replayRatioDenominator]    Override denominator for ratio math.
 * @param {boolean} [props.showRatio=true]            Whether to render the replay-ratio footer.
 * @param {boolean} [props.isLoading=false]           Show skeleton state when true.
 * @param {Array}   [props.processedAnalyticsHistory] History rows for the sparkline.
 */
const PlaysVsViewers = ( {
	mode = 'analytics',
	plays = 0,
	uniqueViewers = 0,
	replayRatioDenominator,
	showRatio = true,
	isLoading = false,
	processedAnalyticsHistory,
} ) => {
	// Use the explicit denominator when provided (dashboard); otherwise fall back to
	// uniqueViewers (per-video). Both are valid — they answer different questions.
	const denominator = replayRatioDenominator ?? uniqueViewers;

	// Guard against division by zero. The server invariant guarantees plays >= denominator
	// for any well-formed dataset, but we defend at the UI layer too.
	const replayRatio =
		denominator > 0 && plays >= denominator
			? ( plays / denominator ).toFixed( 2 )
			: null;

	const formattedPlays = Number( plays ).toLocaleString();
	const formattedViewers = Number( uniqueViewers ).toLocaleString();

	useEffect( () => {
		if ( ! processedAnalyticsHistory || processedAnalyticsHistory.length === 0 ) {
			return;
		}

		// Ensure all 7 days are present, filling gaps with zeros (same as SingleMetrics).
		const ensureAll7Days = ( dataArray ) => {
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
		};

		let mappedData;
		if ( mode === 'analytics' ) {
			mappedData = processedAnalyticsHistory.map( ( h ) => ( {
				date: h.date,
				plays: parseFloat( h.plays ) || 0,
				engagement_rate: parseFloat( calculateEngagementRate( h.plays, h.video_length, h.play_time ) ) || 0,
				play_rate: parseFloat( calculatePlayRate( h.page_load, h.plays ) ) || 0,
				watch_time: parseFloat( h.play_time ) || 0,
			} ) );
		} else {
			mappedData = processedAnalyticsHistory.map( ( h ) => ( {
				date: h.date,
				plays: parseFloat( h.plays ) || 0,
				engagement_rate: parseFloat( h.avg_engagement ) || 0,
				play_rate: h.play_rate ? parseFloat( h.play_rate * 100 ) : 0,
				watch_time: parseFloat( h.watch_time ) || 0,
				total_videos: parseInt( h.total_videos ) || 0,
			} ) );
		}

		const sortedData = ensureAll7Days( mappedData ).sort(
			( a, b ) => new Date( a.date ) - new Date( b.date ),
		);

		// Calculate percentage change over the last 7 days (same logic as SingleMetrics).
		let trendPercentage = 0;
		if ( sortedData.length >= 2 ) {
			const first = parseFloat( sortedData[ 0 ].plays );
			const last = parseFloat( sortedData[ sortedData.length - 1 ].plays );
			if ( ! isNaN( first ) && ! isNaN( last ) ) {
				if ( first === 0 ) {
					if ( last > 0 ) {
						trendPercentage = 100;
					} else if ( last < 0 ) {
						trendPercentage = -100;
					} else {
						trendPercentage = 0;
					}
				} else {
					trendPercentage = ( ( last - first ) / first ) * 100;
				}
			}
		}

		const changeEl = document.getElementById( 'plays-vs-viewers-change' );
		if ( changeEl ) {
			const rounded = Math.abs( trendPercentage ).toFixed( 2 );
			const prefix = trendPercentage >= 0 ? '+' : '-';
			changeEl.innerText = `${ prefix }${ rounded }%`;
			changeEl.classList.remove( 'change-rise', 'change-drop' );
			changeEl.classList.add( trendPercentage >= 0 ? 'change-rise' : 'change-drop' );
		}

		singleMetricsChart( sortedData, '#single-plays-vs-viewers-chart', 'plays', 7, trendPercentage );
	}, [ processedAnalyticsHistory, plays, mode ] );

	return (
		<div className="analytics-info plays-vs-viewers-card flex justify-between max-lg:flex-col border border-zinc-200 w-full md:w-[calc(50%-0.5rem)] lg:w-full">
			<div className="analytics-single-info">
				<div className="flex justify-between items-center flex-row w-full">
					<div className="analytics-info-heading">
						<p className="text-xs text-[#525252]">{ __( 'Plays / Unique viewers', 'godam' ) }</p>
					</div>
					<p id="plays-vs-viewers-change" className="metric-change">+0%</p>
				</div>

				{ isLoading ? (
					<div className="flex flex-row justify-between gap-2 items-end mt-2">
						<div className="flex flex-col gap-3">
							<div className="flex flex-row items-baseline gap-2">
								<div className="skeleton h-8 w-16"></div>
								<span className="text-zinc-300 text-xl select-none" aria-hidden="true">/</span>
								<div className="skeleton h-8 w-16"></div>
							</div>
							<div className="skeleton h-3 w-32"></div>
						</div>
					</div>
				) : (
					<div className="flex flex-row justify-between gap-2 items-end">
						<div className="flex flex-col gap-2">
							<div className="flex flex-row items-baseline gap-2">
								<span className="single-metrics-value">{ formattedPlays }</span>
								<span className="text-zinc-300 text-xl select-none" aria-hidden="true">/</span>
								<span className="single-metrics-value text-zinc-400">{ formattedViewers }</span>
							</div>
							<div className="flex flex-row gap-6">
								<p className="text-zinc-500 text-xs">{ __( 'Plays', 'godam' ) }</p>
								<p className="text-zinc-500 text-xs">{ __( 'Unique viewers', 'godam' ) }</p>
							</div>
						</div>
						<div className="flex flex-col gap-1 items-end">
							<div id="single-plays-vs-viewers-chart" className="metrics-chart"></div>
							<p className="text-zinc-400 text-[10px]">{ __( 'Last 7 days', 'godam' ) }</p>
						</div>
					</div>
				) }

				{ showRatio && (
					<>
						<p className="text-xs text-zinc-500">
							{ __( 'Replay ratio:', 'godam' ) }{ ' ' }
							{ replayRatio !== null ? (
								<strong className="text-zinc-700">{ replayRatio }×</strong>
							) : (
								<span>—</span>
							) }
						</p>
					</>
				) }
			</div>
		</div>
	);
};

export default PlaysVsViewers;

