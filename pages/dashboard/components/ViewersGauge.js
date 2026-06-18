/**
 * External dependencies
 */
import React from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * ViewersGauge — a semicircle gauge for the "Total Plays / Unique Viewers" card.
 *
 * The headline is the unique-viewer count; the arc shows the unique-viewer share
 * of total plays (uniqueViewers / plays), i.e. how concentrated the audience is.
 * Total plays and the sessions-per-user ratio are shown as supporting stats.
 *
 * FE-only: uses data already in the dashboard metrics payload. Full numbers, no
 * hover tooltips (per the Figma design review).
 *
 * @param {Object} props
 * @param {number} props.plays         Total plays.
 * @param {number} props.uniqueViewers Deduplicated distinct-person count.
 * @return {JSX.Element} The gauge.
 */
const ViewersGauge = ( { plays = 0, uniqueViewers = 0 } ) => {
	const playsNum = Number( plays ) || 0;
	const viewersNum = Number( uniqueViewers ) || 0;

	// Top semicircle arc: from (20,100) to (180,100), radius 80.
	const radius = 80;
	const arcLength = Math.PI * radius;
	const ratio = playsNum > 0 ? Math.min( viewersNum / playsNum, 1 ) : 0;
	const dash = ratio * arcLength;

	const sessionsPerUser = viewersNum > 0 ? ( playsNum / viewersNum ).toFixed( 2 ) : null;
	const arcPath = 'M 20 100 A 80 80 0 0 1 180 100';

	return (
		<div className="godam-gauge">
			<div className="godam-gauge__chart">
				<svg
					className="godam-gauge__svg"
					viewBox="0 0 200 112"
					role="img"
					aria-label={ `${ viewersNum.toLocaleString() } ${ __( 'unique viewers', 'godam' ) }` }
				>
					<path
						className="godam-gauge__track"
						d={ arcPath }
						fill="none"
						strokeWidth="14"
						strokeLinecap="round"
					/>
					<path
						className="godam-gauge__fill"
						d={ arcPath }
						fill="none"
						strokeWidth="14"
						strokeLinecap="round"
						strokeDasharray={ `${ dash } ${ arcLength }` }
					/>
				</svg>
				<div className="godam-gauge__center">
					<span className="godam-gauge__value">{ viewersNum.toLocaleString() }</span>
					<span className="godam-gauge__label">{ __( 'Unique viewers', 'godam' ) }</span>
				</div>
			</div>

			<div className="godam-gauge__stats">
				<div className="godam-gauge__stat">
					<span className="godam-gauge__stat-value">{ playsNum.toLocaleString() }</span>
					<span className="godam-gauge__stat-label">{ __( 'Total plays', 'godam' ) }</span>
				</div>
				<div className="godam-gauge__stat">
					<span className="godam-gauge__stat-value">
						{ sessionsPerUser !== null ? `${ sessionsPerUser }×` : '—' }
					</span>
					<span className="godam-gauge__stat-label">{ __( 'Sessions / user', 'godam' ) }</span>
				</div>
			</div>
		</div>
	);
};

export default ViewersGauge;
