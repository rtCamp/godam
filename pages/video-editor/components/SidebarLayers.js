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
import { BaseControl, Button, Icon, Modal, Tooltip } from '@wordpress/components';
import { plus, preformatted, customLink, arrowRight, video, customPostType } from '@wordpress/icons';
import { useState } from '@wordpress/element';

import Layer from './layers/Layer';

const layerTypes = [
	{
		title: __( 'CTA', 'godam' ),
		icon: customLink,
		type: 'cta',
	},
	{
		title: __( 'Gravity Forms', 'godam' ),
		icon: preformatted,
		type: 'form',
	},
	{
		title: __( 'Hotspot', 'godam' ),
		icon: customPostType,
		type: 'hotspot',
	},
	{
		title: __( 'Ad', 'godam' ),
		icon: video,
		type: 'ad',
	},
];

const premiumLayers = [ 'form', 'hotspot', 'ad' ];

const SidebarLayers = ( { currentTime, onSelectLayer } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const loading = useSelector( ( state ) => state.videoReducer.loading );

	const openModal = () => setOpen( true );
	const closeModal = () => setOpen( false );

	const dispatch = useDispatch();
	const layers = useSelector( ( state ) => state.videoReducer.layers );
	const currentLayer = useSelector( ( state ) => state.videoReducer.currentLayer );
	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const isGFPluginActive = useSelector( ( state ) => state.videoReducer.gformPluginActive );
	const adServer = videoConfig?.adServer ?? 'self-hosted';

	// Sort the array (ascending order)
	const sortedLayers = [ ...layers ].sort( ( a, b ) => a.displayTime - b.displayTime );

	// If we want to disable the premium layers the we can use this code
	// const isValidLicense = window?.videoData?.valid_license;

	// For now we are enabling all the features
	const isValidLicense = true;

	const addNewLayer = ( type ) => {
		if ( premiumLayers.includes( type ) && ! isValidLicense ) {
			return;
		}

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
								showStyle: false,
								showIcon: false,
								icon: '',
							},
						],
					} ),
				);
				break;
			case 'ad':
				dispatch( addLayer( {
					id: uuidv4(),
					displayTime: currentTime,
					type,
					adTagUrl: '',
					ad_url: '',
					skippable: false,
					skip_offset: 5,
				} ) );
				break;
			default:
				break;
		}
	};

	return (
		<>
			{
				! currentLayer ? (
					<div id="sidebar-layers" className="p-4">
						{
							sortedLayers?.map( ( layer ) => {
								const isAdServerAd = adServer === 'ad-server' && layer.type === 'ad';
								const isGFPluginNotActive = layer.type === 'form' && ! isGFPluginActive;
								let addWarning = false;
								let toolTipMessage = '';

								if ( premiumLayers.includes( layer.type ) && ! isValidLicense ) {
									toolTipMessage = __( 'This feature is available in the premium version', 'godam' );
									addWarning = true;
								} else if ( isAdServerAd ) {
									toolTipMessage = __( 'This ad will be overriden by Ad server\'s ads', 'godam' );
									addWarning = true;
								} else if ( isGFPluginNotActive ) {
									toolTipMessage = __( 'Gravity Forms plugin is not active', 'godam' );
									addWarning = true;
								} else {
									toolTipMessage = '';
								}

								return (
									<Tooltip
										key={ layer.id }
										className="w-full flex justify-between items-center p-2 border rounded mb-2 hover:bg-gray-50 cursor-pointer"
										text={ toolTipMessage }
										placement="right"
									>
										<div className="border rounded mb-2">
											<Button
												className={ `w-full flex justify-between items-center p-2 border-1 rounded hover:bg-gray-50 cursor-pointer border-[#e5e7eb] ${ addWarning ? 'bg-orange-50 hover:bg-orange-50' : '' }` }
												onClick={ () => {
													dispatch( setCurrentLayer( layer ) );
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
											</Button>
										</div>
									</Tooltip>
								);
							} )
						}
						{
							! loading && layers.length === 0 && (
								<p className="text-center py-4 text-gray-400">{ __( 'No layers added.', 'godam' ) }</p>
							)
						}
						{
							loading && (
								<div className="loading-skeleton">
									<div className="skeleton-container skeleton-container-short">
										<div className="skeleton-header"></div>
									</div>
									<div className="skeleton-container skeleton-container-short">
										<div className="skeleton-header"></div>
									</div>
									<div className="skeleton-container skeleton-container-short">
										<div className="skeleton-header"></div>
									</div>
								</div>
							)
						}

						{ ! loading &&
						<div>
							<Button
								isPrimary
								id="add-layer-btn"
								icon={ plus }
								iconPosition="left"
								onClick={ openModal }
								disabled={ ! currentTime || layers.find( ( l ) => ( l.displayTime ) === ( currentTime ) ) }
							>{ __( 'Add layer at ', 'godam' ) } { currentTime }s
							</Button>
							{ layers.find( ( l ) => l.displayTime === currentTime ) && (
								<p className="text-slate-500">
									{ __( 'There is already a layer at this timestamp. Please choose a different timestamp.', 'godam' ) }
								</p>
							) }
						</div>
						}
						{ isOpen && (
							<Modal title={ __( 'Select layer type', 'godam' ) } onRequestClose={ closeModal }>
								<div className="flex flex-col gap-1">
									{
										layerTypes.map( ( layerType ) => {
											const isAdServerAd = adServer === 'ad-server' && layerType.type === 'ad';
											const isGFPluginNotActive = layerType.type === 'form' && ! isGFPluginActive;
											let isDisabled = false;
											let isPremium = false;
											let message = '';

											if ( premiumLayers.includes( layerType.type ) && ! isValidLicense ) {
												message = __( 'This feature is available in the premium version', 'godam' );
												isDisabled = true;
												isPremium = true;
											} else if ( isAdServerAd ) {
												message = __( 'This ad will be overriden by Ad server\'s ads', 'godam' );
												isDisabled = true;
											} else if ( isGFPluginNotActive ) {
												message = __( 'Gravity Forms plugin is not active', 'godam' );
												isDisabled = true;
											} else {
												message = '';
											}

											return (
												<Tooltip
													key={ layerType.type }
													text={ message }
													placement="top"
													delay={ 0 }
													hideOnClick={ true }
												>
													<div>
														<Button
															icon={ layerType.icon }
															key={ layerType.type }
															variant="secondary"
															className={ `w-full ${ isPremium && isDisabled ? 'opacity-40' : '' }` }
															onClick={ () => {
																if ( isPremium && isDisabled ) {
																	window.open( 'https://godam.io/#pricing', '_blank' );
																	return;
																}

																addNewLayer( layerType.type );
																closeModal();
															} }
															disabled={ ! isPremium && isDisabled }
														>{ layerType.title }</Button>
													</div>
												</Tooltip>
											);
										} )
									}
								</div>
							</Modal>
						) }
					</div>
				) : (
					<div id="sidebar-layers" className="p-4">
						<Layer layer={ currentLayer } goBack={ () => dispatch( setCurrentLayer( null ) ) } />
					</div>
				)
			}
		</>
	);
};

export default SidebarLayers;
