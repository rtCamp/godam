/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import LayerControl from '../LayerControls';

const HubSpotForm = ( { layerID } ) => {
	const layer = useSelector( ( state ) => state.videoReducer.godamCentralLayers.find( ( _layer ) => _layer.id === layerID ) );

	return (
		<>
			{
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'This form can only be edited from GoDAM Central.', 'godam' ) }
				</Notice>
			}

			<LayerControl>
				<>
					<div
						style={ {
							backgroundColor: layer.backgroundColor,
							opacity: layer.backgroundOpacity,
						} }
						className="easydam-layer"
					>
					</div>
				</>
			</LayerControl>
		</>
	);
};

export default HubSpotForm;
