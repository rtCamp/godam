/**
 * WordPress dependencies
 */
import { __, _x, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import '../APIKey/api-key.scss';

/**
 * A utility function to calculate the percentage of used storage or bandwidth.
 *
 * @param {number} used  - The amount of storage or bandwidth used.
 * @param {number} total - The total amount of storage or bandwidth available.
 * @return {number} - The percentage of used storage or bandwidth, rounded to two decimal places.
 */
const calculatePercentage = ( used, total ) => {
	const usedValue = parseFloat( used ) || 0;
	const totalValue = parseFloat( total ) || 0;

	if ( totalValue === 0 ) {
		return 0;
	}

	try {
		const result = ( usedValue / totalValue ) * 100;
		return result.toFixed( 2 );
	} catch ( error ) {
		return 0;
	}
};

/**
 * Single usage card (label, percentage, progress bar and totals).
 *
 * @param {Object} param0       - Component props.
 * @param {string} param0.label - The meter label (e.g. "Bandwidth").
 * @param {number} param0.used  - The amount used.
 * @param {number} param0.total - The total amount available on the plan.
 *
 * @return {JSX.Element} The rendered card.
 */
const PlanUsageCard = ( { label, used, total } ) => {
	const usedValue = parseFloat( used ) || 0;
	const totalValue = parseFloat( total ) || 0;
	const percentage = calculatePercentage( usedValue, totalValue );

	return (
		<div className="godam-plan-usage__card">
			<div className="godam-plan-usage__head">
				<span className="godam-plan-usage__label">{ label }</span>
				<span className="godam-plan-usage__pct">{ percentage }%</span>
			</div>
			<div className="godam-plan-usage__bar">
				<div
					className={ `godam-plan-usage__bar-fill ${ percentage > 90 ? 'is-over' : '' }` }
					style={ { width: `${ percentage }%` } }
				/>
			</div>
			<div className="godam-plan-usage__meta">
				<span className="godam-plan-usage__used">
					{ usedValue.toFixed( 2 ) } { _x( 'GB', 'gigabyte', 'godam' ) }
				</span>
				<span className="godam-plan-usage__avail">
					{ sprintf(
						/* translators: %s: total plan size in gigabytes */
						__( 'of %s GB available', 'godam' ),
						Math.round( totalValue ).toLocaleString( 'en-US' ),
					) }
				</span>
			</div>
		</div>
	);
};

/**
 * Plan Usage — bandwidth and storage consumption for the active plan.
 *
 * Rendered inside the API Settings card. Usage figures are provided by the
 * server via `window.userData`.
 *
 * @return {JSX.Element} The rendered section.
 */
const UsageData = () => {
	const userData = window?.userData || {};

	return (
		<div className="godam-plan-usage">
			<h3 className="godam-plan-usage__title">{ __( 'Plan Usage', 'godam' ) }</h3>
			<div className="godam-plan-usage__cards">
				<PlanUsageCard
					label={ __( 'Bandwidth', 'godam' ) }
					used={ userData.bandwidthUsed }
					total={ userData.totalBandwidth }
				/>
				<PlanUsageCard
					label={ __( 'Storage', 'godam' ) }
					used={ userData.storageUsed }
					total={ userData.totalStorage }
				/>
			</div>
		</div>
	);
};

export default UsageData;
