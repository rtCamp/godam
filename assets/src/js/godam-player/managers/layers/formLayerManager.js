/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { LAYER_TYPES } from '../../utils/constants.js';

/**
 * Form Layer Manager
 * Handles form layer functionality including skip buttons and form observation
 */
export default class FormLayerManager {
	constructor( player, isDisplayingLayers, currentPlayerVideoInstanceId ) {
		this.player = player;
		this.isDisplayingLayers = isDisplayingLayers;
		this.currentPlayerVideoInstanceId = currentPlayerVideoInstanceId;
		this.formLayers = [];
		this.currentFormLayerIndex = 0;
	}

	/**
	 * Setup form layer
	 *
	 * @param {Object}      layer        - Layer configuration object
	 * @param {HTMLElement} layerElement - Layer DOM element
	 */
	setupFormLayer( layer, layerElement ) {
		if ( layer.custom_css ) {
			const styleElement = document.createElement( 'style' );
			styleElement.textContent = layer.custom_css;
			layerElement.appendChild( styleElement );
		}

		const skipText = this.getSkipText( layer.type );
		const allowSkip = layer.allow_skip !== undefined ? layer.allow_skip : true;

		const existingLayer = this.formLayers.some(
			( existingLayerObj ) => existingLayerObj.layerElement === layerElement,
		);

		if ( ! existingLayer ) {
			const layerObj = {
				layerElement,
				displayTime: parseFloat( layer.displayTime ),
				show: true,
				allowSkip,
				skipText,
			};

			this.formLayers.push( layerObj );
			this.setupFormLayerSkipButton( layerObj );
		}
	}

	/**
	 * Get skip text based on layer type
	 *
	 * @param {string} layerType - Type of layer
	 * @return {string} Skip button text
	 */
	getSkipText( layerType ) {
		const skipTexts = {
			[ LAYER_TYPES.FORM ]: __( 'Skip Form', 'godam' ),
			[ LAYER_TYPES.CTA ]: __( 'Skip', 'godam' ),
			[ LAYER_TYPES.POLL ]: __( 'Skip Poll', 'godam' ),
		};

		return skipTexts[ layerType ] || __( 'Skip', 'godam' );
	}

	/**
	 * Setup form layer skip button
	 *
	 * @param {Object} layerObj - Layer object containing element and configuration
	 */
	setupFormLayerSkipButton( layerObj ) {
		let skipButton = layerObj.layerElement.querySelector( '.skip-button' );

		if ( ! skipButton ) {
			skipButton = this.createSkipButton( layerObj.skipText );
		}

		if ( ! layerObj.allowSkip ) {
			skipButton.classList.add( 'hidden' );
		}

		this.setupFormObserver( layerObj, skipButton );
		this.setupSkipButtonHandler( layerObj, skipButton );

		layerObj.layerElement.appendChild( skipButton );
	}

	/**
	 * Create arrow icon for skip button
	 *
	 * @return {HTMLElement} Created arrow icon element
	 */
	createArrowIcon() {
		const arrowIcon = document.createElement( 'span' );
		arrowIcon.innerHTML = `<svg viewBox="0 0 320 512" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M278.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L210.7 256 73.4 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160z"/></svg>`;
		return arrowIcon;
	}

	/**
	 * Create skip button
	 *
	 * @param {string} skipText - Text to display on the skip button
	 * @return {HTMLElement} Created skip button element
	 */
	createSkipButton( skipText ) {
		const skipButton = document.createElement( 'button' );
		skipButton.textContent = skipText;
		skipButton.classList.add( 'skip-button' );
		skipButton.appendChild( this.createArrowIcon() );

		return skipButton;
	}

