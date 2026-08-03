/**
 * External dependencies
 */
import React from 'react';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';
import { arrowDown, arrowUp } from '@wordpress/icons';

/**
 * Period-over-period trend badge for a layer KPI.
 *
 * Renders as an arrow + coloured percentage + muted "vs prev N days" label,
 * matching the treatment on the dashboard and per-video KPI cards. Renders
 * nothing when `delta` is null, which is how "no comparable previous window"
 * is expressed (an All Time range, or a layer with no data before this range).
 *
 * A rising number is green and a falling one red. That reads correctly for
 * every metric this panel shows, because all of them are metrics you want to
 * go up: reach, CTR, submission rate. The two exceptions, Abandon Rate and
 * Skip Rate, do not get a badge (only the primary tile and the donut do).
 *
 * @param {Object}      props
 * @param {number|null} props.delta      Percentage change, or null to render nothing.
 * @param {number|null} [props.spanDays] Length of the compared window, for the label.
 * @param {string}      [props.testId]   data-test-id hook.
 * @return {JSX.Element|null} The badge, or null.
 */
const TrendBadge = ( { delta, spanDays = null, testId } ) => {
	if ( delta === null || delta === undefined || ! Number.isFinite( Number( delta ) ) ) {
		return null;
	}

	const value = Number( delta );
	const rising = value > 0;
	const flat = value === 0;
	// Rising is green, falling red, unchanged muted. Every metric that carries a
	// badge here is one you want to go up (reach, CTR, submission rate); the two
	// "lower is better" rates, Abandon and Skip, are secondary tiles and get no
	// badge at all.
	let toneClass = 'text-emerald-600';
	if ( flat ) {
		toneClass = 'text-zinc-500';
	} else if ( ! rising ) {
		toneClass = 'text-red-600';
	}
	const label = spanDays
		? sprintf(
			/* translators: %d: number of days in the comparison window. */
			__( 'vs prev %d days', 'godam' ),
			spanDays,
		)
		: __( 'vs prev period', 'godam' );

	return (
		<span
			className="inline-flex items-center gap-1 text-[11px]"
			data-test-id={ testId }
		>
			{ ! flat && (
				<span className={ rising ? 'text-emerald-600' : 'text-red-600' }>
					<Icon icon={ rising ? arrowUp : arrowDown } size={ 12 } />
				</span>
			) }
			<span className={ `font-medium ${ toneClass }` }>
				{ /* One decimal, and the sign carried by the arrow rather than
				    repeated in the text. */ }
				{ `${ Math.abs( +value.toFixed( 1 ) ) }%` }
			</span>
			<span className="text-zinc-400 whitespace-nowrap">{ label }</span>
		</span>
	);
};

export default TrendBadge;
