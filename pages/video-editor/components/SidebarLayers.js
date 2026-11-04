/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import {
	store as layersStore,
	getLayerType,
	getDefaultAttributes,
	getDefaultVariation,
	getLayerVariation,
	isVariationAvailable,
	getUnavailableReason,
	getAvailability,
	supportsMedia,
} from '@godam/layers';

/**
 * Internal dependencies
 */
import { addLayer, setCurrentLayer, setAddLayerModalTime, removeLayer } from '../redux/slice/videoSlice';
import { notify as notifyGuide } from '../onboarding/productGuide';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Button, Icon, Tooltip, Dropdown, DropdownMenu, MenuGroup, MenuItem, NavigableMenu, Popover } from '@wordpress/components';
import { plus, moreVertical, copy, trash, chevronRight, info } from '@wordpress/icons';
import { useState, useEffect, useCallback, useRef } from '@wordpress/element';
import { useSelect } from '@wordpress/data';

/**
 * A layer type's label, or its variation's title for types with variations.
 *
 * @param {Object} layerType   Registered layer type.
 * @param {string} [variation] Variation name; defaults to the type's default variation.
 * @return {string} The label, or `''`.
 */
const getLayerTypeLabel = ( layerType, variation ) => {
	if ( ! layerType ) {
		return '';
	}
	if ( layerType.variations.length ) {
		const match = variation
			? layerType.variations.find( ( v ) => v.name === variation )
			: getDefaultVariation( layerType );
		return match?.title || '';
	}
	return layerType.label || layerType.title || '';
};

/**
 * Build the default display name for a layer, e.g. "CTA Layer", "Hotspot Layer",
 * "Gravity Forms Layer". The label comes from the layer registry (a variation's
 * title for types with variations, such as the form plugin), so it matches the
 * Add-layer menu. Returns `''` for unregistered types.
 *
 * @param {string} type        Layer type name (e.g. 'cta', 'hotspot', 'form').
 * @param {string} [variation] Variation name for types with variations (e.g. 'gravity').
 * @return {string} The default layer name.
 */
