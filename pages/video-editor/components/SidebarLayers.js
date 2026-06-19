/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * Internal dependencies
 */
import { addLayer, setCurrentLayer, setAddLayerModalTime, removeLayer } from '../redux/slice/videoSlice';
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
import { Button, Icon, Tooltip, DropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';
import { plus, preformatted, customLink, video, customPostType, thumbsUp, moreVertical, copy, trash } from '@wordpress/icons';
import { useState, useEffect, useCallback } from '@wordpress/element';

import LayerSelector from './LayerSelector.jsx';

/**
 * Layer types with their labels, icons, and integration-specific state.
 */
export const layerTypes = [
	{
		title: __( 'CTA', 'godam' ),
		icon: customLink,
		type: 'cta',
		layerText: __( 'CTA', 'godam' ),
	},
	{
		title: __( 'Hotspot', 'godam' ),
		icon: customPostType,
		type: 'hotspot',
		layerText: __( 'Hotspot', 'godam' ),
	},
	{
		title: __( 'Forms', 'godam' ),
		icon: preformatted,
		type: 'form',
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
		title: __( 'Ad', 'godam' ),
		icon: video,
		type: 'ad',
		layerText: __( 'Ad', 'godam' ),
		tooltipMessage: __( 'This ad will be overridden by Ad server\'s ads', 'godam' ),
	},
	{
		title: __( 'Poll', 'godam' ),
		icon: thumbsUp,
		type: 'poll',
		layerText: __( 'Poll', 'godam' ),
		isActive: Boolean( window?.easydamMediaLibrary?.isPollPluginActive ) ?? false,
		tooltipMessage: __( 'Poll plugin is not active', 'godam' ),
	},
	// Add-on layers (e.g., WooCommerce) are merged from PHP via godamVideoEditorConfig.
	...( window.godamVideoEditorConfig?.layerOptions || [] ),
];

/**
 * Sidebar component to display and select different types of layers to be added to the video.
 *
 * @param {Object}   param0               - Props passed to SidebarLayers component.
 * @param {number}   param0.currentTime   - The current playback time of the video (in seconds or milliseconds).
 * @param {Function} param0.onSelectLayer - Callback function invoked when a layer is selected.
 * @param {Function} param0.onPauseVideo  - Function to pause the video playback.
 * @param {number}   param0.duration      - The total duration of the video (used to bound duplicated layers).
 *
 * @return {JSX.Element} The rendered SidebarLayers component.
 */
const SidebarLayers = ( { currentTime, onSelectLayer, onPauseVideo, duration } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const loading = useSelector( ( state ) => state.videoReducer.loading );
	const addLayerModalTime = useSelector( ( state ) => state.videoReducer.addLayerModalTime );

	const dispatch = useDispatch();

	const openModal = useCallback( () => {
		setOpen( true );
		if ( onPauseVideo ) {
			onPauseVideo();
		}
	}, [ onPauseVideo ] );
	const closeModal = () => {
		setOpen( false );
		// Clear the addLayerModalTime when closing the modal
		dispatch( setAddLayerModalTime( null ) );
	};

	// Listen for addLayerModalTime changes to open the modal from the slider
	useEffect( () => {
		if ( addLayerModalTime !== null ) {
			openModal();
		}
	}, [ addLayerModalTime, openModal ] );

	const layers = useSelector( ( state ) => state.videoReducer.layers );
	const currentLayer = useSelector( ( state ) => state.videoReducer.currentLayer );
	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const adServer = videoConfig?.adServer ?? 'self-hosted';

	// Sort the array (ascending order), excluding layers with unknown types.
	const sortedLayers = [ ...layers ]
		.filter( ( layer ) => layerTypes.some( ( lt ) => lt.type === layer.type ) )
		.sort( ( a, b ) => a.displayTime - b.displayTime );

	const addNewLayer = ( type, formType ) => {
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
					cta_type: 'image',
					cardLayout: 'card-layout--imagecover-text',
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
						hotspots: [],
						isNew: true,
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
			default: {
				// Check for add-on layer creators (registered via window.godamLayerCreators).
				const addonCreator = window.godamLayerCreators?.[ type ];
				if ( addonCreator ) {
					const layerData = addonCreator( { layers, currentTime, type } );
					if ( layerData ) {
						dispatch( addLayer( { ...layerData, id: uuidv4() } ) );
					}
				}
				break;
			}
		}
	};

	const formatTime = ( seconds ) => {
		const total = Math.max( 0, Math.floor( Number( seconds ) || 0 ) );
		const mins = Math.floor( total / 60 );
		const secs = total % 60;
		return `${ mins }:${ secs < 10 ? '0' : '' }${ secs }`;
	};

	const handleDeleteLayer = ( layer ) => {
		if ( currentLayer?.id === layer.id ) {
			dispatch( setCurrentLayer( null ) );
		}
		dispatch( removeLayer( { id: layer.id } ) );
	};

	// Duplicate a layer at the next free whole-second slot (layers can't share a timestamp).
	const handleDuplicateLayer = ( layer ) => {
		const usedTimes = new Set( layers.map( ( l ) => Number( l.displayTime ) ) );
		const maxTime = duration ? Math.floor( duration ) : Number( layer.displayTime ) + layers.length + 1;
		let nextTime = Math.floor( Number( layer.displayTime ) ) + 1;
		while ( usedTimes.has( nextTime ) && nextTime <= maxTime ) {
			nextTime += 1;
		}
		if ( usedTimes.has( nextTime ) ) {
			nextTime = Number( layer.displayTime ) + 0.5;
		}
		const clone = {
			...JSON.parse( JSON.stringify( layer ) ),
			id: uuidv4(),
			displayTime: nextTime,
		};
		dispatch( addLayer( clone ) );
	};

	const hasLayerAtCurrentTime = Boolean( layers.find( ( l ) => l.displayTime === currentTime ) );
	const isAddDisabled = ! currentTime || hasLayerAtCurrentTime;

	return (
		<div id="sidebar-layers" className="godam-ve-layers">
			<div className="godam-ve-layers__head">
				<h2 className="godam-ve-layers__title">
					{ sprintf(
						// translators: %d is the number of layers.
						__( 'Layers (%d)', 'godam' ),
						layers.length,
					) }
				</h2>
			</div>

			<div className="godam-ve-layers__add">
				<Button
					variant="primary"
					className="godam-ve-layers__add-button"
					icon={ plus }
					iconPosition="left"
					id="add-layer-btn"
					onClick={ openModal }
					disabled={ isAddDisabled }
				>
					{ __( 'Add layer', 'godam' ) }
				</Button>
				<Button
					variant="secondary"
					className="godam-ve-layers__add-plus"
					icon={ plus }
					label={ __( 'Add layer', 'godam' ) }
					onClick={ openModal }
					disabled={ isAddDisabled }
				/>
			</div>

			{ hasLayerAtCurrentTime && (
				<p className="godam-ve-layers__hint">
					{ __( 'There is already a layer at this timestamp. Please choose a different timestamp.', 'godam' ) }
				</p>
			) }
			{ ! currentTime && ! hasLayerAtCurrentTime && (
				<p className="godam-ve-layers__hint">
					{ __( 'To add a layer, pick a spot on the timeline where you want the layer.', 'godam' ) }
				</p>
			) }

			{ loading && (
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
			) }

			{ ! loading && sortedLayers.length === 0 && (
				<div className="godam-ve-layers__empty">
					<p className="godam-ve-layers__empty-title">{ __( 'No layers yet', 'godam' ) }</p>
					<p className="godam-ve-layers__empty-text">
						{ __( 'Add interactive elements like CTAs, polls, and forms to your video', 'godam' ) }
					</p>
				</div>
			) }

			{ ! loading && sortedLayers.length > 0 && (
				<ul className="godam-ve-layers__list">
					{ sortedLayers.map( ( layer, index ) => {
						const layerData = layerTypes.find( ( l ) => l.type === layer.type );
						const formType = 'form' === layerData?.type ? layerData?.formType[ layer.form_type ?? 'gravity' ] : false;
						const icon = formType ? formType?.icon : ( layerData?.icon || layerData?.iconUrl );
						const layerText = formType ? formType?.layerText : ( layerData?.layerText || layerData?.title );

						// Tooltip shown when the layer's required plugin/feature is unavailable.
						const tooltipMessage = ( () => {
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

						const isLayerDisabled = ( formType && ! formType.isActive ) || layerData?.isActive === false;
						const isActive = currentLayer?.id === layer.id;
						const hasImageIcon = formType || ( typeof icon === 'string' && icon );

						return (
							<li
								key={ layer.id }
								className={ `godam-ve-layer-row${ isActive ? ' is-active' : '' }${ tooltipMessage ? ' has-warning' : '' }` }
							>
								<Tooltip text={ tooltipMessage } placement="right">
									<div className="godam-ve-layer-row__hit">
										<Button
											className="godam-ve-layer-row__main"
											onClick={ () => {
												dispatch( setCurrentLayer( layer ) );
												onSelectLayer( layer.displayTime );
											} }
											disabled={ isLayerDisabled }
										>
											<span className="godam-ve-layer-row__icon">
												{ hasImageIcon
													? <img src={ icon } alt="" className="godam-ve-layer-row__icon-img" />
													: <Icon icon={ icon } /> }
											</span>
											<span className="godam-ve-layer-row__text">
												<span className="godam-ve-layer-row__name">
													{ sprintf(
														// translators: %d is the layer position in the list.
														__( 'Layer %d', 'godam' ),
														index + 1,
													) }
												</span>
												<span className="godam-ve-layer-row__meta">
													{ layerText } • { formatTime( layer.displayTime ) }
												</span>
											</span>
										</Button>
										<DropdownMenu
											className="godam-ve-layer-row__menu"
											icon={ moreVertical }
											label={ __( 'Layer options', 'godam' ) }
											popoverProps={ { placement: 'bottom-end' } }
										>
											{ ( { onClose } ) => (
												<MenuGroup>
													<MenuItem
														icon={ copy }
														onClick={ () => {
															handleDuplicateLayer( layer );
															onClose();
														} }
													>
														{ __( 'Duplicate', 'godam' ) }
													</MenuItem>
													<MenuItem
														icon={ trash }
														isDestructive
														onClick={ () => {
															handleDeleteLayer( layer );
															onClose();
														} }
													>
														{ __( 'Delete', 'godam' ) }
													</MenuItem>
												</MenuGroup>
											) }
										</DropdownMenu>
									</div>
								</Tooltip>
							</li>
						);
					} ) }
				</ul>
			) }

			{ isOpen && (
				<LayerSelector
					closeModal={ closeModal }
					addNewLayer={ addNewLayer }
				/>
			) }
		</div>
	);
};

export default SidebarLayers;
