/**
 * External dependencies
 */
import React from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	LAYER_TYPE_BY_ID,
	withAlpha,
} from '../constants/layerTypes';
import LayerIcon from './LayerIcon';

/**
 * Format a layer timestamp as M:SS for the marker label.
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
 * LayerTimelineMarker
 *
 * One marker on the horizontal timeline strip. Vertical connector → icon
 * card → name → timestamp → conversion-rate badge. Selected state gets a
 * soft glow ring in the layer's color; hover lifts the icon card slightly
 * for affordance.
 *
 * The marker is purely presentational — the parent strip positions it
 * absolutely by `layer_timestamp`. Selection state is owned by
 * VideoLayerTimeline.
 *
 * @param {Object}   props
 * @param {Object}   props.parent     Parent layer entry.
 * @param {boolean}  props.selected   Whether this marker is currently selected.
 * @param {Function} props.onSelect   () => void called when clicked.
 * @param {number}   props.laneOffset Extra connector length (px) to drop this marker into a lower lane when it would overlap a near-simultaneous neighbour; 0 = top lane.
 * @return {JSX.Element} Marker element.
 */
const LayerTimelineMarker = ( { parent, selected, onSelect, laneOffset = 0 } ) => {
	const meta = LAYER_TYPE_BY_ID[ parent.layer_type ];
	const color = meta?.color || '#64748B';
	// Removed layers (no longer in the video's published postmeta) render
	// with a desaturated card + "Removed" pill below the conversion badge.
	const isActive = parent.isActive !== false;

	return (
		<button
			type="button"
			onClick={ onSelect }
			className="absolute flex flex-col items-center text-center cursor-pointer bg-transparent border-0 p-0"
			style={ {
				transform: 'translateX(-50%)',
				transition: 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1)',
			} }
			aria-pressed={ selected }
			aria-label={ `${ meta?.label || parent.layer_type }: ${ parent.name }` }
		>
			{ /* Vertical connector from horizontal axis to the icon card. Grows
			    by laneOffset so a marker pushed into a lower lane (to avoid
			    overlapping a near-simultaneous neighbour) still hangs from its
			    true position on the axis. */ }
			<span
				aria-hidden="true"
				style={ {
					width: 2,
					height: 18 + laneOffset,
					background: color,
					borderRadius: 1,
					marginBottom: -1,
				} }
			/>

			{ /* Icon card */ }
			<span
				className="inline-flex items-center justify-center"
				style={ {
					width: 44,
					height: 44,
					borderRadius: 10,
					background: isActive ? color : withAlpha( color, 0.32 ),
					color: '#fff',
					boxShadow: selected
						? `0 0 0 4px ${ withAlpha( color, 0.22 ) }, 0 6px 18px ${ withAlpha( color, 0.28 ) }`
						: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)',
					transition:
						'box-shadow 180ms ease-out, transform 140ms cubic-bezier(0.22, 1, 0.36, 1)',
					transform: selected ? 'translateY(-2px) scale(1.04)' : 'none',
					opacity: isActive ? 1 : 0.85,
				} }
			>
				<LayerIcon
					layerType={ parent.layer_type }
					formType={ parent.form_type }
					size={ 20 }
					alt={ meta?.label || parent.layer_type }
					color="#fff"
				/>
			</span>

			{ /* Name */ }
			<span
				className="text-xs font-medium text-zinc-700 mt-2 truncate"
				style={ { maxWidth: 110 } }
				title={ parent.name }
			>
				{ parent.name }
			</span>

			{ /* Timestamp */ }
			<span className="text-[11px] text-zinc-500 tabular-nums">
				{ formatTimestamp( parent.timestamp ) }
			</span>

			{ /* Conversion-rate badge */ }
			<span
				className="text-[11px] font-semibold mt-1 px-2 py-0.5 rounded tabular-nums"
				style={ {
					color,
					background: withAlpha( color, 0.12 ),
				} }
				title={ __(
					'Conversion rate — share of viewers who saw this layer and interacted with it.',
					'godam',
				) }
			>
				{ ( Number( parent.conversion_rate ) || 0 ).toFixed( 1 ) }%
			</span>

			{ /* "Removed" pill for historical layers — slate gray to read
			    as a status indicator rather than a layer-type accent. */ }
			{ ! isActive && (
				<span
					className="text-[10px] font-medium mt-1 px-1.5 py-0.5 rounded uppercase tracking-wide"
					style={ {
						color: '#475569',
						background: '#E2E8F0',
					} }
				>
					{ __( 'Removed', 'godam' ) }
				</span>
			) }
		</button>
	);
};

export default LayerTimelineMarker;