	/**
	 * Setup form observer for confirmation messages
	 *
	 * @param {Object}      layerObj   - Layer object containing element and configuration
	 * @param {HTMLElement} skipButton - Skip button element
	 */
	setupFormObserver( layerObj, skipButton ) {
		const observer = new MutationObserver( () => {
			if ( this.hasConfirmationMessage( layerObj.layerElement ) ) {
				// Update button text while preserving the arrow icon
				let textNode = null;
				for ( let i = 0; i < skipButton.childNodes.length; i++ ) {
					if ( skipButton.childNodes[ i ].nodeType === Node.TEXT_NODE ) {
						textNode = skipButton.childNodes[ i ];
						break;
					}
				}

				if ( textNode ) {
					textNode.textContent = __( 'Continue', 'godam' );
				} else {
					// Fallback: if no text node exists, update all content
					skipButton.textContent = __( 'Continue', 'godam' );
					skipButton.appendChild( this.createArrowIcon() );
				}
				skipButton.classList.remove( 'hidden' );
				observer.disconnect();
			}
		} );

		observer.observe( layerObj.layerElement, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: [ 'class' ],
		} );
	}

	/**
	 * Check for confirmation messages in various form types
	 *
	 * @param {HTMLElement} element - Form element to check for confirmation messages
	 * @return {boolean} True if confirmation message is found
	 */
	hasConfirmationMessage( element ) {
		const confirmationSelectors = [
			'.gform_confirmation_message',
			'.wpforms-confirmation-container-full',
			'form.wpcf7-form.sent',
			'.srfm-success-box.srfm-active',
			'.ff-message-success',
			'.contact-form-success',
			'.forminator-success.forminator-show',
			'.everest-forms-notice--success',
		];

		// Check for standard selectors
		if ( confirmationSelectors.some( ( selector ) => element.querySelector( selector ) ) ) {
			return true;
		}

		// Special cases
		const wpPollsForm = element.querySelector( '.wp-polls-form' );
		const wpPollsResult = element.querySelector( '.wp-polls-ans' );
		if ( ! wpPollsForm && wpPollsResult ) {
			return true;
		}

		const nfResponse = element.querySelector( '.nf-response-msg' );
		if ( nfResponse && nfResponse.innerHTML !== '' ) {
			return true;
		}

		const mfResponse = element.querySelector( '.mf-response-msg>p' );
		if ( mfResponse && mfResponse.textContent !== '' ) {
			return true;
		}

		return false;
	}

	/**
	 * Setup skip button click handler
	 *
	 * @param {Object}      layerObj   - Layer object containing element and configuration
	 * @param {HTMLElement} skipButton - Skip button element
	 */
	setupSkipButtonHandler( layerObj, skipButton ) {
		skipButton.addEventListener( 'click', () => {
			layerObj.show = false;
			layerObj.layerElement.classList.add( 'hidden' );
			this.player.controls( true );
			this.player.play();
			this.isDisplayingLayers[ this.currentPlayerVideoInstanceId ] = false;

			if ( layerObj === this.formLayers[ this.currentFormLayerIndex ] ) {
				this.currentFormLayerIndex++;
			}
		} );
	}

	/**
	 * Handle form layers time update
	 *
	 * @param {number} currentTime - Current video time in seconds
	 */
	handleFormLayersTimeUpdate( currentTime ) {
		if ( this.isDisplayingLayers[ this.currentPlayerVideoInstanceId ] ||
			this.currentFormLayerIndex >= this.formLayers.length ) {
			return;
		}

		const layerObj = this.formLayers[ this.currentFormLayerIndex ];

		if ( layerObj.show &&
			currentTime >= layerObj.displayTime &&
			layerObj.layerElement.classList.contains( 'hidden' ) ) {
			layerObj.layerElement.classList.remove( 'hidden' );
			this.player.pause();
			this.player.controls( false );
			this.isDisplayingLayers[ this.currentPlayerVideoInstanceId ] = true;
		}
	}

	/**
	 * Handle fullscreen changes for form layers
	 *
	 * @param {boolean}     isFullscreen   - Whether player is in fullscreen
	 * @param {HTMLElement} videoContainer - Video container element
	 */
	handleFullscreenChange( isFullscreen, videoContainer ) {
		// Handle uppy selector to visible on fullscreen.
		const uppyContainerModal = document.querySelector( '#uppy-godam-video-modal-container' );

		if ( uppyContainerModal && isFullscreen ) {
			videoContainer.appendChild( uppyContainerModal );
		}

		this.formLayers.forEach( ( layerObj ) => {
			if ( isFullscreen ) {
				videoContainer.appendChild( layerObj.layerElement );
				layerObj.layerElement.classList.add( 'fullscreen-layer' );
			} else {
				layerObj.layerElement.classList.remove( 'fullscreen-layer' );
			}
		} );
	}

	/**
	 * Handle play events for form layers
	 *
	 * @return {boolean} True if any layer is visible and player should be paused
	 */
	handlePlay() {
		const isAnyLayerVisible = this.formLayers.some(
			( layerObj ) => ! layerObj.layerElement.classList.contains( 'hidden' ) && layerObj.show,
		);

		if ( isAnyLayerVisible ) {
			this.player.pause();
			return true;
		}

		return false;
	}

	/**
	 * Sort form layers by display time
	 */
	sortLayers() {
		this.formLayers.sort( ( a, b ) => a.displayTime - b.displayTime );
		this.currentFormLayerIndex = 0;
	}

	/**
	 * Dismiss a layer - either current active layer or specific layer by HTML ID
	 *
	 * @param {string} layerHtmlId - Optional HTML ID of the layer to dismiss. If not provided, dismisses current active layer
	 * @return {boolean} True if a layer was dismissed successfully
	 */
	dismissLayer( layerHtmlId = null ) {
		let layerIndex;

		if ( layerHtmlId ) {
			// Find layer by HTML ID
			layerIndex = this.formLayers.findIndex( ( layerObj ) => layerObj.layerElement.id === layerHtmlId );

			if ( layerIndex === -1 ) {
				return false;
			}
		} else {
			// Use current active layer
			layerIndex = this.currentFormLayerIndex;

			if ( layerIndex >= this.formLayers.length ) {
				return false;
			}
		}

		const layerObj = this.formLayers[ layerIndex ];

		// Hide the layer
		layerObj.show = false;
		layerObj.layerElement.classList.add( 'hidden' );

		// If this was the current layer, handle playback and move to next
		if ( layerIndex === this.currentFormLayerIndex ) {
			this.player.controls( true );
			this.player.play();
			this.isDisplayingLayers[ this.currentPlayerVideoInstanceId ] = false;
			this.currentFormLayerIndex++;
		}

		return true;
	}

	/**
	 * Get the currently active layer
	 *
	 * @return {Object|null} Current layer object or null if no active layer
	 */
	getCurrentLayer() {
		if ( this.currentFormLayerIndex >= this.formLayers.length ) {
			return null;
		}

		const layerObj = this.formLayers[ this.currentFormLayerIndex ];
		return {
			index: this.currentFormLayerIndex,
			element: layerObj.layerElement,
			displayTime: layerObj.displayTime,
			allowSkip: layerObj.allowSkip,
			isVisible: ! layerObj.layerElement.classList.contains( 'hidden' ),
			show: layerObj.show,
		};
	}

	/**
	 * Get all form layers
	 *
	 * @return {Array} Array of layer information objects
	 */
	getAllLayers() {
		return this.formLayers.map( ( layerObj, index ) => ( {
			index,
			element: layerObj.layerElement,
			displayTime: layerObj.displayTime,
			allowSkip: layerObj.allowSkip,
			isVisible: ! layerObj.layerElement.classList.contains( 'hidden' ),
			show: layerObj.show,
		} ) );
	}

	/**
	 * Reset form layer state
	 */
	reset() {
		this.formLayers = [];
		this.currentFormLayerIndex = 0;
	}

	/**
	 * Replay all form layers from the beginning
	 */
	replay() {
		this.currentFormLayerIndex = 0;
		this.formLayers.forEach( ( layerObj ) => {
			layerObj.show = true;
			layerObj.layerElement.classList.add( 'hidden' );
		} );
	}
}
