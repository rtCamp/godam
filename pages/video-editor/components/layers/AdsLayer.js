/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Modal } from '@wordpress/components';
import { arrowLeft, trash } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { removeLayer } from '../../redux/slice/videoSlice';
import LayerControls from '../LayerControls';
import CustomAdSettings from '../ads/CustomAdSettings';

const CTALayer = ( { layerID, goBack } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

	return (
		<>
			<div className="flex justify-between items-center border-b mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<p className="text-base">{ __( 'Ads layer at', 'godam' ) } { layer.displayTime }s</p>
				<Button icon={ trash } isDestructive onClick={ () => setOpen( true ) } />
				{ isOpen && (
					<Modal title={ __( 'Delete layer', 'godam' ) } onRequestClose={ () => setOpen( false ) }>
						<div className="flex justify-between items-center gap-3">
							<Button className="w-full justify-center" isDestructive variant="primary" onClick={ handleDeleteLayer }>
								{ __( 'Delete layer', 'godam' ) }
							</Button>
							<Button className="w-full justify-center" variant="secondary" onClick={ () => setOpen( false ) }>
								{ __( 'Cancel', 'godam' ) }
							</Button>
						</div>
					</Modal>
				) }
			</div>

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
