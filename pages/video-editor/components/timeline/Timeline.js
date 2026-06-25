/**
 * Video editor timeline: scrubber + layer-marker chips + time ruler.
 *
 * Extracted from `VideoJSPlayer.js` so the stage can dock it at the bottom,
 * independent of the player. The presentational `Slider` draws the track,
 * fill, playhead, markers and ruler; the `Timeline` wrapper connects it to
 * Redux (layers / chapters / current layer / current tab) and the player via
 * the `onSeek` callback. Styled in `_timeline.scss`.
 */

/**
 * External dependencies
 */
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { plus } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { layerTypes, FORM_PLUGIN_META } from '../../utils/layerTypes';
import { setCurrentLayer, setAddLayerModalTime, updateLayerField } from '../../redux/slice/videoSlice';

// Timeline accent — mirrors the rest of the editor (uses the live WordPress
// admin theme colour, falling back to the GoDAM purple from the design).
const TIMELINE_ACCENT = 'var(--wp-components-color-accent, var(--wp-admin-theme-color, #5d31ff))';

// Per-type marker colour. Types without an entry (incl. add-on layers) fall
// back to the accent — matching the indigo hotspot chip in the design.
const LAYER_MARKER_COLORS = {
	cta: '#d98c1a',
	ad: '#9b51e0',
	form: '#2d9cdb',
	poll: '#ab3a6c',
};

/**
 * Shopping-cart glyph (white line art) for commerce layer markers.
 * `@wordpress/icons` ships no cart icon, so it's defined inline here.
 *
 * @return {JSX.Element} Cart SVG.
 */
const CartIcon = () => (
	<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<circle cx="9" cy="20" r="1.5" />
		<circle cx="18" cy="20" r="1.5" />
		<path d="M2 3h3l2.4 12a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L22 7H6" />
	</svg>
);

// Per-type marker icon override. Takes precedence over a layer type's WordPress
// icon or add-on `iconUrl` (e.g. the WooCommerce layer shows a cart, not a logo).
const LAYER_MARKER_ICONS = {
	woo: CartIcon,
};

