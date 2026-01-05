/**
 * External dependencies
 */
import videojs from 'video.js';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import GoDAM from '../../../../../assets/src/images/GoDAM.png';
import SettingsButton from '../masterSettings.js';
import { PLAYER_SKINS } from '../utils/constants.js';
import MenuButtonHoverManager from './menuButtonHover.js';

/**
 * Controls Manager
 * Handles video controls, UI elements, and player customization
 */
export default class ControlsManager {
	constructor( player, video, config ) {
		this.player = player;
		this.video = video;
		this.config = config;
	}

	/**
	 * Setup player configuration
	 */
	setupPlayerConfiguration() {
		this.setupControlBarConfiguration();
		this.setupCustomButtons();
		new MenuButtonHoverManager( this.player );
	}

	/**
	 * Setup control bar configuration
	 */
	setupControlBarConfiguration() {
		const controlBarSettings = this.config.videoSetupControls?.controlBar;

		this.setupPlayButtonPosition( controlBarSettings );
		this.setupControlBarComponents( controlBarSettings );
		this.setupCustomPlayButton( controlBarSettings );

		this.setupCustomFullscreenButton();
	}

	/**
	 * Setup play button position
	 *
	 * @param {Object} controlBarSettings - Control bar settings object
	 */
	setupPlayButtonPosition( controlBarSettings ) {
		const playButton = this.player.getChild( 'bigPlayButton' );
		const alignments = [
			'left-align',
			'center-align',
			'right-align',
			'top-align',
			'bottom-align',
		];

		playButton.removeClass( ...alignments );

		const position = controlBarSettings?.playButtonPosition;
		if ( position && alignments.includes( `${ position }-align` ) ) {
			playButton.addClass( `${ position }-align` );
		}
	}

	/**
	 * Create a custom fullscreen button
	 *
	 * @return {Object} - The custom fullscreen button instance
	 */
	createCustomFullscreenButton() {
		class CustomFullscreenButton extends videojs.getComponent( 'Button' ) {
			constructor( player, options ) {
				super( player, options );
				this.controlText( __( 'Custom Fullscreen', 'godam' ) );
			}

			createEl() {
				const el = super.createEl();
				el.classList.add( 'vjs-fullscreen-control', 'vjs-control', 'vjs-button', 'godam-fullscreen-button' );

				return el;
			}

			handleClick( e ) {
				const videoContainer = e.target.closest( '.video-js' );
				const godamVideoContainer = e.target.closest( '.easydam-video-container' );

				// Determine current fullscreen state by checking for fullscreen classes
				const isFullscreen = ( videoContainer && videoContainer.classList.contains( 'vjs-fullscreen' ) );

				if ( isFullscreen ) {
					// EXIT FULLSCREEN MODE

					// Remove fullscreen CSS classes from video containers
					if ( videoContainer ) {
						videoContainer.classList.remove( 'vjs-fullscreen' );
					}
					if ( godamVideoContainer ) {
						godamVideoContainer.classList.remove( 'godam-video-fullscreen' );
					}

					// RESTORE BACKGROUND SCROLLING (iOS-compatible method)
					// Step 1: Get the saved scroll position from body's top style
					const scrollY = document.body.style.top;
					// Step 2: Reset all scroll-prevention styles
					document.body.style.overflow = '';
					document.body.style.position = '';
					document.body.style.top = '';
					document.body.style.width = '';
					document.documentElement.style.overflow = '';
					// Step 3: Restore the original scroll position (multiply by -1 because it was stored as negative)
					if ( scrollY ) {
						window.scrollTo( 0, parseInt( scrollY || '0' ) * -1 );
					}
				} else {
					// ENTER FULLSCREEN MODE

					// Add fullscreen CSS classes to video containers
					if ( videoContainer ) {
						videoContainer.classList.add( 'vjs-fullscreen' );
					}
					if ( godamVideoContainer ) {
						godamVideoContainer.classList.add( 'godam-video-fullscreen' );
					}

					// PREVENT BACKGROUND SCROLLING (robust iOS method)
					// iOS Safari doesn't respect overflow: hidden alone, so we use position: fixed
					// Step 1: Save current scroll position
					const scrollY = window.scrollY;
					// Step 2: Prevent scrolling by fixing body position and offsetting it
					document.body.style.overflow = 'hidden';
					document.documentElement.style.overflow = 'hidden';
					document.body.style.position = 'fixed';
					document.body.style.top = `-${ scrollY }px`; // Negative offset to keep content in place
					document.body.style.width = '100%'; // Prevent horizontal scrollbar
				}

				// Notify other components about fullscreen state change
				this.player().trigger( 'customfullscreenchange' );
			}
		}
		if ( ! videojs.getComponent( 'CustomFullscreenButton' ) ) {
			videojs.registerComponent( 'CustomFullscreenButton', CustomFullscreenButton );
		}
		return new CustomFullscreenButton( this.player );
	}

