/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * Internal dependencies
 */
import { addLayer, setCurrentLayer } from '../redux/slice/videoSlice';
import { v4 as uuidv4 } from 'uuid';
import GFIcon from '../assets/layers/GFIcon.svg';
import WPFormsIcon from '../assets/layers/WPForms-Mascot.svg';
import EverestFormsIcon from '../assets/layers/EverestFormsIcon.svg';
import CF7Icon from '../assets/layers/CF7Icon.svg';
import JetpackIcon from '../assets/layers/JetpackIcon.svg';
import SureformsIcon from '../assets/layers/SureFormsIcons.svg';
import ForminatorIcon from '../assets/layers/Forminator.png';
import FluentFormsIcon from '../assets/layers/FluentFormsIcon.png';
import NinjaFormsIcon from '../assets/layers/NinjaFormsIcon.png';
import MetformIcon from '../assets/layers/MetFormIcon.png';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Button, Icon, Tooltip } from '@wordpress/components';
import { plus, preformatted, customLink, arrowRight, video, customPostType, thumbsUp, error } from '@wordpress/icons';
import { useState } from '@wordpress/element';

import Layer from './layers/Layer';
import LayerSelector from './LayerSelector.jsx';

/**
 * Layer types with detail related to title, text and premium feature.
 */
export const layerTypes = [
	{
		title: __( 'CTA', 'godam' ),
		icon: customLink,
		type: 'cta',
		layerText: __( 'CTA', 'godam' ),
		isPremium: false,
	},
	{
		title: __( 'Forms', 'godam' ),
		icon: preformatted,
		type: 'form',
		isPremium: true,
		formType: {
			gravity: {
				layerText: __( 'Gravity Forms', 'godam' ),
				icon: GFIcon,
				isActive: window?.videoData?.gfActive ?? false,
				tooltipMessage: __( 'Gravity Forms plugin is not active', 'godam' ),
			},
			wpforms: {
				layerText: __( 'WPForms', 'godam' ),
				icon: WPFormsIcon,
				isActive: window?.videoData?.wpformsActive ?? false,
				tooltipMessage: __( 'WPForms plugin is not active', 'godam' ),
			},
			cf7: {
				layerText: __( 'Contact Form 7', 'godam' ),
				isActive: window?.videoData?.cf7Active ?? false,
				icon: CF7Icon,
				tooltipMessage: __( 'Contact Form 7 plugin is not active', 'godam' ),
			},
			jetpack: {
				layerText: __( 'Jetpack Forms', 'godam' ),
				icon: JetpackIcon,
				isActive: window?.videoData?.jetpackActive ?? false,
				tooltipMessage: __( 'Jetpack plugin is not active', 'godam' ),
			},
			sureforms: {
				layerText: __( 'SureForms', 'godam' ),
				icon: SureformsIcon,
				isActive: window?.videoData?.sureformsActive ?? false,
				tooltipMessage: __( 'SureForms plugin is not active', 'godam' ),
			},
			forminator: {
				layerText: __( 'Forminator Forms', 'godam' ),
				icon: ForminatorIcon,
				isActive: window?.videoData?.forminatorActive ?? false,
				tooltipMessage: __( 'Forminator Forms plugin is not active', 'godam' ),
			},
			fluentforms: {
				layerText: __( 'Fluent Forms', 'godam' ),
				icon: FluentFormsIcon,
				isActive: window?.videoData?.fluentformsActive ?? false,
				tooltipMessage: __( 'Fluent Forms plugin is not active', 'godam' ),
			},
			everestforms: {
				layerText: __( 'Everest Forms', 'godam' ),
				icon: EverestFormsIcon,
				isActive: window?.videoData?.everestFormsActive ?? false,
				tooltipMessage: __( 'Everest Forms plugin is not active', 'godam' ),
			},
			ninjaforms: {
				layerText: __( 'Ninja Forms', 'godam' ),
				icon: NinjaFormsIcon,
				isActive: window?.videoData?.ninjaFormsActive ?? false,
				tooltipMessage: __( 'Ninja Forms plugin is not active', 'godam' ),
			},
			metform: {
				layerText: __( 'MetForm', 'godam' ),
				icon: MetformIcon,
				isActive: window?.videoData?.metformActive ?? false,
				tooltipMessage: __( 'MetForm plugin is not active', 'godam' ),
			},
		},
	},
	{
		title: __( 'Hotspot', 'godam' ),
		icon: customPostType,
		type: 'hotspot',
		layerText: __( 'Hotspot', 'godam' ),
		isPremium: true,
	},
	{
		title: __( 'Ad', 'godam' ),
		icon: video,
		type: 'ad',
		layerText: __( 'Ad', 'godam' ),
		tooltipMessage: __( 'This ad will be overriden by Ad server\'s ads', 'godam' ),
		isPremium: true,
	},
	{
		title: __( 'Poll', 'godam' ),
		icon: thumbsUp,
		type: 'poll',
		layerText: __( 'Poll', 'godam' ),
		isActive: Boolean( window?.easydamMediaLibrary?.isPollPluginActive ) ?? false,
		tooltipMessage: __( 'Poll plugin is not active', 'godam' ),
		isPremium: false,
	},
];

