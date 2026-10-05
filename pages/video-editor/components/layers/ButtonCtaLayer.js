/**
 * External dependencies
 */
import { Rnd } from 'react-rnd';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';

/**
 * WordPress dependencies
 */
import { Button, Notice, Icon } from '@wordpress/components';
import { trash, plus, chevronDown, chevronRight, dragHandle } from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';
import { useState, useRef, useEffect, useCallback, useMemo } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import { isValidURL } from '../../utils';
import { formatClock, parseClock } from '../../utils/time';
import LayerControls from '../LayerControls';
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';
import LayersHeader from './LayersHeader';
import {
	resolveButtonCtaStyle,
	DEFAULT_BUTTON_BG,
	DEFAULT_BUTTON_TEXT,
	DEFAULT_BUTTON_HOVER_BG,
	DEFAULT_BUTTON_HOVER_TEXT,
} from '../../../../assets/src/js/godam-player/utils/buttonCtaStyle';
import { VeSection, VeField, VeColorList, VeSelect, VeTextInput, VeToggle } from '../controls';

// Attention animations that draw the viewer's eye to a button.
const ATTENTION_OPTIONS = [
	{ value: 'none', label: __( 'None', 'godam' ) },
	{ value: 'pulse', label: __( 'Pulse', 'godam' ) },
	{ value: 'ripple', label: __( 'Border waves', 'godam' ) },
	{ value: 'glow', label: __( 'Glow', 'godam' ) },
];

