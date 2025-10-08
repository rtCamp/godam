/* global godamSettings */

/**
 * External dependencies
 */
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import 'video.js/dist/video-js.css';
import 'videojs-contrib-ads/dist/videojs.ads.css';
import 'videojs-ima/dist/videojs.ima.css';
import videojs from 'video.js';
import 'videojs-contrib-ads';
import 'videojs-ima';
import 'videojs-flvjs-es6';

/**
 * Internal dependencies
 */
import GoDAM from '../../assets/src/images/GoDAM.png';
import { setCurrentLayer } from './redux/slice/videoSlice';

/**
 * WordPress dependencies
 */
import { customLink, customPostType, preformatted, video, thumbsUp } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';

const layerTypes = [
	{
		title: __( 'Gravity Forms', 'godam' ),
		icon: preformatted,
		type: 'form',
	},
	{
		title: __( 'CTA', 'godam' ),
		icon: customLink,
		type: 'cta',
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

export const VideoJS = ( props ) => {
	const videoRef = useRef( null );
	const playerRef = useRef( null );
	const { options, onReady, onTimeupdate, playbackTime, formatTimeForInput } =
    props;

	const [ duration, setDuration ] = useState( 0 );
	const [ sliderValue, setSliderValue ] = useState( 0 );
	const [ displayVideoControls, setDisplayVideoControls ] = useState( true );

	const dispatch = useDispatch();

	const videoMeta = useSelector( ( state ) => state.videoReducer );
	const videoConfig = videoMeta.videoConfig;
	const layers = videoMeta.layers;
	const chapters = videoMeta.chapters;
	const currentLayer = useSelector( ( state ) => state.videoReducer.currentLayer );
	const currentTab = useSelector( ( state ) => state.videoReducer.currentTab );

	const setCurrentTime = ( timeInSeconds ) => {
		setSliderValue( timeInSeconds );
	};

	useEffect( () => {
		// Make sure Video.js player is only initialized once
		if ( ! playerRef.current ) {
			// The Video.js player needs to be _inside_ the component el for React 18 Strict Mode.
			const videoElement = document.createElement( 'video-js' );

			videoElement.classList.add( 'vjs-big-play-centered' );
			videoRef.current.appendChild( videoElement );

			const player = ( playerRef.current = videojs( videoElement, options, () => {
				videojs.log( 'player is ready' );
				if ( onReady ) {
					onReady( player );
				}
			} ) );

			// Add a 'timeupdate' event listener
			if ( onTimeupdate ) {
				player.on( 'timeupdate', () => {
					const currentTime = player.currentTime();
					onTimeupdate( player, currentTime );
					setCurrentTime( currentTime );
					setSliderValue( currentTime );
				} );
			}

			player.on( 'loadedmetadata', () => {
				setDuration( player.duration() );
			} );
		} else {
			//handle skip timer control
			const skipTime = videoConfig.controlBar.skipButtons.forward;
			const player = playerRef.current;
			const skipBackwardButton = player.controlBar.getChild( 'skipBackward' );
			const skipForwardButton = player.controlBar.getChild( 'skipForward' );
			if ( skipForwardButton ) {
				skipForwardButton.off( 'click' ); // Remove default click behavior
				skipForwardButton.on( 'click', () => {
					const newTime = Math.min(
						player.currentTime() + skipTime,
						player.duration(),
					);
					player.currentTime( newTime );
				} );
			}

			// Override default skip backward button
			if ( skipBackwardButton ) {
				skipBackwardButton.off( 'click' ); // Remove default click behavior
				skipBackwardButton.on( 'click', () => {
					const newTime = Math.max( player.currentTime() - skipTime, 0 );
					player.currentTime( newTime );
				} );
			}
		}
	}, [ videoRef, videoConfig ] );

	useEffect( () => {
		const captionsButton = document.querySelector( '.vjs-subs-caps-button' );
		const volumeSlider = document.querySelector( '.vjs-volume-panel' );
		const brandingLogo = document.querySelector( '#branding-icon' );

		if ( ! videoConfig.controlBar.volumePanel ) {
			volumeSlider.classList.add( 'hide' );
		}

		if ( videoConfig.controlBar.subsCapsButton ) {
			captionsButton.classList.remove( 'vjs-hidden' );
			captionsButton.classList.add( 'show' );
		}

		if ( videoConfig.controlBar.brandingIcon ) {
			const img = document.createElement( 'img' );

			if ( ! brandingLogo ) {
				let imageSrc = '';

				if ( videoConfig.controlBar.customBrandImg.length > 0 ) {
					imageSrc = videoConfig.controlBar.customBrandImg;
				} else if ( godamSettings?.brandImage ) {
					imageSrc = godamSettings?.brandImage;
				} else {
					imageSrc = GoDAM;
				}

				img.src = imageSrc;
				img.id = 'branding-icon';
				img.alt = 'Branding';

				document.querySelector( '.vjs-control-bar' ).appendChild( img );
			}
		}

		//change appearance color
		const controlBar = document.querySelector( '.vjs-control-bar' );
		const bigPlayButton = document.querySelector( '.vjs-big-play-button' );
		controlBar.style.setProperty(
			'background-color',
			videoConfig.controlBar.appearanceColor,
			'important',
		);
		bigPlayButton.style.setProperty(
			'background-color',
			videoConfig.controlBar.appearanceColor,
			'important',
		);

		//change hover color and zoom level
		const controls = controlBar.querySelectorAll( '.vjs-control' );
		controls.forEach( ( control ) => {
			// On hover
			control.addEventListener( 'mouseenter', function() {
				control.style.setProperty(
					'color',
					videoConfig.controlBar.hoverColor,
					'important',
				);

				if ( ! control.className.includes( 'vjs-progress-control' ) ) {
					this.style.transform = `scale(${ 1 + parseFloat( videoConfig.controlBar.zoomLevel ) })`;
				}
			} );

			control.addEventListener( 'mouseleave', function() {
				control.style.color = '#fff'; // Reset to default
				this.style.transform = 'scale(1)';
			} );
		} );

		document
			.querySelector( '.vjs-slider-bar' )
			.addEventListener( 'mouseenter', function() {
				this.style.backgroundColor = videoConfig.controlBar.hoverColor;
			} );

		document
			.querySelector( '.vjs-control-bar' )
			.addEventListener( 'mouseleave', function() {
				document.querySelector( '.vjs-slider-bar' ).style.backgroundColor =
		'#fff'; // Reset to default
			} );

		//play button position
		const playButton = document.querySelector( '.vjs-big-play-button' );

		playButton.classList.add(
			`${ videoConfig.controlBar.playButtonPosition }-align`,
		);

		//skip buttons
		const skipBackwardButton = document.querySelector(
			'[class^="vjs-skip-backward-"]',
		);
		const skipForwardButton = document.querySelector(
			'[class^="vjs-skip-forward-"]',
		);

		const backwardClasses = Array.from( skipBackwardButton.classList );
		const existingBackwardClass = backwardClasses.find( ( cls ) =>
			cls.startsWith( 'vjs-skip-backward-' ),
		);

		if ( existingBackwardClass ) {
			skipBackwardButton.classList.replace(
				existingBackwardClass,
				`vjs-skip-backward-${ videoConfig.controlBar.skipButtons.forward }`,
			);
		}

		const forwardClasses = Array.from( skipForwardButton.classList );
		const existingForwardClass = forwardClasses.find( ( cls ) =>
			cls.startsWith( 'vjs-skip-forward-' ),
		);

		if ( existingForwardClass ) {
			skipForwardButton.classList.replace(
				existingForwardClass,
				`vjs-skip-forward-${ videoConfig.controlBar.skipButtons.forward }`,
			);
		}

		//control bar position
		if ( 'vertical' === videoConfig.controlBar.controlBarPosition ) {
			controlBar.classList.add( 'vjs-control-bar-vertical' );
			for ( const control of controls ) {
				control.classList.add( 'vjs-control-vertical' );
				if ( control.classList.contains( 'vjs-volume-panel' ) ) {
					control.classList.add( 'vjs-volume-panel-vertical' );
					control.classList.remove( 'vjs-volume-panel-horizontal' );
				}

				if ( control.classList.contains( 'vjs-volume-horizontal' ) ) {
					control.classList.add( 'vjs-volume-vertical' );
				}
			}
		}

		const customPlayBtnImg = videoConfig.controlBar.customPlayBtnImg;
		const playButtonElement = document.querySelector( '.vjs-big-play-button' );

		if ( customPlayBtnImg ) {
			// Create new image element
			const imgElement = document.createElement( 'img' );
			imgElement.src = customPlayBtnImg;
			imgElement.alt = __( 'Custom Play Button', 'godam' );
			imgElement.className = 'vjs-big-play-button custom-play-image';

			playButtonElement.classList.forEach( ( cls ) => {
				imgElement.classList.add( cls );
			} );

			imgElement.classList.add( 'custom-play-image' );

			imgElement.style.cursor = 'pointer';

			// Replace the original button with the new image
			playButtonElement.parentNode.replaceChild( imgElement, playButtonElement );
		}

		if ( playerRef.current ) {
			const player = playerRef.current;
			const customPlayBtn = document.querySelector( '.vjs-big-play-button' );
			if ( customPlayBtn ) {
				customPlayBtn.addEventListener( 'click', function( e ) {
					e.preventDefault();
					player.play();
				} );
			}
		}
	}, [ videoConfig ] );

	useEffect( () => {
		if ( playerRef.current ) {
			const player = playerRef.current;

			// Remove the old event listener on 'timeupdate' event.
			player.off( 'timeupdate' );

			// Add a new 'timeupdate' event listener
			if ( onTimeupdate ) {
				player.on( 'timeupdate', () => {
					const currentTime = player.currentTime();
					onTimeupdate( player, currentTime );
					setSliderValue( currentTime );
				} );
			}
		}
	}, [ layers, chapters ] );

	useEffect( () => {
		if ( ! playerRef.current ) {
			return;
		}

		try {
			const player = playerRef.current;
			// player.sources( options.sources );
			player.poster( options.poster );
			player.autoplay( options.autoplay );
			player.muted( options.muted );
			player.loop( options.loop );
			player.controls( options.controls );
			player.preload( options.preload );

			const volumePanel = player.controlBar.getChild( 'volumePanel' );
			if ( options.controlBar.playToggle && ! volumePanel ) {
				player.controlBar.addChild( 'volumePanel' );
			} else if ( ! options.controlBar.playToggle && volumePanel ) {
				player.controlBar.removeChild( 'volumePanel' );
			}
		} catch {
			// Ignoring - "No compatible source was found for this media" error will be shown on the video element.
		}
	}, [ options ] );

	useEffect( () => {
		if ( playerRef.current ) {
			const player = playerRef.current;

			if ( currentLayer ) {
				setDisplayVideoControls( false );
				player.pause();
			} else {
				setDisplayVideoControls( true );
			}

			if ( currentLayer?.adTagUrl ) {
				const imaOptions = {
					adTagUrl: currentLayer?.adTagUrl,
					debug: true,
				};

				player.ima( imaOptions );

				player.pause();
			}
		}
	}, [ currentLayer ] );

	// Dispose the Video.js player when the functional component unmounts
	useEffect( () => {
		const player = playerRef.current;

		return () => {
			if ( player && ! player.isDisposed() ) {
				player.dispose();
				playerRef.current = null;
			}
		};
	}, [ playerRef ] );

	return (
		<>
			<div
				style={ {
					'--is-controls-visible': displayVideoControls ? '' : 'none',
				} }
			>
				<div id="godam-video-player" className="relative rounded-lg overflow-hidden" data-vjs-player>
					<div ref={ videoRef } />
					<div id="godam-layer-placeholder" />
				</div>
			</div>

			<div className="mt-2">Time: { playbackTime }</div>

			{
				currentTab === 'layers' && (
					<Slider
						className="mt-12 mb-6"
						value={ sliderValue }
						onChange={ ( value ) => {
							setSliderValue( value );
							if ( playerRef.current ) {
								playerRef.current.currentTime( value );
							}
						} }
						max={ duration }
						layers={ layers }
						onLayerSelect={ ( layer ) => {
							dispatch( setCurrentLayer( layer ) );
							playerRef.current.currentTime( layer.displayTime );
						} }
						disabled={ currentLayer }
						currentLayerID={ currentLayer?.id }
						chapters={ [] }
						formatTimeForInput={ formatTimeForInput }
					/>
				)
			}

			{
				currentTab === 'chapters' && (
					<Slider
						className="mt-12 mb-6"
						value={ sliderValue }
						onChange={ ( value ) => {
							setSliderValue( value );
							if ( playerRef.current ) {
								playerRef.current.currentTime( value );
							}
						} }
						max={ duration }
						chapters={ chapters }
						onLayerSelect={ ( chapter ) => {
							playerRef.current.currentTime( chapter?.originalTime );
						} }
						layers={ [] }
						formatTimeForInput={ formatTimeForInput }
					/>
				)
			}
		</>
	);
};

const Slider = ( props ) => {
	const { max, value, onChange, className, layers, onLayerSelect, disabled, currentLayerID, chapters, formatTimeForInput } = props;

	const [ sliderValue, setSliderValue ] = useState( value );
	const [ hoverValue, setHoverValue ] = useState( null ); // Hover value

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

	return (
		<div className={ `slider ${ className }` }>
			<input
				style={ {
					'--progress-value': `${ sliderValue / max * 100 }%`,
				} }
				disabled={ disabled }
				type="range"
				min="0"
				step={ 0.01 }
				max={ max }
				className="slider-input"
				value={ sliderValue }
				onChange={ ( e ) => {
					if ( onChange ) {
						onChange( e.target.value );
					}
					setSliderValue( e.target.value );
				} }
				onMouseMove={ handleHover }
				onMouseLeave={ handleLeave }
			/>
			<span
				className="slider-progress"
				style={ {
					width: `${ sliderValue / max * 100 }%`,
				} }
			>
			</span>
			{
				hoverValue && hoverValue >= 0 && hoverValue <= max && (
					<div className="tooltip" style={ { left: `${ hoverValue / max * 100 }%` } }>
						{ formatTime( hoverValue ) }
					</div>
				)
			}
			{
				sortedLayers?.map( ( layer ) => {
					const layerLeft = layer.displayTime / max * 100;

					return (
						// eslint-disable-next-line jsx-a11y/click-events-have-key-events
						<div
							key={ layer.id }
							className={ `layer-indicator ${ layer.type === 'hotspot' ? 'hotspot-indicator' : '' }` }
							style={ {
								left: `${ layerLeft }%`,
								'--hover-width': layer?.duration ? `${ Math.min( ( layer.duration / max ) * 100, 100 - layerLeft ) }%` : '8px',
							} }
							onClick={ () => onLayerSelect( layer ) }
							role="button"
							tabIndex={ 0 }
						>
							<div className="layer-indicator--container">
								<div className={ `icon ${ layer.id === currentLayerID ? 'active' : '' }` }>
									<Icon icon={ layerTypes.find( ( type ) => type.type === layer.type )?.icon } />
									<div>
										{ layer?.type?.toUpperCase() }
										{
											layer?.duration && (
												<div className="duration">
													for { layer.duration }s
												</div>
											)
										}
									</div>
								</div>
								<div className="info">{ formatTime( layer.displayTime ) }</div>
							</div>
						</div>
					);
				} )
			}
			{
				sortedChapters?.map( ( chapter, index ) => {
					const chapterLeft = ( chapter.startTime / max ) * 100;

					// Calculate difference to next chapter
					const nextChapter = sortedChapters[ index + 1 ];
					const nextStart = nextChapter ? nextChapter.startTime : max; // fallback to end
					const hoverWidth = ( ( nextStart - chapter.startTime ) / max ) * 100;

					return (
						<div
							key={ chapter.id }
							className="layer-indicator hotspot-indicator chapter-indicator"
							style={ {
								left: `${ chapterLeft }%`,
								'--hover-width': `${ hoverWidth }%`,
							} }
						>
							<div className="chapter-indicator--duration">
								{ `${ chapter?.originalTime } - ${ nextChapter ? nextChapter?.originalTime : formatTimeForInput( max ) }` }
							</div>
							<div
								className="chapter-indicator--text"
								style={ {
									'--hover-width': `${ hoverWidth }%`,
								} }
							>
								{ chapter?.text?.length > 13
									? `${ chapter.text.slice( 0, 13 ) }...`
									: chapter?.text }
							</div>
						</div>
					);
				} )
			}

		</div>
	);
};

export default VideoJS;
