/**
 * External dependencies
 */
import React, { useMemo } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useFetchProcessedLayerAnalyticsQuery } from './redux/api/analyticsApi';

// UUID v4 regex — used to detect when layer_name is missing and the server
// fell back to layer_id. We never want to render a UUID to the marketer.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Color thresholds for the conversion-rate label.
 *
 * Defaults: red below 5%, amber 5–15%, green above 15%. Per-layer-type
 * refinement is a v1.5 candidate; for now a single set works across types.
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
 * Human-readable label for a layer-type key. Matches what the editor shows.
 *
 * @param {string} layerType 'cta' / 'form' / 'hotspot' / 'woo' / 'poll'.
 * @return {string} Localized layer type label.
 */
function getLayerTypeLabel( layerType ) {
	const labels = {
		cta: __( 'CTA', 'godam' ),
		form: __( 'Form', 'godam' ),
		hotspot: __( 'Hotspot', 'godam' ),
		woo: __( 'Woo Hotspot', 'godam' ),
		poll: __( 'Poll', 'godam' ),
	};
	return labels[ layerType ] || layerType;
}

/**
 * Format a video position as a short string for display in layer labels.
 *
 * Integer seconds render without decimals (`5s`); fractional seconds render
 * with two decimals (`3.14s`). Matches the editor's labeling convention.
 *
 * @param {number} seconds Position in seconds.
 * @return {string} e.g. '5s' or '3.14s'.
 */
function formatPosition( seconds ) {
	const n = Number( seconds || 0 );
	if ( ! Number.isFinite( n ) || n <= 0 ) {
		return '';
	}
	return n % 1 === 0 ? `${ n }s` : `${ n.toFixed( 2 ) }s`;
}

/**
 * Build the display name for a layer row.
 *
 * Priority: a real custom name set by the marketer in the editor → fallback
 * to `<TypeLabel> layer at <position>s`. The UUID escape-hatch (if the row
 * arrives with layer_name == layer_id, which can happen when the editor
 * never localized a name) is detected via a UUID-shape regex and replaced
 * with the fallback.
 *
 * @param {Object} row       individual_layers row from the API.
 * @param {string} layerType Current tab's layer_type, used for the fallback label.
 * @return {string} Marketer-visible name.
 */
function getDisplayLayerName( row, layerType ) {
	const candidate = row?.layer_name || '';
	if ( candidate && ! UUID_RE.test( candidate ) ) {
		return candidate;
	}
	const position = formatPosition( row?.timestamp );
	const typeLabel = getLayerTypeLabel( layerType );
	if ( position ) {
		return `${ typeLabel } layer at ${ position }`;
	}
	return `${ typeLabel } layer`;
}

/**
 * Build the deep-link URL into the video editor for a specific layer.
 *
 * Lands on /wp-admin/admin.php?page=rtgodam_video_editor&id=<videoId>
 * with `#layer=<layerId>` so the editor focuses the parent layer.
 * Sub-hotspot rows (composite layer_id) always link to the parent —
 * individual sub-hotspots aren't separately editable in the sidebar.
 *
 * @param {number|string} attachmentID WP attachment ID of the video.
 * @param {string}        layerId      The parent layer's UUID.
 * @return {string} Absolute admin URL.
 */
function getEditorUrl( attachmentID, layerId ) {
	try {
		const url = new URL( window.location.href );
		url.searchParams.set( 'page', 'rtgodam_video_editor' );
		url.searchParams.set( 'id', String( attachmentID ) );
		url.hash = `layer=${ layerId }`;
		return url.toString();
	} catch ( e ) {
		return `?page=rtgodam_video_editor&id=${ encodeURIComponent( attachmentID ) }#layer=${ encodeURIComponent( layerId ) }`;
	}
}

