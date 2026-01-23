/**
 * WordPress dependencies
 */
import { __, _x } from '@wordpress/i18n';

/**
 * A Utility function to calculate the percentage of used storage or bandwidth.
 *
 * @param {number} used  - The amount of storage or bandwidth used.
 * @param {number} total - The total amount of storage or bandwidth available.
 * @return {number} - The percentage of used storage or bandwidth, rounded to two decimal places.
 */
const calculatePercentage = ( used, total ) => {
	if ( total === 0 ) {
		return 0;
	}
	try {
		const result = ( used / total ) * 100;
		return result.toFixed( 2 );
	} catch ( error ) {
		return 0;
	}
};

const UsageData = () => {
	const userData = window?.userData || {};

	const percentageBandwidthUsed = calculatePercentage( userData.bandwidthUsed, userData.totalBandwidth );
	const percentageStorageUsed = calculatePercentage( userData.storageUsed, userData.totalStorage );

	return (
		<div className="flex gap-4 flex-wrap">
			<div className="flex gap-3 items-center">
				<div className="circle-container">
					<div className="data text-xs">{ percentageBandwidthUsed }%</div>
					<div
						className={ `circle ${
							percentageBandwidthUsed > 90 ? 'red' : ''
						}` }
						style={ { '--percentage': percentageBandwidthUsed + '%' } }
					></div>
				</div>
				<div className="leading-6">
					<div className="easydam-settings-label text-base">{ __( 'BANDWIDTH', 'godam' ) }</div>
					<strong>{ __( 'Available:', 'godam' ) } </strong>{ parseFloat( Math.max( 0, ( userData.totalBandwidth || 0 ) - ( userData.bandwidthUsed || 0 ) ) ).toFixed( 2 ) }{ _x( 'GB', 'gigabyte', 'godam' ) }
					<br />
					<strong>{ __( 'Used:', 'godam' ) } </strong>{ parseFloat( userData.bandwidthUsed || 0 ).toFixed( 2 ) }{ _x( 'GB', 'gigabyte', 'godam' ) }
				</div>
			</div>
			<div className="flex gap-3 items-center">
				<div className="circle-container">
					<div className="data text-xs">{ percentageStorageUsed }%</div>
					<div
						className={ `circle ${
							percentageStorageUsed > 90 ? 'red' : ''
						}` }
						style={ { '--percentage': percentageStorageUsed + '%' } }
					></div>
				</div>
				<div className="leading-6">
					<div className="easydam-settings-label text-base">{ __( 'STORAGE', 'godam' ) }</div>
					<strong>{ __( 'Available:', 'godam' ) } </strong>{ parseFloat( Math.max( 0, ( userData.totalStorage || 0 ) - ( userData.storageUsed || 0 ) ) ).toFixed( 2 ) }{ _x( 'GB', 'gigabyte', 'godam' ) }
					<br />
					<strong>{ __( 'Used:', 'godam' ) } </strong>{ parseFloat( userData.storageUsed || 0 ).toFixed( 2 ) }{ _x( 'GB', 'gigabyte', 'godam' ) }
				</div>
			</div>
		</div>
	);
};

export default UsageData;
