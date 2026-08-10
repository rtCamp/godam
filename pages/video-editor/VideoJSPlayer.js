/* global godamSettings */

/**
 * External dependencies
 */
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
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
import GoDAM from '../../assets/src/images/godam-branding.svg';
import PlayerProgressStripe from './components/player/PlayerProgressStripe';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

const DEFAULT_APPEARANCE_COLOR = '#2b333fb3';
const DEFAULT_HOVER_COLOR = '#fff';

// Big-play-button alignment classes (`video-control.scss`). All are cleared
// before the configured one is applied so a change doesn't stack.
const PLAY_BUTTON_ALIGNMENTS = [ 'left-align', 'center-align', 'right-align', 'top-align', 'bottom-align' ];

/**
 * Index of a control-bar child by name, or -1 when absent.
 *
 * @param {Object} controlBar Video.js ControlBar component.
 * @param {string} name       Child name (e.g. `playToggle`).
 * @return {number} Child index.
 */
const indexOfChild = ( controlBar, name ) => {
	const child = controlBar.getChild( name );
	return child ? controlBar.children().indexOf( child ) : -1;
};

/**
 * Add or remove the volume panel to match the saved setting.
 *
 * @param {Object}  controlBar Video.js ControlBar component.
 * @param {boolean} enabled    Whether the volume slider should show.
 */
const syncVolumePanel = ( controlBar, enabled ) => {
	const volumePanel = controlBar.getChild( 'volumePanel' );

	if ( enabled && ! volumePanel ) {
		const skipForwardIndex = indexOfChild( controlBar, 'skipForward' );
		const playToggleIndex = indexOfChild( controlBar, 'playToggle' );
		const anchor = Math.max( skipForwardIndex, playToggleIndex );
		controlBar.addChild( 'volumePanel', {}, anchor >= 0 ? anchor + 1 : undefined );
	} else if ( ! enabled && volumePanel ) {
		controlBar.removeChild( volumePanel );
		volumePanel.dispose();
	}
};

/**
 * Rebuild the skip-forward / skip-backward buttons for a skip duration.
 *
 * Video.js reads the skip amount from `playerOptions`, a snapshot taken when
 * the player was created, so changing the duration means replacing the buttons
 * with a fresh options object rather than updating them in place.
 *
 * @param {Object} controlBar Video.js ControlBar component.
 * @param {number} seconds    Skip duration; one of 5 / 10 / 30.
 */
const syncSkipButtons = ( controlBar, seconds ) => {
	[ 'skipBackward', 'skipForward' ].forEach( ( name ) => {
		const existing = controlBar.getChild( name );
		if ( existing ) {
			controlBar.removeChild( existing );
			existing.dispose();
		}
	} );

	if ( ! seconds ) {
		return;
	}

	const playerOptions = { controlBar: { skipButtons: { forward: seconds, backward: seconds } } };
	const playToggleIndex = indexOfChild( controlBar, 'playToggle' );
	const insertAt = playToggleIndex >= 0 ? playToggleIndex + 1 : 0;

	controlBar.addChild( 'skipBackward', { playerOptions }, insertAt );
	controlBar.addChild( 'skipForward', { playerOptions }, insertAt + 1 );
};

/**
 * Add, update or remove the branding logo in the control bar.
 *
 * Mirrors the front-end fallback chain: the video's own logo, then the global
 * brand image, then the GoDAM mark.
 *
 * @param {Object} controlBar Video.js ControlBar component.
 * @param {Object} settings   Saved `controlBar` settings.
 */
const syncBrandingIcon = ( controlBar, settings ) => {
	const controlBarEl = controlBar.el();
	const existing = controlBarEl.querySelector( '#branding-icon' );

	if ( ! settings.brandingIcon ) {
		existing?.remove();
		return;
	}

	let imageSrc = GoDAM;
	if ( settings.customBrandImg?.length > 0 ) {
		imageSrc = settings.customBrandImg;
	} else if ( godamSettings?.brandImage ) {
		imageSrc = godamSettings.brandImage;
	}

	if ( existing ) {
		if ( existing.getAttribute( 'src' ) !== imageSrc ) {
			existing.src = imageSrc;
		}
		return;
	}

	const img = document.createElement( 'img' );
	img.src = imageSrc;
	img.id = 'branding-icon';
	img.alt = __( 'Branding', 'godam' );
	controlBarEl.appendChild( img );
};

