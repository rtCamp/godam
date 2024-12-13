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

const CTALayer = ( { layerID, goBack } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

	return (
		<>
			<div className="flex justify-between items-center pb-3 border-b mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<p className="font-semibold">{ __( 'Form layer at', 'transcoder' ) } { 5 }s</p>
				<Button icon={ trash } isDestructive onClick={ () => setOpen( true ) } />
				{ isOpen && (
					<Modal title={ __( 'Delete layer', 'transcoder' ) } onRequestClose={ () => setOpen( false ) }>
						<div className="flex justify-between items-center gap-3">
							<Button className="w-full justify-center" isDestructive variant="primary" onClick={ handleDeleteLayer }>
								{ __( 'Delete layer', 'transcoder' ) }
							</Button>
							<Button className="w-full justify-center" variant="secondary" onClick={ () => setOpen( false ) }>
								{ __( 'Cancel', 'transcoder' ) }
							</Button>
						</div>
					</Modal>
				) }
			</div>
		</>
	);
};

export default CTALayer;
