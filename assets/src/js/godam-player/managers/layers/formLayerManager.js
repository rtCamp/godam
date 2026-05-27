/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { LAYER_TYPES } from '../../utils/constants.js';

/**
 * Resolve the analytics videoKey (data-id or data-job_id) for a player.
 *
 * Falls back to data-job_id when data-id is missing so reel-pop modals and
 * job-id-only configurations still produce a stable bucket.
 *
 * @param {Object} player VideoJS player instance.
 * @return {string} Non-empty videoKey on success; empty string when no usable identifier is present.
 */
function getVideoKey( player ) {
	try {
		const el = player?.el && player.el();
		if ( ! el ) {
			return '';
		}
		const id = el.getAttribute?.( 'data-id' ) || el.dataset?.id;
		if ( id ) {
			return String( id );
		}
		const jobId = el.getAttribute?.( 'data-job_id' ) || el.dataset?.job_id;
		return jobId ? String( jobId ) : '';
	} catch ( e ) {
		return '';
	}
}

/**
 * Form Layer Manager
 *
 * Handles form layer functionality including skip buttons and form observation.
 * Despite the name, this manager also runs for CTA and Poll layers — they
 * share the pause-on-display + skip-button mechanics. Analytics tracking
 * branches on `layer.type` to emit the right event semantics for each type.
 */
export default class FormLayerManager {
	constructor( player, isDisplayingLayers, currentPlayerVideoInstanceId ) {
		this.player = player;
		this.isDisplayingLayers = isDisplayingLayers;
		this.currentPlayerVideoInstanceId = currentPlayerVideoInstanceId;
		this.formLayers = [];
		this.currentFormLayerIndex = 0;
		// Per-session dedupe set for `viewed` impressions. Subsequent
		// interaction events (clicked, submitted, skipped) are NOT deduped.
		this._viewedFired = new Set();
	}

	/**
	 * Emit a layer interaction event into the localStorage buffer.
	 *
	 * No-op when `window.GoDAM.addLayerInteraction` isn't loaded yet (the
	 * shared analytics bundle ships separately and may not be present on
	 * editor-side previews).
	 *
	 * @param {Object} layer      Layer config (must have id, type, displayTime).
	 * @param {string} actionType One of LAYER_ACTIONS[layer.type].all.
	 * @param {Object} [metadata] Optional payload merged into layer_metadata.
	 */
	emitLayerEvent( layer, actionType, metadata ) {
		if ( ! window.GoDAM || typeof window.GoDAM.addLayerInteraction !== 'function' ) {
			return;
		}

		const videoKey = getVideoKey( this.player );
		if ( ! videoKey ) {
			return;
		}

		const layerId = layer?.id ? String( layer.id ) : '';
		const layerType = layer?.type ? String( layer.type ) : '';
		if ( ! layerId || ! layerType ) {
			return;
		}

		// Dedupe `viewed` once per (layer_id, page-session). Interaction
		// events stay re-emittable so multiple clicks/skips on the same layer
		// produce multiple events.
		if ( actionType === 'viewed' ) {
			if ( this._viewedFired.has( layerId ) ) {
				return;
			}
			this._viewedFired.add( layerId );
		}

		window.GoDAM.addLayerInteraction( videoKey, {
			layer_id: layerId,
			layer_type: layerType,
			action_type: actionType,
			layer_timestamp: parseFloat( layer?.displayTime ) || 0,
			layer_name: layer?.name ? String( layer.name ) : '',
			page_url: window.location.href,
			layer_metadata: metadata || {},
		} );
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
				// Stash the original config so analytics emit functions have
				// access to id, name, type without threading them through every
				// method signature.
				layer,
			};

			this.formLayers.push( layerObj );
			this.setupFormLayerSkipButton( layerObj );
			// CTA-specific click tracking: anchor / button clicks inside the
			// layer count as `clicked`. Forms use `submitted` (fired from the
			// confirmation MutationObserver below); polls don't ship in v1.
			if ( layer.type === LAYER_TYPES.CTA ) {
				this.setupCtaClickTracking( layerObj );
			}
		}
	}

	/**
	 * Hook click events on anchors / buttons inside a CTA layer.
	 *
	 * Fires `clicked` per actual user click — not deduped, so a CTA with two
	 * destinations produces two events. The destination URL is preserved
	 * in `layer_metadata.click_target_url` to set up native WP attribution
	 * (resolving the URL to a post/product ID) in v2.
	 *
	 * @param {Object} layerObj Layer object stored in this.formLayers.
	 */
	setupCtaClickTracking( layerObj ) {
		layerObj.layerElement.addEventListener( 'click', ( ev ) => {
			const trigger = ev.target?.closest?.( 'a, button' );
			if ( ! trigger ) {
				return;
			}
			// Skip the built-in skip button — it fires `skipped` separately
			// from setupSkipButtonHandler.
			if ( trigger.classList?.contains( 'skip-button' ) ) {
				return;
			}
			const targetUrl = trigger.getAttribute?.( 'href' ) || '';
			this.emitLayerEvent( layerObj.layer, 'clicked', {
				click_target_url: targetUrl,
			} );
		} );
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

				// Fire `submitted` for form layers when the form-plugin's
				// confirmation message appears. CTA layers don't have a
				// submission concept; their click events fire separately
				// via setupCtaClickTracking.
				if ( layerObj.layer?.type === LAYER_TYPES.FORM ) {
					this.emitLayerEvent( layerObj.layer, 'submitted' );
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
			// Fire `skipped` before tearing the layer down. The button doubles
			// as a "Continue" after a successful form submit (label swap in
			// setupFormObserver) — in that case we deliberately do NOT fire
			// `skipped`, since the form was submitted, not skipped.
			const isContinueAfterSubmit =
				layerObj.layer?.type === LAYER_TYPES.FORM &&
				skipButton.textContent &&
				skipButton.textContent.includes( __( 'Continue', 'godam' ) );

			if ( ! isContinueAfterSubmit ) {
				this.emitLayerEvent( layerObj.layer, 'skipped' );
			}

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

			// Fire `viewed` impression. Deduped per (layer_id, page-session)
			// inside emitLayerEvent — re-displaying the same layer after a
			// time-seek does not produce a second impression.
			this.emitLayerEvent( layerObj.layer, 'viewed' );
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
