/**
 * External dependencies
 */
import { useMemo } from 'react';

/**
 * Internal dependencies
 */
import { useFetchProcessedLayerAnalyticsQuery } from '../redux/api/analyticsApi';
import { LAYER_TYPE_BY_ID } from '../constants/layerTypes';

/**
 * Convert a UI date range key to the integer days parameter the analytics
 * endpoint expects. '1y' is mapped to 365 as a reasonable upper bound.
 *
 * @param {string} dateRange '7d' | '30d' | '90d' | '1y'.
 * @return {number} Days.
 */
function rangeToDays( dateRange ) {
	switch ( dateRange ) {
		case '7d':
			return 7;
		case '30d':
			return 30;
		case '90d':
			return 90;
		case '1y':
		default:
			return 365;
	}
}

/**
 * Parse layer_metadata which the microservice returns as a JSON string
 * (or sometimes a parsed object, depending on transport). Safe — never
 * throws.
 *
 * @param {string|Object} raw Raw layer_metadata field.
 * @return {Object} Parsed metadata or {}.
 */
function parseMetadata( raw ) {
	if ( ! raw ) {
		return {};
	}
	if ( typeof raw === 'object' ) {
		return raw;
	}
	try {
		return JSON.parse( raw );
	} catch ( e ) {
		return {};
	}
}

/**
 * Compute the No Action count for a layer.
 *
 * Definition is uniform across layer types — "viewers who saw the layer
 * but didn't take any observable action." Per-type math differs only
 * because the set of observable actions differs:
 * - Hover-based (Hotspot, Woo): viewed - hovered.
 * (clicked ⊆ hovered and added_to_cart ⊆ hovered by UX, so hover
 * covers all engagement.)
 * - Action-based (CTA, Form, Poll): viewed - (terminal_action + skipped).
 *
 * Bounded ≥ 0 to absorb edge cases (clock skew, dedupe race on the
 * tracker).
 *
 * @param {string} layerType 'cta' | 'form' | 'hotspot' | 'poll' | 'woo'.
 * @param {Object} counts    Action counts for the layer.
 * @return {number} Non-negative integer.
 */
function computeNoAction( layerType, counts ) {
	const v = Number( counts.viewed ) || 0;
	switch ( layerType ) {
		case 'hotspot':
		case 'woo':
			return Math.max( 0, v - ( Number( counts.hovered ) || 0 ) );
		case 'cta':
			return Math.max(
				0,
				v - ( Number( counts.clicked ) || 0 ) - ( Number( counts.skipped ) || 0 ),
			);
		case 'form':
			return Math.max(
				0,
				v - ( Number( counts.submitted ) || 0 ) - ( Number( counts.skipped ) || 0 ),
			);
		case 'poll':
			return Math.max(
				0,
				v - ( Number( counts.voted ) || 0 ) - ( Number( counts.skipped ) || 0 ),
			);
		default:
			return 0;
	}
}

/**
 * Flatten one raw individual_layers row into a counts dict keyed by
 * action_type. The microservice returns counts on the row itself for
 * the conventional actions (viewed, clicked, hovered, etc.).
 *
 * @param {Object} row Microservice row.
 * @return {Object} { viewed, clicked, hovered, ... }
 */
function pluckCounts( row ) {
	return {
		viewed: Number( row.viewed ) || 0,
		clicked: Number( row.clicked ) || 0,
		hovered: Number( row.hovered ) || 0,
		skipped: Number( row.skipped ) || 0,
		submitted: Number( row.submitted ) || 0,
		voted: Number( row.voted ) || 0,
		added_to_cart: Number( row.added_to_cart ) || 0,
	};
}

/**
 * Group the microservice's individual_layers rows into a parent → children
 * tree. Composite layer_id pattern is `<parentId>` (parent / aggregate row)
 * or `<parentId>::<subId>` (sub-hotspot row). The backend's per-parent
 * aggregation pass emits a row at the bare parentId; sub-hotspot rows
 * keep the composite key.
 *
 * @param {Array}  rows      Raw individual_layers rows.
 * @param {string} layerType 'cta' | 'form' | 'hotspot' | 'poll' | 'woo'.
 * @return {Array} Parent layer entries with embedded sub_hotspots[].
 */