const Slider = ( props ) => {
	const { max, value, onChange, className, layers, onLayerSelect, disabled, currentLayerID, chapters, formatTimeForInput, onInteract, onAddLayer, onLayerDrag } = props;

	const sliderRef = useRef( null );
	const [ sliderValue, setSliderValue ] = useState( value );
	const [ hoverValue, setHoverValue ] = useState( null ); // Hover value
	const [ isDragging, setIsDragging ] = useState( false ); // Track if user is dragging the slider
	const [ isHovering, setIsHovering ] = useState( false ); // Track if mouse is over slider area
	const [ draggingLayer, setDraggingLayer ] = useState( null ); // Track which layer is being dragged
	const [ dragPosition, setDragPosition ] = useState( null ); // Track drag position as percentage
	const [ addPinned, setAddPinned ] = useState( false ); // "Add layer" chip pinned after a track click
	const pressTimerRef = useRef( null ); // Timer for press-and-hold detection

	useEffect( () => {
		setSliderValue( value );
	}, [ value ] );

	// Sort the array (ascending order) and remove garbage values
	const seenTimes = new Set();
	const sortedChapters = chapters
		?.filter( ( chapter ) => {
			const time = parseFloat( chapter.startTime );
			if (
				isNaN( time ) ||
			time < 0 ||
			seenTimes.has( time )
			) {
				return false;
			}
			seenTimes.add( time );
			return true;
		} )
		.sort( ( a, b ) => a.startTime - b.startTime );

	const sortedLayers = [ ...layers ]?.sort( ( a, b ) => a.displayTime - b.displayTime );

	const handleHover = ( e ) => {
		const rect = e.target.getBoundingClientRect();
		const offsetX = e.clientX - rect.left;
		const percentage = offsetX / rect.width;
		const val = percentage * max;
		setHoverValue( val.toFixed( 2 ) );
	};

	const handleLeave = () => {
		setHoverValue( null ); // Hide tooltip when not hovering
	};

	const formatTime = ( seconds ) => {
		const minutes = Math.floor( seconds / 60 );
		const remainingSeconds = Math.floor( seconds % 60 );
		return `${ minutes }:${ remainingSeconds < 10 ? '0' : '' }${ remainingSeconds }`;
	};

	// Handle layer drag start (after press-and-hold delay)
	const handleLayerPointerDown = ( e, layer ) => {
		e.stopPropagation();
		const PRESS_HOLD_DELAY = 200; // milliseconds

		pressTimerRef.current = setTimeout( () => {
			setDraggingLayer( layer );
			setDragPosition( ( layer.displayTime / max ) * 100 );
			document.body.style.cursor = 'grabbing';
		}, PRESS_HOLD_DELAY );
	};

	// Handle pointer up - either select layer or finish drag
	const handleLayerPointerUp = ( layer ) => {
		if ( pressTimerRef.current ) {
			clearTimeout( pressTimerRef.current );
			pressTimerRef.current = null;
		}

		if ( draggingLayer ) {
			// Finish drag — watch-depth updates its watch %, end-of-video is fixed
			// at the end (no update), others update displayTime.
			if ( draggingLayer.trigger === 'watch_depth' ) {
				const watchDepthValue = Math.max( 1, Math.min( 100, Math.round( dragPosition ) ) );
				onLayerDrag?.( draggingLayer.id, watchDepthValue, 'watchDepth' );
				onLayerSelect( { ...draggingLayer, watchDepth: watchDepthValue } );
			} else if ( draggingLayer.trigger === 'end_of_video' ) {
				onLayerSelect( draggingLayer );
			} else {
				const newDisplayTime = Math.max( 0, Math.min( Math.round( ( dragPosition / 100 ) * max * 100 ) / 100, max ) );
				onLayerDrag?.( draggingLayer.id, newDisplayTime, 'displayTime' );
				onLayerSelect( { ...draggingLayer, displayTime: newDisplayTime } );
			}
			setDraggingLayer( null );
			setDragPosition( null );
			document.body.style.cursor = '';
		} else {
			// Normal click - select layer
			onLayerSelect( layer );
		}
	};

	// Handle pointer move during drag
	const handlePointerMove = ( e ) => {
		if ( ! draggingLayer || ! sliderRef.current ) {
			return;
		}

		const rect = sliderRef.current.getBoundingClientRect();
		const offsetX = e.clientX - rect.left;
		const percentage = Math.max( 0, Math.min( ( offsetX / rect.width ) * 100, 100 ) );
		setDragPosition( percentage );
	};

	// Handle pointer leave during drag
	const handlePointerLeaveWhileDragging = () => {
		if ( pressTimerRef.current ) {
			clearTimeout( pressTimerRef.current );
			pressTimerRef.current = null;
		}
	};

	// Cleanup on unmount
	useEffect( () => {
		return () => {
			if ( pressTimerRef.current ) {
				clearTimeout( pressTimerRef.current );
			}
		};
	}, [] );

	// Add global pointer up listener when dragging
	useEffect( () => {
		if ( ! draggingLayer ) {
			return;
		}

		const handleGlobalPointerUp = () => {
			if ( draggingLayer ) {
				if ( draggingLayer.trigger === 'watch_depth' ) {
					const watchDepthValue = Math.max( 1, Math.min( 100, Math.round( dragPosition ) ) );
					onLayerDrag?.( draggingLayer.id, watchDepthValue, 'watchDepth' );
					onLayerSelect( { ...draggingLayer, watchDepth: watchDepthValue } );
				} else if ( draggingLayer.trigger === 'end_of_video' ) {
					onLayerSelect( draggingLayer );
				} else {
					const newDisplayTime = Math.max( 0, Math.min( Math.round( ( dragPosition / 100 ) * max * 100 ) / 100, max ) );
					onLayerDrag?.( draggingLayer.id, newDisplayTime, 'displayTime' );
					onLayerSelect( { ...draggingLayer, displayTime: newDisplayTime } );
				}
				setDraggingLayer( null );
				setDragPosition( null );
				document.body.style.cursor = '';
			}
		};

		const handleGlobalPointerMove = ( e ) => {
			if ( draggingLayer && sliderRef.current ) {
				const rect = sliderRef.current.getBoundingClientRect();
				const offsetX = e.clientX - rect.left;
				const percentage = Math.max( 0, Math.min( ( offsetX / rect.width ) * 100, 100 ) );
				setDragPosition( percentage );
			}
		};

		document.addEventListener( 'pointerup', handleGlobalPointerUp );
		document.addEventListener( 'pointermove', handleGlobalPointerMove );

		return () => {
			document.removeEventListener( 'pointerup', handleGlobalPointerUp );
			document.removeEventListener( 'pointermove', handleGlobalPointerMove );
		};
	}, [ draggingLayer, dragPosition, max, onLayerDrag ] );

	const progress = max > 0 ? Math.max( 0, Math.min( ( sliderValue / max ) * 100, 100 ) ) : 0;

	// The add-layer affordance is active while hovering the track with no layer
	// selected and not mid-drag. Before a click it follows the cursor ("Click to
	// add layer"); a click seeks there and pins an "Add layer" chip (`addPinned`).
	const addActive = Boolean( onAddLayer ) && isHovering && ! currentLayerID && ! isDragging;

	// Build the time ruler: 4 equal major divisions (5 labels), each split by 3
	// minor dots — matching the `0:00 ··· 2:30 ··· 5:00 ··· 7:30 ··· 10:00` design.
	const ruler = [];
	if ( max > 0 ) {
		const MAJORS = 4;
		const MINORS = 3;
		for ( let i = 0; i <= MAJORS; i++ ) {
			const frac = i / MAJORS;
			let align = 'mid';
			if ( i === 0 ) {
				align = 'start';
			} else if ( i === MAJORS ) {
				align = 'end';
			}
			ruler.push( {
				type: 'major',
				frac,
				label: formatTime( frac * max ),
				align,
			} );
			if ( i < MAJORS ) {
				for ( let k = 1; k <= MINORS; k++ ) {
					ruler.push( { type: 'minor', frac: ( i + ( k / ( MINORS + 1 ) ) ) / MAJORS } );
				}
			}
		}
	}

	return (
		<div
			className={ `godam-ve-timeline ${ className || '' }`.trim() }
			onMouseEnter={ () => setIsHovering( true ) }
			onMouseLeave={ () => {
				setIsHovering( false );
				setAddPinned( false );
				handlePointerLeaveWhileDragging();
			} }
		>
			<div className="godam-ve-timeline__track-area" ref={ sliderRef } onPointerMove={ handlePointerMove }>
				<span className="godam-ve-timeline__track" />
				<span className="godam-ve-timeline__fill" style={ { width: `${ progress }%` } } />

				<input
					disabled={ disabled }
					type="range"
					min="0"
					step={ 0.01 }
					max={ max }
					className="godam-ve-timeline__range"
					value={ sliderValue }
					onPointerDown={ () => {
						setIsDragging( true );
						onInteract?.();
					} }
					onPointerUp={ () => setIsDragging( false ) }
					onMouseDown={ () => {
						setIsDragging( true );
						onInteract?.();
					} }
					onMouseUp={ () => setIsDragging( false ) }
					onTouchStart={ () => {
						setIsDragging( true );
						onInteract?.();
					} }
					onTouchEnd={ () => setIsDragging( false ) }
					onFocus={ () => onInteract?.() }
					onChange={ ( e ) => {
						if ( onChange ) {
							onChange( e.target.value );
						}
						setSliderValue( e.target.value );
						// A click/scrub on the track pins the "Add layer" chip here.
						if ( onAddLayer ) {
							setAddPinned( true );
						}
					} }
					onMouseMove={ handleHover }
					onMouseLeave={ handleLeave }
				/>

				<span className="godam-ve-timeline__playhead" style={ { left: `${ progress }%` } } />

				{
					// Time bubble on hover — suppressed while the add-layer affordance
					// is active (the "Click to add layer" chip conveys the position).
					hoverValue && hoverValue >= 0 && hoverValue <= max && ! addActive && (
						<div className="godam-ve-timeline__tooltip" style={ { left: `${ hoverValue / max * 100 }%` } }>
							{ formatTime( hoverValue ) }
						</div>
					)
				}

				{
					sortedLayers?.map( ( layer ) => {
						const isBeingDragged = draggingLayer?.id === layer.id;
						// Trigger drives the marker position: end-of-video pins to the
						// end, watch-depth to its watch %, others to displayTime.
						let layerLeft;
						if ( layer.trigger === 'end_of_video' ) {
							layerLeft = 100;
						} else if ( isBeingDragged ) {
							layerLeft = dragPosition;
						} else if ( layer.trigger === 'watch_depth' ) {
							layerLeft = Math.max( 0, Math.min( Number( layer.watchDepth ) || 0, 100 ) );
						} else {
							layerLeft = ( layer.displayTime / max ) * 100;
						}

						const layerType = layerTypes.find( ( type ) => type.type === layer.type );
						const isActive = layer.id === currentLayerID;
						const markerColor = LAYER_MARKER_COLORS[ layer.type ] || TIMELINE_ACCENT;
						// Form layers resolve to their specific plugin (icon + name) so the
						// chip shows e.g. "WPForms" with the WPForms logo on a white chip.
						const formMeta = layer.type === 'form' ? FORM_PLUGIN_META[ layer.form_type ] : null;
						// Timeline chips identify the layer by its type (e.g. "Hotspot"),
						// not its custom name — the sidebar already shows the custom name.
						const markerName = formMeta?.name || layerType?.title || layer.name || layer?.type;
						const markerTime = formatTime( isBeingDragged ? ( dragPosition / 100 ) * max : layer.displayTime );

						return (
							// eslint-disable-next-line jsx-a11y/click-events-have-key-events
							<div
								key={ layer.id }
								className={ `godam-ve-timeline__marker ${ formMeta ? 'godam-ve-timeline__marker--form' : '' } ${ isActive ? 'is-active' : '' } ${ isBeingDragged ? 'is-dragging' : '' }` }
								style={ {
									left: `${ layerLeft }%`,
									'--marker-color': markerColor,
									cursor: isBeingDragged ? 'grabbing' : 'grab',
								} }
								onPointerDown={ ( e ) => handleLayerPointerDown( e, layer ) }
								onPointerUp={ () => handleLayerPointerUp( layer ) }
								onPointerCancel={ handlePointerLeaveWhileDragging }
								role="button"
								tabIndex={ 0 }
							>
								<div className="godam-ve-timeline__chip">
									<span className="godam-ve-timeline__chip-icon">
										{ ( () => {
											if ( formMeta?.icon ) {
												return <img src={ formMeta.icon } alt={ markerName } />;
											}
											const OverrideIcon = LAYER_MARKER_ICONS[ layer.type ];
											if ( OverrideIcon ) {
												return <OverrideIcon />;
											}
											if ( layerType?.iconUrl ) {
												return <img src={ layerType.iconUrl } alt={ layerType.title } />;
											}
											return <Icon icon={ layerType?.icon } size={ 18 } />;
										} )() }
									</span>
									<span className="godam-ve-timeline__chip-label">{ markerName } · { markerTime }</span>
								</div>
								<span className="godam-ve-timeline__stem" />
							</div>
						);
					} )
				}

				{
					/* Ghost affordance: follows the cursor before a click. */
					addActive && ! addPinned && hoverValue !== null && hoverValue >= 0 && hoverValue <= max && (
						<div
							className="godam-ve-timeline__marker godam-ve-timeline__marker--add-ghost is-expanded"
							style={ { left: `${ hoverValue / max * 100 }%`, '--marker-color': TIMELINE_ACCENT } }
							aria-hidden="true"
						>
							<div className="godam-ve-timeline__chip">
								<span className="godam-ve-timeline__chip-icon"><Icon icon={ plus } size={ 18 } /></span>
								<span className="godam-ve-timeline__chip-label">{ __( 'Click to add layer', 'godam' ) }</span>
							</div>
							<span className="godam-ve-timeline__stem" />
						</div>
					)
				}

				{
					/* Pinned at the clicked time; click it to open the add-layer dialog. */
					addActive && addPinned && (
						<div
							className="godam-ve-timeline__marker godam-ve-timeline__marker--add is-expanded"
							style={ { left: `${ progress }%`, '--marker-color': TIMELINE_ACCENT } }
							onClick={ ( e ) => {
								e.stopPropagation();
								onAddLayer( sliderValue );
							} }
							onKeyDown={ ( e ) => {
								if ( e.key === 'Enter' || e.key === ' ' ) {
									e.preventDefault();
									onAddLayer( sliderValue );
								}
							} }
							role="button"
							tabIndex={ 0 }
							title={ __( 'Add layer at this time', 'godam' ) }
						>
							<div className="godam-ve-timeline__chip">
								<span className="godam-ve-timeline__chip-icon"><Icon icon={ plus } size={ 18 } /></span>
								<span className="godam-ve-timeline__chip-label">{ __( 'Add layer', 'godam' ) } · { formatTime( sliderValue ) }</span>
							</div>
							<span className="godam-ve-timeline__stem" />
						</div>
					)
				}

				{
					sortedChapters?.map( ( chapter, index ) => {
						const chapterStart = parseFloat( chapter.startTime ) || 0;
						const chapterLeft = ( chapterStart / max ) * 100;

						// Each chapter spans its own start to its own end. Older data
						// (no endTime) falls back to the next chapter's start, or the
						// video end for the last one.
						const nextChapter = sortedChapters[ index + 1 ];
						let endLabel;
						if ( chapter.endTime !== undefined && chapter.endTime !== null && chapter.endTime !== '' ) {
							const parsedEndTime = parseFloat( chapter.endTime );
							endLabel = chapter.originalEndTime || formatTimeForInput( parsedEndTime );
						} else {
							endLabel = nextChapter ? nextChapter.originalTime : formatTimeForInput( max );
						}

						return (
							<div
								key={ chapter.id }
								className="godam-ve-timeline__marker godam-ve-timeline__marker--chapter is-expanded"
								style={ { left: `${ chapterLeft }%`, '--marker-color': TIMELINE_ACCENT } }
								title={ `${ chapter?.originalTime } – ${ endLabel }` }
							>
								<div className="godam-ve-timeline__chip">
									<span className="godam-ve-timeline__chip-label">
										{ chapter?.text?.length > 18
											? `${ chapter.text.slice( 0, 18 ) }…`
											: chapter?.text }
									</span>
								</div>
								<span className="godam-ve-timeline__stem" />
							</div>
						);
					} )
				}
			</div>

			{ ruler.length > 0 && (
				<div className="godam-ve-timeline__ruler">
					{ ruler.map( ( tick, i ) => (
						tick.type === 'major'
							? (
								<span
									key={ `maj-${ i }` }
									className={ `godam-ve-timeline__tick godam-ve-timeline__tick--major is-${ tick.align }` }
									style={ { left: `${ tick.frac * 100 }%` } }
								>
									{ tick.label }
								</span>
							)
							: (
								<span
									key={ `min-${ i }` }
									className="godam-ve-timeline__tick godam-ve-timeline__tick--minor"
									style={ { left: `${ tick.frac * 100 }%` } }
								/>
							)
					) ) }
				</div>
			) }
		</div>
	);
};

