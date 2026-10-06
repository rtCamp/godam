/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getLayerDisplayName } from '../../utils/layerActions.js';
import { resolveButtonCtaStyle, isImageButtonVariant } from '../../utils/buttonCtaStyle';

/**
 * Resolve the analytics videoKey (data-id or data-job_id) for a player.
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
 * Button CTA Layer Manager.
 *
 * Renders one or more clickable buttons positioned anywhere over the video,
 * modeled on the Hotspot layer: a non-modal overlay shown for a
 * `[displayTime, displayTime + duration)` window that does NOT pause playback
 * (an optional `pauseOnHover` pauses only while a button is hovered). The server
 * template emits an empty `.easydam-layer.godam-button-cta-layer` container; this
 * manager builds, positions and wires each button inside it.
 */
export default class ButtonCtaLayerManager {
	constructor( player, isDisplayingLayers, currentPlayerVideoInstanceId ) {
		this.player = player;
		this.buttonCtaLayers = [];
		this.wasPlayingBeforeHover = false;
		this.isDisplayingLayers = isDisplayingLayers;
		this.currentPlayerVideoInstanceId = currentPlayerVideoInstanceId;

		// Per-(layer_id, action_type, page-session) dedupe. For clicks the key is a
		// composite `${layerId}::${buttonId|idx}` so each button is its own unit.
		this._dedupeFired = new Map();
	}

	/**
	 * Register a button CTA layer for playback handling.
	 *
	 * @param {Object}      layer        Layer configuration object.
	 * @param {HTMLElement} layerElement Layer DOM element.
	 */
	setupButtonCtaLayer( layer, layerElement ) {
		const layerObj = {
			layerElement,
			displayTime: parseFloat( layer.displayTime ) || 0,
			duration: layer.duration ? parseInt( layer.duration, 10 ) : 0,
			show: true,
			buttons: Array.isArray( layer.buttons ) ? layer.buttons : [],
			pauseOnHover: layer.pauseOnHover || false,
			// Stash the original config so analytics has access to id/name/type.
			layer,
		};

		this.buttonCtaLayers.push( layerObj );
	}

	/**
	 * Show / hide button CTA layers based on the current playback time.
	 *
	 * @param {number} currentTime Current video time in seconds.
	 */
	handleButtonCtaLayersTimeUpdate( currentTime ) {
		const blockedByLayer = this.isDisplayingLayers?.[ this.currentPlayerVideoInstanceId ] === true;

		this.buttonCtaLayers.forEach( ( layerObj ) => {
			if ( ! layerObj.show ) {
				return;
			}

			// A falsy duration means "stay visible until the end of the video".
			const endTime = layerObj.duration ? layerObj.displayTime + layerObj.duration : Infinity;
			const isActive = currentTime >= layerObj.displayTime && currentTime < endTime;

			// While a modal layer (form/CTA/poll) is up, drop behind it.
			if ( blockedByLayer ) {
				if ( ! layerObj.layerElement.classList.contains( 'overlapped' ) ) {
					layerObj.layerElement.classList.add( 'overlapped' );
				}
			} else if ( layerObj.layerElement.classList.contains( 'overlapped' ) ) {
				layerObj.layerElement.classList.remove( 'overlapped' );
			}

			if ( isActive ) {
				if ( layerObj.layerElement.classList.contains( 'hidden' ) ) {
					layerObj.layerElement.classList.remove( 'hidden' );
					this.emitLayerEvent( layerObj.layer, 'viewed' );
					if ( ! layerObj.layerElement.dataset?.buttonsInitialized ) {
						this.createButtons( layerObj );
						layerObj.layerElement.dataset.buttonsInitialized = true;
					} else {
						this.updateButtonPositions();
					}
				}
			} else if ( ! layerObj.layerElement.classList.contains( 'hidden' ) ) {
				layerObj.layerElement.classList.add( 'hidden' );
			}
		} );
	}

