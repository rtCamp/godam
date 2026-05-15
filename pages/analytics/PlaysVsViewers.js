/**
 * External dependencies
 */
import React, { useEffect } from 'react';

/**
 * Internal dependencies
 */
import { calculateEngagementRate, calculatePlayRate, singleMetricsChart, ensureAll7Days, calculateTrendPercentage } from './helper';
import './charts.js';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * PlaysVsViewers — combined stat card that replaces the standalone "Total Plays" card.
 * Inherits the sparkline chart and percentage-change badge from SingleMetrics (plays),
 * and adds Unique Viewers and a "Sessions per user" footer.
 *
 * unique_viewers is a deduplicated all-time distinct-person count (Model B).
 * The "Sessions per user" ratio is always plays / uniqueViewers — the industry-standard
 * "Average views per viewer" formula. Never summed across per-video rows.
 *
 * @param {Object}  props
 * @param {string}  [props.mode='analytics']          'analytics' | 'dashboard'
 * @param {number}  props.plays                       Total plays count.
 * @param {number}  props.uniqueViewers               Deduplicated distinct-person count.
 * @param {boolean} [props.showRatio=true]            Whether to render the ratio footer.
 * @param {boolean} [props.isLoading=false]           Show skeleton state when true.
 * @param {Array}   [props.processedAnalyticsHistory] History rows for the sparkline.
 */
const PlaysVsViewers = ( {
	mode = 'analytics',
	plays = 0,
	uniqueViewers = 0,
	showRatio = true,
	isLoading = false,
	processedAnalyticsHistory,
} ) => {
	// Plays / deduplicated unique viewers (industry-standard "avg views per viewer").
	// Guard against division by zero only.
	const sessionsPerUser =
		uniqueViewers > 0
			? ( plays / uniqueViewers ).toFixed( 2 )
			: null;

	const formattedPlays = Number( plays ).toLocaleString();
	const formattedViewers = Number( uniqueViewers ).toLocaleString();

	useEffect( () => {
		if ( ! processedAnalyticsHistory || processedAnalyticsHistory.length === 0 ) {
			return;
		}

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

		const trendPercentage = calculateTrendPercentage( sortedData, 'plays' );

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
							{ __( 'Sessions per user:', 'godam' ) }{ ' ' }
							{ sessionsPerUser !== null ? (
								<strong className="text-zinc-700">{ sessionsPerUser }×</strong>
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

