/**
 * External dependencies
 */
import { Rnd } from 'react-rnd';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';

/**
 * WordPress dependencies
 */
import {
	Button,
	Notice,
	Icon,
} from '@wordpress/components';
import {
	trash,
	plus,
	chevronDown,
	chevronRight,
	dragHandle,
} from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';
import { useState, useRef, useEffect, useCallback } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import { isValidURL } from '../../utils';
import { formatClock, parseClock } from '../../utils/time';
import LayerControls from '../LayerControls';
import FontAwesomeIconPicker from '../hotspot/FontAwesomeIconPicker';
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShoppingCart } from '@fortawesome/free-solid-svg-icons';
import LayersHeader from './LayersHeader';
import { HOTSPOT_CONSTANTS } from '../../../../assets/src/js/godam-player/utils/constants';
import { resolveHotspotStyle, DEFAULT_HOTSPOT_COLOR } from '../../../../assets/src/js/godam-player/utils/hotspotStyle';
import { VeSection, VeColorList, VeSegmented, VeTextInput, VeToggle } from '../controls';

/**
 * Small purple pulse-dot glyph for the Style segmented control, matching the
 * WooCommerce hotspot layer's "Pulse" option.
 *
 * @return {JSX.Element} The pulse-dot icon.
 */
const PulseDotIcon = () => (
	<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
		<circle cx="9" cy="9" r="4" fill="#7c3aed" />
		<circle cx="9" cy="9" r="7.5" stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.35" />
	</svg>
);

const CartIconOption = () => (
	<FontAwesomeIcon icon={ faShoppingCart } style={ { fontSize: '1rem' } } />
);

// Icon-on-top segmented cards, matching the WooCommerce hotspot layer's Style
// field. Woo uses a cart for its "Icon" option (product-specific); a generic
// hotspot uses a map-marker glyph instead.
const STYLE_OPTIONS = [
	{ value: 'pulse', label: __( 'Pulse', 'godam' ), icon: <PulseDotIcon /> },
	{ value: 'icon', label: __( 'Icon', 'godam' ), icon: <CartIconOption /> },
];