/**
 * Stage timeline. Reads editor state from Redux and renders the seeker for the
 * Layers and Chapters tabs (nothing on other tabs). Seeking is delegated to the
 * player through `onSeek`.
 *
 * @param {Object}   props                    Props.
 * @param {number}   props.currentTime        Current playhead time (seconds).
 * @param {number}   props.duration           Video duration (seconds).
 * @param {Function} props.onSeek             Seek the player to a time (seconds).
 * @param {Function} props.formatTimeForInput Formats seconds for chapter labels.
 * @return {JSX.Element|null} The timeline, or null on tabs without a seeker.
 */
const Timeline = ( { currentTime, duration, onSeek, formatTimeForInput } ) => {
	const dispatch = useDispatch();
	const allLayers = useSelector( ( state ) => state.videoReducer.layers );
	const chapters = useSelector( ( state ) => state.videoReducer.chapters );
	const currentLayer = useSelector( ( state ) => state.videoReducer.currentLayer );
	const currentTab = useSelector( ( state ) => state.videoReducer.currentTab );

	if ( currentTab !== 'layers' && currentTab !== 'chapters' ) {
		return null;
	}

	// Clearing a selected layer lets the user scrub freely (shared across tabs).
	const clearSelectedLayer = () => {
		if ( currentLayer ) {
			dispatch( setCurrentLayer( null ) );
		}
	};

	if ( currentTab === 'chapters' ) {
		return (
			<Slider
				value={ currentTime }
				max={ duration }
				layers={ [] }
				chapters={ chapters }
				formatTimeForInput={ formatTimeForInput }
				onInteract={ clearSelectedLayer }
				onChange={ ( value ) => onSeek?.( value ) }
				onLayerSelect={ ( chapter ) => onSeek?.( chapter?.originalTime ) }
			/>
		);
	}

	// Exclude layers whose type isn't known (e.g. added in another branch/version)
	// so they don't appear on the seeker.
	const layers = allLayers.filter(
		( layer ) => layerTypes.some( ( lt ) => lt.type === layer.type ),
	);

	return (
		<Slider
			value={ currentTime }
			max={ duration }
			layers={ layers }
			chapters={ [] }
			disabled={ false }
			currentLayerID={ currentLayer?.id }
			formatTimeForInput={ formatTimeForInput }
			onInteract={ clearSelectedLayer }
			onChange={ ( value ) => onSeek?.( value ) }
			onLayerSelect={ ( selectedLayer ) => {
				dispatch( setCurrentLayer( selectedLayer ) );
				// Trigger drives where the preview seeks: watch-depth to its watch %,
				// end-of-video to the end, others to displayTime.
				let seekTime = selectedLayer?.displayTime;
				if ( selectedLayer?.trigger === 'watch_depth' ) {
					seekTime = ( ( Number( selectedLayer.watchDepth ) || 0 ) / 100 ) * ( duration || 0 );
				} else if ( selectedLayer?.trigger === 'end_of_video' ) {
					seekTime = duration || 0;
				}
				onSeek?.( seekTime );
			} }
			onAddLayer={ ( time ) => dispatch( setAddLayerModalTime( time ) ) }
			onLayerDrag={ ( layerId, value, field = 'displayTime' ) => dispatch( updateLayerField( { id: layerId, field, value } ) ) }
		/>
	);
};

export default Timeline;
