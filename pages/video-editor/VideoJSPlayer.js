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

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

export const VideoJS = ( props ) => {
	const videoRef = useRef( null );
	const playerRef = useRef( null );
	const { options, onReady, onTimeupdate } = props;

	const [ displayVideoControls, setDisplayVideoControls ] = useState( true );

	const videoMeta = useSelector( ( state ) => state.videoReducer );
	const videoConfig = videoMeta.videoConfig;
	const currentLayer = useSelector( ( state ) => state.videoReducer.currentLayer );

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
					onTimeupdate( player, player.currentTime() );
				} );
			}
		}
	}, [ videoRef, videoConfig ] );

	useEffect( () => {
		const captionsButton = document.querySelector( '.vjs-subs-caps-button' );
		const volumeSlider = document.querySelector( '.vjs-volume-panel' );
		const brandingLogo = document.querySelector( '#branding-icon' );

		if ( volumeSlider && ! videoConfig.controlBar.volumePanel ) {
			volumeSlider.classList.add( 'hide' );
		}

		if ( captionsButton && videoConfig.controlBar.subsCapsButton ) {
			captionsButton.classList.remove( 'vjs-hidden' );
			captionsButton.classList.add( 'show' );
		}

		if ( videoConfig.controlBar.brandingIcon ) {
			const img = document.createElement( 'img' );

			if ( ! brandingLogo ) {
				let imageSrc = '';

				if ( videoConfig.controlBar.customBrandImg && videoConfig.controlBar.customBrandImg.length > 0 ) {
					imageSrc = videoConfig.controlBar.customBrandImg;
				} else if ( godamSettings?.brandImage ) {
					imageSrc = godamSettings?.brandImage;
				} else {
					imageSrc = GoDAM;
				}

				img.src = imageSrc;
				img.id = 'branding-icon';
				img.alt = 'Branding';

				const controlBarElement = document.querySelector( '.vjs-control-bar' );
				if ( controlBarElement ) {
					controlBarElement.appendChild( img );
				}
			}
		}

		//change appearance color
		const controlBar = document.querySelector( '.vjs-control-bar' );
		const bigPlayButton = document.querySelector( '.vjs-big-play-button' );

		if ( controlBar ) {
			controlBar.style.setProperty(
				'background-color',
				videoConfig.controlBar.appearanceColor || '#2b333fb3',
				'important',
			);
		}

		if ( bigPlayButton ) {
			bigPlayButton.style.setProperty(
				'background-color',
				videoConfig.controlBar.appearanceColor || '#2b333fb3',
				'important',
			);
		}

		//change hover color and zoom level
		if ( controlBar ) {
			const controls = controlBar.querySelectorAll( '.vjs-control' );
			controls.forEach( ( control ) => {
				// On hover
				control.addEventListener( 'mouseenter', function() {
					control.style.setProperty(
						'color',
						videoConfig.controlBar.hoverColor || '#fff',
						'important',
					);

					if ( ! control.className.includes( 'vjs-progress-control' ) ) {
						this.style.transform = `scale(${ 1 + parseFloat( videoConfig.controlBar.zoomLevel || 0 ) })`;
					}
				} );

				control.addEventListener( 'mouseleave', function() {
					control.style.color = '#fff'; // Reset to default
					this.style.transform = 'scale(1)';
				} );
			} );
		}

		const sliderBar = document.querySelector( '.vjs-slider-bar' );
		if ( sliderBar ) {
			sliderBar.addEventListener( 'mouseenter', function() {
				this.style.backgroundColor = videoConfig.controlBar.hoverColor || '#fff';
			} );
		}

		const controlBarForMouseLeave = document.querySelector( '.vjs-control-bar' );
		if ( controlBarForMouseLeave ) {
			controlBarForMouseLeave.addEventListener( 'mouseleave', function() {
				const innerSliderBar = document.querySelector( '.vjs-slider-bar' );
				if ( innerSliderBar ) {
					innerSliderBar.style.backgroundColor = '#fff'; // Reset to default
				}
			} );
		}

		//play button position
		const playButton = document.querySelector( '.vjs-big-play-button' );

		if ( playButton && videoConfig.controlBar.playButtonPosition ) {
			playButton.classList.add(
				`${ videoConfig.controlBar.playButtonPosition }-align`,
			);
		}

		//control bar position
		if ( controlBar && 'vertical' === videoConfig.controlBar.controlBarPosition ) {
			controlBar.classList.add( 'vjs-control-bar-vertical' );
			const controls = controlBar.querySelectorAll( '.vjs-control' );
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

		if ( customPlayBtnImg && playButtonElement ) {
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
			if ( playButtonElement.parentNode ) {
				playButtonElement.parentNode.replaceChild( imgElement, playButtonElement );
			}
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
		if ( ! playerRef.current ) {
			return;
		}

		try {
			const player = playerRef.current;
			// player.sources( options.sources );
			if ( options.aspectRatio ) {
				player.aspectRatio( options.aspectRatio );
			}
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
		<div
			style={ {
				'--is-controls-visible': displayVideoControls ? '' : 'none',
			} }
		>
			<div id="easydam-video-player" className="relative rounded-lg overflow-hidden" data-vjs-player>
				<div ref={ videoRef } />
				<div id="easydam-layer-placeholder" />
			</div>
		</div>
	);
};

export default VideoJS;
