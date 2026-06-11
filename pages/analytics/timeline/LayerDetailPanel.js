/**
 * External dependencies
 */
import React, { useEffect, useState } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { external } from '@wordpress/icons';
import { Icon } from '@wordpress/components';

/**
 * Internal dependencies
 */
import {
	LAYER_TYPE_BY_ID,
	withAlpha,
} from '../constants/layerTypes';
import LayerIcon from './LayerIcon';
import LayerInteractionFunnel from './LayerInteractionFunnel';
import SubHotspotRail from './SubHotspotRail';
import LayerModifiedNotice from './LayerModifiedNotice';

/**
 * Build the deep-link URL into the video editor for a layer.
 *
 * Lands on /wp-admin/admin.php?page=rtgodam_video_editor&id=<videoId>
 * with `#layer=<layerId>`. Sub-hotspot rows always link to the PARENT —
 * individual sub-hotspots inside a layer aren't separately editable.
 *
 * @param {number|string} attachmentID WP attachment ID.
 * @param {string}        layerId      Parent layer UUID (always, not sub).
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
 * Format a layer timestamp (in seconds) as M:SS for the header.
 *
 * @param {number} seconds Position in the video.
 * @return {string} '1:18'
 */
function formatTimestamp( seconds ) {
	const total = Math.max( 0, Math.floor( Number( seconds ) || 0 ) );
	const m = Math.floor( total / 60 );
	const s = total % 60;
	return `${ m }:${ String( s ).padStart( 2, '0' ) }`;
}

/**
 * LayerDetailPanel
 *
 * The card below the timeline for the currently selected parent layer.
 * Holds the header (icon + name + type pill + "Appeared at X:XX" + Edit
 * Layer link), the conditional SubHotspotRail (Hotspot/Woo only), and
 * the LayerInteractionFunnel. The left-edge accent border picks up the
 * layer's type color so a glance at the panel reaffirms which marker is
 * selected.
 *
 * Sub-hotspot selection state is owned here — selecting a sub from the
 * rail swaps the funnel data but leaves the rest of the panel intact.
 *
 * @param {Object}        props
 * @param {Object|null}   props.parent       Currently selected parent layer entry, or null.
 * @param {number|string} props.attachmentID WP attachment ID for the Edit Layer link.
 * @return {JSX.Element|null} The detail card, or null when no layer is selected.
 */
