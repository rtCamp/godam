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
	subHotspotColor,
	withAlpha,
} from '../constants/layerTypes';

/**
 * SubHotspotRail
 *
 * Left rail in the detail panel for Hotspot / Woo layers. Pinned "All
 * Products (Aggregate)" row at the top, then per-sub-hotspot rows sorted
 * by conversion-rate descending. Selecting a row swaps the funnel on the
 * right; the parent layer's color border on the detail panel doesn't
 * change — it identifies the layer, not the selected sub.
 *
 * For Woo layers, sub-rows are products with names + prices ("Red Hoodie
 * 24%"). For plain Hotspot layers, sub-rows usually lack meaningful names
 * — the fallback shows "Hotspot N" with a sequential color dot.
 *
 * @param {Object}      props
 * @param {Object}      props.parent        The parent layer entry.
 * @param {string|null} props.selectedSubId Currently selected sub-hotspot id, or null for aggregate.
 * @param {Function}    props.onSelect      (subId | null) => void — called when a row is clicked.
 * @return {JSX.Element|null} The rail, or null if the parent has no sub-hotspots.
 */
const SubHotspotRail = ( { parent, selectedSubId, onSelect } ) => {
	const meta = LAYER_TYPE_BY_ID[ parent?.layer_type ];

	if ( ! meta || ! meta.hasSubHotspots ) {
		return null;
	}

	const subs = Array.isArray( parent.sub_hotspots ) ? parent.sub_hotspots : [];

	const aggregateActive = ! selectedSubId;

	return (
		<aside
			className="flex flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden"
			style={ { minHeight: 280 } }
		>
			<header className="px-4 py-3 border-b border-zinc-200 flex items-center gap-2">
				<h4 className="text-sm font-semibold text-zinc-800 m-0">
					{ parent.layer_type === 'woo'
						? __( 'Hotspots in this layer', 'godam' )
						: __( 'Hotspots in this layer', 'godam' ) }
				</h4>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="text-zinc-400"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="16" x2="12" y2="12" />
					<circle cx="12" cy="8" r="0.5" fill="currentColor" />
				</svg>
			</header>

			<ul className="m-0 p-0 list-none overflow-y-auto" style={ { maxHeight: 340 } }>
				{ /* "All Products (Aggregate)" pinned at the top. */ }
				<li>
					<button
						type="button"
						onClick={ () => onSelect( null ) }
						className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left border-b border-zinc-100 cursor-pointer"
						style={ {
							background: aggregateActive
								? withAlpha( meta.color, 0.08 )
								: 'transparent',
						} }
					>
						<span
							className="text-sm font-semibold"
							style={ {
								color: aggregateActive ? meta.color : '#1F2937',
							} }
						>
							{ parent.layer_type === 'woo'
								? __( 'All Products (Aggregate)', 'godam' )
								: __( 'All Hotspots (Aggregate)', 'godam' ) }
						</span>
						<span
							className="text-sm font-semibold tabular-nums"
							style={ {
								color: aggregateActive ? meta.color : '#475569',
							} }
						>
							{ ( Number( parent.conversion_rate ) || 0 ).toFixed( 1 ) }%
						</span>
					</button>
				</li>

				{ subs.map( ( sub, idx ) => {
					const active = selectedSubId === sub.id;
					const dotColor = subHotspotColor( meta.color, idx );
					return (
						<li key={ sub.id }>
							<button
								type="button"
								onClick={ () => onSelect( sub.id ) }
								className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left cursor-pointer"
								style={ {
									background: active
										? withAlpha( meta.color, 0.08 )
										: 'transparent',
									transition: 'background-color 140ms ease-out',
								} }
							>
								<span className="flex items-center gap-2 min-w-0">
									<span
										aria-hidden="true"
										style={ {
											width: 8,
											height: 8,
											borderRadius: '50%',
											background: dotColor,
											flexShrink: 0,
										} }
									/>
									<span className="text-sm text-zinc-700 truncate">
										{ sub.name }
									</span>
								</span>
								<span
									className="text-sm font-medium tabular-nums shrink-0"
									style={ {
										color: active ? meta.color : '#475569',
									} }
								>
									{ ( Number( sub.conversion_rate ) || 0 ).toFixed( 1 ) }%
								</span>
							</button>
						</li>
					);
				} ) }
			</ul>
		</aside>
	);
};

export default SubHotspotRail;