function groupRows( rows, layerType ) {
	const meta = LAYER_TYPE_BY_ID[ layerType ];
	if ( ! meta ) {
		return [];
	}

	// First pass: bucket rows by their parent layer id. Atomic layer types
	// (CTA / Form / Poll) have parent_layer_id absent from layer_metadata;
	// treat the row's own layer_id as the parent.
	const byParent = new Map();
	rows.forEach( ( row ) => {
		const md = parseMetadata( row.layer_metadata );
		const compositeId = row.layer_id || '';
		const parentId = md.parent_layer_id || compositeId;
		const isParentRow = compositeId === parentId;

		if ( ! byParent.has( parentId ) ) {
			byParent.set( parentId, {
				parentRow: null,
				subRows: [],
				parentName: md.parent_layer_name || '',
			} );
		}
		const bucket = byParent.get( parentId );
		if ( isParentRow ) {
			bucket.parentRow = row;
			if ( ! bucket.parentName ) {
				bucket.parentName = row.layer_name || '';
			}
		} else {
			bucket.subRows.push( { row, md } );
		}
	} );

	// Second pass: materialize the parent entries the timeline consumes.
	// For atomic layer types, sub_hotspots is empty. For Hotspot/Woo,
	// it's the per-sub-hotspot detail rows sorted by conversion descending.
	const parents = [];
	byParent.forEach( ( bucket, parentId ) => {
		const parentCounts = bucket.parentRow
			? pluckCounts( bucket.parentRow )
			: {};

		// If the parent has no row of its own (older Hotspot tracker that
		// only emitted per-sub) the parent funnel falls back to a synthesized
		// row using max(sub.viewed) so the marker still has a denominator.
		// That's an approximation flagged in the plan; backend (b) eliminates
		// it for new events, but we keep a defensive fallback so legacy
		// data isn't blank.
		if ( ! bucket.parentRow && bucket.subRows.length > 0 ) {
			const fallback = bucket.subRows.reduce( ( acc, sub ) => {
				const c = pluckCounts( sub.row );
				Object.keys( c ).forEach( ( k ) => {
					acc[ k ] = Math.max( acc[ k ] || 0, c[ k ] || 0 );
				} );
				return acc;
			}, {} );
			Object.assign( parentCounts, fallback );
		}

		const parentNoAction = computeNoAction( layerType, parentCounts );
		const parentConversion =
			parentCounts.viewed > 0
				? ( ( parentCounts[ meta.conversionAction ] || 0 ) /
						parentCounts.viewed ) *
					100
				: 0;

		const parentRowAny = bucket.parentRow || ( bucket.subRows[ 0 ]?.row || {} );
		const parentTimestamp = Number( parentRowAny.timestamp || 0 );
		const parentPageUrl = parentRowAny.page_url || '';

		const subHotspots = bucket.subRows
			.map( ( { row, md }, idx ) => {
				const counts = pluckCounts( row );
				const noAction = computeNoAction( layerType, {
					...counts,
					// Sub-hotspots inherit viewed from the parent (all sub-
					// hotspots in one layer become visible together).
					viewed: parentCounts.viewed,
				} );
				const conversion =
					parentCounts.viewed > 0
						? ( ( counts[ meta.conversionAction ] || 0 ) /
								parentCounts.viewed ) *
							100
						: 0;
				const subId = row.layer_id || '';
				const subName =
					row.layer_name ||
					md.product_name ||
					subId ||
					`#${ idx + 1 }`;
				return {
					id: subId,
					name: subName,
					counts: {
						...counts,
						// Inherit viewed; per-sub viewed isn't emitted anymore.
						viewed: parentCounts.viewed,
					},
					no_action: noAction,
					conversion_rate: conversion,
					product_id: md.product_id || null,
					product_price: md.product_price || null,
					timestamp: Number( row.timestamp || 0 ),
				};
			} )
			.sort( ( a, b ) => b.conversion_rate - a.conversion_rate );

		parents.push( {
			id: parentId,
			name:
				bucket.parentName ||
				bucket.parentRow?.layer_name ||
				parentId,
			layer_type: layerType,
			timestamp: parentTimestamp,
			page_url: parentPageUrl,
			counts: parentCounts,
			no_action: parentNoAction,
			conversion_rate: parentConversion,
			sub_hotspots: subHotspots,
		} );
	} );

	return parents;
}

