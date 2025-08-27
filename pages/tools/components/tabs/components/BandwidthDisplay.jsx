/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

const BandwidthDisplay = ( { availableBandwidthGB, bandwidthUsed } ) => {
	return (
		<div className="flex gap-4 flex-wrap mb-4">
			<div>
				<strong>{ __( 'Bandwidth Available:', 'godam' ) }</strong> { parseFloat( availableBandwidthGB ).toFixed( 2 ) } GB
			</div>
			<div>
				<strong>{ __( 'Bandwidth Used:', 'godam' ) }</strong> { parseFloat( bandwidthUsed || 0 ).toFixed( 2 ) } GB
			</div>
		</div>
	);
};

export default BandwidthDisplay;
