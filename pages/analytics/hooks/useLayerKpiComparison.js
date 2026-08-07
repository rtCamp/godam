/**
 * External dependencies
 */
import { useMemo } from 'react';

/**
 * Internal dependencies
 */
import {
	useFetchAnalyticsDataQuery,
	useFetchProcessedLayerAnalyticsQuery,
} from '../redux/api/analyticsApi';
import { groupRows, indexActiveConfig, readActiveLayerConfig } from './useVideoLayerData';
import { buildLayerKpis } from '../timeline/layerKpis';
import {
	parseRetentionArray,
	percentDelta,
	previousRange,
	spanLengthInDays,
} from '../timeline/reach';

/**
 * Period-over-period deltas for the layer panel that is currently open.
 *
 * The layer endpoint has no `%change` field of its own (godam-analytics #234
 * added period-over-period only to the dashboard KPIs), so the comparison is
 * computed here from a second read of the previous equal-length window.
 *
 * Scoped to the **selected** layer on purpose. `useVideoLayerData` already fires
 * one request per layer type; fetching a previous window for all five would
 * double a five-request fan-out behind a proxy with a bounded timeout, to
 * produce numbers that are only ever visible inside one open panel. So this
 * fetches exactly two things, and only while a panel is open: the previous
 * window for that layer's type, and the previous window's retention array for
 * the reach delta.
 *
 * Returns nulls (which hide the badges) rather than zeros whenever a comparison
 * is not available: an All Time range has no previous window, and a layer that
 * did not exist in the previous window has no previous row.
 *
 * @param {Object}        params
 * @param {number|string} params.videoId     WP attachment ID.
 * @param {string}        params.siteUrl     site_url query param.
 * @param {Object|null}   params.layer       Selected parent layer entry from useVideoLayerData.
 * @param {Object}        params.range       Current range: { startDate, endDate }.
 * @param {Object|null}   params.currentKpis buildLayerKpis() result for the current range.
 * @return {{reachDelta:number|null, primaryDelta:number|null, spanDays:number|null, isLoading:boolean}} Deltas.
 */
export function useLayerKpiComparison( {
	videoId,
	siteUrl,
	layer,
	range,
	currentKpis,
} ) {
	const previous = useMemo( () => previousRange( range || {} ), [ range ] );
	const layerType = layer?.layer_type || null;
	const layerId = layer?.id || null;

	// One extra layer-type read, and one extra payload read for the reach
	// baseline. Both skipped entirely at All Time (no previous window) and
	// whenever no panel is open.
	const skip = ! videoId || ! previous || ! layerType;

	const previousLayers = useFetchProcessedLayerAnalyticsQuery(
		{
			layerType,
			startDate: previous?.startDate,
			endDate: previous?.endDate,
			siteUrl,
			videoId,
		},
		{ skip },
	);

	const previousAnalytics = useFetchAnalyticsDataQuery(
		{
			videoId,
			siteUrl,
			startDate: previous?.startDate,
			endDate: previous?.endDate,
		},
		{ skip },
	);

	const spanDays = useMemo( () => {
		if ( ! previous ) {
			return null;
		}
		const [ y, m, d ] = previous.startDate.split( '-' ).map( Number );
		const [ ey, em, ed ] = previous.endDate.split( '-' ).map( Number );
		return spanLengthInDays(
			new Date( y, m - 1, d ),
			new Date( ey, em - 1, ed ),
		);
	}, [ previous ] );

	const previousKpis = useMemo( () => {
		if ( skip || ! layerId ) {
			return null;
		}
		const rows = previousLayers.data?.layer_analytics?.individual_layers;
		if ( ! Array.isArray( rows ) || rows.length === 0 ) {
			return null;
		}

		// Reuse the same grouping the current window goes through, so the
		// previous counts are derived identically (parent aggregation,
		// sub-hotspot folding, no_action) and the delta compares like with like.
		const configIndex = indexActiveConfig( readActiveLayerConfig() );
		const grouped = groupRows( rows, layerType, configIndex );
		const match = grouped.find( ( entry ) => entry.id === layerId );
		if ( ! match ) {
			return null;
		}

		return buildLayerKpis( {
			layerType,
			counts: match.counts,
			noAction: match.no_action,
			retentionArray: parseRetentionArray(
				previousAnalytics.data?.all_time_heatmap,
			),
			// The layer's position in the previous window, not today's: a layer
			// that was moved should be compared where it actually sat then.
			timestamp: match.timestamp,
		} );
	}, [
		skip,
		layerId,
		layerType,
		previousLayers.data,
		previousAnalytics.data,
	] );

	return {
		reachDelta: percentDelta(
			currentKpis?.donut?.reach,
			previousKpis?.donut?.reach,
		),
		primaryDelta: percentDelta(
			currentKpis?.primary?.value,
			previousKpis?.primary?.value,
		),
		spanDays,
		isLoading: ! skip && ( previousLayers.isFetching || previousAnalytics.isFetching ),
	};
}

export default useLayerKpiComparison;
