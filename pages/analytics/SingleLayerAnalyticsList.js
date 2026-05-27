/**
 * External dependencies
 */
import React, { useEffect, useMemo } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useFetchProcessedLayerAnalyticsQuery } from './redux/api/analyticsApi';
import { layerAnalyticsBarChart } from './helper.js';

/**
 * Color thresholds for the conversion-rate label.
 *
 * Final values are likely to come back tuned by marketing, but these are
 * reasonable defaults: red below 5%, amber 5–15%, green above 15%. Anything
 * above 100% (which the new dedupe semantics should make impossible) shows
 * green — defensive, not a target.
 *
 * @param {number} ratePct Conversion rate as a percentage (0–100).
 * @return {string} Tailwind text-color class.
 */
function getConversionColorClass( ratePct ) {
	if ( ratePct < 5 ) {
		return 'text-red-600';
	}
	if ( ratePct <= 15 ) {
		return 'text-amber-500';
	}
	return 'text-green-600';
}

/**
 * Human-readable label for an action_type key.
 *
 * @param {string} actionKey 'clicked', 'submitted', 'hovered', 'skipped', 'viewed'.
 * @return {string} Localized label.
 */
function actionLabel( actionKey ) {
	const labels = {
		viewed: __( 'Views', 'godam' ),
		clicked: __( 'Clicks', 'godam' ),
		submitted: __( 'Submissions', 'godam' ),
		hovered: __( 'Hovers', 'godam' ),
		skipped: __( 'Skips', 'godam' ),
	};
	return labels[ actionKey ] || actionKey;
}

/**
 * Action types shown in the right-hand summary cards per layer type.
 *
 * 'viewed' is the conversion denominator; it gets its own dedicated card so
 * we don't repeat it inside the action list. Conversion rate is computed
 * server-side and rendered separately.
 *
 * @param {string} layerType 'cta', 'form', 'hotspot', 'woo'.
 * @return {string[]} Action keys to show as cards.
 */
function summaryActionsFor( layerType ) {
	const map = {
		cta: [ 'clicked', 'skipped' ],
		form: [ 'submitted', 'skipped' ],
		hotspot: [ 'clicked', 'hovered', 'skipped' ],
		woo: [ 'clicked', 'hovered' ],
	};
	return map[ layerType ] || [];
}

/**
 * SingleLayerAnalyticsList
 *
 * Renders the per-layer breakdown for a single layer-type tab (CTA, Form,
 * Hotspot, Woo). Talks to /wp-json/godam/v1/analytics/layer-analytics
 * via RTK Query. Groups sub-hotspot rows (`<parent>::<sub>`) under their
 * parent layer using `parent_layer_id` / `parent_layer_name` carried in
 * `layer_metadata` — so a Woo layer with 5 products shows as one parent
 * card with 5 children sorted by conversion rate.
 *
 * @param {Object} props
 * @param {string} props.activeTab    Layer type key — 'cta', 'form', 'hotspot', 'woo'.
 * @param {string} props.dateRange    '7d' | '30d' | '60d' | '1y'.
 * @param {number} props.attachmentID WP attachment ID of the video.
 * @return {JSX.Element} The list + chart + summary cards layout.
 */