	/**
	 * Exit fullscreen button
	 */
	createCustomFullscreenExitButton() {
		class CustomFullscreenExitButton extends videojs.getComponent( 'Button' ) {
			constructor( player, options ) {
				super( player, options );
				this.controlText( __( 'Exit Fullscreen', 'godam' ) );
			}

			createEl() {
				const el = super.createEl();
				el.classList.add( 'vjs-custom-fullscreen-exit-control', 'vjs-control', 'vjs-button' );

				return el;
			}

			handleClick( e ) {
				// Find the video containers that need fullscreen styling removed
				const videoContainer = e.target.closest( '.video-js' );
				const godamVideoContainer = e.target.closest( '.easydam-video-container' );

				// EXIT FULLSCREEN MODE (always exit when this button is clicked)

				// Remove fullscreen CSS classes from video containers
				if ( videoContainer ) {
					videoContainer.classList.remove( 'vjs-fullscreen' );
				}
				if ( godamVideoContainer ) {
					godamVideoContainer.classList.remove( 'godam-video-fullscreen' );
				}

				// RESTORE BACKGROUND SCROLLING (iOS-compatible method)
				// Step 1: Get the saved scroll position from body's top style
				const scrollY = document.body.style.top;
				// Step 2: Reset all scroll-prevention styles
				document.body.style.overflow = '';
				document.body.style.position = '';
				document.body.style.top = '';
				document.body.style.width = '';
				document.documentElement.style.overflow = '';
				// Step 3: Restore the original scroll position (multiply by -1 because it was stored as negative)
				if ( scrollY ) {
					window.scrollTo( 0, parseInt( scrollY || '0' ) * -1 );
				}

				// Notify other components about fullscreen state change
				this.player().trigger( 'customfullscreenchange' );
			}
		}
		if ( ! videojs.getComponent( 'CustomFullscreenExitButton' ) ) {
			videojs.registerComponent( 'CustomFullscreenExitButton', CustomFullscreenExitButton );
		}
		return new CustomFullscreenExitButton( this.player );
	}

	/**
	 * Check if the device is iOS
	 *
	 * @return {boolean} - True if iOS device, false otherwise
	 */
	checkIOSDevice() {
		const userAgent = window.navigator.userAgent.toLowerCase();
		return /iphone|ipad|ipod/.test( userAgent );
	}

	/**
	 * Setup custom fullscreen button
	 * This is for iOS devices that does not support videojs on fullscreen mode
	 */
	setupCustomFullscreenButton() {
		// Add custom fullscreen button to control bar
		const controlBar = this.player.controlBar;
		const controlBarEl = controlBar.el();
		const _fullscreenButton = controlBarEl.querySelector( '.vjs-fullscreen-control.vjs-control.vjs-button' );
		if ( _fullscreenButton && this.checkIOSDevice() ) { // Also check if is iOS device.
			// Replace fullscreen button with custom implementation
			const customFullscreenButton = this.createCustomFullscreenButton();
			_fullscreenButton.parentNode.replaceChild( customFullscreenButton.el(), _fullscreenButton );
			// Add exit button
			const customFullscreenExitButton = this.createCustomFullscreenExitButton();
			controlBar.addChild( customFullscreenExitButton );
			// Setup dynamic viewport height for iOS to avoid bottom bar overlap
			this.setupIOSViewportHeight();
		}
	}

