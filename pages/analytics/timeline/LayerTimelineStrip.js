/**
 * External dependencies
 */
import React, { useMemo, useRef, useState, useLayoutEffect } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import LayerTimelineMarker from './LayerTimelineMarker';

import {
	LANE_STEP_PX,
	BASE_TRACK_HEIGHT_PX,
	assignLanes,
} from './lanes';

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
 * Layers firing at near-identical timestamps would overlap, so markers are
 * packed into vertical lanes (see `assignLanes`): each keeps its true
 * horizontal position but the connector lengthens to drop colliding markers
 * onto lower rows. The strip also keeps a minimum width and scrolls
 * horizontally on narrow viewports, so the axis, ticks and markers stay
 * legible (and aligned) on mobile instead of crushing together. Shared by the
 * active timeline and the removed-layers drawer.
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

	// Measure the marker track so lane collisions are computed against the real
	// pixel width (it grows past the 560px minimum on wider screens, and scrolls
	// below it). Re-measures on resize.
	const trackRef = useRef( null );
	const [ trackWidth, setTrackWidth ] = useState( 0 );
	useLayoutEffect( () => {
		const el = trackRef.current;
		if ( ! el ) {
			return undefined;
		}
		const measure = () => setTrackWidth( el.clientWidth );
		measure();
		if ( typeof ResizeObserver === 'undefined' ) {
			return undefined;
		}
		const observer = new ResizeObserver( measure );
		observer.observe( el );
		return () => observer.disconnect();
	}, [] );

	const { lanes, laneCount } = useMemo(
		() => assignLanes( parents, safeDuration, trackWidth ),
		[ parents, safeDuration, trackWidth ],
	);

	// One lane fits in the base height; each extra lane drops markers further
	// down, so the track has to grow to hold them.
	const trackHeight =
		BASE_TRACK_HEIGHT_PX + ( Math.max( 0, laneCount - 1 ) * LANE_STEP_PX );

	return (
		<div className="pt-4 pb-2 overflow-x-auto">
			{ /* Inner track keeps a usable minimum width so ticks/axis/markers
			    stay aligned and legible; the wrapper scrolls horizontally on
			    narrow (mobile) viewports rather than letting markers collide. */ }
			<div className="px-6" style={ { minWidth: 560 } }>
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
					ref={ trackRef }
					className="relative"
					style={ { height: trackHeight, marginTop: 0 } }
					role="list"
					aria-label={ __( 'Interactive layers on the video timeline', 'godam' ) }
				>
					{ parents.length === 0 ? (
						<div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 m-0">
							<p className="text-sm font-medium text-zinc-700 m-0">
								{ __( 'Nothing to show yet', 'godam' ) }
							</p>
							<p className="text-xs text-zinc-500 m-0 mt-1 max-w-md">
								{ __(
									'Layer analytics appear after the video is played on the front end and the activity is processed. A layer you just added won\'t have data until viewers interact with it.',
									'godam',
								) }
							</p>
						</div>
					) : (
						parents.map( ( parent, idx ) => {
							const pct = Math.min(
								100,
								Math.max( 0, ( parent.timestamp / safeDuration ) * 100 ),
							);
							// Shallower lanes stack above deeper ones, so a deeper
							// lane's long connector renders BEHIND the cards it
							// crosses (a lane-0 card stays fully clickable even when
							// a lower marker's line passes over it).
							const zIndex = laneCount - lanes[ idx ];
							return (
								<div
									key={ parent.id }
									className="absolute top-0"
									style={ { left: `${ pct }%`, zIndex } }
									role="listitem"
								>
									<LayerTimelineMarker
										parent={ parent }
										selected={ selectedParentId === parent.id }
										onSelect={ () => onSelect( parent.id ) }
										laneOffset={ lanes[ idx ] * LANE_STEP_PX }
									/>
								</div>
							);
						} )
					) }
				</div>
			</div>
		</div>
	);
};

export default LayerTimelineStrip;
