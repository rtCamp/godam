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
	}

	/**
	 * Setup control bar configuration
	 */
	setupControlBarConfiguration() {
		const controlBarSettings = this.config.videoSetupControls?.controlBar;

		this.setupPlayButtonPosition( controlBarSettings );
		this.setupControlBarComponents( controlBarSettings );
		this.setupCustomPlayButton( controlBarSettings );
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
		if ( this.config.videoSetupOptions?.playerSkin === PLAYER_SKINS.MINIMAL ) {
			playButton.style.setProperty( 'bottom', `${ ( newHeight / 2 ) + 4 }px` );
			skipButtons.forEach( ( button ) => {
				button.style.setProperty( 'bottom', `${ ( newHeight / 2 ) - 5 }px` );
			} );
		}

		if ( this.config.videoSetupOptions?.playerSkin !== PLAYER_SKINS.DEFAULT ) {
			playButton.style.setProperty( 'bottom', `${ newHeight / 2 }px` );
			playButton.style.setProperty( 'left', `${ ( newWidth / 2 ) - 20 }px` );
		}

		if ( this.config.videoSetupOptions?.playerSkin !== PLAYER_SKINS.MINIMAL ) {
			skipButtons.forEach( ( button ) => {
				button.style.setProperty( 'bottom', `${ newHeight / 2 }px` );
			} );
		}
	}
}