	/**
	 * Setup iOS dynamic viewport height variable (--vh)
	 * Ensures fullscreen container height matches the visible viewport
	 */
	/**
	 * Setup dynamic viewport height tracking for iOS devices
	 *
	 * PROBLEM: On iOS Safari, the viewport height changes dynamically when:
	 * - Address bar collapses/expands during scrolling
	 * - On-screen keyboard appears/disappears
	 * - Device rotates between portrait/landscape
	 *
	 * SOLUTION: Use the visualViewport API (iOS 13+) which provides accurate
	 * viewport dimensions that account for dynamic UI elements. This ensures
	 * fullscreen containers always fill the available screen space.
	 */
	setupIOSViewportHeight() {
		/**
		 * Calculate and update the CSS custom property --vh with current viewport height
		 *
		 * This function is called whenever the viewport size changes to ensure
		 * the fullscreen player container always matches the visible viewport.
		 */
		const setViewportHeight = () => {
			// Get accurate viewport height accounting for dynamic UI elements
			let vh;

			// PREFERRED: Use visualViewport API (iOS 13+, modern browsers)
			// - Accounts for on-screen keyboard
			// - Accounts for dynamic address bar (iOS Safari)
			// - Accounts for pinch-to-zoom scaling
			if ( window.visualViewport ) {
				vh = window.visualViewport.height * 0.01; // Convert to vh units (1% of viewport height)
			} else {
				// FALLBACK: Use window.innerHeight (older browsers)
				// Less accurate but better than nothing
				vh = window.innerHeight * 0.01;
			}

			// Set CSS custom property that can be used in stylesheets
			// Example usage: height: calc(var(--vh, 1vh) * 100);
			document.documentElement.style.setProperty( '--vh', `${ vh }px` );
		};

		// INITIALIZATION: Set viewport height immediately when called
		setViewportHeight();

		// EVENT LISTENER 1: visualViewport API (most accurate, iOS 13+)
		if ( window.visualViewport ) {
			// Listen for viewport resize events (address bar, keyboard, etc.)
			window.visualViewport.addEventListener( 'resize', setViewportHeight );

			// Also listen for scroll events as viewport can change during scrolling
			window.visualViewport.addEventListener( 'scroll', setViewportHeight );
		}

		// EVENT LISTENER 2: Window resize (fallback for older browsers)
		// Use requestAnimationFrame for smooth updates instead of setTimeout
		let resizeTimer = null;
		window.addEventListener( 'resize', () => {
			// Cancel previous animation frame to debounce rapid events
			if ( resizeTimer ) {
				cancelAnimationFrame( resizeTimer );
			}
			// Schedule update for next animation frame (smooth, performant)
			resizeTimer = requestAnimationFrame( setViewportHeight );
		}, { passive: true } ); // passive: true for better scroll performance

		// EVENT LISTENER 3: Orientation changes (device rotation)
		if ( screen.orientation ) {
			// Modern Screen Orientation API (preferred)
			screen.orientation.addEventListener( 'change', () => {
				// Delay slightly to allow iOS to finish recalculating viewport
				setTimeout( setViewportHeight, 200 );
			} );
		} else {
			// FALLBACK: Legacy orientationchange event
			window.addEventListener( 'orientationchange', () => {
				// Delay slightly to allow iOS to finish recalculating viewport
				setTimeout( setViewportHeight, 200 );
			} );
		}
	}

	/**
	 * Setup control bar components
	 *
	 * @param {Object} controlBarSettings - Control bar settings object
	 */
	setupControlBarComponents( controlBarSettings ) {
		const controlBar = this.player.controlBar;

		if ( ! controlBarSettings?.volumePanel ) {
			controlBar.removeChild( 'volumePanel' );
		}

		this.setupSettingsButton( controlBar );
	}

