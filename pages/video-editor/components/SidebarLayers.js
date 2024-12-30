/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';
/**
 * Internal dependencies
 */
import { addLayer, setCurrentLayer } from '../redux/slice/videoSlice';
import { v4 as uuidv4 } from 'uuid';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Button, Icon, Modal } from '@wordpress/components';
import { plus, preformatted, customLink, arrowRight, video, customPostType } from '@wordpress/icons';
import { useEffect, useState } from '@wordpress/element';

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
	{
		title: __( 'Hotspot', 'transcoder' ),
		icon: customPostType,
		type: 'hotspot',
	},
	{
		title: __( 'Ads', 'transcoder' ),
		icon: video,
		type: 'ads',
	},
];

const SidebarLayers = ( { currentTime, onSelectLayer } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const openModal = () => setOpen( true );
	const closeModal = () => setOpen( false );

	const [ selectedLayer, setSelectedLayer ] = useState( null );

	const layers = useSelector( ( state ) => state.videoReducer.layers );
	const dispatch = useDispatch();

	// Sort the array (ascending order)
	const sortedLayers = [ ...layers ].sort( ( a, b ) => a.displayTime - b.displayTime );

	const addNewLayer = ( type ) => {
		switch ( type ) {
			case 'form':
				dispatch( addLayer( {
					id: uuidv4(),
					displayTime: currentTime,
					type,
					submitted: false,
					allow_skip: true,
					custom_css: '',
					theme: 'orbital',
				} ) );
				break;
			case 'cta':
				dispatch( addLayer( {
					id: uuidv4(),
					displayTime: currentTime,
					type,
					cta_type: 'text',
					text: '',
					html: '',
					link: '',
					allow_skip: true,
				} ) );
				break;
			case 'hotspot':
				dispatch(
					addLayer( {
						id: uuidv4(),
						displayTime: currentTime,
						type,
						duration: 5,
						pauseOnHover: false,
						hotspots: [
							{
								id: uuidv4(),
								tooltipText: 'Click me!',
								position: { x: 50, y: 50 },
								size: { diameter: 48 },
								oSize: { diameter: 48 },
								oPosition: { x: 50, y: 50 },
								link: '',
								backgroundColor: '#0c80dfa6',
							},
						],
					} ),
				);
				break;
			case 'ads':
				dispatch( addLayer( {
					id: uuidv4(),
					displayTime: currentTime,
					type,
					adTagUrl: '',
					adVideoUrl: '',
					skippable: false,
					skipTime: 5,
				} ) );
				break;
			default:
				break;
		}
	};

	useEffect( () => {
		dispatch( setCurrentLayer( selectedLayer ) );
	}, [ selectedLayer ] );

	return (
		<>
			{
				! selectedLayer ? (
					<div id="sidebar-layers" className="p-4">
						{
							sortedLayers?.map( ( layer ) => (
								<button
									key={ layer.id }
									className="w-full flex justify-between items-center p-2 border rounded mb-2 hover:bg-gray-50 cursor-pointer"
									onClick={ () => {
										setSelectedLayer( layer );
										onSelectLayer( layer.displayTime );
									} }
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
						>{ __( 'Add layer at ', 'transcoder' ) } { currentTime }s</Button>

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
