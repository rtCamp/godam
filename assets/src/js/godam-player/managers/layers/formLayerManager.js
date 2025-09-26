/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { LAYER_TYPES } from '../../utils/constants.js';
import { addLayerInteraction } from '../../utils/storage.js';

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
				name: layer.name || '',
			};

			this.formLayers.push( layerObj );
			this.setupFormLayerSkipButton( layerObj, layer );
		}
	}

	/**
	 * Handle layer interaction and update localStorage
	 *
	 * @param {string}             layerType      - Type of layer: 'form', 'cta', etc.
	 * @param {string}             actionType     - Action type: 'clicked', 'submitted', 'skipped'
	 * @param {HTMLElement|Object} layer          - Layer element or layer object
	 * @param {Object}             [extraData={}] - Any additional data to store
	 */
	handleLayerInteraction( layerType, actionType, layer, extraData = {} ) {
		const layerId = layer.id || 'unknown';
		const layerName = layer.name || '';

		const interaction = {
			layer_id: layerId,
			layer_type: layerType,
			action_type: actionType,
			layer_timestamp: parseFloat( layer.displayTime ) || 0,
			layer_name: layerName,
			...extraData,
		};

		addLayerInteraction( this.player.el().dataset.id || this.player.el().dataset.job_id, interaction );
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
	 * @param {Object} layer    - Single Layer configuration object
	 */
	setupFormLayerSkipButton( layerObj, layer ) {
		let skipButton = layerObj.layerElement.querySelector( '.skip-button' );

		if ( ! skipButton ) {
			skipButton = this.createSkipButton( layerObj.skipText );
		}

		if ( ! layerObj.allowSkip ) {
			skipButton.classList.add( 'hidden' );
		}

		this.setupFormObserver( layerObj, skipButton, layer );
		this.setupSkipButtonHandler( layerObj, skipButton, layer );

		layerObj.layerElement.appendChild( skipButton );
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

		const arrowIcon = document.createElement( 'i' );
		arrowIcon.className = 'fa-solid fa-chevron-right';
		skipButton.appendChild( arrowIcon );

		return skipButton;
	}

	/**
	 * Setup form observer for confirmation messages
	 *
	 * @param {Object}      layerObj   - Layer object containing element and configuration
	 * @param {HTMLElement} skipButton - Skip button element
	 * @param {Object}      layer      - Single Layer configuration object
	 */
	setupFormObserver( layerObj, skipButton, layer ) {
		const observer = new MutationObserver( () => {
			if ( ! this.isDisplayingLayers[ this.currentPlayerVideoInstanceId ] ) {
				return; // ignore if this layer isn’t currently showing
			}

			if ( this.hasConfirmationMessage( layerObj.layerElement ) ) {
				skipButton.textContent = __( 'Continue', 'godam' );
				skipButton.classList.remove( 'hidden' );

				// only track if we're close to the display time
				if ( ! layerObj._submittedTracked ) {
					this.handleLayerInteraction( LAYER_TYPES.FORM, 'submitted', layer );
					layerObj._submittedTracked = true;
				}

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
		const wpPollsAnswer = element.querySelector( '.wp-polls-answer' );
		if ( ! wpPollsForm && wpPollsAnswer ) {
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
	 * @param {Object}      layer      - Single Layer configuration object
	 */
	setupSkipButtonHandler( layerObj, skipButton, layer ) {
		skipButton.addEventListener( 'click', () => {
			layerObj.show = false;
			layerObj.layerElement.classList.add( 'hidden' );
			this.player.controls( true );
			this.player.play();
			this.isDisplayingLayers[ this.currentPlayerVideoInstanceId ] = false;

			if ( ! layerObj._ctaClickedTracked && LAYER_TYPES.CTA === layer.type && 'image' === layer.cta_type ) {
				this.handleLayerInteraction( LAYER_TYPES.CTA, 'skipped', layer ); //update layer type
			}

			if ( ! layerObj._submittedTracked && LAYER_TYPES.FORM === layer.type ) {
				this.handleLayerInteraction( LAYER_TYPES.FORM, 'skipped', layer ); //update layer type
			}

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
			const imageCtaBtn = layerObj?.layerElement?.querySelector( '.image-cta-btn' );
			if ( imageCtaBtn ) {
				imageCtaBtn.addEventListener( 'click', () => {
					const layer = {
						id: layerObj?.layerElement?.id.replace( `layer-${ this.player.el().dataset.instanceId }-`, '' ) || '',
						name: layerObj?.name || '',
					};

					this.handleLayerInteraction( 'cta', 'clicked', layer );
					layerObj._ctaClickedTracked = true;
				} );
			}
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
	 * Reset form layer state
	 */
	reset() {
		this.formLayers = [];
		this.currentFormLayerIndex = 0;
	}
}