export const getDefaultLayerName = ( type, variation ) => {
	const label = getLayerTypeLabel( getLayerType( type ), variation );

	if ( ! label ) {
		return '';
	}

	return sprintf(
		/* translators: %s is the layer type label; e.g. "CTA" produces "CTA Layer". */
		__( '%s Layer', 'godam' ),
		label,
	);
};

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
				data-test-id={ `godam-video-editor-control-add-${ opt.key }` }
				aria-haspopup="menu"
				aria-expanded={ isSubOpen }
				onClick={ () => setSubOpen( ( value ) => ! value ) }
			>
				<span
					className="godam-ve-add-menu__icon"
					style={ { '--godam-layer-color': opt.color } }
				>
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
								data-test-id={ `godam-video-editor-control-add-${ opt.key }-${ sub.key }` }
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

	// Open the "Add layer" dropdown menu (from the sidebar button or the timeline).
	const openAddMenu = useCallback( () => {
		setOpen( true );
		if ( onPauseVideo ) {
			onPauseVideo();
		}
		// Advances the product guide's "open the dropdown" step.
		notifyGuide( 'open-add-layer' );
	}, [ onPauseVideo ] );

	// Controlled toggle for the dropdown. Closing also clears any pending
	// add-time requested from the timeline's "Add layer" chip.
	const handleAddMenuToggle = ( next ) => {
		if ( next ) {
			openAddMenu();
			return;
		}
		setOpen( false );
		if ( addLayerModalTime !== null ) {
			dispatch( setAddLayerModalTime( null ) );
		}
	};

	// The timeline's "Add layer" chip requests the menu by setting addLayerModalTime.
	useEffect( () => {
		if ( addLayerModalTime !== null ) {
			openAddMenu();
		}
	}, [ addLayerModalTime, openAddMenu ] );

	const layers = useSelector( ( state ) => state.videoReducer.layers );
	const currentLayer = useSelector( ( state ) => state.videoReducer.currentLayer );
	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	// Layer types come from the registry; add-ons can register after the editor loads.
	const layerTypes = useSelect( ( select ) => select( layersStore ).getLayerTypes(), [] );
	// Timeline-based media (video) gate the add flow on a playhead position;
	// images have no timeline, so layers are added freely and land at 0:00.
	const mediaType = useSelector( ( state ) => state.videoReducer.mediaType );
	const isTimelineMedia = mediaType !== 'image';
	const availabilityContext = { videoConfig, mediaType };

	// Sort the array (ascending order). A registered type that doesn't support
	// this media is hidden; a type nothing registered stays listed, with a notice.
	const sortedLayers = [ ...layers ]
		.filter( ( layer ) => {
			const layerType = getLayerType( layer.type );
			return ! layerType || supportsMedia( layerType, mediaType );
		} )
		.sort( ( a, b ) => a.displayTime - b.displayTime );

	const addNewLayer = ( type, variationName ) => {
		const layerType = getLayerType( type );
		if ( ! layerType ) {
			return;
		}
		// Add at the time requested from the timeline ("Add layer" chip), else at
		// the current playhead. `??` keeps a valid 0:00. Cleared on menu close.
		const addTime = addLayerModalTime ?? currentTime;

		if ( typeof layerType.create === 'function' ) {
			// Add-on types from the old hooks build their own layer data
			// (`window.godamLayerCreators`).
			const layerData = layerType.create( { layers, currentTime: addTime, type } );
			if ( layerData ) {
				// Seed a registry-derived default name; the add-on creator can
				// override it by returning its own `name` (e.g. the WooCommerce
				// layer names itself "Product Hotspot Layer").
				dispatch( addLayer( { name: getDefaultLayerName( type ), ...layerData, id: uuidv4() } ) );
			}
		} else {
			const variation = variationName
				? layerType.variations.find( ( v ) => v.name === variationName )
				: getDefaultVariation( layerType );
			dispatch( addLayer( {
				id: uuidv4(),
				displayTime: addTime,
				type,
				name: getDefaultLayerName( type, variation?.name ),
				...getDefaultAttributes( layerType, variation ),
			} ) );
		}

		// Advance the product guide's "add a layer" step once a layer is added.
		notifyGuide( 'layer-added' );
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
	const isAddDisabled = isTimelineMedia && ( ! currentTime || hasLayerAtCurrentTime );

	// Build the "Add layer" dropdown from the registry, in registration order.
	// A type with variations (e.g. Form's form plugins) adds directly when one
	// variation is available and opens a side submenu when several are.
	const buildAddOptions = () => layerTypes
		.filter( ( layerType ) => supportsMedia( layerType, mediaType ) )
		.map( ( layerType ) => {
			const option = {
				key: layerType.name,
				iconUrl: layerType.iconUrl,
				iconComponent: layerType.iconUrl ? undefined : layerType.icon,
				title: layerType.title,
				description: layerType.description,
				color: layerType.color,
			};
			const availability = getAvailability( layerType, availabilityContext );
			if ( ! availability.available ) {
				return { ...option, disabled: true, tooltip: availability.reason ?? '' };
			}
			if ( ! layerType.variations.length ) {
				return { ...option, onSelect: () => addNewLayer( layerType.name ) };
			}
			const variations = layerType.variations
				.filter( isVariationAvailable )
				.map( ( variation ) => ( {
					key: variation.name,
					title: variation.title,
					iconUrl: typeof variation.icon === 'string' ? variation.icon : undefined,
					iconComponent: typeof variation.icon === 'string' ? undefined : variation.icon,
					onSelect: () => addNewLayer( layerType.name, variation.name ),
				} ) );
			if ( variations.length === 0 ) {
				return { ...option, disabled: true, tooltip: '' };
			}
			return variations.length === 1
				? { ...option, onSelect: variations[ 0 ].onSelect }
				: { ...option, submenu: variations };
		} );
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
					open={ isOpen }
					onToggle={ handleAddMenuToggle }
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
									data-test-id="godam-video-editor-button-add-layer"
									onClick={ handleToggle }
									aria-expanded={ menuOpen }
									icon={ plus }
									disabled={ isAddDisabled }
								>
									{ __( 'Add layer', 'godam' ) }
								</Button>
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
										data-test-id={ `godam-video-editor-control-add-${ opt.key }` }
										disabled={ opt.disabled }
										onClick={ () => {
											opt.onSelect?.();
											onClose();
										} }
									>
										<span
											className="godam-ve-add-menu__icon"
											style={ { '--godam-layer-color': opt.color } }
										>
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

				{ isTimelineMedia && ! currentTime && ! hasLayerAtCurrentTime && (
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
					{ sortedLayers.map( ( layer ) => {
						const layerType = getLayerType( layer.type );
						const variation = layerType?.variations.length ? getLayerVariation( layerType, layer ) : undefined;
						const icon = variation?.icon || layerType?.iconUrl || layerType?.icon;
						const layerText = variation?.title || layerType?.label || layerType?.title || layer.type;

						// Warning shown when the layer's type, variation or plugin is unavailable.
						let tooltipMessage = '';
						let isLayerDisabled = false;
						if ( ! layerType ) {
							tooltipMessage = __( 'This layer needs an add-on that isn\'t active.', 'godam' );
						} else if ( variation && ! isVariationAvailable( variation ) ) {
							tooltipMessage = getUnavailableReason( variation );
							isLayerDisabled = true;
						} else {
							const availability = getAvailability( layerType, availabilityContext );
							if ( ! availability.available ) {
								tooltipMessage = availability.reason ?? '';
								isLayerDisabled = false !== availability.disablesExisting;
							}
						}

						const isActive = currentLayer?.id === layer.id;
						const hasImageIcon = typeof icon === 'string' && icon;

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
											<span
												className="godam-ve-layer-row__icon"
												style={ { '--godam-layer-color': layerType?.color } }
											>
												{ hasImageIcon
													? <img src={ icon } alt="" className="godam-ve-layer-row__icon-img" />
													: <Icon icon={ icon } /> }
											</span>
											<span className="godam-ve-layer-row__text">
												<span className="godam-ve-layer-row__name">
													{ layer.name || sprintf(
														// translators: %s is the layer type label; e.g. "CTA Layer".
														__( '%s Layer', 'godam' ),
														layerText,
													) }
												</span>
												<span className="godam-ve-layer-row__meta">
													{ /* Images have no timeline — every layer renders at 0:00, so drop the timestamp. */ }
													{ isTimelineMedia
														? `${ layerText } • ${ formatTime( layer.displayTime ) }`
														: layerText }
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

		</div>
	);
};

export default SidebarLayers;
