/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Modal, SelectControl, ToggleControl, ColorPalette, TextareaControl, TabPanel } from '@wordpress/components';
import { arrowLeft, chevronRight, trash } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { removeLayer, updateLayerField } from '../../redux/slice/videoSlice';
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
			<div className="flex justify-between items-center pb-3 border-b mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<p className="font-semibold">
					{ __( 'Ad layer at', 'transcoder' ) } { layer.displayTime }s
				</p>
				<Button icon={ trash } isDestructive onClick={ () => setOpen( true ) } />
				{ isOpen && (
					<Modal
						title={ __( 'Delete layer', 'transcoder' ) }
						onRequestClose={ () => setOpen( false ) }
					>
						<div className="flex justify-between items-center gap-3">
							<Button
								className="w-full justify-center"
								isDestructive
								variant="primary"
								onClick={ handleDeleteLayer }
							>
								{ __( 'Delete layer', 'transcoder' ) }
							</Button>
							<Button
								className="w-full justify-center"
								variant="secondary"
								onClick={ () => setOpen( false ) }
							>
								{ __( 'Cancel', 'transcoder' ) }
							</Button>
						</div>
					</Modal>
				) }
			</div>

			<div>
				<TabPanel
					onSelect={ () => {} }
					className="sidebar-tabs"
					tabs={ [
						{
							name: 'adTagUrl',
							title: 'AdTag URL',
							className: 'flex-1 justify-center items-center',
							component: <TextareaControl
								label={ __( 'AdTag URL', 'transcoder' ) }
								help={ __( 'Enter the ad tag URL from your Ad server, check ', 'transcoder' ) }
								value={ layer?.adTagUrl }
								onChange={ ( val ) => dispatch( updateLayerField( { id: layer.id, field: 'adTagUrl', value: val } ) ) }
							/>,
						},
						{
							name: 'selfHostedVideoAd',
							title: 'Self Hosted Video Ad',
							className: 'flex-1 justify-center items-center',
							component: <CustomAdSettings layerID={ layer.id } />,
						},
					] }
				>
					{ ( tab ) => <div className="py-4">{ tab.component }</div> }
				</TabPanel>

			</div>

			<LayerControls>
				<>
				</>
			</LayerControls>
		</>
	);
};

export default CTALayer;
