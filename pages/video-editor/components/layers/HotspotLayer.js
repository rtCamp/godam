/**
 * External dependencies
 */
import { Rnd } from 'react-rnd';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import {
	Button,
	TextControl,
	ToggleControl,
	DropdownMenu,
	MenuItem,
	ColorPalette,
	Notice,
} from '@wordpress/components';
import {
	trash,
	plus,
	chevronDown,
	chevronUp,
	moreVertical,
	check,
} from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';
import { useState, useRef, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import { v4 as uuidv4 } from 'uuid';
import LayerControls from '../LayerControls';
import FontAwesomeIconPicker from '../hotspot/FontAwesomeIconPicker';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import LayersHeader from './LayersHeader';

const HotspotLayer = ( { layerID, goBack, duration } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);

	const hotspots = layer?.hotspots || [];
	// Track expanded hotspot
	const [ expandedHotspotIndex, setExpandedHotspotIndex ] = useState( null );

	const containerRef = useRef( null );

	const [ contentRect, setContentRect ] = useState( null );

	// Helper to dispatch updates
	const updateField = ( field, value ) => {
		dispatch( updateLayerField( { id: layer.id, field, value } ) );
	};

	const percentToPx = ( percent, dimension ) => {
		if ( ! contentRect ) {
			return 0;
		}
		const size = dimension === 'x' ? contentRect.width : contentRect.height;
		return ( percent / 100 ) * size;
	};

	const pxToPercent = ( px, dimension ) => {
		if ( ! contentRect ) {
			return 0;
		}
		const size = dimension === 'x' ? contentRect.width : contentRect.height;
		return ( px / size ) * 100;
	};

	// Add a new hotspot
	const handleAddHotspot = () => {
		const diameterPercent = 15;

		const newHotspot = {
			id: uuidv4(),
			tooltipText: __( 'New Hotspot', 'godam' ),
			link: '',
			position: { x: 50, y: 50 },
			size: { diameter: diameterPercent },
			oSize: { diameter: diameterPercent },
			oPosition: { x: 50, y: 50 },
			backgroundColor: '#0c80dfa6',
			icon: '',
			unit: 'percent',
		};
		updateField( 'hotspots', [ ...hotspots, newHotspot ] );
	};

	const handleDeleteHotspot = ( index ) => {
		updateField(
			'hotspots',
			hotspots.filter( ( _, i ) => i !== index ),
		);
	};

	// Expand/hide a hotspot’s panel
	const toggleHotspotExpansion = ( index ) => {
		setExpandedHotspotIndex( expandedHotspotIndex === index ? null : index );
	};

	const computeContentRect = () => {
		const videoEl = document.querySelector( 'video' );
		const containerEl = document.getElementById( 'easydam-video-player' );

		if ( ! videoEl || ! containerEl ) {
			setContentRect( null );
			return;
		}

		const nativeW = videoEl.videoWidth || 0;
		const nativeH = videoEl.videoHeight || 0;

		const elW = containerEl.offsetWidth;
		const elH = containerEl.offsetHeight;

		// If video dimensions aren't loaded yet, use full container
		if ( ! nativeW || ! nativeH ) {
			setContentRect( {
				left: 0,
				top: 0,
				width: elW,
				height: elH,
			} );
			return;
		}

		const videoAspectRatio = nativeW / nativeH;
		const containerAspectRatio = elW / elH;

		let contentW, contentH, offsetX, offsetY;

		if ( containerAspectRatio > videoAspectRatio ) {
			// Pillarboxed (black bars on left/right)
			contentH = elH;
			contentW = elH * videoAspectRatio;
			offsetX = ( elW - contentW ) / 2;
			offsetY = 0;
		} else {
			// Letterboxed (black bars on top/bottom)
			contentW = elW;
			contentH = elW / videoAspectRatio;
			offsetX = 0;
			offsetY = ( elH - contentH ) / 2;
		}

		const newRect = {
			left: Math.round( offsetX ),
			top: Math.round( offsetY ),
			width: Math.round( contentW ),
			height: Math.round( contentH ),
		};

		setContentRect( newRect );
	};

	useEffect( () => {
		computeContentRect();
		window.addEventListener( 'resize', computeContentRect );
		document.addEventListener( 'fullscreenchange', computeContentRect );

		// Also listen for video metadata loaded
		const videoEl = document.querySelector( 'video' );
		if ( videoEl ) {
			videoEl.addEventListener( 'loadedmetadata', computeContentRect );
		}

		return () => {
			window.removeEventListener( 'resize', computeContentRect );
			document.removeEventListener( 'fullscreenchange', computeContentRect );
			if ( videoEl ) {
				videoEl.removeEventListener( 'loadedmetadata', computeContentRect );
			}
		};
	}, [] );

	// If we want to disable the premium layers the we can use this code
	// const isValidAPIKey = window?.videoData?.validApiKey;

	// For now we are enabling all the features
	const isValidAPIKey = true;

	const isValidOrigin = ( url = '' ) =>
		/^https?:\/\//i.test( url.trim() );

	return (
		<>
			<LayersHeader layer={ layer } goBack={ goBack } duration={ duration } />

			{
				! isValidAPIKey &&
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'This features is available in premium version', 'godam' ) }
				</Notice>
			}

			{ /* Duration */ }
			<div className="mb-6">
				<TextControl
					label={ __( 'Layer Duration (seconds)', 'godam' ) }
					className="godam-input"
					type="number"
					min="1"
					value={ layer?.duration || '' }
					onChange={ ( val ) => {
						const newVal = parseInt( val, 10 ) || 0;
						updateField( 'duration', newVal );
					} }
					help={ __( 'Duration (in seconds) this layer will stay visible', 'godam' ) }
					disabled={ ! isValidAPIKey }
				/>
			</div>

			{ /* Pause on hover */ }
			<div className="mb-4">
				<ToggleControl
					className="godam-toggle"
					label={ __( 'Pause video on hover', 'godam' ) }
					checked={ layer?.pauseOnHover || false }
					onChange={ ( isChecked ) => updateField( 'pauseOnHover', isChecked ) }
					disabled={ ! isValidAPIKey }
				/>
				<p className="text-xs text-gray-500 mt-1">
					{ __(
						'Player will pause the video while the layer is displayed and users hover over the hotspots.',
						'godam',
					) }
				</p>
			</div>

			{ /* Hotspots list */ }
			<div className="flex items-center flex-col gap-4 pb-4">
				{ hotspots.map( ( hotspot, index ) => (
					<div key={ hotspot.id } className="p-2 w-full border rounded">
						<div className="flex justify-between items-center">
							<Button
								icon={ expandedHotspotIndex === index ? chevronUp : chevronDown }
								className="flex-1 text-left"
								onClick={ () => toggleHotspotExpansion( index ) }
							>
								{
									/* translators: %d is the hotspot index */
									sprintf( __( 'Hotspot %d', 'godam' ), index + 1 )
								}
							</Button>
							<DropdownMenu
								icon={ moreVertical }
								label={ `Hotspot ${ index + 1 } options` }
								/* translators: %d is the hotspot index */
								toggleProps={ { 'aria-label': sprintf( __( 'Options for Hotspot %d', 'godam' ), index + 1 ) } }

							>
								{ () => (
									<>
										<MenuItem
											icon={ hotspot.showStyle ? check : '' }
											onClick={ () => {
												updateField(
													'hotspots',
													hotspots.map( ( h2, j ) =>
														j === index
															? {
																...h2,
																showStyle: ! h2.showStyle,
																showIcon: ! h2.showStyle ? false : h2.showIcon,
																icon: ! h2.showStyle ? '' : h2.icon,
															}
															: h2,
													),
												);
											} }
										>
											{ __( 'Show Style', 'godam' ) }
										</MenuItem>
										<MenuItem
											icon={ hotspot.showIcon ? check : '' }
											onClick={ () => {
												updateField(
													'hotspots',
													hotspots.map( ( h2, j ) =>
														j === index
															? {
																...h2,
																showIcon: ! h2.showIcon, // Enable icon
																showStyle: ! h2.showIcon ? false : h2.showStyle, // Disable style
															}
															: h2,
													),
												);
											} }
										>
											{ __( 'Show Icon', 'godam' ) }
										</MenuItem>
										<MenuItem
											icon={ trash }
											onClick={ () => handleDeleteHotspot( index ) }
											className="text-red-500"
										>
											{ __( 'Delete Hotspot', 'godam' ) }
										</MenuItem>
									</>
								) }
							</DropdownMenu>
						</div>

						{ expandedHotspotIndex === index && (
							<div className="mt-3">
								<TextControl
									className="godam-input"
									label={ __( 'Tooltip Text', 'godam' ) }
									placeholder={ __( 'Click Me!', 'godam' ) }
									value={ hotspot.tooltipText }
									onChange={ ( val ) =>
										updateField(
											'hotspots',
											hotspots.map( ( h2, j ) =>
												j === index ? { ...h2, tooltipText: val } : h2,
											),
										)
									}
									disabled={ ! isValidAPIKey }
								/>
								<TextControl
									label={ __( 'Link', 'godam' ) }
									placeholder="https://www.example.com"
									value={ hotspot.link }
									onChange={ ( val ) => {
										const updated = hotspots.map( ( h2, j ) =>
											j === index
												? { ...h2, link: val, linkInvalid: val && ! isValidOrigin( val ) }
												: h2,
										);
										updateField( 'hotspots', updated );
									} }
									className={ `${ hotspot.linkInvalid ? 'hotspot-link-error' : undefined } godam-input` }
									disabled={ ! isValidAPIKey }
								/>
								{ hotspot.linkInvalid && (
									<p className="text-red-600 text-xs mt-1">{ __( 'Invalid origin: must use either http or https as the scheme.', 'godam' ) }</p>
								) }
								{ hotspot.showIcon && (
									<div className="flex flex-col gap-2 mt-2">
										<FontAwesomeIconPicker
											hotspot={ hotspot }
											index={ index }
											updateField={ updateField }
											hotspots={ hotspots }
											disabled={ ! isValidAPIKey }
										/>
									</div>
								) }
								{ hotspot.showStyle && (
									<div className="flex flex-col gap-2 mt-2">
										<label
											htmlFor={ `hotspot-color-${ index }` }
											className="text-xs text-gray-700"
										>
											{ __( 'BACKGROUND COLOR', 'godam' ) }
										</label>
										<ColorPalette
											id={ `hotspot-color-${ index }` }
											value={ hotspot.backgroundColor || '#0c80dfa6' }
											className={ ! isValidAPIKey ? 'pointer-events-none opacity-50' : '' }
											onChange={ ( newColor ) => {
												updateField(
													'hotspots',
													hotspots.map( ( h2, j ) =>
														j === index
															? {
																...h2,
																backgroundColor: newColor,
															}
															: h2,
													),
												);
											} }
											enableAlpha
										/>
									</div>
								) }
							</div>
						) }
					</div>
				) ) }

				<Button
					variant="primary"
					id="add-hotspot-btn"
					icon={ plus }
					iconPosition="left"
					className="godam-button"
					onClick={ handleAddHotspot }
					disabled={ ! isValidAPIKey }
				>
					{ __( 'Add Hotspot', 'godam' ) }
				</Button>
			</div>

			{ /* The actual layer content */ }
			<LayerControls>
				<div
					ref={ containerRef }
					className="easydam-layer hotspot-layer"
					style={ { backgroundColor: layer.bg_color || 'transparent' } }
				>
					<div
						className="absolute inset-0 bg-transparent z-10 pointer-events-auto"
					></div>
					{ hotspots.map( ( hotspot, index ) => {
						const posX = hotspot.position?.x ?? 50;
						const posY = hotspot.position?.y ?? 50;
						const diameter = hotspot.size?.diameter ?? 15;

						let pixelX, pixelY, pixelDiameter;

						if ( hotspot.unit === 'percent' ) {
							// Calculate pixel values for rendering
							pixelX = ( contentRect?.left || 0 ) + percentToPx( posX, 'x' );
							pixelY = ( contentRect?.top || 0 ) + percentToPx( posY, 'y' );
							pixelDiameter = percentToPx( diameter, 'x' );
						} else {
							// Legacy handling in editor (relative to 800x600)
							const baseWidth = 800;
							const baseHeight = 600;
							const effectiveRect = contentRect || {
								left: 0,
								top: 0,
								width: 800,
								height: 600,
							};
							pixelX =
								effectiveRect.left +
								( ( posX / baseWidth ) * effectiveRect.width );
							pixelY =
								effectiveRect.top +
								( ( posY / baseHeight ) * effectiveRect.height );
							pixelDiameter = Math.max( 30, ( ( diameter / baseWidth ) * effectiveRect.width ) );
						}

						return (
							<Rnd
								key={ hotspot.id }
								position={ {
									x: pixelX,
									y: pixelY,
								} }
								size={ {
									width: pixelDiameter,
									height: pixelDiameter,
								} }
								bounds="parent"
								maxWidth={ contentRect?.width || '100%' }
								maxHeight={ contentRect?.height || '100%' }
								minWidth={ 30 }
								minHeight={ 30 }
								lockAspectRatio
								onDragStop={ ( e, d ) => {
									if ( ! contentRect ) {
										return;
									}

									// Get current diameter in pixels for clamping
									let currentDiameterPx;
									if ( hotspot.unit === 'percent' ) {
										currentDiameterPx = percentToPx( diameter, 'x' );
									} else {
										currentDiameterPx = ( diameter / 800 ) * contentRect.width;
									}

									const minX = contentRect.left;
									const minY = contentRect.top;
									const maxX = contentRect.left + contentRect.width - currentDiameterPx;
									const maxY = contentRect.top + contentRect.height - currentDiameterPx;

									const clampedX = Math.max( minX, Math.min( d.x, maxX ) );
									const clampedY = Math.max( minY, Math.min( d.y, maxY ) );

									// Calculate relative position to content rect
									const relativeX = clampedX - contentRect.left;
									const relativeY = clampedY - contentRect.top;

									const newHotspots = hotspots.map( ( h2, j ) => {
										if ( j === index ) {
											const newX = pxToPercent( relativeX, 'x' );
											const newY = pxToPercent( relativeY, 'y' );

											// If converting from legacy, also convert diameter to percentage
											let newDiameter = h2.size?.diameter ?? 10;
											if ( h2.unit !== 'percent' ) {
												// Ensure it's at least 30px equivalent in percentage
												const minPercent = contentRect ? ( 30 / contentRect.width ) * 100 : 10;
												newDiameter = Math.max( minPercent, ( newDiameter / 800 ) * 100 );
											}

											return {
												...h2,
												unit: 'percent',
												size: { diameter: newDiameter },
												oSize: { diameter: newDiameter },
												oPosition: {
													x: newX,
													y: newY,
												},
												position: {
													x: newX,
													y: newY,
												},
											};
										}
										return h2;
									} );
									updateField( 'hotspots', newHotspots );
								} }
								onResizeStop={ ( e, direction, ref, delta, position ) => {
									if ( ! contentRect ) {
										return;
									}

									const newDiameterPx = ref.offsetWidth;
									const newDiameterPercent = pxToPercent( newDiameterPx, 'x' );

									// Calculate relative position to content rect
									const relativeX = position.x - contentRect.left;
									const relativeY = position.y - contentRect.top;

									const newHotspots = hotspots.map( ( h2, j ) => {
										if ( j === index ) {
											const newX = pxToPercent( relativeX, 'x' );
											const newY = pxToPercent( relativeY, 'y' );
											return {
												...h2,
												unit: 'percent',
												oSize: {
													diameter: newDiameterPercent,
												},
												size: {
													diameter: newDiameterPercent,
												},
												oPosition: {
													x: newX,
													y: newY,
												},
												position: {
													x: newX,
													y: newY,
												},
											};
										}
										return h2;
									} );
									updateField( 'hotspots', newHotspots );
								} }
								onClick={ () => setExpandedHotspotIndex( index ) }
								className="hotspot circle"
								style={ {
									backgroundColor: hotspot.icon ? 'white' : hotspot.backgroundColor || '#0c80dfa6',
								} }
							>
								<div className={ `hotspot-content flex items-center justify-center ${ ! hotspot.icon ? 'no-icon' : '' }` }>
									{ hotspot.icon ? (
										<FontAwesomeIcon
											icon={ [ 'fas', hotspot.icon ] }
											className="pointer-events-none"
											style={ {
												width: '50%',
												height: '50%',
												color: '#000',
											} }
										/>
									) : null }

									<span className="index">{ index + 1 }</span>

									<div className="hotspot-tooltip">
										{ hotspot.link ? (
											<a
												href={ hotspot.link }
												target="_blank"
												rel="noopener noreferrer"
											>
												{ hotspot.tooltipText }
											</a>
										) : (
											hotspot.tooltipText
										) }
									</div>
								</div>
							</Rnd>
						);
					} ) }
				</div>
			</LayerControls>
		</>
	);
};

export default HotspotLayer;