/**
 * useVideoLayerData
 *
 * Bundle: fires one /processed-layer-analytics/ call per layer type in
 * parallel (RTK Query caches by args so this is free), merges results
 * into a flat `parents[]` array sorted by `layer_timestamp` ascending
 * (timeline order), computes parent + sub-hotspot funnel counts +
 * no_action, and surfaces a single loading/error state for the timeline
 * to render against.
 *
 * @param {Object}        params
 * @param {number|string} params.videoId   WP attachment ID.
 * @param {string}        params.siteUrl   site_url query param.
 * @param {string}        params.dateRange '7d' | '30d' | '90d' | '1y'.
 * @return {Object} { parents, isLoading, errorType, errorMessage }.
 */
export function useVideoLayerData( { videoId, siteUrl, dateRange } ) {
	const days = rangeToDays( dateRange );

	// One RTK Query hook per layer type. React's rules-of-hooks forbid
	// looping `useFetchProcessedLayerAnalyticsQuery` over LAYER_TYPES, so
	// we expand explicitly — five calls, fixed at compile time, each
	// caches independently and won't re-fire on identical args.
	const cta = useFetchProcessedLayerAnalyticsQuery(
		{ layerType: 'cta', days, siteUrl, videoId },
		{ skip: ! videoId },
	);
	const form = useFetchProcessedLayerAnalyticsQuery(
		{ layerType: 'form', days, siteUrl, videoId },
		{ skip: ! videoId },
	);
	const hotspot = useFetchProcessedLayerAnalyticsQuery(
		{ layerType: 'hotspot', days, siteUrl, videoId },
		{ skip: ! videoId },
	);
	const poll = useFetchProcessedLayerAnalyticsQuery(
		{ layerType: 'poll', days, siteUrl, videoId },
		{ skip: ! videoId },
	);
	const woo = useFetchProcessedLayerAnalyticsQuery(
		{ layerType: 'woo', days, siteUrl, videoId },
		{ skip: ! videoId },
	);

	const queries = [ cta, form, hotspot, poll, woo ];
	const typeIds = [ 'cta', 'form', 'hotspot', 'poll', 'woo' ];

	const isLoading = queries.some(
		( q ) => q.isLoading || q.isFetching,
	);

	// Soft errors come back as { errorType, message } from the proxy
	// transformResponse. Per layer type — if all five are errored we
	// surface the first non-empty error; if some succeed and some error
	// we just render what we have (silently dropping the failed types).
	const firstError = queries.find( ( q ) => q.data?.errorType );
	const allErrored = queries.every( ( q ) => q.data?.errorType );

	const parents = useMemo( () => {
		if ( isLoading ) {
			return [];
		}
		const merged = [];
		queries.forEach( ( q, idx ) => {
			const analytics = q.data?.layer_analytics;
			if ( ! analytics ) {
				return;
			}
			const rows = Array.isArray( analytics.individual_layers )
				? analytics.individual_layers
				: [];
			merged.push( ...groupRows( rows, typeIds[ idx ] ) );
		} );

		// Timeline order: by layer_timestamp ascending. Ties broken by name
		// for stable rendering when layers share an exact timestamp.
		return merged.sort( ( a, b ) => {
			const diff = a.timestamp - b.timestamp;
			if ( diff !== 0 ) {
				return diff;
			}
			return ( a.name || '' ).localeCompare( b.name || '' );
		} );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		isLoading,
		cta.data,
		form.data,
		hotspot.data,
		poll.data,
		woo.data,
	] );

	return {
		parents,
		isLoading,
		errorType: allErrored ? firstError?.data?.errorType : null,
		errorMessage: allErrored ? firstError?.data?.message : null,
	};
}
