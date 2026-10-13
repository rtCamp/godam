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

const AdsLayer = ( { layerID, goBack, duration } ) => {
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);

	return (
		<>
			<LayersHeader layer={ layer } goBack={ goBack } duration={ duration } />

			<div className="godam-ve-config">
				<CustomAdSettings layerID={ layer.id } />
			</div>

			<LayerControls>
				<div
					className="easydam-layer"
					style={ {
						position: 'absolute',
						inset: 0,
						background: 'rgba(255, 255, 255, 0.7)',
					} }
				>
					<h3
						style={ {
							position: 'absolute',
							right: 24,
							bottom: 16,
							margin: 0,
							fontSize: '1.5rem',
							fontWeight: 600,
							color: '#6b7280',
						} }
					>
						{ __( 'Self hosted video Ad', 'godam' ) }
					</h3>
				</div>
			</LayerControls>
		</>
	);
};

export default AdsLayer;