/**
 * SingleLayerAnalyticsList
 *
 * Per-layer breakdown for a single layer-type tab. Talks to
 * /wp-json/godam/v1/analytics/layer-analytics via RTK Query.
 *
 * Layout — Left: per-layer rows. Flat layer types (CTA / Form / Poll)
 * render each row directly; nested types (Hotspot / Woo) render the
 * parent layer as a header with sub-hotspot children indented beneath,
 * sorted by conversion rate descending. Right: a single cumulative
 * "Avg. conversion rate" card. The per-action totals (Total Views,
 * Total Clicks, etc.) used to live here too but were dropped because
 * they duplicated per-row data.
 *
 * The daily breakdown bar chart was removed pending a v1.5 redesign
 * (palette + tab-switch clearing fix + sparse-data handling). The
 * function still lives in helper.js for that follow-up.
 *
 * @param {Object} props
 * @param {string} props.activeTab    Layer type key — 'cta' / 'form' / 'hotspot' / 'woo' / 'poll'.
 * @param {string} props.dateRange    '7d' | '30d' | '60d' | '1y'.
 * @param {number} props.attachmentID WP attachment ID of the video.
 * @return {JSX.Element} The list + summary card layout.
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

	// Memoize the array field so it has stable identity across renders.
	const individualLayers = useMemo(
		() => analytics?.individual_layers || [],
		[ analytics ],
	);
	const cumulative = analytics?.cumulative || null;

	// Group sub-hotspot rows under their parent layer. Composite layer_id
	// pattern: `<parentId>::<subId>`. Parent context is echoed in
	// layer_metadata.parent_layer_id / parent_layer_name so we don't have
	// to parse the composite string.
	const groups = useMemo( () => {
		const byParent = new Map();
		individualLayers.forEach( ( row ) => {
			const parentId = row?.layer_metadata?.parent_layer_id || row.layer_id;
			const parentNameRaw =
				row?.layer_metadata?.parent_layer_name ||
				row.layer_name ||
				'';
			// Apply the UUID fallback to the parent header too — same rule
			// as per-row names. If parent_layer_name is empty or looks like
			// a UUID, derive from layer_type + position.
			const parentName = parentNameRaw && ! UUID_RE.test( parentNameRaw )
				? parentNameRaw
				: ( () => {
					const position = formatPosition( row?.timestamp );
					const typeLabel = getLayerTypeLabel( layerType );
					return position ? `${ typeLabel } layer at ${ position }` : `${ typeLabel } layer`;
				} )();

			if ( ! byParent.has( parentId ) ) {
				byParent.set( parentId, {
					parentId,
					parentName,
					rows: [],
				} );
			}
			byParent.get( parentId ).rows.push( row );
		} );

		// Sort children by conversion_rate descending — surfaces winners first.
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
	}, [ individualLayers, layerType ] );

	// Loading skeleton.
	if ( isLoading || isFetching ) {
		return (
			<div className="grid grid-cols-[5fr_2fr] gap-3 h-[280px] px-6 pb-6">
				<div className="animate-pulse bg-zinc-100 rounded-lg" />
				<div className="animate-pulse bg-zinc-100 rounded-2xl" />
			</div>
		);
	}

	// Microservice error.
	if ( data?.errorType ) {
		return (
			<div className="px-6 pb-6">
				<p className="text-sm text-zinc-500 h-[200px] flex items-center justify-center">
					{ data.message || __( 'Unable to load layer analytics.', 'godam' ) }
				</p>
			</div>
		);
	}

	// Empty state — no layers of this type have any interactions in the
	// selected date range. Important to render this cleanly because when
	// the user switches tabs (e.g. from Hotspot to Poll which has no data),
	// we need to clear the previous tab's content rather than leave stale
	// rendering behind. React handles this correctly so long as the
	// component returns a fresh tree here.
	if ( ! analytics || individualLayers.length === 0 ) {
		return (
			<div className="px-6 pb-6">
				<p className="text-sm text-zinc-500 h-[200px] flex items-center justify-center">
					{ __( 'No data available for this layer type in the selected date range.', 'godam' ) }
				</p>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-[5fr_2fr] gap-3 px-6 pb-6">
			{ /* Left: per-layer rows. Flat layer types (CTA / Form / Poll)
			     collapse the parent-header (since parent == child for
			     atomic layers); nested types (Hotspot / Woo) keep the
			     parent header with children listed under it. */ }
			<div className="overflow-auto pr-2 max-h-[400px]">
				<div className="divide-y divide-zinc-100">
					{ groups.map( ( group ) => {
						// A group is "flat" when it has exactly one row whose
						// layer_id equals the parent_id — i.e., atomic layer.
						const isFlat = group.rows.length === 1 &&
							group.rows[ 0 ].layer_id === group.parentId;

						if ( isFlat ) {
							// Single row, no parent header. The row itself
							// carries the Edit affordance next to the name.
							const row = group.rows[ 0 ];
							const ratePct = Number( row.conversion_rate ) || 0;
							const displayName = getDisplayLayerName( row, layerType );
							return (
								<div
									key={ row.layer_id }
									className="py-3 flex justify-between items-start gap-3"
								>
									<div className="min-w-0">
										<div className="flex items-center gap-2">
											<p className="text-sm font-semibold text-zinc-800 truncate m-0">
												{ displayName }
											</p>
											{ attachmentID && (
												<a
													href={ getEditorUrl( attachmentID, row.layer_id ) }
													className="text-xs text-[#AB3A6C] hover:underline shrink-0"
													aria-label={ __( 'Edit this layer in the video editor', 'godam' ) }
												>
													{ __( 'Edit ↗', 'godam' ) }
												</a>
											) }
										</div>
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
						}

						// Nested: parent header + indented children.
						return (
							<div key={ group.parentId } className="py-3">
								<div className="flex items-center gap-2">
									<p className="text-sm font-semibold text-zinc-800 truncate m-0">
										{ group.parentName }
									</p>
									{ attachmentID && (
										<a
											href={ getEditorUrl( attachmentID, group.parentId ) }
											className="text-xs text-[#AB3A6C] hover:underline shrink-0"
											aria-label={ __( 'Edit this layer in the video editor', 'godam' ) }
										>
											{ __( 'Edit ↗', 'godam' ) }
										</a>
									) }
								</div>
								<div className="mt-1 pl-3 border-l-2 border-zinc-100 divide-y divide-zinc-50">
									{ group.rows.map( ( row ) => {
										const ratePct = Number( row.conversion_rate ) || 0;
										const subName = getDisplayLayerName( row, layerType );
										return (
											<div
												key={ row.layer_id }
												className="py-2 flex justify-between items-start gap-2"
											>
												<p className="text-sm text-zinc-700 truncate min-w-0 m-0">
													{ subName }
												</p>
												<p
													className={ `text-sm font-semibold shrink-0 ${ getConversionColorClass( ratePct ) }` }
												>
													{ ratePct.toFixed( 1 ) }%
												</p>
											</div>
										);
									} ) }
								</div>
							</div>
						);
					} ) }
				</div>
			</div>

			{ /* Right: single Avg. conversion rate card. Per-action totals
			     (Total Views, Total Clicks, etc.) were dropped from this
			     column because they duplicated the per-row data. The
			     daily-breakdown chart was also removed pending v1.5 rework. */ }
			<div>
				<div className="rounded-2xl p-6 bg-zinc-50 flex flex-col items-center justify-center h-full min-h-[160px]">
					<p
						className={ `text-3xl font-bold ${ getConversionColorClass( cumulative?.conversion_rate || 0 ) }` }
					>
						{ Number( cumulative?.conversion_rate || 0 ).toFixed( 1 ) }%
					</p>
					<p className="text-sm text-zinc-500 mt-1 text-center">
						{ groups.length > 1
							? __( 'Avg. conversion rate', 'godam' )
							: __( 'Conversion rate', 'godam' ) }
					</p>
				</div>
			</div>
		</div>
	);
};

export default SingleLayerAnalyticsList;