export const VideoJS = ( props ) => {
	const videoRef = useRef( null );
	const playerRef = useRef( null );
	const { options, onReady, onTimeupdate } = props;

	// Mirrors `playerRef` in state so the progress stripe re-renders once the
	// player exists (a ref alone wouldn't trigger that).
	const [ player, setPlayer ] = useState( null );
	// Skip duration currently built into the control bar. Starts `null` rather
	// than reading the player options: the player can be constructed on a render
	// that precedes the saved config reaching the store, so its options are not a
	// reliable record of what got built. `null` makes the first sync always apply.
	const appliedSkipSecondsRef = useRef( null );

	const videoMeta = useSelector( ( state ) => state.videoReducer );
	const videoConfig = videoMeta.videoConfig;
	const currentLayer = useSelector( ( state ) => state.videoReducer.currentLayer );
	const currentTab = useSelector( ( state ) => state.videoReducer.currentTab );

	const controlBarSettings = videoConfig.controlBar;

	// The Settings tab previews the front-end player, so it shows the real
	// Video.js control bar; every other tab keeps the preview clean and relies
	// on the reel progress stripe. A selected layer covers the video, so
	// neither control shows while one is open.
	const showFrontendControls = currentTab === 'player-settings' && ! currentLayer;

	useEffect( () => {
		// Make sure Video.js player is only initialized once
		if ( ! playerRef.current ) {
			// The Video.js player needs to be _inside_ the component el for React 18 Strict Mode.
			const videoElement = document.createElement( 'video-js' );

			videoElement.classList.add( 'vjs-big-play-centered' );
			videoRef.current.appendChild( videoElement );

			const newPlayer = ( playerRef.current = videojs( videoElement, options, () => {
				videojs.log( 'player is ready' );
				if ( onReady ) {
					onReady( newPlayer );
				}
			} ) );

			setPlayer( newPlayer );

			// Add a 'timeupdate' event listener
			if ( onTimeupdate ) {
				newPlayer.on( 'timeupdate', () => {
					onTimeupdate( newPlayer, newPlayer.currentTime() );
				} );
			}
		}
	}, [ videoRef, videoConfig ] );

	// Keep the control bar in step with the saved player settings so the
	// Settings tab preview always reflects what the front end will render.
	useEffect( () => {
		const currentPlayer = playerRef.current;
		if ( ! currentPlayer || currentPlayer.isDisposed() ) {
			return;
		}

		const controlBar = currentPlayer.controlBar;
		if ( ! controlBar ) {
			return;
		}

		syncVolumePanel( controlBar, Boolean( controlBarSettings.volumePanel ) );
		syncBrandingIcon( controlBar, controlBarSettings );

		// Rebuilding the skip buttons throws away live components, so only do it
		// when the duration actually changed (not on every colour tweak).
		const skipSeconds = Number( controlBarSettings.skipButtons?.forward ) || 0;
		if ( appliedSkipSecondsRef.current !== skipSeconds ) {
			appliedSkipSecondsRef.current = skipSeconds;
			syncSkipButtons( controlBar, skipSeconds );
		}

		// Play-button placement.
		const bigPlayButton = currentPlayer.getChild( 'bigPlayButton' );
		if ( bigPlayButton ) {
			bigPlayButton.removeClass( ...PLAY_BUTTON_ALIGNMENTS );
			const position = controlBarSettings.playButtonPosition;
			if ( position && PLAY_BUTTON_ALIGNMENTS.includes( `${ position }-align` ) ) {
				bigPlayButton.addClass( `${ position }-align` );
			}
		}

		// Vertical control bar (legacy option, not exposed in the Settings tab).
		if ( 'vertical' === controlBarSettings.controlBarPosition ) {
			controlBar.addClass( 'vjs-control-bar-vertical' );
			for ( const control of controlBar.el().querySelectorAll( '.vjs-control' ) ) {
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
	}, [ controlBarSettings ] );

	// Custom play-button image (legacy option, not exposed in the Settings tab).
	// It replaces the button element outright, so it only ever runs once.
	useEffect( () => {
		const currentPlayer = playerRef.current;
		const customPlayBtnImg = controlBarSettings.customPlayBtnImg;
		if ( ! currentPlayer || ! customPlayBtnImg ) {
			return;
		}

		const playButtonElement = currentPlayer.el().querySelector( '.vjs-big-play-button' );
		if ( ! playButtonElement || playButtonElement.classList.contains( 'custom-play-image' ) ) {
			return;
		}

		const imgElement = document.createElement( 'img' );
		imgElement.src = customPlayBtnImg;
		imgElement.alt = __( 'Custom Play Button', 'godam' );
		imgElement.style.cursor = 'pointer';
		playButtonElement.classList.forEach( ( cls ) => imgElement.classList.add( cls ) );
		imgElement.classList.add( 'custom-play-image' );
		imgElement.addEventListener( 'click', ( event ) => {
			event.preventDefault();
			currentPlayer.play();
		} );

		playButtonElement.parentNode.replaceChild( imgElement, playButtonElement );
	}, [ controlBarSettings.customPlayBtnImg ] );

	useEffect( () => {
		if ( ! playerRef.current ) {
			return;
		}

		try {
			const currentPlayer = playerRef.current;
			// player.sources( options.sources );
			if ( options.aspectRatio ) {
				currentPlayer.aspectRatio( options.aspectRatio );
			}
			currentPlayer.poster( options.poster );
			currentPlayer.autoplay( options.autoplay );
			currentPlayer.muted( options.muted );
			currentPlayer.loop( options.loop );
			currentPlayer.controls( options.controls );
			currentPlayer.preload( options.preload );
		} catch {
			// Ignoring - "No compatible source was found for this media" error will be shown on the video element.
		}
	}, [ options ] );

	useEffect( () => {
		if ( playerRef.current ) {
			const currentPlayer = playerRef.current;

			if ( currentLayer ) {
				currentPlayer.pause();
			}

			if ( currentLayer?.adTagUrl ) {
				const imaOptions = {
					adTagUrl: currentLayer?.adTagUrl,
					debug: true,
				};

				currentPlayer.ima( imaOptions );

				currentPlayer.pause();
			}
		}
	}, [ currentLayer ] );

	// Dispose the Video.js player when the functional component unmounts
	useEffect( () => {
		const currentPlayer = playerRef.current;

		return () => {
			if ( currentPlayer && ! currentPlayer.isDisposed() ) {
				currentPlayer.dispose();
				playerRef.current = null;
				setPlayer( null );
			}
		};
	}, [ playerRef ] );

	return (
		<div
			style={ {
				'--is-controls-visible': showFrontendControls ? 'flex' : 'none',
				// The front-end stylesheet (loaded by `App.js`) styles the control
				// bar from these, so the preview matches the block output.
				'--rtgodam-control-bar-color': controlBarSettings.appearanceColor || DEFAULT_APPEARANCE_COLOR,
				'--rtgodam-control-hover-color': controlBarSettings.hoverColor || DEFAULT_HOVER_COLOR,
				'--rtgodam-control-hover-zoom': String( 1 + ( parseFloat( controlBarSettings.zoomLevel ) || 0 ) ),
			} }
		>
			<div
				id="easydam-video-player"
				// `is-captions-visible` drives the captions button's visibility in
				// CSS. Video.js re-hides that button whenever the text tracks
				// change, so a class it can't touch is steadier than toggling
				// `vjs-hidden` from here.
				className={ `relative rounded-lg overflow-hidden ${ controlBarSettings.subsCapsButton ? 'is-captions-visible' : '' }`.trim() }
				data-vjs-player
			>
				<div ref={ videoRef } />
				<PlayerProgressStripe
					player={ player }
					isVisible={ ! showFrontendControls && ! currentLayer }
				/>
				<div id="easydam-layer-placeholder" />
			</div>
		</div>
	);
};

export default VideoJS;
