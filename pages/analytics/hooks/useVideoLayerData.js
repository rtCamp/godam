/**
 * External dependencies
 */
import { useMemo } from 'react';

/**
 * Internal dependencies
 */
import {
	useFetchProcessedLayerAnalyticsQuery,
	useFetchProcessedAnalyticsHistoryQuery,
} from '../redux/api/analyticsApi';
import { LAYER_TYPE_BY_ID, FORM_TYPE_LABELS } from '../constants/layerTypes';

/**
 * Convert a UI date range key to the integer days parameter the analytics
 * endpoint expects. '1y' is mapped to 365 as a reasonable upper bound.
 * 'all' returns undefined so the `days` query param is omitted entirely —
 * the microservice then applies no date lower-bound and returns the full
 * history (matching the Playback Performance chart's "All" option).
 *
 * @param {string} dateRange '7d' | '30d' | '90d' | '1y' | 'all'.
 * @return {number|undefined} Days, or undefined for all-time.
 */
function rangeToDays( dateRange ) {
	switch ( dateRange ) {
		case '7d':
			return 7;
		case '30d':
			return 30;
		case '90d':
			return 90;
		case 'all':
			return undefined;
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
 * UUID v1-v5 shape: 8-4-4-4-12 hex chars. Defensive — older clients (or
 * misconfigured ones) may emit the layer's UUID as its `layer_name`; we
 * detect that here and re-render with the type+timestamp fallback so the
 * timeline marker never shows a bare UUID.
 */
const UUID_SHAPE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tracker-side auto-generated fallback names follow the pattern
 * `<EnglishTypeLabel> layer at <t>s`. When we receive one of these, we
 * regenerate using the live-locale type label so the timeline reads in
 * the admin's current language even when the site language has changed
 * since the events were emitted. The form-integration brands (WPForms /
 * Gravity Forms / …) are also caught here so we render the brand label
 * the marketer picked in the editor.
 */
const TRACKER_AUTO_NAME_RE = new RegExp(
	'^(' +
		[
			'CTA',
			'Form',
			'Hotspot',
			'Poll',
			'Woo',
			'Gravity Forms',
			'WPForms',
			'Contact Form 7',
			'Jetpack Forms',
			'SureForms',
			'Forminator Forms',
			'Fluent Forms',
			'Everest Forms',
			'Ninja Forms',
			'MetForm',
		].join( '|' ) +
		') layer at \\d+(\\.\\d+)?s$',
);

/**
 * Resolve the display name for a layer at render time.
 *
 * Custom name (from the future editor naming UI) wins whenever the server
 * delivered a non-empty, non-UUID, non-auto-pattern value. Otherwise we
 * generate `<TypeLabel> layer at <t>s` locally — using the localized
 * `meta.label` so the admin sees the layer type in its current language.
 *
 * For form layers with a known `form_type`, the type label is replaced by
 * the form-integration brand name (e.g. "WPForms layer at 2.59s"), so
 * analytics reads identically to the editor's sidebar.
 *
 * @param {string} rawName    Server-delivered layer_name.
 * @param {Object} meta       LAYER_TYPE_BY_ID entry for this layer's type.
 * @param {number} timestamp  Layer timestamp in seconds.
 * @param {string} [formType] Optional form integration id for form layers.
 * @return {string} Display name for the timeline marker / detail header.
 */
function resolveLayerName( rawName, meta, timestamp, formType ) {
	const trimmed = ( rawName || '' ).toString().trim();
	const isAutoOrMissing =
		! trimmed ||
		UUID_SHAPE_RE.test( trimmed ) ||
		TRACKER_AUTO_NAME_RE.test( trimmed );
	if ( ! isAutoOrMissing ) {
		return trimmed;
	}
	let label = meta?.label || 'Layer';
	if ( meta?.id === 'form' && formType && FORM_TYPE_LABELS[ formType ] ) {
		label = FORM_TYPE_LABELS[ formType ];
	}
	const t = Number.isFinite( Number( timestamp ) ) ? Number( timestamp ) : 0;
	return `${ label } layer at ${ t.toFixed( 2 ) }s`;
}

/**
 * Read the published layer config from PHP-localised data. Each entry is
 * `{ id, type, subIds? }` — subIds are the trailing tokens of composite
 * layer ids (`<sub.id>` for hotspot, `p<productId>` for woo). When the
 * config isn't available we return null and the caller treats every
 * layer as active (fail-open — never blank out analytics if postmeta
 * lookup is missing).
 *
 * @return {Array<{id:string,type:string,subIds?:string[]}>|null} Layer config or null.
 */
function readActiveLayerConfig() {
	if (
		typeof window === 'undefined' ||
		! window.godamAnalyticsConfig ||
		! Array.isArray( window.godamAnalyticsConfig.activeLayerConfig )
	) {
		return null;
	}
	return window.godamAnalyticsConfig.activeLayerConfig;
}

/**
 * Build O(1) lookup maps from the published layer config.
 *
 * @param {Array|null} config readActiveLayerConfig() result.
 * @return {{activeParentIds:Set<string>|null, activeSubIdsByParent:Map<string,Set<string>>}} Lookup helpers.
 */
function indexActiveConfig( config ) {
	if ( ! config ) {
		return {
			activeParentIds: null,
			activeSubIdsByParent: new Map(),
			entriesUrlByParent: new Map(),
		};
	}
	const activeParentIds = new Set();
	const activeSubIdsByParent = new Map();
	// parent layer id -> wp-admin entries/results URL (form & poll layers).
	// PHP builds the URL (admin_url + the saved integration id); we just carry
	// it through to the detail panel.
	const entriesUrlByParent = new Map();
	config.forEach( ( entry ) => {
		if ( ! entry?.id ) {
			return;
		}
		activeParentIds.add( entry.id );
		if ( Array.isArray( entry.subIds ) ) {
			activeSubIdsByParent.set( entry.id, new Set( entry.subIds ) );
		}
		if ( entry.entries_url ) {
			entriesUrlByParent.set( entry.id, entry.entries_url );
		}
	} );
	return { activeParentIds, activeSubIdsByParent, entriesUrlByParent };
}

/**
 * Extract the sub-hotspot's id suffix from a composite layer_id.
 * `parent.id::sub-uuid` → `sub-uuid`. `parent.id::p567` → `p567`.
 * Returns '' when not composite-shaped.
 *
 * @param {string} compositeLayerId Sub-hotspot composite id.
 * @return {string} Suffix or ''.
 */
function extractSubIdSuffix( compositeLayerId ) {
	const idx = ( compositeLayerId || '' ).indexOf( '::' );
	if ( idx < 0 ) {
		return '';
	}
	return compositeLayerId.slice( idx + 2 );
}

/**
 * Group the microservice's individual_layers rows into a parent → children
 * tree. Composite layer_id pattern is `<parentId>` (parent / aggregate row)
 * or `<parentId>::<subId>` (sub-hotspot row). The backend's per-parent
 * aggregation pass emits a row at the bare parentId; sub-hotspot rows
 * keep the composite key.
 *
 * @param {Array}                                                                           rows        Raw individual_layers rows.
 * @param {string}                                                                          layerType   'cta' | 'form' | 'hotspot' | 'poll' | 'woo'.
 * @param {{activeParentIds:Set<string>|null,activeSubIdsByParent:Map<string,Set<string>>}} configIndex Active-layer lookup from indexActiveConfig().
 * @return {Array} Parent layer entries with embedded sub_hotspots[].
 */
function groupRows( rows, layerType, configIndex ) {
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
				formType: '',
			} );
		}
		const bucket = byParent.get( parentId );
		// Form layers carry the integration id (gravity/wpforms/…) so the
		// frontend can pick the brand-specific icon. Any row in the parent's
		// group should expose the same form_type — first non-empty wins.
		if ( ! bucket.formType && md.form_type ) {
			bucket.formType = String( md.form_type );
		}
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
		// Raw rate then clamp to ≤ 100: the numerator (parent-aggregate uniqExact
		// sessions) and denominator (parent viewed) come from different
		// aggregation passes, so cross-day session skew could nudge it past 100.
		const parentRawConversion =
			parentCounts.viewed > 0
				? ( ( parentCounts[ meta.conversionAction ] || 0 ) /
						parentCounts.viewed ) *
					100
				: 0;
		const parentConversion = Math.min( 100, parentRawConversion );

		const parentRowAny = bucket.parentRow || ( bucket.subRows[ 0 ]?.row || {} );
		const parentTimestamp = Number( parentRowAny.timestamp || 0 );
		const parentPageUrl = parentRowAny.page_url || '';

		// Parent active state: present in the published activeLayerConfig.
		// When the config is unknown (e.g. postmeta lookup didn't run),
		// activeParentIds is null and we fail open — every parent is active.
		const parentIsActive = configIndex.activeParentIds
			? configIndex.activeParentIds.has( parentId )
			: true;

		// Sub-hotspot active set is only meaningful when the parent itself
		// is active. A removed parent implies removed children, regardless
		// of the subIds entry (which may be stale or missing).
		const activeSubSet = parentIsActive
			? configIndex.activeSubIdsByParent.get( parentId )
			: null;

		const subHotspots = bucket.subRows
			.map( ( { row, md }, idx ) => {
				const counts = pluckCounts( row );
				const noAction = computeNoAction( layerType, {
					...counts,
					// Sub-hotspots inherit viewed from the parent (all sub-
					// hotspots in one layer become visible together).
					viewed: parentCounts.viewed,
				} );
				// Per-sub conversion = sub conversions / PARENT viewed (subs
				// don't emit their own viewed); clamp to ≤ 100 for the same
				// cross-aggregation reason as the parent rate.
				const subRawConversion =
					parentCounts.viewed > 0
						? ( ( counts[ meta.conversionAction ] || 0 ) /
								parentCounts.viewed ) *
							100
						: 0;
				const conversion = Math.min( 100, subRawConversion );
				const subId = row.layer_id || '';
				// Sub-hotspot name: in the rail the parent context ("Products
				// in this layer") is already implicit, so prefer the bare
				// product_name (Woo) when available; only fall back to the
				// tracker-emitted layer_name when no product_name is set.
				// UUID-shape and auto-pattern names are rejected via the same
				// path the parent uses so a raw composite UUID never reaches
				// the rail. Falls back to a generic ordinal "<TypeLabel> #N"
				// when nothing usable.
				const rawSubName = md.product_name || row.layer_name || '';
				let subName;
				if (
					rawSubName &&
					! UUID_SHAPE_RE.test( rawSubName ) &&
					! TRACKER_AUTO_NAME_RE.test( rawSubName )
				) {
					subName = rawSubName;
				} else {
					subName = `${ meta.label } #${ idx + 1 }`;
				}
				// Resolve sub-hotspot active state.
				// - Parent inactive → all children inactive.
				// - Parent active + activeSubSet present → only suffixes
				//   in the published config count as active.
				// - Parent active + no activeSubSet (atomic layer type, or
				//   missing subIds entry) → fail open, every sub active.
				let subIsActive;
				if ( ! parentIsActive ) {
					subIsActive = false;
				} else if ( activeSubSet ) {
					subIsActive = activeSubSet.has( extractSubIdSuffix( subId ) );
				} else {
					subIsActive = true;
				}
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
					product_image: md.product_image || '',
					product_price: md.product_price || null,
					timestamp: Number( row.timestamp || 0 ),
					isActive: subIsActive,
				};
			} )
			.sort( ( a, b ) => b.conversion_rate - a.conversion_rate );

		const parentRawName =
			bucket.parentName ||
			bucket.parentRow?.layer_name ||
			'';
		const parentName = resolveLayerName(
			parentRawName,
			meta,
			parentTimestamp,
			bucket.formType,
		);

		// Distinct positions (seconds) this parent has ever been observed
		// at. Backend's per-day Map<layer_id, positions[]> column is unioned
		// across the date range in /processed-layer-analytics/ and attached
		// to each individual_layers row. Powers the "this layer has been
		// modified" notice in the detail panel.
		const parentRawPositions = Array.isArray(
			bucket.parentRow?.historical_positions,
		)
			? bucket.parentRow.historical_positions
			: [];
		const historicalPositions = parentRawPositions
			.map( ( p ) => Number( p ) )
			.filter( ( p ) => Number.isFinite( p ) )
			.sort( ( a, b ) => a - b );

		parents.push( {
			id: parentId,
			name: parentName,
			layer_type: layerType,
			form_type: bucket.formType || '',
			timestamp: parentTimestamp,
			page_url: parentPageUrl,
			counts: parentCounts,
			no_action: parentNoAction,
			conversion_rate: parentConversion,
			sub_hotspots: subHotspots,
			isActive: parentIsActive,
			historical_positions: historicalPositions,
			// wp-admin link to this form's entries / poll's results, when the
			// integration has one (empty string otherwise → link hidden).
			entries_url: configIndex.entriesUrlByParent?.get( parentId ) || '',
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
 * @param {string}        params.dateRange '7d' | '30d' | '90d' | '1y' | 'all'.
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

	// Video-level conversion rate — the same metric the Dashboard shows per
	// video (unique converting sessions / plays), but for THIS video over the
	// selected range. Reuses the processed-analytics history feed (one row per
	// day) so it tracks the same date pill as the layer data above. The
	// numerator is already type=1 gated server-side, so the ratio is ≤ 100%.
	const history = useFetchProcessedAnalyticsHistoryQuery(
		{ days, videoId, siteUrl },
		{ skip: ! videoId },
	);

	const videoConversion = useMemo( () => {
		const rows = Array.isArray( history.data ) ? history.data : [];
		const totals = rows.reduce(
			( acc, row ) => {
				acc.plays += Number( row.plays ) || 0;
				acc.converting += Number( row.unique_converting_sessions ) || 0;
				return acc;
			},
			{ plays: 0, converting: 0 },
		);
		const rate =
			totals.plays > 0
				? Math.min( 100, ( totals.converting / totals.plays ) * 100 )
				: null;
		return {
			rate,
			plays: totals.plays,
			converting: totals.converting,
		};
	}, [ history.data ] );

	const isLoading =
		cta.isLoading || cta.isFetching ||
		form.isLoading || form.isFetching ||
		hotspot.isLoading || hotspot.isFetching ||
		poll.isLoading || poll.isFetching ||
		woo.isLoading || woo.isFetching;

	// Soft errors come back as { errorType, message } from the proxy
	// transformResponse. Per layer type — if all five are errored we
	// surface the first non-empty error; if some succeed and some error
	// we just render what we have (silently dropping the failed types).
	const allErrored =
		!! cta.data?.errorType &&
		!! form.data?.errorType &&
		!! hotspot.data?.errorType &&
		!! poll.data?.errorType &&
		!! woo.data?.errorType;
	let firstErrorPayload = null;
	if ( cta.data?.errorType ) {
		firstErrorPayload = cta.data;
	} else if ( form.data?.errorType ) {
		firstErrorPayload = form.data;
	} else if ( hotspot.data?.errorType ) {
		firstErrorPayload = hotspot.data;
	} else if ( poll.data?.errorType ) {
		firstErrorPayload = poll.data;
	} else if ( woo.data?.errorType ) {
		firstErrorPayload = woo.data;
	}

	const parents = useMemo( () => {
		if ( isLoading ) {
			return [];
		}
		// Snapshot the published layer config once per data refresh. The
		// PHP-localised values are static for the page lifetime; reading
		// inside the memo keeps the source of truth in one place and
		// avoids leaking window-globals into every component.
		const configIndex = indexActiveConfig( readActiveLayerConfig() );
		const merged = [];
		const sources = [
			[ cta.data, 'cta' ],
			[ form.data, 'form' ],
			[ hotspot.data, 'hotspot' ],
			[ poll.data, 'poll' ],
			[ woo.data, 'woo' ],
		];
		sources.forEach( ( [ data, typeId ] ) => {
			const analytics = data?.layer_analytics;
			if ( ! analytics ) {
				return;
			}
			const rows = Array.isArray( analytics.individual_layers )
				? analytics.individual_layers
				: [];
			merged.push( ...groupRows( rows, typeId, configIndex ) );
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
		errorType: allErrored ? firstErrorPayload?.errorType : null,
		errorMessage: allErrored ? firstErrorPayload?.message : null,
		videoConversion,
	};
}
