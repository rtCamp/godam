/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';
/**
 * Internal dependencies
 */
import { addLayer } from '../redux/slice/videoSlice';
import { v4 as uuidv4 } from 'uuid';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Button, Icon, Modal, DropdownMenu } from '@wordpress/components';
import { plus, preformatted, customLink, video, arrowRight } from '@wordpress/icons';
import { useState } from '@wordpress/element';
import Layer from './layers/Layer';

const layerTypes = [
	{
		title: __( 'Gravity Forms', 'transcoder' ),
		icon: preformatted,
		type: 'form',
	},
	{
		title: __( 'CTA', 'transcoder' ),
		icon: customLink,
		type: 'cta',
	},
	// {
	// 	title: __( 'Ad', 'transcoder' ),
	// 	icon: video,
	// 	type: 'ad',
	// },
];

const SidebarLayers = () => {
	const [ isOpen, setOpen ] = useState( false );
	const openModal = () => setOpen( true );
	const closeModal = () => setOpen( false );

	const [ selectedLayer, setSelectedLayer ] = useState( null );

	const layers = useSelector( ( state ) => state.videoReducer.layers );
	const dispatch = useDispatch();

	const addNewLayer = ( type ) => {
		dispatch( addLayer( {
			id: uuidv4(),
			displayTime: 5,
			type,
			viewed: false,
			submitted: false,
			allow_skip: true,
			custom_css: '',
			template: 'default',
		} ) );
	};

	return (
		<>
			{
				! selectedLayer ? (
					<div id="sidebar-layers" className="p-4">
						{
							layers?.map( ( layer ) => (
								<button
									key={ layer.id }
									className="w-full flex justify-between items-center p-2 border rounded mb-2 hover:bg-gray-50 cursor-pointer"
									onClick={ () => setSelectedLayer( layer ) }
								>
									<div className="flex items-center gap-2">
										<Icon icon={ layerTypes.find( ( type ) => type.type === layer.type ).icon } />
										<p>{ layer?.type?.toUpperCase() } layer at <b>{ layer.displayTime }s</b></p>
									</div>
									<div>
										<Icon icon={ arrowRight } />
									</div>
								</button>
							) )
						}
						{
							layers.length === 0 && (
								<p className="text-center py-4 text-gray-400">{ __( 'No layers added.', 'transcoder' ) }</p>
							)
						}

						<Button
							isPrimary
							id="add-layer-btn"
							icon={ plus }
							iconPosition="left"
							onClick={ openModal }
						>{ __( 'Add layer at ', 'transcoder' ) } { 5 }s</Button>

						{ /* Add layer modal */ }
						{ isOpen && (
							<Modal title={ __( 'Select layer type', 'transcoder' ) } onRequestClose={ closeModal }>
								<div className="flex flex-col gap-1">
									{
										layerTypes.map( ( layerType ) => (
											<Button
												icon={ layerType.icon }
												key={ layerType.type }
												variant="secondary"
												className="w-full mb-2"
												onClick={ () => {
													addNewLayer( layerType.type );
													closeModal();
												} }
											>{ layerType.title }</Button>
										) )
									}
								</div>
							</Modal>
						) }

						{ /* <DropdownMenu
                        icon={ plus }
                        label={ __( 'Add new layer', 'transcoder' ) }
                        controls={
                            layerTypes.map( ( layerType ) => (
                                {
                                    title: layerType.title,
                                    icon: layerType.icon,
                                    onClick: () => addNewLayer( layerType.type ),
                                }
                            ) )
                        }
                    /> */ }
					</div>
				) : (
					<div id="sidebar-layers" className="p-4">
						<Layer layer={ selectedLayer } goBack={ () => setSelectedLayer( null ) } />
					</div>
				)
			}
		</>
	);
};

export default SidebarLayers;