	/**
	 * Build and append all buttons for a layer.
	 *
	 * @param {Object} layerObj Layer object containing buttons and configuration.
	 */
	createButtons( layerObj ) {
		layerObj.buttons.forEach( ( button, index ) => {
			const buttonEl = this.createButtonElement( button, index, layerObj );
			layerObj.layerElement.appendChild( buttonEl );
		} );
	}

	/**
	 * Create a single button element.
	 *
	 * @param {Object} button   Button configuration object.
	 * @param {number} index    Index of the button within the layer.
	 * @param {Object} layerObj The owning layer object.
	 * @return {HTMLElement} The created anchor element.
	 */
	createButtonElement( button, index, layerObj ) {
		const style = resolveButtonCtaStyle( button );
		const isImage = isImageButtonVariant( style.variant ) && !! style.imageUrl;
		const isSticker = style.variant === 'sticker';

		const buttonEl = document.createElement( 'a' );
		buttonEl.className = 'godam-button-cta' +
			( isImage ? ' godam-button-cta--image' : '' ) +
			( isSticker ? ' godam-button-cta--sticker' : '' ) +
			( style.attention !== 'none' ? ` godam-button-cta--attn-${ style.attention }` : '' );

		if ( isImage ) {
			// Sticker / image variant: the uploaded graphic IS the button. Mirrors
			// the hotspot custom-icon render (objectFit + onerror fallback). Width
			// is applied to the anchor in positionButton (a % of content width).
			const img = document.createElement( 'img' );
			img.src = style.imageUrl;
			img.alt = button.text || __( 'Button', 'godam' );
			img.onerror = () => {
				img.remove();
				buttonEl.classList.remove( 'godam-button-cta--image' );
				buttonEl.style.width = '';
				buttonEl.textContent = button.text || __( 'Button', 'godam' );
			};
			buttonEl.appendChild( img );
		} else {
			// textContent (never innerHTML) keeps author-entered labels inert.
			const label = button.text || __( 'Button', 'godam' );
			buttonEl.textContent = label;
			// Sticker variant duplicates the label via ::before/::after (see
			// `_button-cta.scss`), which read it from `data-sticker-text`.
			if ( isSticker ) {
				buttonEl.setAttribute( 'data-sticker-text', label );
			}
		}

		if ( button.link ) {
			buttonEl.href = button.link;
			buttonEl.target = '_blank';
			buttonEl.rel = 'noopener noreferrer';
		}

		buttonEl.style.position = 'absolute';

		// Colours ride as inline CSS custom properties so idle + :hover + alpha are
		// all expressible from the stylesheet (plain inline styles can't do :hover).
		buttonEl.style.setProperty( '--godam-btn-bg', style.bgColor );
		buttonEl.style.setProperty( '--godam-btn-text', style.textColor );
		buttonEl.style.setProperty( '--godam-btn-hover-bg', style.hoverBgColor );
		buttonEl.style.setProperty( '--godam-btn-hover-text', style.hoverTextColor );

		this.positionButton( buttonEl, button );
		this.setupHoverEvents( buttonEl, layerObj.pauseOnHover );

		buttonEl.addEventListener( 'click', () => {
			this.emitButtonClick( layerObj.layer, button, index );
		} );

		return buttonEl;
	}

	/**
	 * Position a button element at its percentage coordinate, offset into the
	 * video content box so it stays aligned over letterboxed / pillarboxed video.
	 *
	 * @param {HTMLElement} buttonEl The button element.
	 * @param {Object}      button   Button configuration object.
	 */
	positionButton( buttonEl, button ) {
		const contentRect = this.computeContentRect();
		if ( ! contentRect ) {
			return;
		}

		const posX = button.position?.x ?? 50;
		const posY = button.position?.y ?? 50;

		buttonEl.style.left = `${ contentRect.left + ( ( posX / 100 ) * contentRect.width ) }px`;
		buttonEl.style.top = `${ contentRect.top + ( ( posY / 100 ) * contentRect.height ) }px`;

		// Sticker / image buttons size relative to the video content width (height
		// follows the image aspect ratio), so re-apply width on every reposition.
		const style = resolveButtonCtaStyle( button );
		if ( isImageButtonVariant( style.variant ) && style.imageUrl ) {
			buttonEl.style.width = `${ ( style.size / 100 ) * contentRect.width }px`;
		}
	}