	/**
	 * Setup settings button
	 *
	 * @param {Object} controlBar - VideoJS control bar component
	 */
	setupSettingsButton( controlBar ) {
		if ( ! controlBar.getChild( 'SettingsButton' ) ) {
			if ( ! videojs.getComponent( 'SettingsButton' ) ) {
				videojs.registerComponent( 'SettingsButton', SettingsButton );
			}
			controlBar.addChild( 'SettingsButton', {} );
		}

		document.querySelectorAll( '.vjs-settings-button' ).forEach( ( button ) => {
			const icon = button.querySelector( '.vjs-icon-placeholder' );
			icon?.classList.add( 'vjs-icon-cog' );
		} );
	}

	/**
	 * Setup custom play button
	 *
	 * @param {Object} controlBarSettings - Control bar settings object
	 */
	setupCustomPlayButton( controlBarSettings ) {
		if ( ! controlBarSettings?.customPlayBtnImg ) {
			return;
		}

		const playButtonElement = this.player.getChild( 'bigPlayButton' );
		const imgElement = document.createElement( 'img' );

		imgElement.src = controlBarSettings.customPlayBtnImg;
		imgElement.alt = __( 'Custom Play Button', 'godam' );
		imgElement.style.cursor = 'pointer';

		// Copy classes from original button
		playButtonElement.el_.classList.forEach( ( cls ) => {
			imgElement.classList.add( cls );
		} );
		imgElement.classList.add( 'custom-play-image' );

		// Add click handler
		imgElement.addEventListener( 'click', () => {
			const videoPlayer = imgElement.closest( '.easydam-player' );
			const videoElement = videoPlayer?.querySelector( 'video' );
			videoElement?.play();
		} );

		// Replace the original button
		playButtonElement.el_.parentNode.replaceChild( imgElement, playButtonElement.el_ );
	}

	/**
	 * Setup custom buttons
	 */
	setupCustomButtons() {
		const controlBarSettings = this.config.videoSetupControls?.controlBar;

		if ( controlBarSettings?.brandingIcon || ! window?.godamAPIKeyData?.validApiKey ) {
			this.setupBrandingButton( controlBarSettings );
		}
	}

	/**
	 * Setup branding button
	 *
	 * @param {Object} controlBarSettings - Control bar settings object
	 */
	setupBrandingButton( controlBarSettings ) {
		const CustomPlayButton = videojs.getComponent( 'Button' );
		const controlBar = this.player.controlBar;

		class CustomButton extends CustomPlayButton {
			constructor( p, options ) {
				super( p, options );
				this.controlText( __( 'Branding', 'godam' ) );
			}

			createEl() {
				const el = super.createEl();
				el.className += ' vjs-custom-play-button';
				const img = document.createElement( 'img' );

				if ( controlBarSettings?.customBrandImg?.length ) {
					img.src = controlBarSettings.customBrandImg;
				} else if ( window.godamSettings?.brandImage ) {
					img.src = window.godamSettings.brandImage;
				} else {
					img.src = GoDAM;
				}

				img.id = 'branding-icon';
				img.alt = __( 'Branding', 'godam' );
				img.className = 'branding-icon';
				el.appendChild( img );
				return el;
			}

			handleClick( event ) {
				event.preventDefault();
			}
		}

		if ( ! controlBar.getChild( 'CustomButton' ) ) {
			if ( ! videojs.getComponent( 'CustomButton' ) ) {
				videojs.registerComponent( 'CustomButton', CustomButton );
			}
			controlBar.addChild( 'CustomButton', {} );
		}
	}

	/**
	 * Setup captions button styling
	 */
	setupCaptionsButton() {
		const captionsButton = this.player.el().querySelector( '.vjs-subs-caps-button' );
		const durationElement = this.player.el().querySelector( '.vjs-duration' );

		if ( captionsButton?.classList.contains( 'vjs-hidden' ) && durationElement ) {
			durationElement.classList.add( 'right-80' );
		}
	}

