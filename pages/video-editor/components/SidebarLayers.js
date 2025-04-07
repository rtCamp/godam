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
import { Button, Icon, Tooltip } from '@wordpress/components';
import { plus, preformatted, customLink, arrowRight, video, customPostType, thumbsUp } from '@wordpress/icons';
import { useState } from '@wordpress/element';

import Layer from './layers/Layer';
import LayerSelector from './LayerSelector.jsx';

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
	{
		title: __( 'Poll', 'godam' ),
		icon: thumbsUp,
		type: 'poll',
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
	// const isValidAPiKey = window?.videoData?.valid_license;

	// For now we are enabling all the features
	const isValidAPiKey = true;

	const addNewLayer = ( type ) => {
		if ( premiumLayers.includes( type ) && ! isValidAPiKey ) {
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
			case 'poll':
				dispatch( addLayer( {
					id: uuidv4(),
					displayTime: currentTime,
					type,
					poll_id: '',
					allow_skip: true,
					custom_css: '',
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
					<div id="sidebar-layers" className="pt-4 h-max">
						{
							sortedLayers?.map( ( layer ) => {
								const isAdServerAd = adServer === 'ad-server' && layer.type === 'ad';
								const isGFPluginNotActive = layer.type === 'form' && ! isGFPluginActive;
								const isPollPluginNotActive = layer.type === 'poll' && ! window.easydamMediaLibrary.isPollPluginActive;
								let addWarning = false;
								let toolTipMessage = '';

								if ( premiumLayers.includes( layer.type ) && ! isValidAPiKey ) {
									toolTipMessage = __( 'This feature is available in the premium version', 'godam' );
									addWarning = true;
								} else if ( isAdServerAd ) {
									toolTipMessage = __( 'This ad will be overriden by Ad server\'s ads', 'godam' );
									addWarning = true;
								} else if ( isGFPluginNotActive ) {
									toolTipMessage = __( 'Gravity Forms plugin is not active', 'godam' );
									addWarning = true;
								} else if ( isPollPluginNotActive ) {
									toolTipMessage = __( 'Poll plugin is not active', 'godam' );
									addWarning = true;
								} else {
									toolTipMessage = '';
								}

								return (
									<Tooltip
										key={ layer.id }
										className="w-full flex justify-between items-center px-2 py-3 border rounded-md mb-2 hover:bg-gray-50 cursor-pointer"
										text={ toolTipMessage }
										placement="right"
									>
										<div className="border rounded-lg mb-2">
											<Button
												className={ `w-full flex justify-between items-center px-2 py-3 border-1 rounded-lg h-auto hover:bg-gray-50 cursor-pointer border-[#e5e7eb] ${ addWarning ? 'bg-orange-50 hover:bg-orange-50' : '' }` }
												onClick={ () => {
													dispatch( setCurrentLayer( layer ) );
													onSelectLayer( layer.displayTime );
												} }
											>
												<div className="flex items-center gap-2">
													<Icon icon={ layerTypes.find( ( type ) => type.type === layer.type ).icon } />
													<p className="m-0 text-base">{ layer?.type?.toUpperCase() } layer at <b>{ layer.displayTime }s</b></p>
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
								<>
									<h3 className="text-2xl m-0 text-center">{ __( 'No layers added', 'godam' ) }</h3>
									<p className="text-center mb-10 text-gray-400">{ __( 'Play video to add layer.', 'godam' ) }</p>
								</>
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

						{
							! loading && (
								<div className="mt-10 flex justify-center flex-col items-center">
									<Button
										className="godam-button w-fit"
										variant="primary"
										id="add-layer-btn"
										icon={ plus }
										iconPosition="left"
										onClick={ openModal }
										disabled={ ! currentTime || layers.find( ( l ) => ( l.displayTime ) === ( currentTime ) ) }
									>{ __( 'Add layer at ', 'godam' ) } { currentTime }s
									</Button>
									{ layers.find( ( l ) => l.displayTime === currentTime ) && (
										<p className="text-slate-500 text-center">
											{ __( 'There is already a layer at this timestamp. Please choose a different timestamp.', 'godam' ) }
										</p>
									) }
								</div>
							)
						}

						{ isOpen && (
							<LayerSelector
								isGFPluginActive={ isGFPluginActive }
								closeModal={ closeModal }
								addNewLayer={ addNewLayer }
							/>
						) }
					</div>
				) : (
					<div id="sidebar-layers">
						<Layer layer={ currentLayer } goBack={ () => dispatch( setCurrentLayer( null ) ) } />
					</div>
				)
			}
		</>
	);
};

export default SidebarLayers;