	/**
	 * Pause the video while a button is hovered (opt-in per layer), mirroring the
	 * Hotspot layer's pause-on-hover behaviour.
	 *
	 * @param {HTMLElement} buttonEl     The button element.
	 * @param {boolean}     pauseOnHover Whether to pause playback on hover.
	 */
	setupHoverEvents( buttonEl, pauseOnHover = false ) {
		buttonEl.addEventListener( 'mouseenter', () => {
			if ( pauseOnHover ) {
				this.wasPlayingBeforeHover = ! this.player.paused();
				this.player.pause();
			}
		} );

		buttonEl.addEventListener( 'mouseleave', () => {
			if ( pauseOnHover && this.wasPlayingBeforeHover ) {
				this.player.play();
			}
		} );
	}

	/**
	 * Reposition every button (e.g. after a resize or fullscreen change).
	 */
	updateButtonPositions() {
		this.buttonCtaLayers.forEach( ( layerObj ) => {
			const buttonEls = layerObj.layerElement.querySelectorAll( '.godam-button-cta' );
			buttonEls.forEach( ( buttonEl, index ) => {
				const button = layerObj.buttons[ index ];
				if ( button ) {
					this.positionButton( buttonEl, button );
				}
			} );
		} );
	}

	/**
	 * Handle fullscreen changes: re-parent layers into the player container and
	 * reposition once layout settles.
	 *
	 * @param {boolean}     isFullscreen   Whether the player is in fullscreen.
	 * @param {HTMLElement} videoContainer The video container element.
	 */
	handleFullscreenChange( isFullscreen, videoContainer ) {
		this.buttonCtaLayers.forEach( ( layerObj ) => {
			if ( isFullscreen && ! videoContainer.contains( layerObj.layerElement ) ) {
				videoContainer.appendChild( layerObj.layerElement );
			}
		} );

		let framesToWait = 2;
		const waitForResize = () => {
			if ( framesToWait > 0 ) {
				framesToWait--;
				window.requestAnimationFrame( waitForResize );
			} else {
				this.updateButtonPositions();
			}
		};
		window.requestAnimationFrame( waitForResize );
	}

	/**
	 * Compute the video content rectangle (accounting for letterbox / pillarbox).
	 *
	 * @return {Object|null} Content rectangle {left, top, width, height} or null.
	 */
	computeContentRect() {
		const videoEl = this.player.tech( true )?.el() || this.player.el().querySelector( 'video' );
		const containerEl = this.player.el();

		if ( ! videoEl || ! containerEl ) {
			return null;
		}

		const nativeW = videoEl.videoWidth || this.player.videoWidth() || 0;
		const nativeH = videoEl.videoHeight || this.player.videoHeight() || 0;

		const elW = containerEl.offsetWidth;
		const elH = containerEl.offsetHeight;

		// If video dimensions aren't loaded yet, use the full container.
		if ( ! nativeW || ! nativeH ) {
			return { left: 0, top: 0, width: elW, height: elH };
		}

		const videoAspectRatio = nativeW / nativeH;
		const containerAspectRatio = elW / elH;

		let contentW, contentH, offsetX, offsetY;

		if ( containerAspectRatio > videoAspectRatio ) {
			// Pillarboxed (black bars on left/right).
			contentH = elH;
			contentW = elH * videoAspectRatio;
			offsetX = ( elW - contentW ) / 2;
			offsetY = 0;
		} else {
			// Letterboxed (black bars on top/bottom).
			contentW = elW;
			contentH = elW / videoAspectRatio;
			offsetX = 0;
			offsetY = ( elH - contentH ) / 2;
		}

		return {
			left: Math.round( offsetX ),
			top: Math.round( offsetY ),
			width: Math.round( contentW ),
			height: Math.round( contentH ),
		};
	}