	/**
	 * Move video controls based on player skin
	 */
	moveVideoControls() {
		try {
			const playerElement = this.player.el_;
			const newHeight = playerElement.offsetHeight;
			const newWidth = playerElement.offsetWidth;

			const skipButtons = playerElement.querySelectorAll(
				'.vjs-skip-backward-5, .vjs-skip-backward-10, .vjs-skip-backward-30, .vjs-skip-forward-5, .vjs-skip-forward-10, .vjs-skip-forward-30',
			);

			const playButton = playerElement.querySelector( '.vjs-play-control' );

			if ( this.config.videoSetupOptions?.playerSkin === PLAYER_SKINS.PILLS ) {
				this.setupPillsControlLayout( playerElement, playButton, skipButtons, newWidth, newHeight );
			} else {
				this.setupStandardControlLayout( playButton, skipButtons, newWidth, newHeight );
			}
		} catch {
			// Silently fail
		}
	}

	/**
	 * Setup Pills control layout
	 *
	 * @param {HTMLElement} playerElement - Player element
	 * @param {HTMLElement} playButton    - Play button element
	 * @param {Array}       skipButtons   - Array of skip button elements
	 * @param {number}      newWidth      - New width value
	 * @param {number}      newHeight     - New height value
	 */
	setupPillsControlLayout( playerElement, playButton, skipButtons, newWidth, newHeight ) {
		let controlWrapper = playerElement.querySelector( '.godam-central-controls' );

		if ( ! controlWrapper ) {
			controlWrapper = document.createElement( 'div' );
			controlWrapper.className = 'godam-central-controls';
			playButton.parentNode.insertBefore( controlWrapper, playButton );

			// Move controls into wrapper
			const skipBack = playerElement.querySelectorAll(
				'.vjs-skip-backward-5, .vjs-skip-backward-10, .vjs-skip-backward-30',
			);
			const skipForward = playerElement.querySelectorAll(
				'.vjs-skip-forward-5, .vjs-skip-forward-10, .vjs-skip-forward-30',
			);

			skipBack.forEach( ( btn ) => controlWrapper.appendChild( btn ) );
			controlWrapper.appendChild( playButton );
			skipForward.forEach( ( btn ) => controlWrapper.appendChild( btn ) );
		}

		// Position the wrapper
		controlWrapper.style.position = 'absolute';
		controlWrapper.style.left = `${ newWidth / 4 }px`;
		controlWrapper.style.bottom = `${ ( newHeight / 2 ) - 15 }px`;
		controlWrapper.style.width = `${ ( newWidth / 2 ) - 15 }px`;
		playButton.style.setProperty( 'left', `${ ( newWidth / 4 ) - 28 }px` );
	}

	/**
	 * Setup standard control layout
	 *
	 * @param {HTMLElement} playButton  - Play button element
	 * @param {Array}       skipButtons - Array of skip button elements
	 * @param {number}      newWidth    - New width value
	 * @param {number}      newHeight   - New height value
	 */
	setupStandardControlLayout( playButton, skipButtons, newWidth, newHeight ) {
		const skin = this.config.videoSetupOptions?.playerSkin;

		if ( skin === PLAYER_SKINS.MINIMAL ) {
			// For Minimal skin, center the play button and skip buttons vertically and horizontally
			if ( playButton ) {
				// Use -15px offset for play button and -20px for skip buttons to align their centers
				// The play button is typically smaller than the skip button containers
				playButton.style.setProperty( 'bottom', `${ ( newHeight / 2 ) - 15 }px` );
				playButton.style.setProperty( 'left', `${ ( newWidth / 2 ) - 20 }px` );
			}

			skipButtons.forEach( ( button ) => {
				// Align skip buttons to the same vertical center as the play button
				button.style.setProperty( 'bottom', `${ ( newHeight / 2 ) - 20 }px` );
			} );
		} else if ( skin !== PLAYER_SKINS.DEFAULT ) {
			// For other non-default skins (excluding PILLS)
			if ( playButton ) {
				playButton.style.setProperty( 'bottom', `${ newHeight / 2 }px` );
				playButton.style.setProperty( 'left', `${ ( newWidth / 2 ) - 20 }px` );
			}

			skipButtons.forEach( ( button ) => {
				button.style.setProperty( 'bottom', `${ newHeight / 2 }px` );
			} );
		}
	}
}