/**
 * Premium tooltip message.
 */
const premiumMessage = __( 'This feature is available in the premium version', 'godam' );

/**
 * Sidebar component to display and select different types of layers to be added to the video.
 *
 * @param {Object}   param0               - Props passed to SidebarLayers component.
 * @param {number}   param0.currentTime   - The current playback time of the video (in seconds or milliseconds).
 * @param {Function} param0.onSelectLayer - Callback function invoked when a layer is selected.
 * @param {Function} param0.onPauseVideo  - Function to pause the video playback.
 * @param {number}   param0.duration      - The total duration of the video (in seconds or milliseconds).
 *
 * @return {JSX.Element} The rendered SidebarLayers component.
 */
const SidebarLayers = ( { currentTime, onSelectLayer, onPauseVideo, duration } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const loading = useSelector( ( state ) => state.videoReducer.loading );

	const openModal = () => {
		setOpen( true );
		if ( onPauseVideo ) {
			onPauseVideo();
		}
	};
	const closeModal = () => setOpen( false );

	const dispatch = useDispatch();
	const layers = useSelector( ( state ) => state.videoReducer.layers );
	const currentLayer = useSelector( ( state ) => state.videoReducer.currentLayer );
	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const adServer = videoConfig?.adServer ?? 'self-hosted';

	// Sort the array (ascending order)
	const sortedLayers = [ ...layers ].sort( ( a, b ) => a.displayTime - b.displayTime );

	// If we want to disable the premium layers the we can use this code
	// const isValidAPiKey = window?.videoData?.valid_license;

	// For now we are enabling all the features
	const isValidAPiKey = true;

	const addNewLayer = ( type, formType ) => {
		const layerType = layerTypes.find( ( l ) => l.type === type );
		const isPremiumLayer = ! isValidAPiKey && layerType && layerType?.isPremium;

		if ( isPremiumLayer ) {
			return;
		}

		switch ( type ) {
			case 'form':
				dispatch( addLayer( {
					id: uuidv4(),
					displayTime: currentTime,
					type,
					form_type: formType || 'gravity',
					submitted: false,
					allow_skip: true,
					custom_css: '',
					theme: '',
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
					imageOpacity: 1,
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
								tooltipText: __( 'Click me!', 'godam' ),
								position: { x: 50, y: 50 },
								size: { diameter: 15 },
								oSize: { diameter: 15 },
								oPosition: { x: 50, y: 50 },
								link: '',
								backgroundColor: '#0c80dfa6',
								showStyle: false,
								showIcon: false,
								icon: '',
								unit: 'percent',
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
								let addWarning = false;
								const layerData = layerTypes.find( ( l ) => l.type === layer.type );
								const formType = 'form' === layerData?.type ? layerData?.formType[ layer.form_type ?? 'gravity' ] : false;
								const icon = formType ? formType?.icon : layerData?.icon;
								const layerText = formType ? formType?.layerText : layerData.layerText;

								/**
								 * Get Tooltip message.
								 */
								const tooltipMessage = ( () => {
									if ( layerData.isPremium && ! isValidAPiKey ) {
										return premiumMessage;
									}

									if ( formType && ! formType.isActive ) {
										return formType.tooltipMessage;
									}

									if ( 'ad-server' === adServer && 'ad' === layerData?.type ) {
										return layerData?.tooltipMessage;
									}

									if ( layerData?.isActive === false ) {
										return layerData?.tooltipMessage ?? '';
									}

									return '';
								} )();

								if ( '' !== tooltipMessage ) {
									addWarning = true;
								}

								return (
									<Tooltip
										key={ layer.id }
										className="w-full flex justify-between items-center px-2 py-3 border rounded-md mb-2 hover:bg-gray-50 cursor-pointer"
										text={ tooltipMessage }
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
													{
														formType ? (
															<img src={ icon } alt={ layer.type } className="w-6 h-6" />
														) : (
															<Icon icon={ icon } />
														)
													}
													<p className="m-0 text-base">{ layerText } layer at <b>{ layer.displayTime }s</b></p>
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
									>
										{
											// translators: %s is the current time in seconds.
											sprintf( __( 'Add layer at %ss', 'godam' ), currentTime )
										}
									</Button>
									{ layers.find( ( l ) => l.displayTime === currentTime ) && (
										<p className="text-slate-500 text-center">
											{ __( 'There is already a layer at this timestamp. Please choose a different timestamp.', 'godam' ) }
										</p>
									) }
									{ ! currentTime && (
										<div className="flex items-center gap-2">
											<Icon icon={ error } className="w-4 h-4" style={ { fill: '#EAB308' } } />
											<p className="text-center text-[#AB3A6C]">{ __( 'Play video to add layer.', 'godam' ) }</p>
										</div>
									) }
								</div>
							)
						}

						{ isOpen && (
							<LayerSelector
								closeModal={ closeModal }
								addNewLayer={ addNewLayer }
							/>
						) }
					</div>
				) : (
					<div id="sidebar-layers">
						<Layer layer={ currentLayer } goBack={ () => dispatch( setCurrentLayer( null ) ) } duration={ duration } />
					</div>
				)
			}
		</>
	);
};

export default SidebarLayers;