	/**
	 * Emit a layer-level analytics event (e.g. `viewed`), deduped once per layer
	 * per page-session.
	 *
	 * @param {Object} layer      Layer config (.id required).
	 * @param {string} actionType e.g. 'viewed'.
	 */
	emitLayerEvent( layer, actionType ) {
		const layerId = layer?.id ? String( layer.id ) : '';
		if ( ! layerId ) {
			return;
		}
		this.writeEvent( {
			dedupeKey: layerId,
			actionType,
			layerId,
			layerType: layer?.type || 'button-cta',
			layerTimestamp: parseFloat( layer?.displayTime ) || 0,
			layerName: getLayerDisplayName( layer, layer?.type || 'button-cta' ),
		} );
	}

	/**
	 * Emit a per-button `clicked` event, deduped per button per page-session.
	 *
	 * @param {Object} layer  Parent layer config.
	 * @param {Object} button Button config.
	 * @param {number} index  Button index within the layer.
	 */
	emitButtonClick( layer, button, index ) {
		const parentId = layer?.id ? String( layer.id ) : '';
		if ( ! parentId ) {
			return;
		}
		const subId = button?.id ? String( button.id ) : `idx${ index }`;
		const compositeId = `${ parentId }::${ subId }`;
		const parentName = getLayerDisplayName( layer, layer?.type || 'button-cta' );
		// Image/sticker buttons have no text, so give analytics a readable label.
		let subLabel = button?.text;
		if ( ! subLabel ) {
			subLabel = isImageButtonVariant( button?.variant ) ? `Image ${ index + 1 }` : `Button ${ index + 1 }`;
		}

		this.writeEvent( {
			dedupeKey: compositeId,
			actionType: 'clicked',
			layerId: compositeId,
			layerType: layer?.type || 'button-cta',
			layerTimestamp: parseFloat( layer?.displayTime ) || 0,
			layerName: parentName ? `${ parentName } — ${ subLabel }` : String( subLabel ),
			metadata: {
				parent_layer_id: parentId,
				parent_layer_name: parentName,
				button_index: index,
				button_id: button?.id ? String( button.id ) : '',
				button_link: button?.link || '',
			},
		} );
	}

	/**
	 * Write a deduped analytics event via the GoDAM buffer.
	 *
	 * @param {Object} params                Event parameters.
	 * @param {string} params.dedupeKey      Key for per-(key, action, session) dedupe.
	 * @param {string} params.actionType     Action type (e.g. 'viewed', 'clicked').
	 * @param {string} params.layerId        layer_id written on the event.
	 * @param {string} params.layerType      layer_type written on the event.
	 * @param {number} params.layerTimestamp layer_timestamp written on the event.
	 * @param {string} params.layerName      layer_name written on the event.
	 * @param {Object} [params.metadata]     Extra fields merged into layer_metadata.
	 */
	writeEvent( { dedupeKey, actionType, layerId, layerType, layerTimestamp, layerName, metadata } ) {
		if ( ! window.GoDAM || typeof window.GoDAM.addLayerInteraction !== 'function' ) {
			return;
		}

		const videoKey = getVideoKey( this.player );
		if ( ! videoKey ) {
			return;
		}

		let fired = this._dedupeFired.get( dedupeKey );
		if ( ! fired ) {
			fired = new Set();
			this._dedupeFired.set( dedupeKey, fired );
		}
		if ( fired.has( actionType ) ) {
			return;
		}
		fired.add( actionType );

		window.GoDAM.addLayerInteraction( videoKey, {
			layer_id: layerId,
			layer_type: layerType,
			action_type: actionType,
			layer_timestamp: layerTimestamp,
			layer_name: layerName,
			page_url: window.location.href,
			layer_metadata: metadata || {},
		} );
	}

	/**
	 * Reset manager state.
	 */
	reset() {
		this.buttonCtaLayers = [];
		this.wasPlayingBeforeHover = false;
	}
}
