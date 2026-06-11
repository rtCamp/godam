/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { LAYER_TYPES } from '../../utils/constants.js';
import { getLayerDisplayName, shouldSuppressSkip } from '../../utils/layerActions.js';

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

		// Per-(emitted layer_id, page-session) dedupe sets. CTA/form are atomic,
		// so each layer_id is a unique unit — and we dedupe every action_type
		// (viewed, clicked, submitted, skipped) at this granularity. That keeps
		// conversion-rate math bounded ≤ 100%: one click per (layer, session)
		// at most, denominator is one viewed event per (layer, session) at most.
		this._dedupeFired = new Map(); // layer_id -> Set<action_type>

		// Per-layer first-visible timestamp (epoch ms) — used to compute
		// dwell_ms on click/submit/skip. Map<layer_id, number>.
		this._firstVisibleAt = new Map();

		// Snapshot of `window.GoDAM.getTabHiddenAccumulatedMs()` at the moment
		// `_firstVisibleAt` is set. dwell = (now - firstVisibleAt) - (current
		// hidden total - snapshot) so time the viewer spent on another tab
		// doesn't pollute "consideration time." Map<layer_id, number>.
		this._hiddenAtFirstVisible = new Map();

		// Per-layer interaction sequence — incremented on each emit so the
		// receiver can distinguish first-touch from repeat events. Map<layer_id, number>.
		this._interactionSeq = new Map();
	}

	/**
	 * Emit a layer interaction event into the localStorage buffer.
	 *
	 * No-op when `window.GoDAM.addLayerInteraction` isn't loaded yet (the
	 * shared analytics bundle ships separately and may not be present on
	 * editor-side previews).
	 *
	 * Dedupes every action per (layer_id, page-session) — keeps conversion
	 * math sensible (clicks ≤ views) without losing the meaningful event
	 * (the first click is recorded; subsequent clicks within the same session
	 * are dropped because the analytical question is "did the viewer click?").
	 *
	 * Enriches every event with parent_layer_id, parent_layer_name, dwell_ms,
	 * current_video_time, is_fullscreen, interaction_seq so future analytics
	 * questions ("how long after layer appeared do users click?", "do fullscreen
	 * viewers convert better?") can be answered without re-instrumenting.
	 *
	 * @param {Object} layer      Layer config (must have id, type, displayTime).
	 * @param {string} actionType e.g. 'viewed', 'clicked', 'submitted', 'skipped'.
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

		// Per-(layer_id, action_type, session) dedupe.
		let firedActions = this._dedupeFired.get( layerId );
		if ( ! firedActions ) {
			firedActions = new Set();
			this._dedupeFired.set( layerId, firedActions );
		}
		// A skip that lands after the viewer already took this layer's positive
		// action isn't a real skip (see shouldSuppressSkip) — drop it so
		// clicked/submitted/voted and skipped stay mutually exclusive per
		// session (e.g. a CTA opens in a new tab, the viewer returns and presses
		// Continue, which must not log a skip on top of the click).
		if ( shouldSuppressSkip( firedActions, actionType ) ) {
			return;
		}
		if ( firedActions.has( actionType ) ) {
			return;
		}
		firedActions.add( actionType );

		// Compute dwell — ms between layer first becoming visible and this
		// event, minus time the tab was hidden during that window. 0 for the
		// viewed event itself (since "visible-at" is recorded at the same
		// instant); positive for interactions that follow.
		const firstVisibleAt = this._firstVisibleAt.get( layerId );
		let dwellMs = 0;
		if ( actionType === 'viewed' ) {
			this._firstVisibleAt.set( layerId, Date.now() );
			this._hiddenAtFirstVisible.set(
				layerId,
				window.GoDAM?.getTabHiddenAccumulatedMs?.() || 0,
			);
		} else if ( firstVisibleAt ) {
			const wallMs = Date.now() - firstVisibleAt;
			const hiddenAtStart = this._hiddenAtFirstVisible.get( layerId ) || 0;
			const hiddenNow = window.GoDAM?.getTabHiddenAccumulatedMs?.() || 0;
			dwellMs = Math.max( 0, wallMs - ( hiddenNow - hiddenAtStart ) );
		}

		// Bump interaction sequence — 1-indexed; `viewed` is seq 1 by convention.
		const prevSeq = this._interactionSeq.get( layerId ) || 0;
		const seq = prevSeq + 1;
		this._interactionSeq.set( layerId, seq );

		// Current player time — distinct from layer_timestamp (which is when the
		// layer was *placed* in the editor). When CTA/Form auto-pauses the video,
		// current_video_time tracks the actual playback position at interaction.
		let currentVideoTime = 0;
		try {
			currentVideoTime = Number( this.player?.currentTime?.() ) || 0;
		} catch ( e ) {
			currentVideoTime = 0;
		}

		// Fullscreen state — useful for "do fullscreen viewers convert better"
		// questions in v2 without re-instrumenting.
		let isFullscreen = false;
		try {
			isFullscreen = !! this.player?.isFullscreen?.();
		} catch ( e ) {
			isFullscreen = false;
		}

		// Device + viewer context — slicing dimensions for v1.5 dashboards
		// (conversion-by-device, first-time vs returning-viewer rates).
		// Helpers are no-ops on missing window.GoDAM.* and return safe
		// defaults, so this is robust against bundle load order.
		const deviceType = window.GoDAM?.getDeviceType?.() || 'desktop';
		const wasFirstView = window.GoDAM?.wasFirstViewForVideo?.( videoKey ) || false;

		// CTA/form layers are atomic — the parent IS the layer. We still set
		// parent_layer_id so the UI can group consistently across all layer types.
		// `layer.name` (custom name from the editor) wins; otherwise fall back to
		// `<TypeLabel> layer at <t>s` so the analytics UI never has to render a
		// bare UUID. For form layers, `<TypeLabel>` resolves to the specific
		// form-integration label (e.g. "WPForms") via `layer.form_type`. Same
		// string is used for parent_layer_name in metadata so the backend's
		// argMax aggregation surfaces the same value.
		const displayName = getLayerDisplayName( layer, layerType );

		// Stash form_type when present so the analytics UI can pick the
		// matching form-integration icon at render time (different from the
		// generic Form glyph). Empty string for non-form layers — keeps the
		// metadata shape uniform across layer types.
		const formType =
			layerType === 'form' && layer?.form_type
				? String( layer.form_type )
				: '';

		const enrichedMetadata = {
			parent_layer_id: layerId,
			parent_layer_name: displayName,
			form_type: formType,
			dwell_ms: dwellMs,
			current_video_time: currentVideoTime,
			is_fullscreen: isFullscreen,
			interaction_seq: seq,
			device_type: deviceType,
			was_first_view: wasFirstView,
			...( metadata || {} ),
		};

		window.GoDAM.addLayerInteraction( videoKey, {
			layer_id: layerId,
			layer_type: layerType,
			action_type: actionType,
			layer_timestamp: parseFloat( layer?.displayTime ) || 0,
			layer_name: displayName,
			page_url: window.location.href,
			layer_metadata: enrichedMetadata,
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
	 * Fires `clicked` on the first click of the session — deduped per
	 * (layer_id, action_type, session) by emitLayerEvent, like every other
	 * action, so repeat clicks don't inflate the count and the conversion rate
	 * stays bounded ≤ 100%. The destination URL is preserved in
	 * `layer_metadata.click_target_url` to set up native WP attribution
	 * (resolving the URL to a post/product ID) in v2. (Per-destination counts
	 * for a multi-link CTA would need a composite layer_id — out of scope.)
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
		const isPoll = layerObj.layer?.type === LAYER_TYPES.POLL;
		// Polls: only count a vote on a genuine voting-form → results-view
		// transition. WP-Polls renders the results immediately for a viewer who
		// already voted in a prior session, which would otherwise be miscounted
		// as a fresh vote. Seed from the current DOM, then keep it updated as
		// the form (re)appears (some WP-Polls setups AJAX-load the form too).
		let pollFormSeen = isPoll
			? !! layerObj.layerElement?.querySelector( '.wp-polls-form' )
			: false;

		const observer = new MutationObserver( () => {
			if ( isPoll && ! pollFormSeen &&
				layerObj.layerElement?.querySelector( '.wp-polls-form' ) ) {
				pollFormSeen = true;
			}
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

				// Fire the conversion event when the integration's
				// confirmation appears. For FORM that's `submitted`; for
				// POLL it's `voted` (WP-Polls confirmation = the form was
				// replaced by the results view, detected in hasConfirmationMessage
				// via the .wp-polls-form → .wp-polls-ans transition).
				// CTA layers don't run this observer — their click events
				// fire separately via setupCtaClickTracking.
				if ( layerObj.layer?.type === LAYER_TYPES.FORM ) {
					this.emitLayerEvent( layerObj.layer, 'submitted' );
				} else if ( isPoll && pollFormSeen ) {
					// pollFormSeen guards against counting an already-voted
					// viewer (results shown without a vote this session).
					this.emitLayerEvent( layerObj.layer, 'voted' );
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
			// as a "Continue" after a successful form submit / poll vote
			// (label swap in setupFormObserver) — in that case we deliberately
			// do NOT fire `skipped`, since the conversion event already fired.
			const layerType = layerObj.layer?.type;
			const isConversionContinue =
				( layerType === LAYER_TYPES.FORM || layerType === LAYER_TYPES.POLL ) &&
				skipButton.textContent &&
				skipButton.textContent.includes( __( 'Continue', 'godam' ) );

			if ( ! isConversionContinue ) {
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
