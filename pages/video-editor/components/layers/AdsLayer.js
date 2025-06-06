/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import LayerControls from '../LayerControls';
import CustomAdSettings from '../ads/CustomAdSettings';
import LayersHeader from './LayersHeader';

const CTALayer = ( { layerID, goBack, duration } ) => {
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);

	return (
		<>
			<LayersHeader layer={ layer } goBack={ goBack } duration={ duration } />

			<div>
				<CustomAdSettings layerID={ layer.id } />
			</div>

			<LayerControls>
				<div className="absolute inset-0 px-4 py-8 bg-white bg-opacity-70 my-auto">
					<h3 className="text-2xl font-semibold text-gray-500 absolute bottom-4 right-6">{ __( 'Self hosted video Ad', 'godam' ) }</h3>
				</div>
			</LayerControls>
		</>
	);
};

export default CTALayer;
