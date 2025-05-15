/* global userData */

/**
 * WordPress dependencies
 */
/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

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
	return (
		<div className="flex gap-4 flex-wrap">

			{
				userData.storageBandwidthError ? (
					<p className="text-yellow-700 text-xs h-max">{ userData.storageBandwidthError }</p>
				) : (
					<>
						<div className="flex gap-3 items-center">
							<div className="circle-container">
								<div className="data text-xs">{ calculatePercentage( userData.bandwidth_used, userData.total_bandwidth ) }%</div>
								<div
									className={ `circle ${
										calculatePercentage( userData.bandwidth_used, userData.total_bandwidth ) > 90 ? 'red' : ''
									}` }
									style={ { '--percentage': calculatePercentage( userData.bandwidth_used, userData.total_bandwidth ) + '%' } }
								></div>
							</div>
							<div className="leading-6">
								<div className="easydam-settings-label text-base">{ __( 'BANDWIDTH', 'godam' ) }</div>
								<strong>{ __( 'Available: ', 'godam' ) }</strong>{ parseFloat( userData.total_bandwidth - userData.bandwidth_used ).toFixed( 2 ) }{ __( 'GB', 'godam' ) }
								<br />
								<strong>{ __( 'Used: ', 'godam' ) }</strong>{ parseFloat( userData.bandwidth_used ).toFixed( 2 ) }{ __( 'GB', 'godam' ) }
							</div>
						</div>
						<div className="flex gap-3 items-center">
							<div className="circle-container">
								<div className="data text-xs">{ calculatePercentage( userData.storage_used, userData.total_storage ) }%</div>
								<div
									className={ `circle ${
										calculatePercentage( userData.storage_used, userData.total_storage ) > 90 ? 'red' : ''
									}` }
									style={ { '--percentage': calculatePercentage( userData.storage_used, userData.total_storage ) + '%' } }
								></div>
							</div>
							<div className="leading-6">
								<div className="easydam-settings-label text-base">{ __( 'STORAGE', 'godam' ) }</div>
								<strong>{ __( 'Available: ', 'godam' ) }</strong>{ parseFloat( userData.total_storage - userData.storage_used ).toFixed( 2 ) }{ __( 'GB', 'godam' ) }
								<br />
								<strong>{ __( 'Used: ', 'godam' ) }</strong>{ parseFloat( userData.storage_used ).toFixed( 2 ) }{ __( 'GB', 'godam' ) }
							</div>
						</div>
					</>
				)
			}
		</div>
	);
};

export default UsageData;