const ButtonCtaLayer = ( { layerID, goBack, duration } ) => {
	const dispatch = useDispatch();
	const store = useStore();
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	// Images have no timeline, so the Start Time / Duration / pause-on-hover
	// controls are hidden and layers are always visible (displayTime defaults to 0).
	const mediaType = useSelector( ( state ) => state.videoReducer.mediaType );

	// Memoised so the `|| []` fallback keeps a stable reference across renders
	// (used in effect dependency lists).
	const buttons = useMemo( () => layer?.buttons || [], [ layer?.buttons ] );

	// Track expanded button card.
	const [ expandedButtonIndex, setExpandedButtonIndex ] = useState( null );

	// Error message for duration validation.
	const [ durationNotice, setDurationNotice ] = useState( '' );

	// Track duration input separately for validation on blur.
	const [ durationInput, setDurationInput ] = useState( String( layer?.duration || '' ) );

	const containerRef = useRef( null );
	const videoRef = useRef( null );

	// Always-fresh buttons reference, so debounced colour flushes read current state.
	const buttonsRef = useRef( buttons );
	useEffect( () => {
		buttonsRef.current = buttons;
	}, [ buttons ] );

	// Sync duration input with layer duration.
	useEffect( () => {
		setDurationInput( String( layer?.duration || '' ) );
	}, [ layer?.duration ] );

	// Helper to dispatch layer-level updates.
	const updateField = useCallback( ( field, value ) => {
		dispatch( updateLayerField( { id: layer.id, field, value } ) );
	}, [ dispatch, layer?.id ] );

	// Replace the whole buttons array.
	const updateButtons = useCallback( ( next ) => {
		updateField( 'buttons', next );
	}, [ updateField ] );

	// Update a single button's fields by index (immediate; for discrete actions).
	const updateButtonField = useCallback( ( index, changes ) => {
		updateButtons( buttonsRef.current.map( ( b, j ) => ( j === index ? { ...b, ...changes } : b ) ) );
	}, [ updateButtons ] );

	// prevent color picker flickering.
	// Timers are keyed per (button index + field) so editing several colours within
	// the debounce window doesn't make one edit's clearTimeout cancel another, and
	// each flush reads the freshest buttons array from the store (not a stale
	// closure) so near-simultaneous colour edits compose instead of overwriting.
	const colorDebounceRef = useRef( {} );
	const debouncedButtonColor = useCallback(
		( index, field, value ) => {
			const key = `${ index }-${ field }`;
			if ( colorDebounceRef.current[ key ] ) {
				clearTimeout( colorDebounceRef.current[ key ] );
			}
			colorDebounceRef.current[ key ] = setTimeout( () => {
				const liveLayer = store.getState().videoReducer.layers.find( ( l ) => l.id === layerID );
				const liveButtons = liveLayer?.buttons || [];
				const next = liveButtons.map( ( b, j ) => ( j === index ? { ...b, [ field ]: value } : b ) );
				dispatch( updateLayerField( { id: layerID, field: 'buttons', value: next } ) );
				delete colorDebounceRef.current[ key ];
			}, 150 );
		},
		[ dispatch, store, layerID ],
	);

	/**
	 * Handle the shared Start Time change (the layer's displayTime), clamped to
	 * the video length.
	 *
	 * @param {string} value The `m:ss` (or plain seconds) input value.
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
	 * @param {string} value The input value.
	 */
	const handleDurationInputChange = ( value ) => {
		if ( /^\d{0,5}$/.test( value ) ) {
			setDurationInput( value );
		}
	};

	/**
	 * Validate duration value when the input loses focus (1 to 36000 seconds).
	 */
	const validateDuration = () => {
		const value = parseInt( durationInput, 10 );
		let validatedValue;

		const MAX_DURATION = 36000;
		const MIN_DURATION = 1;

		if ( Number.isNaN( value ) || value < MIN_DURATION ) {
			validatedValue = MIN_DURATION;
		} else if ( value > MAX_DURATION ) {
			validatedValue = MAX_DURATION;
		} else {
			validatedValue = value;
		}

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

	// Add a new button at the centre.
	const handleAddButton = useCallback( () => {
		const newButton = {
			id: uuidv4(),
			text: __( 'Click here', 'godam' ),
			link: '',
			position: { x: 50, y: 50 },
			unit: 'percent',
			attention: 'none',
		};
		updateButtons( [ ...buttonsRef.current, newButton ] );
	}, [ updateButtons ] );

	// Auto-add the first button when a fresh layer mounts.
	useEffect( () => {
		if ( layer?.isNew && buttons.length === 0 && contentRect?.width ) {
			handleAddButton();
			updateField( 'isNew', false );
		}
	}, [ layer?.isNew, buttons.length, contentRect?.width, handleAddButton, updateField ] );

	const handleDeleteButton = ( index ) => {
		updateButtons( buttonsRef.current.filter( ( _, i ) => i !== index ) );
		setExpandedButtonIndex( null );
	};

	const toggleButtonExpansion = ( index ) => {
		setExpandedButtonIndex( expandedButtonIndex === index ? null : index );
	};

	const computeContentRect = () => {
		// Resolve the media element generically: video for the player stage,
		// img for the image editor stage.
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

		if ( ! nativeW || ! nativeH ) {
			setContentRect( { left: 0, top: 0, width: elW, height: elH } );
			return;
		}

		const videoAspectRatio = nativeW / nativeH;
		const containerAspectRatio = elW / elH;

		let contentW, contentH, offsetX, offsetY;

		if ( containerAspectRatio > videoAspectRatio ) {
			// Pillarboxed (black bars on left/right).
			contentH = elH;
			contentW = elH * videoAspectRatio;
			offsetX = ( elW - contentW ) / 2;
			offsetY = 0;
		} else {
			// Letterboxed (black bars on top/bottom).
			contentW = elW;
			contentH = elW / videoAspectRatio;
			offsetX = 0;
			offsetY = ( elH - contentH ) / 2;
		}

		setContentRect( {
			left: Math.round( offsetX ),
			top: Math.round( offsetY ),
			width: Math.round( contentW ),
			height: Math.round( contentH ),
		} );
	};

	useEffect( () => {
		let resizeObserver = null;
		let rafId = null;
		let cancelled = false;
		let stageWaitFrames = 0;

		const MAX_STAGE_WAIT_FRAMES = 300;

		// The stage preview may not be in the DOM yet when this layer mounts, so
		// retry until the stage container exists, then observe it (handles the
		// 0 -> WxH transition on media load regardless of mount order).
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
				{ /* Buttons: one card per button with text, link, variant and colours. */ }
				<VeSection title={ __( 'Buttons', 'godam' ) }>
					{ buttons.length > 0 && (
						<p className="godam-ve-hint">
							<Icon className="godam-ve-hint__icon" icon={ dragHandle } size={ 18 } />
							{ __( 'Drag a button in the video to reposition it.', 'godam' ) }
						</p>
					) }

					<div className="godam-ve-hotspot-list">
						{ buttons.map( ( button, index ) => (
							<div key={ button.id } className="godam-ve-hotspot-card">
								<div className="godam-ve-hotspot-card__head">
									<Button
										data-test-id={ `godam-button-cta-control-select-${ index }` }
										icon={ expandedButtonIndex === index ? chevronDown : chevronRight }
										className="godam-ve-hotspot-card__toggle"
										onClick={ () => toggleButtonExpansion( index ) }
									>
										{
											/* translators: %d is the button index */
											sprintf( __( 'Button %d', 'godam' ), index + 1 )
										}
									</Button>
									<Button
										data-test-id={ `godam-button-cta-button-delete-${ index }` }
										icon={ trash }
										label={
											/* translators: %d is the button index */
											sprintf( __( 'Delete Button %d', 'godam' ), index + 1 )
										}
										onClick={ () => handleDeleteButton( index ) }
									/>
								</div>

								{ expandedButtonIndex === index && (
									<div className="godam-ve-hotspot-card__body">
										<VeTextInput
											data-test-id={ `godam-button-cta-control-text-${ index }` }
											label={ __( 'Button Text', 'godam' ) }
											placeholder={ __( 'Click here', 'godam' ) }
											value={ button.text }
											onChange={ ( val ) => updateButtonField( index, { text: val } ) }
										/>
										<VeTextInput
											data-test-id={ `godam-button-cta-control-link-${ index }` }
											label={ __( 'Link', 'godam' ) }
											type="url"
											placeholder="https://www.example.com"
											value={ button.link }
											error={ button.link && ! isValidURL( button.link ) ? __( 'Please enter a valid URL (e.g., https://example.com)', 'godam' ) : '' }
											onChange={ ( val ) => updateButtonField( index, { link: val } ) }
										/>
										<VeSelect
											label={ __( 'Attention animation', 'godam' ) }
											value={ button.attention || 'none' }
											options={ ATTENTION_OPTIONS }
											onChange={ ( val ) => updateButtonField( index, { attention: val } ) }
										/>
										<VeField label={ __( 'Colours', 'godam' ) }>
											<VeColorList>
												<ColorPickerButton
													className="godam-ve-color-row"
													value={ button.bgColor ?? DEFAULT_BUTTON_BG }
													label={ __( 'Background', 'godam' ) }
													enableAlpha={ true }
													onChange={ ( val ) => debouncedButtonColor( index, 'bgColor', val ) }
												/>
												<ColorPickerButton
													className="godam-ve-color-row"
													value={ button.textColor ?? DEFAULT_BUTTON_TEXT }
													label={ __( 'Text', 'godam' ) }
													enableAlpha={ true }
													onChange={ ( val ) => debouncedButtonColor( index, 'textColor', val ) }
												/>
												<ColorPickerButton
													className="godam-ve-color-row"
													value={ button.hoverBgColor ?? DEFAULT_BUTTON_HOVER_BG }
													label={ __( 'Hover Background', 'godam' ) }
													enableAlpha={ true }
													onChange={ ( val ) => debouncedButtonColor( index, 'hoverBgColor', val ) }
												/>
												<ColorPickerButton
													className="godam-ve-color-row"
													value={ button.hoverTextColor ?? DEFAULT_BUTTON_HOVER_TEXT }
													label={ __( 'Hover Text', 'godam' ) }
													enableAlpha={ true }
													onChange={ ( val ) => debouncedButtonColor( index, 'hoverTextColor', val ) }
												/>
											</VeColorList>
										</VeField>
									</div>
								) }
							</div>
						) ) }

						<Button
							data-test-id="godam-button-cta-button-add"
							className="godam-ve-add-hotspot"
							icon={ plus }
							iconPosition="left"
							onClick={ handleAddButton }
						>
							{ __( 'Add Button', 'godam' ) }
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
							data-test-id="godam-button-cta-control-duration"
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

				{ /* Behaviour: pause-on-hover is video-only, so hidden for images. */ }
				{ mediaType !== 'image' && (
					<VeSection title={ __( 'Behaviour', 'godam' ) }>
						<div data-test-id="godam-button-cta-control-pause-on-hover">
							<VeToggle
								label={ __( 'Pause video when a button is hovered', 'godam' ) }
								checked={ layer?.pauseOnHover || false }
								onChange={ ( isChecked ) => updateField( 'pauseOnHover', isChecked ) }
								help={ __( 'Player will pause the video while users hover over a button.', 'godam' ) }
							/>
						</div>
					</VeSection>
				) }
			</div>

			<LayerControls>
				<div
					ref={ containerRef }
					className="easydam-layer godam-button-cta-layer"
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
					{ buttons.map( ( button, index ) => {
						const posX = button.position?.x ?? 50;
						const posY = button.position?.y ?? 50;
						const pixelX = percentToPx( posX, 'x' );
						const pixelY = percentToPx( posY, 'y' );
						const style = resolveButtonCtaStyle( button );

						return (
							<Rnd
								key={ button.id }
								position={ { x: pixelX, y: pixelY } }
								default={ { x: pixelX, y: pixelY, width: 'auto', height: 'auto' } }
								bounds="parent"
								enableResizing={ false }
								onDragStop={ ( e, d ) => {
									if ( ! contentRect ) {
										return;
									}
									updateButtonField( index, {
										unit: 'percent',
										position: {
											x: pxToPercent( d.x, 'x' ),
											y: pxToPercent( d.y, 'y' ),
										},
									} );
								} }
								onClick={ () => setExpandedButtonIndex( index ) }
								className={ `godam-button-cta${ style.attention !== 'none' ? ` godam-button-cta--attn-${ style.attention }` : '' }` }
								style={ {
									'--godam-btn-bg': style.bgColor,
									'--godam-btn-text': style.textColor,
									'--godam-btn-hover-bg': style.hoverBgColor,
									'--godam-btn-hover-text': style.hoverTextColor,
								} }
							>
								{ button.text || __( 'Button', 'godam' ) }
							</Rnd>
						);
					} ) }
				</div>
			</LayerControls>
		</>
	);
};

export default ButtonCtaLayer;