const LayerDetailPanel = ( { parent, attachmentID } ) => {
	const [ selectedSubId, setSelectedSubId ] = useState( null );

	// Whenever the selected parent changes, reset to the aggregate view.
	useEffect( () => {
		setSelectedSubId( null );
	}, [ parent?.id ] );

	if ( ! parent ) {
		return null;
	}

	const meta = LAYER_TYPE_BY_ID[ parent.layer_type ];
	if ( ! meta ) {
		return null;
	}

	// Auto-generated names already encode the position ("<Type> layer at
	// <t>s"), so a separate "Appeared at X:XX" line just repeats it. Show that
	// line only for custom-named layers, where the name carries no timestamp.
	// resolveLayerName emits the " layer at <t>s" suffix in English regardless
	// of locale, so this literal match is locale-safe.
	const nameEncodesTimestamp = / layer at \d+(\.\d+)?s$/.test( parent.name || '' );

	// Resolve the active funnel data — parent aggregate by default, sub-hotspot
	// when one is selected from the rail.
	const activeSub = selectedSubId
		? ( parent.sub_hotspots || [] ).find( ( s ) => s.id === selectedSubId )
		: null;
	const funnelCounts = activeSub ? activeSub.counts : parent.counts;
	const funnelNoAction = activeSub ? activeSub.no_action : parent.no_action;

	const showRail = meta.hasSubHotspots && ( parent.sub_hotspots || [] ).length > 0;

	return (
		<section
			className="rounded-xl border border-zinc-200 bg-white overflow-hidden"
			style={ {
				borderLeft: `4px solid ${ meta.color }`,
			} }
		>
			{ /* Header */ }
			<header className="px-6 py-4 flex flex-wrap items-center gap-4 justify-between border-b border-zinc-100">
				<div className="flex items-center gap-3 min-w-0">
					<span
						className="inline-flex items-center justify-center rounded-lg"
						style={ {
							width: 40,
							height: 40,
							background: withAlpha( meta.color, 0.12 ),
							color: meta.color,
							flexShrink: 0,
						} }
					>
						<LayerIcon
							layerType={ parent.layer_type }
							formType={ parent.form_type }
							size={ 22 }
							alt={ meta?.label || parent.layer_type }
							color={ meta.color }
						/>
					</span>
					<div className="min-w-0">
						<h3 className="text-base font-semibold text-zinc-900 m-0 truncate">
							{ parent.name || __( 'Untitled layer', 'godam' ) }
						</h3>
						{ ! nameEncodesTimestamp && (
							<p className="text-xs text-zinc-500 m-0 mt-0.5">
								{ __( 'Appeared at', 'godam' ) }{ ' ' }
								<span className="font-medium text-zinc-700 tabular-nums">
									{ formatTimestamp( parent.timestamp ) }
								</span>
							</p>
						) }
					</div>
				</div>

				<div className="flex items-center gap-2 flex-shrink-0">
					{ /* Deep-link to the integration's entries (Form) or the
					    poll's results (Poll), when the server resolved one.
					    Shown for removed layers too — the underlying form/poll
					    and its submissions still exist. Opens in a new tab so
					    the analytics view is preserved. */ }
					{ parent.entries_url && (
						<a
							href={ parent.entries_url }
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
							aria-label={ parent.layer_type === 'poll'
								? __( 'View this poll’s results', 'godam' )
								: __( 'View this form’s entries', 'godam' ) }
						>
							{ parent.layer_type === 'poll'
								? __( 'View Poll results', 'godam' )
								: __( 'View Form entries', 'godam' ) }
							<Icon icon={ external } size={ 14 } />
						</a>
					) }
					{ attachmentID && parent.isActive !== false && (
						<a
							href={ getEditorUrl( attachmentID, parent.id ) }
							className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
							aria-label={ __( 'Edit this layer in the video editor', 'godam' ) }
						>
							{ __( 'Edit Layer', 'godam' ) }
							<Icon icon={ external } size={ 14 } />
						</a>
					) }
					{ attachmentID && parent.isActive === false && (
						<span
							className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-400 cursor-not-allowed"
							title={ __( 'This layer is no longer in the video. Historical analytics preserved.', 'godam' ) }
						>
							{ __( 'Removed from video', 'godam' ) }
						</span>
					) }
				</div>
			</header>

			{ /* Modification notice — only when the layer's been at more
			    than one position over the requested date range. Backed by
			    the layer_positions Map on processed_analytics. */ }
			{ Array.isArray( parent.historical_positions ) &&
				parent.historical_positions.length > 1 && (
				<LayerModifiedNotice
					layerId={ parent.id }
					historicalPositions={ parent.historical_positions }
				/>
			) }

			{ /* Body. Single column on mobile (the sub-hotspot rail stacks
			    above the funnel); two columns from md up. Avoids the rail +
			    funnel overflowing on narrow screens. */ }
			<div
				className={ `grid gap-4 p-6 grid-cols-1 ${
					showRail
						? 'md:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]'
						: ''
				}` }
			>
				{ showRail && (
					<SubHotspotRail
						parent={ parent }
						selectedSubId={ selectedSubId }
						onSelect={ setSelectedSubId }
					/>
				) }

				<LayerInteractionFunnel
					layerType={ parent.layer_type }
					counts={ funnelCounts }
					noAction={ funnelNoAction }
				/>
			</div>
		</section>
	);
};

export default LayerDetailPanel;
