/**
 * External dependencies
 */
import React, { useMemo } from 'react';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	LAYER_TYPE_BY_ID,
	actionLabel,
	withAlpha,
} from '../constants/layerTypes';

/**
 * Inline icon for a funnel action. Matches the mockup's iconography.
 *
 * @param {string} actionKey 'viewed', 'clicked', etc.
 * @return {JSX.Element} SVG element.
 */
function actionIcon( actionKey ) {
	const common = {
		width: 16,
		height: 16,
		viewBox: '0 0 24 24',
		fill: 'none',
		stroke: 'currentColor',
		strokeWidth: 1.8,
		strokeLinecap: 'round',
		strokeLinejoin: 'round',
		'aria-hidden': true,
	};
	switch ( actionKey ) {
		case 'viewed':
			return (
				<svg { ...common }>
					<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
					<circle cx="12" cy="12" r="3" />
				</svg>
			);
		case 'clicked':
			return (
				<svg { ...common }>
					<path d="M9 9l5 12 1.5-5.5L21 14 9 9z" />
					<path d="M5 5l3 3" />
					<path d="M3 11h3" />
				</svg>
			);
		case 'submitted':
		case 'voted':
			return (
				<svg { ...common }>
					<circle cx="12" cy="12" r="10" />
					<path d="M9 12l2 2 4-4" />
				</svg>
			);
		case 'hovered':
			return (
				<svg { ...common }>
					<circle cx="12" cy="12" r="9" />
					<line x1="4" y1="4" x2="20" y2="20" strokeDasharray="2 2" />
				</svg>
			);
		case 'skipped':
			return (
				<svg { ...common }>
					<polyline points="13 17 18 12 13 7" />
					<polyline points="6 17 11 12 6 7" />
				</svg>
			);
		case 'added_to_cart':
			return (
				<svg { ...common }>
					<circle cx="9" cy="20" r="1.6" />
					<circle cx="18" cy="20" r="1.6" />
					<path d="M2 3h3l2.7 13.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L23 6H6" />
				</svg>
			);
		case 'no_action':
			return (
				<svg { ...common }>
					<circle cx="12" cy="12" r="10" />
					<line x1="6" y1="12" x2="18" y2="12" />
				</svg>
			);
		default:
			return null;
	}
}

/**
 * Tone — how each bar relates to the layer's accent color. Viewed sits at
 * full opacity (the denominator), the conversion-side actions step through
 * lighter opacities, and No Action sits in muted grey so it reads as "the
 * leftover," not as engagement.
 *
 * @param {string} actionKey Funnel position id.
 * @return {{ fillAlpha: number, useGrey: boolean }} Visual descriptor.
 */
function toneFor( actionKey ) {
	switch ( actionKey ) {
		case 'viewed':
			return { fillAlpha: 1.0, useGrey: false };
		case 'hovered':
		case 'submitted':
		case 'voted':
			return { fillAlpha: 0.72, useGrey: false };
		case 'clicked':
			return { fillAlpha: 0.5, useGrey: false };
		case 'added_to_cart':
			return { fillAlpha: 0.36, useGrey: false };
		case 'skipped':
			return { fillAlpha: 0.55, useGrey: true };
		case 'no_action':
		default:
			return { fillAlpha: 1.0, useGrey: true };
	}
}

/**
 * LayerInteractionFunnel
 *
 * Vertical-bar funnel for a single layer (parent aggregate or sub-hotspot).
 * Bars are sized as a fraction of `viewed` so the viewer bar is always
 * full-height and downstream actions shrink proportionally. Per-type
 * funnel composition comes from constants/layerTypes.js — adding a new
 * layer type only needs an entry there, not a code change here.
 *
 * Tooltip text on the No Action bar is uniform across layer types
 * ("Viewers who saw this layer but didn't interact with it") even though
 * the per-type math differs.
 *
 * @param {Object} props
 * @param {string} props.layerType Layer type id.
 * @param {Object} props.counts    { viewed, hovered, clicked, ... }
 * @param {number} props.noAction  Precomputed no_action count.
 * @return {JSX.Element|null} The funnel block, or null if layerType unknown.
 */