const SingleLayerAnalyticsList = ( { activeTab, dateRange, attachmentID } ) => {
	const siteUrl = window.location.origin;
	const layerType = ( activeTab || '' ).toLowerCase();

	const days = useMemo( () => {
		switch ( dateRange ) {
			case '7d':
				return 7;
			case '30d':
				return 30;
			case '60d':
				return 60;
			case '1y':
			default:
				return 365;
		}
	}, [ dateRange ] );

	const { data, isLoading, isFetching } = useFetchProcessedLayerAnalyticsQuery( {
		layerType,
		days,
		siteUrl,
		videoId: attachmentID,
	}, {
		skip: ! attachmentID || ! layerType,
	} );

	const analytics = data?.layer_analytics || null;

	// Memoize the array fields so they have stable identity across renders
	// — the `|| []` fallbacks would otherwise create fresh arrays each call
	// and re-fire downstream useMemo/useEffect hooks every render.
	const individualLayers = useMemo(
		() => analytics?.individual_layers || [],
		[ analytics ],
	);
	const dailyBreakdown = useMemo(
		() => analytics?.daily_breakdown || [],
		[ analytics ],
	);
	const cumulative = analytics?.cumulative || null;
	const summaryActions = useMemo(
		() => summaryActionsFor( layerType ),
		[ layerType ],
	);

	// Group sub-hotspot rows under their parent layer.
	// Composite layer_id pattern: `<parentId>::<subId>`. Parent context is
	// echoed in layer_metadata.parent_layer_id / parent_layer_name so we
	// never have to parse strings.
	const groups = useMemo( () => {
		const byParent = new Map();
		individualLayers.forEach( ( row ) => {
			const parentId = row?.layer_metadata?.parent_layer_id || row.layer_id;
			const parentName =
				row?.layer_metadata?.parent_layer_name ||
				row.layer_name ||
				'';

			if ( ! byParent.has( parentId ) ) {
				byParent.set( parentId, {
					parentId,
					parentName,
					rows: [],
				} );
			}
			byParent.get( parentId ).rows.push( row );
		} );

		// Sort children by conversion_rate descending — surfaces the winners first.
		byParent.forEach( ( group ) => {
			group.rows.sort(
				( a, b ) => ( b.conversion_rate || 0 ) - ( a.conversion_rate || 0 ),
			);
		} );

		// Sort parents by their best child's conversion rate descending.
		return Array.from( byParent.values() ).sort( ( a, b ) => {
			const aTop = a.rows[ 0 ]?.conversion_rate || 0;
			const bTop = b.rows[ 0 ]?.conversion_rate || 0;
			return bTop - aTop;
		} );
	}, [ individualLayers ] );

	// Render the chart whenever daily_breakdown changes.
	useEffect( () => {
		if ( ! Array.isArray( dailyBreakdown ) || dailyBreakdown.length === 0 ) {
			return;
		}
		layerAnalyticsBarChart(
			dailyBreakdown,
			'#layer-analytics-chart',
			dateRange,
			summaryActions,
		);
	}, [ dailyBreakdown, dateRange, summaryActions ] );

	// Loading skeleton (matches the final three-column layout).
	if ( isLoading || isFetching ) {
		return (
			<div className="grid grid-cols-[3fr_3fr_2fr] gap-3 h-[350px] px-6 pb-6">
				<div className="animate-pulse bg-zinc-100 rounded-lg" />
				<div className="animate-pulse bg-zinc-100 rounded-lg" />
				<div className="grid grid-cols-2 gap-3">
					<div className="col-span-2 h-28 animate-pulse bg-zinc-100 rounded-2xl" />
					<div className="h-28 animate-pulse bg-zinc-100 rounded-2xl" />
					<div className="h-28 animate-pulse bg-zinc-100 rounded-2xl" />
				</div>
			</div>
		);
	}

	// Error or empty state.
	if ( data?.errorType ) {
		return (
			<div className="px-6 pb-6">
				<p className="text-sm text-zinc-500 h-[200px] flex items-center justify-center">
					{ data.message || __( 'Unable to load layer analytics.', 'godam' ) }
				</p>
			</div>
		);
	}

	if ( ! analytics || individualLayers.length === 0 ) {
		return (
			<div className="px-6 pb-6">
				<p className="text-sm text-zinc-500 h-[200px] flex items-center justify-center">
					{ __( 'No interactions yet — this layer hasn\'t been shown to viewers in this date range.', 'godam' ) }
				</p>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-[3fr_3fr_2fr] gap-3 h-[350px] px-6 pb-6">
			{ /* Left: parent-layer groups → children */ }
			<div className="overflow-auto pr-2">
				<div className="divide-y divide-zinc-100">
					{ groups.map( ( group ) => (
						<div key={ group.parentId } className="py-3">
							<p className="text-sm font-semibold text-zinc-800">
								{ group.parentName ||
									__( 'Untitled layer', 'godam' ) }
							</p>
							<div className="mt-1 divide-y divide-zinc-50">
								{ group.rows.map( ( row ) => {
									const ratePct = Number( row.conversion_rate ) || 0;
									return (
										<div
											key={ row.layer_id }
											className="py-2 flex justify-between items-start gap-2"
										>
											<div className="min-w-0">
												<p className="text-sm text-zinc-700 truncate">
													{ row.layer_name ||
														row.layer_id }
												</p>
												<p className="text-xs text-zinc-500 mt-0.5">
													{ __( 'Position:', 'godam' ) }{ ' ' }
													<span className="font-medium text-zinc-700">
														{ Number( row.timestamp || 0 ).toFixed( 2 ) }s
													</span>
													{ summaryActions.map(
														( action ) => (
															<span key={ action }>
																{ ' · ' }
																{ actionLabel( action ) }:{ ' ' }
																<span className="font-medium text-zinc-700">
																	{ row[ action ] || 0 }
																</span>
															</span>
														),
													) }
												</p>
											</div>
											<div className="text-right shrink-0">
												<p
													className={ `text-base font-semibold ${ getConversionColorClass( ratePct ) }` }
												>
													{ ratePct.toFixed( 1 ) }%
												</p>
												<p className="text-[10px] uppercase text-zinc-400 tracking-wide">
													{ __( 'Conv. rate', 'godam' ) }
												</p>
											</div>
										</div>
									);
								} ) }
							</div>
						</div>
					) ) }
				</div>
			</div>

			{ /* Middle: daily bar chart */ }
			<div className="overflow-hidden" id="layer-analytics-chart" />

			{ /* Right: cumulative summary cards */ }
			<div className="grid grid-cols-2 gap-3 overflow-auto">
				<div className="col-span-2 rounded-2xl p-6 bg-zinc-50 flex flex-col items-center justify-center">
					<p
						className={ `text-3xl font-bold ${ getConversionColorClass( cumulative?.conversion_rate || 0 ) }` }
					>
						{ Number( cumulative?.conversion_rate || 0 ).toFixed( 1 ) }%
					</p>
					<p className="text-sm text-zinc-500 mt-1">
						{ __( 'Avg. conversion rate', 'godam' ) }
					</p>
				</div>
				{ /* viewed card — always shown so denominator is visible */ }
				<div className="rounded-2xl p-4 bg-green-50 flex flex-col items-center justify-center">
					<p className="text-2xl font-bold text-green-600">
						{ cumulative?.viewed || 0 }
					</p>
					<p className="text-xs text-zinc-500 mt-1 whitespace-nowrap">
						{ __( 'Total Views', 'godam' ) }
					</p>
				</div>
				{ summaryActions.map( ( action ) => (
					<div
						key={ action }
						className="rounded-2xl p-4 bg-green-50 flex flex-col items-center justify-center"
					>
						<p className="text-2xl font-bold text-green-600">
							{ cumulative?.[ action ] || 0 }
						</p>
						<p className="text-xs text-zinc-500 mt-1 whitespace-nowrap">
							{ __( 'Total', 'godam' ) } { actionLabel( action ) }
						</p>
					</div>
				) ) }
			</div>
		</div>
	);
};

export default SingleLayerAnalyticsList;
