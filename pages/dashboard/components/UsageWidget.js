/**
 * WordPress dependencies
 */
import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { generateUsageDonutChart } from './ChartsDashboard';

/**
 * O8 usage / quota widget — bandwidth + storage donuts for the connected
 * account. Data comes from window.userData (the verify_api_key + usage fetch);
 * the donut renderer is the same one the Settings screen uses.
 */
const UsageWidget = () => {
	const u = window.userData || {};
	const hasUsage = !! u.validApiKey && ( u.totalStorage !== undefined || u.totalBandwidth !== undefined );

	useEffect( () => {
		if ( ! hasUsage ) {
			return;
		}
		const timer = setInterval( () => {
			const bandwidthEl = document.querySelector( '#bandwidth-donut-chart' );
			const storageEl = document.querySelector( '#storage-donut-chart' );
			if ( bandwidthEl && storageEl ) {
				clearInterval( timer );
				generateUsageDonutChart( '#bandwidth-donut-chart', u.bandwidthUsed ?? 0, u.totalBandwidth ?? 0, 'bandwidth', __( 'Used', 'godam' ) );
				generateUsageDonutChart( '#storage-donut-chart', u.storageUsed ?? 0, u.totalStorage ?? 0, 'storage', __( 'Used', 'godam' ) );
			}
		}, 100 );
		return () => clearInterval( timer );
	}, [ hasUsage, u.bandwidthUsed, u.totalBandwidth, u.storageUsed, u.totalStorage ] );

	if ( ! hasUsage ) {
		return null;
	}

	return (
		<div className="godam-usage-widget" data-test-id="godam-dashboard-usage-widget">
			<div className="godam-usage-widget__item">
				<h3 className="godam-usage-widget__title">{ __( 'Bandwidth', 'godam' ) }</h3>
				<div id="bandwidth-donut-chart" className="godam-usage-widget__chart"></div>
			</div>
			<div className="godam-usage-widget__item">
				<h3 className="godam-usage-widget__title">{ __( 'Storage', 'godam' ) }</h3>
				<div id="storage-donut-chart" className="godam-usage-widget__chart"></div>
			</div>
		</div>
	);
};

export default UsageWidget;
