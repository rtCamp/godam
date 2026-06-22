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
import { CtaLayerIcon, HotspotLayerIcon, FormLayerIcon, PollLayerIcon } from './editor-shell/icons';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Button, Icon, Tooltip, Dropdown, DropdownMenu, MenuGroup, MenuItem, NavigableMenu, Popover } from '@wordpress/components';
import { plus, preformatted, customLink, video, customPostType, thumbsUp, moreVertical, copy, trash, chevronRight, info } from '@wordpress/icons';
import { useState, useEffect, useCallback, useRef } from '@wordpress/element';

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
 * A submenu item for the "Add layer" menu (e.g. Form) that opens a side Popover
 * listing the choices. The trigger is a real MenuItem button inside a plain
 * wrapper (no tabindex), so it is keyboard-navigable within the parent
 * NavigableMenu (arrow keys move to it, Enter/Space opens the submenu).
 *
 * @param {Object}   param0               Props.
 * @param {Object}   param0.opt           The option, including a `submenu` array.
 * @param {Function} param0.onParentClose Closes the parent Add-layer menu.
 *
 * @return {JSX.Element} The submenu item.
 */
const AddLayerSubmenuItem = ( { opt, onParentClose } ) => {
	const [ isSubOpen, setSubOpen ] = useState( false );
	const anchorRef = useRef( null );

	return (
		<div className="godam-ve-add-menu__submenu" ref={ anchorRef }>
			<MenuItem
				className="godam-ve-add-menu__item"
				aria-haspopup="menu"
				aria-expanded={ isSubOpen }
				onClick={ () => setSubOpen( ( value ) => ! value ) }
			>
				<span className="godam-ve-add-menu__icon">
					{ opt.iconUrl
						? <img src={ opt.iconUrl } alt="" />
						: <Icon icon={ opt.iconComponent } /> }
				</span>
				<span className="godam-ve-add-menu__text">
					<span className="godam-ve-add-menu__title">{ opt.title }</span>
					{ opt.description && (
						<span className="godam-ve-add-menu__desc">{ opt.description }</span>
					) }
				</span>
				<Icon className="godam-ve-add-menu__chevron" icon={ chevronRight } />
			</MenuItem>
			{ isSubOpen && (
				<Popover
					className="godam-ve-add-menu__popover"
					anchor={ anchorRef.current }
					placement="right-start"
					onClose={ () => setSubOpen( false ) }
					onFocusOutside={ () => setSubOpen( false ) }
				>
					<NavigableMenu orientation="vertical" className="godam-ve-add-menu">
						{ opt.submenu.map( ( sub ) => (
							<MenuItem
								key={ sub.key }
								className="godam-ve-add-menu__item"
								onClick={ () => {
									sub.onSelect();
									setSubOpen( false );
									onParentClose();
								} }
							>
								<span className="godam-ve-add-menu__icon">
									{ sub.iconUrl
										? <img src={ sub.iconUrl } alt="" />
										: <Icon icon={ sub.iconComponent } /> }
								</span>
								<span className="godam-ve-add-menu__text">
									<span className="godam-ve-add-menu__title">{ sub.title }</span>
								</span>
							</MenuItem>
						) ) }
					</NavigableMenu>
				</Popover>
			) }
		</div>
	);
};

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

	// Colored layer-type icons (from design) used in the list rows + add menu.
	const layerTypeIcons = {
		cta: CtaLayerIcon,
		hotspot: HotspotLayerIcon,
		poll: PollLayerIcon,
	};

	// Build the "Add layer" dropdown options from the live layer types so that
	// plugin availability (forms/poll/ad/add-ons) is reflected here, mirroring
	// the modal's behaviour.
	const buildAddOptions = () => {
		const options = [
			{ key: 'cta', iconComponent: CtaLayerIcon, title: __( 'CTA', 'godam' ), description: __( 'Add a clickable button', 'godam' ), onSelect: () => addNewLayer( 'cta' ) },
			{ key: 'hotspot', iconComponent: HotspotLayerIcon, title: __( 'Hotspot', 'godam' ), description: __( 'Add an info hotspot', 'godam' ), onSelect: () => addNewLayer( 'hotspot' ) },
		];

		// "Form" entry. With multiple active form plugins it opens a side submenu
		// to choose one; with a single plugin it adds directly; disabled when none
		// are active.
		const formLayer = layerTypes.find( ( l ) => l.type === 'form' );
		const activeForms = Object.entries( formLayer?.formType ?? {} )
			.filter( ( [ , ft ] ) => ft.isActive )
			.map( ( [ ftKey, ft ] ) => ( {
				key: ftKey,
				title: ft.layerText,
				iconUrl: ft.icon,
				onSelect: () => addNewLayer( 'form', ftKey ),
			} ) );
		const formOption = {
			key: 'form',
			iconComponent: FormLayerIcon,
			title: __( 'Form', 'godam' ),
			description: __( 'Embed a lead form', 'godam' ),
		};
		if ( activeForms.length === 0 ) {
			formOption.disabled = true;
			formOption.tooltip = __( 'No form plugin is active', 'godam' );
		} else if ( activeForms.length === 1 ) {
			formOption.onSelect = activeForms[ 0 ].onSelect;
		} else {
			formOption.submenu = activeForms;
		}
		options.push( formOption );

		const pollLayer = layerTypes.find( ( l ) => l.type === 'poll' );
		options.push( {
			key: 'poll',
			iconComponent: PollLayerIcon,
			title: __( 'Poll', 'godam' ),
			description: __( 'Create an interactive poll', 'godam' ),
			disabled: pollLayer?.isActive === false,
			tooltip: pollLayer?.isActive === false ? pollLayer?.tooltipMessage : '',
			onSelect: () => addNewLayer( 'poll' ),
		} );

		const adLayer = layerTypes.find( ( l ) => l.type === 'ad' );
		const adDisabled = 'ad-server' === adServer;
		options.push( {
			key: 'ad',
			iconComponent: adLayer?.icon,
			title: __( 'Ad', 'godam' ),
			description: __( 'Insert an advertisement', 'godam' ),
			disabled: adDisabled,
			tooltip: adDisabled ? adLayer?.tooltipMessage : '',
			onSelect: () => addNewLayer( 'ad' ),
		} );

		// Add-on layers (e.g., WooCommerce) merged from PHP.
		layerTypes
			.filter( ( lt ) => ! [ 'cta', 'hotspot', 'form', 'ad', 'poll' ].includes( lt.type ) )
			.forEach( ( lt ) => {
				options.push( {
					key: lt.type,
					iconUrl: lt.iconUrl,
					iconComponent: lt.iconUrl ? undefined : lt.icon,
					title: lt.title || lt.layerText,
					description: ( lt.title && lt.layerText ) ? lt.layerText : '',
					disabled: lt.isActive === false,
					tooltip: lt.isActive === false ? ( lt.tooltipMessage ?? '' ) : '',
					onSelect: () => addNewLayer( lt.type ),
				} );
			} );

		return options;
	};
	const addOptions = buildAddOptions();

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

				<Dropdown
					className="godam-ve-layers__add"
					contentClassName="godam-ve-add-menu__popover"
					popoverProps={ { placement: 'bottom-start' } }
					renderToggle={ ( { isOpen: menuOpen, onToggle } ) => {
						const handleToggle = () => {
							if ( onPauseVideo ) {
								onPauseVideo();
							}
							onToggle();
						};
						return (
							<>
								<Button
									variant="primary"
									className="godam-ve-layers__add-button"
									iconPosition="left"
									id="add-layer-btn"
									onClick={ handleToggle }
									aria-expanded={ menuOpen }
									disabled={ isAddDisabled }
								>
									{ __( 'Add layer', 'godam' ) }
								</Button>
								<Button
									variant="primary"
									className="godam-ve-layers__add-plus"
									icon={ plus }
									label={ __( 'Add layer', 'godam' ) }
									onClick={ handleToggle }
									aria-expanded={ menuOpen }
									disabled={ isAddDisabled }
								/>
							</>
						);
					} }
					renderContent={ ( { onClose } ) => (
						<NavigableMenu orientation="vertical" className="godam-ve-add-menu">
							{ addOptions.map( ( opt ) => {
								// Options with a submenu (e.g. Form) open a side submenu.
								if ( opt.submenu ) {
									return (
										<AddLayerSubmenuItem
											key={ opt.key }
											opt={ opt }
											onParentClose={ onClose }
										/>
									);
								}

								const item = (
									<MenuItem
										className="godam-ve-add-menu__item"
										disabled={ opt.disabled }
										onClick={ () => {
											opt.onSelect?.();
											onClose();
										} }
									>
										<span className="godam-ve-add-menu__icon">
											{ opt.iconUrl
												? <img src={ opt.iconUrl } alt="" />
												: <Icon icon={ opt.iconComponent } /> }
										</span>
										<span className="godam-ve-add-menu__text">
											<span className="godam-ve-add-menu__title">{ opt.title }</span>
											{ opt.description && (
												<span className="godam-ve-add-menu__desc">{ opt.description }</span>
											) }
										</span>
									</MenuItem>
								);

								return opt.tooltip
									? <Tooltip key={ opt.key } text={ opt.tooltip } placement="right">{ item }</Tooltip>
									: <span key={ opt.key }>{ item }</span>;
							} ) }
						</NavigableMenu>
					) }
				/>

				{ ! currentTime && ! hasLayerAtCurrentTime && (
					<p className="godam-ve-layers__hint">
						<Icon icon={ info } size={ 24 } />
						{ __( 'To add a layer, pick a spot on the timeline where you want the layer.', 'godam' ) }
					</p>
				) }
			</div>

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
						const icon = formType ? formType?.icon : ( layerTypeIcons[ layer.type ] || layerData?.iconUrl || layerData?.icon );
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
