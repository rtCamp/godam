/**
 * External dependencies
 */
import React from 'react';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import InfoTooltip from './InfoTooltip';
import TrendBadge from './TrendBadge';

// Geometry. A plain SVG ring drawn with stroke-dasharray, deliberately not d3:
// one arc needs no scales, no axes and no layout, and this keeps the layer panel
// free of a charting dependency it would otherwise only use here.
const SIZE = 168;
const STROKE = 18;
const RADIUS = ( SIZE - STROKE ) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Viewer Reach donut for the layer detail panel (Figma W7–W11).
 *
 * The centre is Viewer Reach: how many viewers were still watching when this
 * layer appeared, read from the retention array. The ring is the layer's
 * headline action as a share of its own impressions.
 *
 * Those two numbers count different populations on purpose, so the ring is
 * never drawn as a fraction of the centre value. The tooltip spells the
 * distinction out, and the arc legend shows the action's own tally.
 *
 * Renders nothing when reach is unknown (no retention data for the range, or the
 * layer sits past the length recorded with these events). Hiding beats drawing
 * an empty ring, which reads as "no viewers reached this layer".
 *
 * @param {Object}      props
 * @param {number|null} props.reach      Viewers at the layer's second, or null.
 * @param {string}      props.arcLabel   Display label for the ring's action.
 * @param {number}      props.arcValue   That action's count.
 * @param {number|null} props.arcShare   That action as a percentage of impressions.
 * @param {number|null} [props.delta]    Reach change vs the previous equal window.
 * @param {number|null} [props.spanDays] Length of the compared window.
 * @return {JSX.Element|null} The donut, or null when reach is unknown.
 */
const LayerReachDonut = ( {
	reach,
	arcLabel,
	arcValue,
	arcShare,
	delta = null,
	spanDays = null,
} ) => {
	if ( reach === null || reach === undefined ) {
		return null;
	}

	// The ring length is the action's share of impressions, bounded to the
	// circle for drawing only. A share above 100% (counts that genuinely
	// disagree) still shows its true value in the legend and the tile.
	const share = Number.isFinite( Number( arcShare ) ) ? Number( arcShare ) : 0;
	const drawn = Math.max( 0, Math.min( 100, share ) );
	const dash = ( drawn / 100 ) * CIRCUMFERENCE;

	return (
		<div
			className="flex flex-col items-center gap-2 py-2"
			data-test-id="godam-layer-reach-donut"
		>
			<div className="relative" style={ { width: SIZE, height: SIZE } }>
				<svg
					width={ SIZE }
					height={ SIZE }
					viewBox={ `0 0 ${ SIZE } ${ SIZE }` }
					role="img"
					aria-label={ sprintf(
						/* translators: 1: viewer reach count, 2: action label, 3: action count. */
						__( 'Viewer reach %1$s, %2$s %3$s', 'godam' ),
						Number( reach ).toLocaleString(),
						arcLabel,
						Number( arcValue || 0 ).toLocaleString(),
					) }
				>
					{ /* Track. */ }
					<circle
						cx={ SIZE / 2 }
						cy={ SIZE / 2 }
						r={ RADIUS }
						fill="none"
						stroke="color-mix(in srgb, var(--wp-admin-theme-color, #ab3a6c) 18%, white)"
						strokeWidth={ STROKE }
					/>
					{ /* Arc, starting at 12 o'clock. */ }
					{ dash > 0 && (
						<circle
							cx={ SIZE / 2 }
							cy={ SIZE / 2 }
							r={ RADIUS }
							fill="none"
							stroke="var(--wp-admin-theme-color, #ab3a6c)"
							strokeWidth={ STROKE }
							strokeLinecap="round"
							strokeDasharray={ `${ dash } ${ CIRCUMFERENCE - dash }` }
							transform={ `rotate(-90 ${ SIZE / 2 } ${ SIZE / 2 })` }
						/>
					) }
				</svg>

				{ /* Centre label. Absolutely positioned rather than an SVG
				    <text> so it inherits the panel's font stack and the
				    tooltip button can be a real focusable element. */ }
				<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
					<span className="text-2xl font-semibold text-zinc-900 tabular-nums">
						{ Number( reach ).toLocaleString() }
					</span>
					<span className="flex items-center gap-1 text-xs text-zinc-500 pointer-events-auto">
						{ __( 'Viewer Reach', 'godam' ) }
						<InfoTooltip
							size={ 13 }
							text={ __(
								'Viewers still watching when this layer appeared, from the same retention data as the Viewer Retention Curve. It counts viewers, while the ring counts this layer\'s own interactions, so the two are not a fraction of one another.',
								'godam',
							) }
						/>
					</span>
				</div>
			</div>

			{ /* Arc legend: which action the ring represents, and its tally. */ }
			<div className="flex items-center gap-1.5 text-xs text-zinc-600">
				<span
					className="inline-block rounded-sm"
					style={ {
						width: 9,
						height: 9,
						background: 'var(--wp-admin-theme-color, #ab3a6c)',
					} }
				/>
				<span>{ arcLabel }</span>
				<span className="font-medium text-zinc-900 tabular-nums">
					{ Number( arcValue || 0 ).toLocaleString() }
				</span>
			</div>

			<TrendBadge
				delta={ delta }
				spanDays={ spanDays }
				testId="godam-layer-reach-trend"
			/>
		</div>
	);
};

export default LayerReachDonut;