const LayerInteractionFunnel = ( { layerType, counts, noAction } ) => {
	const meta = LAYER_TYPE_BY_ID[ layerType ];

	const bars = useMemo( () => {
		if ( ! meta ) {
			return [];
		}
		const viewed = Math.max( 0, Number( counts?.viewed ) || 0 );
		return meta.funnel.map( ( action ) => {
			const value =
				action === 'no_action'
					? Math.max( 0, Number( noAction ) || 0 )
					: Math.max( 0, Number( counts?.[ action ] ) || 0 );
			const pct = viewed > 0 ? ( value / viewed ) * 100 : 0;
			return { action, value, pct };
		} );
	}, [ meta, counts, noAction ] );

	if ( ! meta ) {
		return null;
	}

	return (
		<div className="rounded-xl p-3 sm:p-5 border border-zinc-200 bg-white">
			<div className="flex items-center gap-2 mb-1">
				<h4 className="text-sm font-semibold text-zinc-800 m-0">
					{ __( 'Interaction Outcomes', 'godam' ) }
				</h4>
			</div>
			<p className="text-xs text-zinc-500 m-0 mb-4">
				{ __( 'Out of all viewers who saw this layer', 'godam' ) }
			</p>

			{ /* The three rows (counts / bars / percentages) share one
			    horizontal-scroll track with a per-bar minimum width, so on
			    narrow (mobile) widths the bars stay legible and the rows stay
			    column-aligned instead of crushing together. */ }
			<div className="overflow-x-auto">
				<div style={ { minWidth: bars.length * 64 } }>
					{ /* Counts row */ }
					<div
						className="grid gap-3 mb-3"
						style={ {
							gridTemplateColumns: `repeat(${ bars.length }, minmax(0, 1fr))`,
						} }
					>
						{ bars.map( ( bar ) => (
							<div
								key={ bar.action }
								className="flex flex-col items-center text-center"
							>
								<div
									className="flex items-center gap-1.5 text-zinc-500"
									style={ { lineHeight: 1 } }
								>
									{ actionIcon( bar.action ) }
									<span className="text-[11px] uppercase tracking-wide">
										{ actionLabel( bar.action ) }
									</span>
								</div>
								<p className="text-xl font-semibold text-zinc-900 mt-1.5 mb-0">
									{ bar.value.toLocaleString() }
								</p>
							</div>
						) ) }
					</div>

					{ /* Bars row — heights as % of the tallest bar (viewed). */ }
					<div
						className="grid gap-3 items-end"
						style={ {
							gridTemplateColumns: `repeat(${ bars.length }, minmax(0, 1fr))`,
							height: '160px',
						} }
					>
						{ bars.map( ( bar, idx ) => {
							const tone = toneFor( bar.action );
							const heightPct = Math.max( bar.pct, bar.value > 0 ? 4 : 0 );
							const color = tone.useGrey ? '#94A3B8' : meta.color;
							const background = withAlpha( color, tone.fillAlpha );
							let ariaLabel;
							if ( bar.action === 'no_action' ) {
								ariaLabel = sprintf(
									/* translators: %1$s value, %2$s percentage */
									__( '%1$s viewers (%2$s%%) saw this layer but didn\'t interact with it.', 'godam' ),
									bar.value.toLocaleString(),
									bar.pct.toFixed( 1 ),
								);
							} else {
								ariaLabel = sprintf(
									/* translators: %1$s action name, %2$s value, %3$s percentage */
									__( '%1$s: %2$s viewers (%3$s%%).', 'godam' ),
									actionLabel( bar.action ),
									bar.value.toLocaleString(),
									bar.pct.toFixed( 1 ),
								);
							}
							return (
								<div
									key={ bar.action }
									className="flex items-end h-full"
									title={ ariaLabel }
								>
									<div
										className="w-full rounded-t-md"
										style={ {
											height: `${ heightPct }%`,
											background,
											minHeight: bar.value > 0 ? 8 : 0,
											transition:
										'height 360ms cubic-bezier(0.22, 1, 0.36, 1)',
											transitionDelay: `${ idx * 40 }ms`,
										} }
										role="img"
										aria-label={ ariaLabel }
									/>
								</div>
							);
						} ) }
					</div>

					{ /* Percentage row */ }
					<div
						className="grid gap-3 mt-3"
						style={ {
							gridTemplateColumns: `repeat(${ bars.length }, minmax(0, 1fr))`,
						} }
					>
						{ bars.map( ( bar ) => {
							const tone = toneFor( bar.action );
							const color = tone.useGrey ? '#475569' : meta.color;
							return (
								<div
									key={ bar.action }
									className="text-center"
								>
									<p
										className="text-lg font-semibold m-0"
										style={ { color } }
									>
										{ bar.pct.toFixed( 1 ) }%
									</p>
									<p className="text-[11px] text-zinc-500 m-0">
										{ __( 'of viewers', 'godam' ) }
									</p>
								</div>
							);
						} ) }
					</div>
				</div>
			</div>
		</div>
	);
};

export default LayerInteractionFunnel;