const HotspotLayer = ( { layerID, goBack, duration } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	// Images have no timeline, so the Start Time / Layer Duration controls are
	// hidden and layers are always visible (displayTime defaults to 0).
	const mediaType = useSelector( ( state ) => state.videoReducer.mediaType );

	const hotspots = layer?.hotspots || [];
	// Track expanded hotspot
	const [ expandedHotspotIndex, setExpandedHotspotIndex ] = useState( null );

	// Error message for duration validation
	const [ durationNotice, setDurationNotice ] = useState( '' );

	// Track duration input separately for validation on blur
	const [ durationInput, setDurationInput ] = useState( String( layer?.duration || '' ) );

	const containerRef = useRef( null );
	const videoRef = useRef( null );

	// Sync duration input with layer duration
	useEffect( () => {
		setDurationInput( String( layer?.duration || '' ) );
	}, [ layer?.duration ] );

	// Helper to dispatch updates
	const updateField = useCallback( ( field, value ) => {
		dispatch( updateLayerField( { id: layer.id, field, value } ) );
	}, [ dispatch, layer?.id ] );

	const styleType = layer?.styleType || 'pulse';
	const sharedColor = styleType === 'icon'
		? ( layer?.iconColor || DEFAULT_HOTSPOT_COLOR )
		: ( layer?.pulseColor || DEFAULT_HOTSPOT_COLOR );

	/**
	 * Migrate legacy layers (saved with per-hotspot style and no `styleType`)
	 * to the shared style model on open: seed the shared Style controls from the
	 * first hotspot's icon/colour so the new UI is populated. The frontend still
	 * renders legacy layers correctly until they are re-saved (see
	 * resolveHotspotStyle); after a save they use the shared model.
	 */
	useEffect( () => {
		if ( ! layer || layer.styleType ) {
			return;
		}
		const first = layer.hotspots?.[ 0 ] || {};
		const hasIcon = !! ( first.icon || first.customIconUrl );
		const seededColor = first.backgroundColor || DEFAULT_HOTSPOT_COLOR;

		dispatch( updateLayerField( { id: layer.id, field: 'styleType', value: hasIcon ? 'icon' : 'pulse' } ) );
		dispatch( updateLayerField( { id: layer.id, field: 'pulseColor', value: seededColor } ) );
		dispatch( updateLayerField( { id: layer.id, field: 'iconColor', value: seededColor } ) );
		dispatch( updateLayerField( { id: layer.id, field: 'icon', value: first.icon || '' } ) );
		dispatch( updateLayerField( { id: layer.id, field: 'customIconUrl', value: first.customIconUrl || null } ) );
		dispatch( updateLayerField( { id: layer.id, field: 'customIconId', value: first.customIconId || null } ) );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ layer?.id ] );

	/**
	 * Handle the shared Start Time change (the layer's displayTime), clamped to
	 * the video length.
	 *
	 * @param {string} value - The `m:ss` (or plain seconds) input value.
	 */
	const handleStartTimeChange = ( value ) => {
		let seconds = parseClock( value );
		if ( duration ) {
			seconds = Math.min( seconds, Math.floor( duration ) );
		}
		seconds = Math.max( 0, seconds );
		updateField( 'displayTime', seconds );
	};

	/**
	 * Handle duration input change - allows typing but filters non-numeric input.
	 *
	 * @param {string} value - The input value.
	 */
	const handleDurationInputChange = ( value ) => {
		// Allow only digits up to 5 characters (max 36000 = 10 hours)
		if ( /^\d{0,5}$/.test( value ) ) {
			setDurationInput( value );
		}
	};

	/**
	 * Validate duration value when input loses focus.
	 * Ensures value is within valid range (1 to 36000 seconds = 10 hours).
	 */
	const validateDuration = () => {
		const value = parseInt( durationInput, 10 );
		let validatedValue;

		// Maximum: 10 hours (36000 seconds)
		const MAX_DURATION = 36000;
		const MIN_DURATION = 1;

		if ( Number.isNaN( value ) || value < MIN_DURATION ) {
			validatedValue = MIN_DURATION;
		} else if ( value > MAX_DURATION ) {
			validatedValue = MAX_DURATION;
		} else {
			validatedValue = value;
		}

		// Check if duration exceeds remaining video length
		const displayTime = parseFloat( layer?.displayTime || 0 );
		if ( duration > 0 && validatedValue + displayTime > duration ) {
			setDurationNotice( __( 'Layer duration exceeds the remaining video length. Please reduce the duration.', 'godam' ) );
			validatedValue = Math.max( MIN_DURATION, Math.floor( duration - displayTime ) );
		} else {
			setDurationNotice( '' );
		}

		setDurationInput( String( validatedValue ) );
		if ( validatedValue !== layer?.duration ) {
			updateField( 'duration', validatedValue );
		}
	};

	const [ contentRect, setContentRect ] = useState( null );

	const percentToPx = useCallback( ( percent, dimension ) => {
		if ( ! contentRect ) {
			return 0;
		}
		const size = dimension === 'x' ? contentRect.width : contentRect.height;
		return ( percent / 100 ) * size;
	}, [ contentRect ] );

	const pxToPercent = useCallback( ( px, dimension ) => {
		if ( ! contentRect ) {
			return 0;
		}
		const size = dimension === 'x' ? contentRect.width : contentRect.height;
		return ( px / size ) * 100;
	}, [ contentRect ] );

	const getDefaultDiameter = useCallback( ( unit ) => {
		if ( unit !== 'percent' ) {
			return HOTSPOT_CONSTANTS.DEFAULT_DIAMETER_PX;
		}

		return contentRect?.width
			? pxToPercent( HOTSPOT_CONSTANTS.DEFAULT_DIAMETER_PX, 'x' )
			: HOTSPOT_CONSTANTS.DEFAULT_DIAMETER_PERCENT;
	}, [ contentRect?.width, pxToPercent ] );

	// Add a new hotspot. Style now lives at the layer level (shared), so a
	// hotspot only carries its position, size, tooltip and link.
	const handleAddHotspot = useCallback( () => {
		// Calculate percentage dynamically to maintain a consistent physical size (approx 48px)
		const diameterPercent = getDefaultDiameter( 'percent' );

		const newHotspot = {
			id: uuidv4(),
			tooltipText: __( 'New Hotspot', 'godam' ),
			link: '',
			position: { x: 50, y: 50 },
			size: { diameter: diameterPercent },
			oSize: { diameter: diameterPercent },
			oPosition: { x: 50, y: 50 },
			unit: 'percent',
		};
		updateField( 'hotspots', [ ...hotspots, newHotspot ] );
	}, [ getDefaultDiameter, hotspots, updateField ] );

	// Auto-add the first hotspot if none exist and it's a new layer
	useEffect( () => {
		if ( layer?.isNew && hotspots.length === 0 && contentRect?.width ) {
			handleAddHotspot();
			updateField( 'isNew', false ); // Mark as not new anymore
		}
	}, [ layer?.isNew, hotspots.length, contentRect?.width, handleAddHotspot, updateField ] );

	const handleDeleteHotspot = ( index ) => {
		updateField(
			'hotspots',
			hotspots.filter( ( _, i ) => i !== index ),
		);
		setExpandedHotspotIndex( null );
	};

	// Expand/hide a hotspot’s panel
	const toggleHotspotExpansion = ( index ) => {
		setExpandedHotspotIndex( expandedHotspotIndex === index ? null : index );
	};

	// Update a single hotspot's field by index.
	const updateHotspotField = ( index, changes ) => {
		updateField(
			'hotspots',
			hotspots.map( ( h2, j ) => ( j === index ? { ...h2, ...changes } : h2 ) ),
		);
	};

	const computeContentRect = () => {
		// Resolve the media element generically: video for the player stage,
		// img for the image editor stage. `videoWidth`/`naturalWidth` give the
		// intrinsic size in each case so the aspect math below is shared.
		const mediaEl = document.querySelector( '#easydam-video-player video' ) ||
			document.querySelector( '#easydam-video-player img' );
		const containerEl = document.getElementById( 'easydam-video-player' );

		if ( ! mediaEl || ! containerEl ) {
			setContentRect( null );
			return;
		}

		const nativeW = mediaEl.videoWidth || mediaEl.naturalWidth || 0;
		const nativeH = mediaEl.videoHeight || mediaEl.naturalHeight || 0;

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
		let resizeObserver = null;
		let rafId = null;
		let cancelled = false;
		let stageWaitFrames = 0;

		// Cap the wait for the stage container so a layer selected while the
		// preview never mounts can't spin requestAnimationFrame for the
		// component's whole lifetime. ~300 frames (~5s at 60fps) is far beyond
		// the frame-or-two the normal path needs; past that the stage isn't
		// coming and there is nothing to position against.
		const MAX_STAGE_WAIT_FRAMES = 300;

		// The stage preview may not be in the DOM yet when this layer mounts (a
		// layer can be selected before the attachment finishes loading). A one-shot
		// computeContentRect() would then find no media element, set contentRect to
		// null and never recover, collapsing hotspots to 0x0 at (0,0). So retry
		// until the stage container exists, then observe it: ResizeObserver fires on
		// observe and whenever the media box gets/changes a laid-out size (0 -> WxH
		// on image load), reliably (re)computing contentRect regardless of mount
		// order.
		const start = () => {
			if ( cancelled ) {
				return;
			}

			const containerEl = document.getElementById( 'easydam-video-player' );
			if ( ! containerEl ) {
				if ( stageWaitFrames++ < MAX_STAGE_WAIT_FRAMES ) {
					rafId = requestAnimationFrame( start );
				}
				return;
			}

			computeContentRect();

			resizeObserver = new ResizeObserver( computeContentRect );
			resizeObserver.observe( containerEl );

			// `loadedmetadata` for a video, `load` for an image; cached images may
			// already be complete (no future load event), so compute now too.
			const mediaEl = containerEl.querySelector( 'video, img' );
			if ( mediaEl ) {
				videoRef.current = mediaEl;
				const loadEvent = mediaEl.tagName === 'IMG' ? 'load' : 'loadedmetadata';
				mediaEl.addEventListener( loadEvent, computeContentRect );
				if ( 'IMG' === mediaEl.tagName && mediaEl.complete ) {
					computeContentRect();
				}
			}
		};

		start();
		window.addEventListener( 'resize', computeContentRect );
		document.addEventListener( 'fullscreenchange', computeContentRect );

		return () => {
			cancelled = true;
			if ( rafId ) {
				cancelAnimationFrame( rafId );
			}
			if ( resizeObserver ) {
				resizeObserver.disconnect();
			}
			window.removeEventListener( 'resize', computeContentRect );
			document.removeEventListener( 'fullscreenchange', computeContentRect );
			if ( videoRef.current ) {
				const loadEvent = videoRef.current.tagName === 'IMG' ? 'load' : 'loadedmetadata';
				videoRef.current.removeEventListener( loadEvent, computeContentRect );
			}
		};
	}, [] );

	// Validate existing hotspot links on component load
	useEffect( () => {
		if ( hotspots.length > 0 ) {
			const updatedHotspots = hotspots.map( ( hotspot ) => {
				if ( hotspot.link ) {
					const isInvalid = ! isValidURL( hotspot.link );
					if ( hotspot.linkInvalid !== isInvalid ) {
						return { ...hotspot, linkInvalid: isInvalid };
					}
				} else if ( hotspot.linkInvalid ) {
					// No link present; ensure linkInvalid is reset
					return { ...hotspot, linkInvalid: false };
				}
				return hotspot;
			} );
			// Only update if there are changes
			const hasChanges = updatedHotspots.some(
				( h, i ) => h.linkInvalid !== hotspots[ i ].linkInvalid,
			);
			if ( hasChanges ) {
				updateField( 'hotspots', updatedHotspots );
			}
		}
	}, [] );

	return (
		<>
			<LayersHeader layer={ layer } goBack={ goBack } duration={ duration } />

			{
				durationNotice &&
				<Notice
					className="mb-4"
					status="error"
					onRemove={ () => setDurationNotice( '' ) }
				>
					{ durationNotice }
				</Notice>
			}

			<div className="godam-ve-config">
				{ /* Add Hotspots: one card per point with tooltip + link. */ }
				<VeSection title={ __( 'Add Hotspots', 'godam' ) }>
					{ hotspots.length > 0 && (
						<p className="godam-ve-hint">
							<Icon className="godam-ve-hint__icon" icon={ dragHandle } size={ 18 } />
							{ __( 'Drag the hotspot in video to reposition it.', 'godam' ) }
						</p>
					) }

					<div className="godam-ve-hotspot-list">
						{ hotspots.map( ( hotspot, index ) => (
							<div key={ hotspot.id } className="godam-ve-hotspot-card">
								<div className="godam-ve-hotspot-card__head">
									<Button
										data-test-id={ `godam-hotspot-control-select-${ index }` }
										icon={ expandedHotspotIndex === index ? chevronDown : chevronRight }
										className="godam-ve-hotspot-card__toggle"
										onClick={ () => toggleHotspotExpansion( index ) }
									>
										{
											/* translators: %d is the hotspot index */
											sprintf( __( 'Hotspot %d', 'godam' ), index + 1 )
										}
									</Button>
									<Button
										data-test-id={ `godam-hotspot-button-delete-${ index }` }
										icon={ trash }
										label={
											/* translators: %d is the hotspot index */
											sprintf( __( 'Delete Hotspot %d', 'godam' ), index + 1 )
										}
										onClick={ () => handleDeleteHotspot( index ) }
									/>
								</div>

								{ expandedHotspotIndex === index && (
									<div className="godam-ve-hotspot-card__body">
										<VeTextInput
											data-test-id={ `godam-hotspot-control-tooltip-text-${ index }` }
											label={ __( 'Tooltip Text', 'godam' ) }
											placeholder={ __( 'Click Me!', 'godam' ) }
											value={ hotspot.tooltipText }
											onChange={ ( val ) => updateHotspotField( index, { tooltipText: val } ) }
										/>
										<VeTextInput
											data-test-id={ `godam-hotspot-control-link-${ index }` }
											label={ __( 'Link', 'godam' ) }
											placeholder="https://www.example.com"
											value={ hotspot.link }
											error={ hotspot.linkInvalid ? __( 'Please enter a valid URL (e.g., https://example.com)', 'godam' ) : '' }
											onChange={ ( val ) => updateHotspotField( index, { link: val, linkInvalid: !! val && ! isValidURL( val ) } ) }
										/>
									</div>
								) }
							</div>
						) ) }

						<Button
							data-test-id="godam-hotspot-button-add"
							id="add-hotspot-btn"
							className="godam-ve-add-hotspot"
							icon={ plus }
							iconPosition="left"
							onClick={ handleAddHotspot }
						>
							{ __( 'Add Hotspot', 'godam' ) }
						</Button>
					</div>
				</VeSection>

				{ /* Duration: shared Start Time + Layer Duration. Timeline-only; hidden for images. */ }
				{ mediaType !== 'image' && (
					<VeSection title={ __( 'Duration', 'godam' ) }>
						<VeTextInput
							label={ __( 'Start Time', 'godam' ) }
							value={ formatClock( layer?.displayTime ) }
							onChange={ handleStartTimeChange }
							placeholder="0:00"
						/>
						<VeTextInput
							data-test-id="godam-hotspot-control-duration"
							label={ __( 'Layer Duration (seconds)', 'godam' ) }
							type="number"
							min="1"
							max="36000"
							value={ durationInput }
							onChange={ handleDurationInputChange }
							onBlur={ validateDuration }
							help={ __( 'Duration (in seconds) this layer will stay visible. Maximum: 10 hours (36000 seconds)', 'godam' ) }
						/>
					</VeSection>
				) }

				{ /* Style: shared across all hotspot points. */ }
				<VeSection title={ __( 'Style', 'godam' ) }>
					<VeSegmented
						options={ STYLE_OPTIONS }
						value={ styleType }
						onChange={ ( value ) => updateField( 'styleType', value ) }
					/>

					{ styleType === 'icon' && (
						<FontAwesomeIconPicker
							icon={ layer?.icon }
							customIconUrl={ layer?.customIconUrl }
							customIconId={ layer?.customIconId }
							onChange={ ( { icon, customIconUrl, customIconId } ) => {
								updateField( 'icon', icon ?? '' );
								updateField( 'customIconUrl', customIconUrl ?? null );
								updateField( 'customIconId', customIconId ?? null );
							} }
						/>
					) }

					<VeColorList>
						<ColorPickerButton
							value={ sharedColor }
							label={ styleType === 'icon' ? __( 'Colour', 'godam' ) : __( 'Pulse colour', 'godam' ) }
							enableAlpha={ true }
							onChange={ ( value ) => updateField( styleType === 'icon' ? 'iconColor' : 'pulseColor', value ) }
						/>
					</VeColorList>
				</VeSection>

				{ /* Behaviour: pause-on-hover is video-only, so hidden for images. */ }
				{ mediaType !== 'image' && (
					<VeSection title={ __( 'Behaviour', 'godam' ) }>
						<div data-test-id="godam-hotspot-control-pause-on-hover">
							<VeToggle
								label={ __( 'Pause video when hotspot is hovered', 'godam' ) }
								checked={ layer?.pauseOnHover || false }
								onChange={ ( isChecked ) => updateField( 'pauseOnHover', isChecked ) }
								help={ __( 'Player will pause the video while the layer is displayed and users hover over the hotspots.', 'godam' ) }
							/>
						</div>
					</VeSection>
				) }
			</div>

			<LayerControls>
				<div
					ref={ containerRef }
					className="easydam-layer hotspot-layer"
					style={ {
						backgroundColor: layer.bg_color || 'transparent',
						position: 'absolute',
						left: contentRect?.left || 0,
						top: contentRect?.top || 0,
						width: contentRect?.width || '100%',
						height: contentRect?.height || '100%',
						zIndex: 5,
					} }
				>
					{ hotspots.map( ( hotspot, index ) => {
						const posX = hotspot.oPosition?.x ?? hotspot.position?.x ?? 50;
						const posY = hotspot.oPosition?.y ?? hotspot.position?.y ?? 50;
						const diameter = hotspot.oSize?.diameter ?? hotspot.size?.diameter ?? getDefaultDiameter( hotspot.unit );

						// Resolve the effective style (shared for new layers,
						// per-hotspot for legacy layers) so the preview matches
						// the published player.
						const effective = resolveHotspotStyle( layer, hotspot );
						const hasIcon = !! ( effective.icon || effective.customIconUrl );

						let pixelX, pixelY, pixelDiameter;

						if ( hotspot.unit === 'percent' ) {
							// Calculate pixel values for rendering
							pixelX = percentToPx( posX, 'x' );
							pixelY = percentToPx( posY, 'y' );
							pixelDiameter = percentToPx( diameter, 'x' );
						} else {
							// Legacy handling in editor (relative to base dimensions)
							const baseWidth = HOTSPOT_CONSTANTS.BASE_WIDTH;
							const baseHeight = HOTSPOT_CONSTANTS.BASE_HEIGHT;
							pixelX = ( posX / baseWidth ) * ( contentRect?.width || HOTSPOT_CONSTANTS.BASE_WIDTH );
							pixelY = ( posY / baseHeight ) * ( contentRect?.height || HOTSPOT_CONSTANTS.BASE_HEIGHT );
							pixelDiameter = ( diameter / baseWidth ) * ( contentRect?.width || HOTSPOT_CONSTANTS.BASE_WIDTH );
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
								minWidth={ HOTSPOT_CONSTANTS.MIN_PX }
								minHeight={ HOTSPOT_CONSTANTS.MIN_PX }
								lockAspectRatio
								onDragStop={ ( e, d ) => {
									if ( ! contentRect ) {
										return;
									}

									// d.x and d.y are relative to the parent (contentRect div)
									const relativeX = d.x;
									const relativeY = d.y;

									const newHotspots = hotspots.map( ( h2, j ) => {
										if ( j === index ) {
											const newX = pxToPercent( relativeX, 'x' );
											const newY = pxToPercent( relativeY, 'y' );

											// If converting from legacy, also convert diameter to percentage
											let newDiameter = h2.oSize?.diameter ?? h2.size?.diameter ?? getDefaultDiameter( h2.unit );
											if ( h2.unit !== 'percent' ) {
												// Ensure it's at least 10px equivalent in percentage
												const minPercent = contentRect ? ( HOTSPOT_CONSTANTS.MIN_PX / contentRect.width ) * 100 : HOTSPOT_CONSTANTS.MIN_PERCENT_FALLBACK;
												newDiameter = Math.max( minPercent, ( newDiameter / HOTSPOT_CONSTANTS.BASE_WIDTH ) * 100 );
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

									let newDiameterPx = ref.offsetWidth;
									let relativeX = position.x;
									let relativeY = position.y;

									// Clamp position to ensure it stays within contentRect
									relativeX = Math.max( 0, Math.min( relativeX, contentRect.width - newDiameterPx ) );
									relativeY = Math.max( 0, Math.min( relativeY, contentRect.height - newDiameterPx ) );

									// Clamp diameter to ensure it doesn't exceed the remaining space from the current position
									const maxAllowedDiameter = Math.min( contentRect.width - relativeX, contentRect.height - relativeY );
									newDiameterPx = Math.min( newDiameterPx, maxAllowedDiameter );

									const newDiameterPercent = pxToPercent( newDiameterPx, 'x' );
									const newX = pxToPercent( relativeX, 'x' );
									const newY = pxToPercent( relativeY, 'y' );

									const newHotspots = hotspots.map( ( h2, j ) => {
										if ( j === index ) {
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
									backgroundColor: hasIcon ? 'white' : ( effective.color || DEFAULT_HOTSPOT_COLOR ),
								} }
							>
								<div className={ `hotspot-content flex items-center justify-center ${ ! hasIcon ? 'no-icon' : '' }` }>
									{ /* eslint-disable-next-line no-nested-ternary */ }
									{ effective.icon ? (
										<FontAwesomeIcon
											icon={ [ 'fas', effective.icon ] }
											className="pointer-events-none"
											style={ {
												width: '50%',
												height: '50%',
												color: '#000',
											} }
										/>
									) : effective.customIconUrl ? (
										<img
											src={ effective.customIconUrl }
											alt={ __( 'Custom Icon', 'godam' ) }
											className="pointer-events-none"
											style={ {
												width: '50%',
												height: '50%',
												objectFit: 'contain',
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
