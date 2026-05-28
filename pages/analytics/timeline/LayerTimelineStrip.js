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
import LayerTimelineMarker from './LayerTimelineMarker';

/**
 * Generate tick label positions for the timeline axis.
 *
 * The ticks divide the visible duration into ~6 segments. Each tick label
 * is M:SS. The video's actual end is always shown as the last tick.
 *
 * @param {number} duration Video duration in seconds.
 * @return {Array<{ pct: number, label: string }>} Tick descriptors.
 */
function computeTicks( duration ) {
	const safeDuration = Math.max( 1, Number( duration ) || 0 );
	const stepsTarget = 6;
	const rough = safeDuration / stepsTarget;

	// Round step to a sensible bucket (5s, 10s, 15s, 30s, 60s, 120s, 300s, 600s).
	const candidates = [ 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600 ];
	const step = candidates.find( ( c ) => c >= rough ) || candidates[ candidates.length - 1 ];

	const ticks = [];
	for ( let t = 0; t <= safeDuration; t += step ) {
		const pct = ( t / safeDuration ) * 100;
		const m = Math.floor( t / 60 );
		const s = t % 60;
		ticks.push( {
			pct,
			label: `${ m }:${ String( s ).padStart( 2, '0' ) }`,
		} );
	}
	// Always pin the end-of-video tick.
	if ( ticks.length === 0 || ticks[ ticks.length - 1 ].pct < 100 ) {
		const totalM = Math.floor( safeDuration / 60 );
		const totalS = Math.floor( safeDuration % 60 );
		ticks.push( {
			pct: 100,
			label: `${ totalM }:${ String( totalS ).padStart( 2, '0' ) }`,
		} );
	}
	return ticks;
}

/**
 * LayerTimelineStrip
 *
 * Horizontal axis + absolutely-positioned markers for each parent layer.
 * Markers position themselves by `layer_timestamp / videoDuration * 100%`.
 * If two layers fire at near-identical timestamps the markers will visually
 * overlap; this is rare in practice (marketers don't stack five CTAs on
 * one frame), so v1 keeps overlap detection out of scope — horizontal
 * scroll absorbs the rest.
 *
 * @param {Object}   props
 * @param {Array}    props.parents          Sorted parent layers.
 * @param {number}   props.videoDuration    Total video length in seconds.
 * @param {string}   props.selectedParentId Currently selected parent id, or null.
 * @param {Function} props.onSelect         (parentId) => void.
 * @return {JSX.Element} The strip.
 */
const LayerTimelineStrip = ( {
	parents,
	videoDuration,
	selectedParentId,
	onSelect,
} ) => {
	const safeDuration = Math.max( 1, Number( videoDuration ) || 1 );

	const ticks = useMemo( () => computeTicks( safeDuration ), [ safeDuration ] );

	return (
		<div className="px-6 pt-4 pb-2">
			{ /* Tick label row */ }
			<div className="relative h-5">
				{ ticks.map( ( tick, idx ) => {
					let transform = 'translateX(-50%)';
					if ( tick.pct === 0 ) {
						transform = 'translateX(0)';
					} else if ( tick.pct === 100 ) {
						transform = 'translateX(-100%)';
					}
					return (
						<span
							key={ `${ tick.pct }-${ idx }` }
							className="absolute text-[11px] font-medium text-zinc-500 tabular-nums"
							style={ {
								left: `${ tick.pct }%`,
								transform,
							} }
						>
							{ tick.label }
						</span>
					);
				} ) }
			</div>

			{ /* Axis line + tick dots */ }
			<div className="relative mt-1">
				<div
					className="w-full"
					style={ {
						height: 1,
						background: '#E5E7EB',
					} }
				/>
				{ ticks.map( ( tick, idx ) => (
					<span
						key={ `dot-${ tick.pct }-${ idx }` }
						aria-hidden="true"
						className="absolute"
						style={ {
							top: -2,
							left: `${ tick.pct }%`,
							width: 5,
							height: 5,
							borderRadius: '50%',
							background: '#CBD5E1',
							transform: 'translateX(-50%)',
						} }
					/>
				) ) }
			</div>

			{ /* Markers — absolutely positioned by layer_timestamp. The
			    height matches the marker tree so the connector line sits
			    flush against the axis above. */ }
			<div
				className="relative"
				style={ { height: 130, marginTop: 0 } }
				role="list"
				aria-label={ __( 'Interactive layers on the video timeline', 'godam' ) }
			>
				{ parents.length === 0 ? (
					<p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500 m-0">
						{ __(
							'No interactive layers in this video yet.',
							'godam',
						) }
					</p>
				) : (
					parents.map( ( parent ) => {
						const pct = Math.min(
							100,
							Math.max( 0, ( parent.timestamp / safeDuration ) * 100 ),
						);
						return (
							<div
								key={ parent.id }
								className="absolute top-0"
								style={ { left: `${ pct }%` } }
								role="listitem"
							>
								<LayerTimelineMarker
									parent={ parent }
									selected={ selectedParentId === parent.id }
									onSelect={ () => onSelect( parent.id ) }
								/>
							</div>
						);
					} )
				) }
			</div>
		</div>
	);
};

export default LayerTimelineStrip;
