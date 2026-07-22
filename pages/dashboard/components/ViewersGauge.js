/**
 * External dependencies
 */
import React from 'react';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * ViewersGauge — a semicircle gauge for the "Total Plays / Unique Viewers" card.
 *
 * The arc is two-tone in the admin accent colour: the light track is the
 * background (Total Plays) and the dark fill is the Unique Viewers portion
 * (uniqueViewers / plays). The center shows the unique-viewer count; hovering
 * the gauge reveals a tooltip with both raw values.
 *
 * FE-only: uses data already in the dashboard metrics payload. Full numbers.
 *
 * `uniqueViewers` of `null`/`undefined` means unavailable (range mode has no
 * range-scoped unique count until the uniqExactState rollup) and renders "—"
 * with no dark fill arc.
 *
 * @param {Object}      props
 * @param {number}      props.plays         Total plays.
 * @param {number|null} props.uniqueViewers Deduplicated distinct-person count.
 * @return {JSX.Element} The gauge.
 */
const ViewersGauge = ( { plays = 0, uniqueViewers = 0 } ) => {
	const playsNum = Number( plays ) || 0;
	// Distinguish "unavailable" (null/undefined, e.g. range mode) from a real 0.
	const viewersUnavailable = uniqueViewers === null || uniqueViewers === undefined;
	const viewersNum = viewersUnavailable ? 0 : ( Number( uniqueViewers ) || 0 );
	const viewersDisplay = viewersUnavailable ? '—' : viewersNum.toLocaleString();

	// Top semicircle arc: from (20,100) to (180,100), radius 80.
	const radius = 80;
	const arcLength = Math.PI * radius;
	// No dark fill when uniques are unavailable — only the total-plays track shows.
	const ratio = ( ! viewersUnavailable && playsNum > 0 ) ? Math.min( viewersNum / playsNum, 1 ) : 0;
	const dash = ratio * arcLength;
	const arcPath = 'M 20 100 A 80 80 0 0 1 180 100';

	return (
		<div className="godam-gauge">
			<div className="godam-gauge__chart">
				<svg
					className="godam-gauge__svg"
					viewBox="0 0 200 112"
					role="img"
					aria-label={ sprintf(
						/* translators: 1: unique viewers count, 2: total plays count. */
						__( '%1$s unique viewers of %2$s total plays', 'godam' ),
						viewersNum.toLocaleString(),
						playsNum.toLocaleString(),
					) }
				>
					<path
						className="godam-gauge__track"
						d={ arcPath }
						fill="none"
						strokeWidth="16"
						strokeLinecap="round"
					/>
					{ /* Only draw the fill arc when there's something to show — a
					    zero-length dash with a round linecap would otherwise render
					    a stray dot at the arc start. */ }
					{ dash > 0 && (
						<path
							className="godam-gauge__fill"
							d={ arcPath }
							fill="none"
							strokeWidth="16"
							strokeLinecap="round"
							strokeDasharray={ `${ dash } ${ arcLength }` }
						/>
					) }
				</svg>

				<div className="godam-gauge__center">
					<span className="godam-gauge__value">{ viewersDisplay }</span>
					<span className="godam-gauge__label">{ __( 'Unique viewers', 'godam' ) }</span>
				</div>

				<div className="godam-gauge__tooltip" role="tooltip">
					<div className="godam-gauge__tooltip-row">
						<span className="godam-gauge__swatch godam-gauge__swatch--light" aria-hidden="true" />
						<span className="godam-gauge__tooltip-label">{ __( 'Total Plays', 'godam' ) }</span>
						<span className="godam-gauge__tooltip-value">{ playsNum.toLocaleString() }</span>
					</div>
					<div className="godam-gauge__tooltip-row">
						<span className="godam-gauge__swatch godam-gauge__swatch--dark" aria-hidden="true" />
						<span className="godam-gauge__tooltip-label">{ __( 'Unique Viewers', 'godam' ) }</span>
						<span className="godam-gauge__tooltip-value">{ viewersDisplay }</span>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ViewersGauge;
