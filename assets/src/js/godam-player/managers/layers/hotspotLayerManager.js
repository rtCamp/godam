/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { HOTSPOT_CONSTANTS } from '../../utils/constants';
import { getLayerDisplayName } from '../../utils/layerActions.js';

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
 * Hotspot Layer Manager
 * Handles hotspot layer functionality including creation, positioning, and interaction
 */
export default class HotspotLayerManager {
	static BASE_WIDTH = HOTSPOT_CONSTANTS.BASE_WIDTH;
	static BASE_HEIGHT = HOTSPOT_CONSTANTS.BASE_HEIGHT;

	constructor( player, isDisplayingLayers, currentPlayerVideoInstanceId ) {
		this.player = player;
		this.hotspotLayers = [];
		this.wasPlayingBeforeHover = false;
		this.isDisplayingLayers = isDisplayingLayers;
		this.currentPlayerVideoInstanceId = currentPlayerVideoInstanceId;

		// Per-(composite layer_id, action_type, page-session) dedupe map.
		// Composite layer_id is `${parentLayer.id}::${hotspot.id || `idx${index}`}`
		// so each sub-hotspot is its own atomic unit in the analytics.
		// Map<compositeLayerId, Set<actionType>>.
		this._dedupeFired = new Map();

		// First-visible timestamp keyed by composite layer_id (epoch ms).
		// Used to compute dwell_ms on click/hover. Map<compositeLayerId, number>.
		this._firstVisibleAt = new Map();

		// Snapshot of `window.GoDAM.getTabHiddenAccumulatedMs()` at the moment
		// `_firstVisibleAt` is set — subtracted from wall-clock dwell so tab-
		// away time doesn't inflate "consideration time" reporting.
		// Map<compositeLayerId | parentLayerId, number>.
		this._hiddenAtFirstVisible = new Map();

		// Interaction sequence keyed by composite layer_id. Map<compositeLayerId, number>.
		this._interactionSeq = new Map();
	}

	/**
	 * Build a stable composite layer_id for a sub-hotspot.
	 *
	 * Prefers the hotspot's own `id` field (a UUID set by the editor) so
	 * reordering or removing hotspots doesn't shift the analytics key.
	 * Falls back to `idx<index>` only when no stable id is available — in
	 * which case reordering will misattribute, documented as a known limit.
	 *
	 * @param {Object} parentLayer Parent layer config with an .id field.
	 * @param {Object} hotspot     Individual hotspot config.
	 * @param {number} index       Position within parentLayer.hotspots.
	 * @return {string} Composite layer_id, e.g. `<uuid>::<sub-uuid>` or `<uuid>::idx0`.
	 */
	buildCompositeLayerId( parentLayer, hotspot, index ) {
		const parentId = parentLayer?.id ? String( parentLayer.id ) : '';
		if ( ! parentId ) {
			return '';
		}
		const subId = hotspot?.id ? String( hotspot.id ) : `idx${ index }`;
		return `${ parentId }::${ subId }`;
	}

	/**
	 * Emit a sub-hotspot interaction event into the localStorage buffer.
	 *
	 * Sub-hotspots emit engagement events only — `hovered` and `clicked`.
	 * Parent-level `viewed` is the layer-wide visibility signal and is
	 * emitted separately via emitParentLayerEvent. All sub-hotspots in one
	 * parent layer become visible at the same moment, so per-sub `viewed`
	 * counts would be N redundant copies of the parent's visibility count;
	 * the backend's per-parent aggregation pass derives "All Hotspots
	 * (Aggregate)" engagement by grouping sub events by `parent_layer_id`.
	 *
	 * All actions deduped per (composite layer_id, action_type, page-session)
	 * — one clicked, one hovered per sub-hotspot per session at most.
	 *
	 * Enriches every event with parent_layer_id, parent_layer_name,
	 * hotspot_index, dwell_ms, current_video_time, is_fullscreen,
	 * interaction_seq so the UI can group sub-hotspots by parent layer
	 * without parsing composite ids, and future analytics questions can
	 * be answered without re-instrumenting.
	 *
	 * @param {Object} parentLayer Parent layer config (has id, type, displayTime, name).
	 * @param {Object} hotspot     Individual hotspot config.
	 * @param {number} index       Hotspot's position in parentLayer.hotspots.
	 * @param {string} actionType  e.g. 'clicked', 'hovered'.
	 * @param {Object} [metadata]  Extra fields merged into layer_metadata.
	 */
	emitHotspotEvent( parentLayer, hotspot, index, actionType, metadata ) {
		if ( ! window.GoDAM || typeof window.GoDAM.addLayerInteraction !== 'function' ) {
			return;
		}

		const videoKey = getVideoKey( this.player );
		if ( ! videoKey ) {
			return;
		}

		const compositeLayerId = this.buildCompositeLayerId( parentLayer, hotspot, index );
		if ( ! compositeLayerId ) {
			return;
		}

		// Per-(composite layer_id, action_type, session) dedupe.
		let firedActions = this._dedupeFired.get( compositeLayerId );
		if ( ! firedActions ) {
			firedActions = new Set();
			this._dedupeFired.set( compositeLayerId, firedActions );
		}
		if ( firedActions.has( actionType ) ) {
			return;
		}
		firedActions.add( actionType );

		// Dwell measures consideration time — gap between parent visibility
		// and this sub-hotspot interaction, minus time the tab was hidden
		// during that window. Sub-hotspots no longer emit `viewed` themselves,
		// so we fall back to the parent's first-visible timestamp keyed on
		// parentLayer.id (seeded by emitParentLayerEvent).
		const parentLayerId = parentLayer?.id ? String( parentLayer.id ) : '';
		let firstVisibleAt = this._firstVisibleAt.get( compositeLayerId );
		let hiddenAtStart = this._hiddenAtFirstVisible.get( compositeLayerId );
		if ( ! firstVisibleAt && parentLayerId ) {
			firstVisibleAt = this._firstVisibleAt.get( parentLayerId );
			hiddenAtStart = this._hiddenAtFirstVisible.get( parentLayerId );
		}
		let dwellMs = 0;
		if ( firstVisibleAt ) {
			const wallMs = Date.now() - firstVisibleAt;
			const hiddenNow = window.GoDAM?.getTabHiddenAccumulatedMs?.() || 0;
			dwellMs = Math.max( 0, wallMs - ( hiddenNow - ( hiddenAtStart || 0 ) ) );
		}

		const prevSeq = this._interactionSeq.get( compositeLayerId ) || 0;
		const seq = prevSeq + 1;
		this._interactionSeq.set( compositeLayerId, seq );

		let currentVideoTime = 0;
		try {
			currentVideoTime = Number( this.player?.currentTime?.() ) || 0;
		} catch ( e ) {
			currentVideoTime = 0;
		}

		let isFullscreen = false;
		try {
			isFullscreen = !! this.player?.isFullscreen?.();
		} catch ( e ) {
			isFullscreen = false;
		}

		// Device + viewer context for v1.5 slicing dimensions
		// (conversion-by-device, first-touch vs returning-viewer).
		const deviceType = window.GoDAM?.getDeviceType?.() || 'desktop';
		const wasFirstView = window.GoDAM?.wasFirstViewForVideo?.( videoKey ) || false;

		// `parent_layer_name` carries the resolved display name (custom if set,
		// otherwise `<TypeLabel> layer at <t>s`) so backend `argMax` aggregation
		// and the per-parent timeline marker have a non-UUID label even when
		// the marketer hasn't named the layer.
		const parentLayerName = getLayerDisplayName(
			parentLayer,
			parentLayer?.type || 'hotspot',
		);

		// Sub-hotspot label: "<parentName> — Hotspot N". Fallback to
		// "Hotspot N" alone if the parent name is missing (defensive — should
		// always be populated via getLayerDisplayName above).
		const subLabel = hotspot?.name || hotspot?.label || hotspot?.title || `Hotspot ${ index + 1 }`;
		const compositeName = parentLayerName ? `${ parentLayerName } — ${ subLabel }` : String( subLabel );

		const enrichedMetadata = {
			parent_layer_id: parentLayerId,
			parent_layer_name: parentLayerName,
			hotspot_index: index,
			hotspot_id: hotspot?.id ? String( hotspot.id ) : '',
			hotspot_link: hotspot?.link || '',
			dwell_ms: dwellMs,
			current_video_time: currentVideoTime,
			is_fullscreen: isFullscreen,
			interaction_seq: seq,
			device_type: deviceType,
			was_first_view: wasFirstView,
			...( metadata || {} ),
		};

		window.GoDAM.addLayerInteraction( videoKey, {
			layer_id: compositeLayerId,
			layer_type: parentLayer?.type || 'hotspot',
			action_type: actionType,
			layer_timestamp: parseFloat( parentLayer?.displayTime ) || 0,
			layer_name: compositeName,
			page_url: window.location.href,
			layer_metadata: enrichedMetadata,
		} );
	}

	/**
	 * Emit a parent-layer interaction event (no sub-hotspot identity).
	 *
	 * Used for events that belong to the layer as a whole rather than to a
	 * single sub-hotspot — currently just `viewed`, which fires once when
	 * the layer becomes visible. Engagement actions (hovered / clicked)
	 * stay per-sub-hotspot; the godam-analytics processing pipeline
	 * aggregates those by parent_layer_id for the "All Hotspots
	 * (Aggregate)" funnel.
	 *
	 * `layer_id` = `parentLayer.id` (no `::sub` suffix). Deduped per
	 * (layer_id, action_type, session) via the same _dedupeFired map that
	 * gates sub-hotspot events — so a viewer who briefly sees the layer
	 * twice within one pageload only emits one `viewed`. Also seeds
	 * `_firstVisibleAt` keyed on the parent's id, so sub-hotspot dwell
	 * measures from layer visibility rather than from first sub-event.
	 *
	 * @param {Object} parentLayer Parent layer config (.id required; .name / .displayTime / .type preferred).
	 * @param {string} actionType  e.g. 'viewed'.
	 * @param {Object} [metadata]  Extra fields merged into layer_metadata.
	 */
	emitParentLayerEvent( parentLayer, actionType, metadata ) {
		if ( ! window.GoDAM || typeof window.GoDAM.addLayerInteraction !== 'function' ) {
			return;
		}

		const videoKey = getVideoKey( this.player );
		if ( ! videoKey ) {
			return;
		}

		const parentLayerId = parentLayer?.id ? String( parentLayer.id ) : '';
		if ( ! parentLayerId ) {
			return;
		}

		// Shared dedupe map — parent's key (bare id) and sub-hotspots'
		// composite keys (parent::sub) can't collide.
		let firedActions = this._dedupeFired.get( parentLayerId );
		if ( ! firedActions ) {
			firedActions = new Set();
			this._dedupeFired.set( parentLayerId, firedActions );
		}
		if ( firedActions.has( actionType ) ) {
			return;
		}
		firedActions.add( actionType );

		const firstVisibleAt = this._firstVisibleAt.get( parentLayerId );
		let dwellMs = 0;
		if ( actionType === 'viewed' ) {
			this._firstVisibleAt.set( parentLayerId, Date.now() );
			this._hiddenAtFirstVisible.set(
				parentLayerId,
				window.GoDAM?.getTabHiddenAccumulatedMs?.() || 0,
			);
		} else if ( firstVisibleAt ) {
			const wallMs = Date.now() - firstVisibleAt;
			const hiddenAtStart = this._hiddenAtFirstVisible.get( parentLayerId ) || 0;
			const hiddenNow = window.GoDAM?.getTabHiddenAccumulatedMs?.() || 0;
			dwellMs = Math.max( 0, wallMs - ( hiddenNow - hiddenAtStart ) );
		}

		const prevSeq = this._interactionSeq.get( parentLayerId ) || 0;
		const seq = prevSeq + 1;
		this._interactionSeq.set( parentLayerId, seq );

		let currentVideoTime = 0;
		try {
			currentVideoTime = Number( this.player?.currentTime?.() ) || 0;
		} catch ( e ) {
			currentVideoTime = 0;
		}

		let isFullscreen = false;
		try {
			isFullscreen = !! this.player?.isFullscreen?.();
		} catch ( e ) {
			isFullscreen = false;
		}

		const deviceType = window.GoDAM?.getDeviceType?.() || 'desktop';
		const wasFirstView = window.GoDAM?.wasFirstViewForVideo?.( videoKey ) || false;
		const parentLayerName = getLayerDisplayName(
			parentLayer,
			parentLayer?.type || 'hotspot',
		);

		const enrichedMetadata = {
			parent_layer_id: parentLayerId,
			parent_layer_name: parentLayerName,
			dwell_ms: dwellMs,
			current_video_time: currentVideoTime,
			is_fullscreen: isFullscreen,
			interaction_seq: seq,
			device_type: deviceType,
			was_first_view: wasFirstView,
			...( metadata || {} ),
		};

		window.GoDAM.addLayerInteraction( videoKey, {
			layer_id: parentLayerId,
			layer_type: parentLayer?.type || 'hotspot',
			action_type: actionType,
			layer_timestamp: parseFloat( parentLayer?.displayTime ) || 0,
			layer_name: parentLayerName,
			page_url: window.location.href,
			layer_metadata: enrichedMetadata,
		} );
	}

	/**
	 * Setup hotspot layer
	 *
	 * @param {Object}      layer        - Layer configuration object
	 * @param {HTMLElement} layerElement - Layer DOM element
	 */
	setupHotspotLayer( layer, layerElement ) {
		const layerObj = {
			layerElement,
			displayTime: parseFloat( layer.displayTime ),
			duration: layer.duration ? parseInt( layer.duration ) : 0,
			show: true,
			hotspots: layer.hotspots || [],
			pauseOnHover: layer.pauseOnHover || false,
			// Stash the original config so emitLayerEvent has access to id/name/type.
			layer,
		};

		this.hotspotLayers.push( layerObj );
	}

	/**
	 * Handle hotspot layers time update
	 *
	 * @param {number} currentTime - Current video time in seconds
	 */
	handleHotspotLayersTimeUpdate( currentTime ) {
		const blockedByLayer = this.isDisplayingLayers?.[ this.currentPlayerVideoInstanceId ] === true;

		this.hotspotLayers.forEach( ( layerObj ) => {
			if ( ! layerObj.show ) {
				return;
			}

			const endTime = layerObj.displayTime + layerObj.duration;
			const isActive = currentTime >= layerObj.displayTime && currentTime < endTime;

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
					// Parent-level `viewed` fires once per session when the
					// layer first becomes visible. Sub-hotspots don't emit
					// their own `viewed` — every hotspot inside one parent
					// layer becomes visible at the same moment, so per-sub
					// `viewed` counts would all be identical to this one.
					// Engagement (hovered / clicked) is still emitted per
					// sub-hotspot; the backend aggregates those by
					// parent_layer_id for the "All Hotspots" funnel.
					this.emitParentLayerEvent( layerObj.layer, 'viewed' );
					if ( ! layerObj.layerElement.dataset?.hotspotsInitialized ) {
						this.createHotspots( layerObj );
						layerObj.layerElement.dataset.hotspotsInitialized = true;
					} else {
						requestAnimationFrame( () => {
							const hotspotDivs = layerObj.layerElement.querySelectorAll( '.hotspot' );
							hotspotDivs.forEach( ( hotspotDiv ) => {
								const tooltipDiv = hotspotDiv.querySelector( '.hotspot-tooltip' );
								if ( tooltipDiv ) {
									this.positionTooltip( hotspotDiv, tooltipDiv );
								}
							} );
						} );
					}
				}
			} else if ( ! layerObj.layerElement.classList.contains( 'hidden' ) ) {
				layerObj.layerElement.classList.add( 'hidden' );
			}
		} );
	}

	/**
	 * Handle fullscreen changes for hotspot layers
	 *
	 * @param {boolean}     isFullscreen   - Whether player is in fullscreen
	 * @param {HTMLElement} videoContainer - Video container element
	 */
	handleFullscreenChange( isFullscreen, videoContainer ) {
		this.hotspotLayers.forEach( ( layerObj ) => {
			if ( isFullscreen && ! videoContainer.contains( layerObj.layerElement ) ) {
				videoContainer.appendChild( layerObj.layerElement );
			}
		} );

		// Use requestAnimationFrame to wait for layout to stabilize after fullscreen resize
		let framesToWait = 2;
		const waitForResize = () => {
			if ( framesToWait > 0 ) {
				framesToWait--;
				window.requestAnimationFrame( waitForResize );
			} else {
				this.updateHotspotPositions();
			}
		};
		window.requestAnimationFrame( waitForResize );
	}

	/**
	 * Create hotspots for a layer
	 *
	 * @param {Object} layerObj - Layer object containing hotspots and configuration
	 */
	createHotspots( layerObj ) {
		const videoContainer = this.player.el();
		const containerWidth = videoContainer?.offsetWidth;
		const containerHeight = videoContainer?.offsetHeight;

		const baseWidth = HotspotLayerManager.BASE_WIDTH;
		const baseHeight = HotspotLayerManager.BASE_HEIGHT;

		layerObj.hotspots.forEach( ( hotspot, index ) => {
			const hotspotDiv = this.createHotspotElement( hotspot, index, containerWidth, containerHeight, baseWidth, baseHeight );

			if ( layerObj.pauseOnHover ) {
				this.setupHotspotHoverEvents( hotspotDiv );
			}

			// Track per-hotspot interactions. The layer event carries the
			// hotspot's index + link in `layer_metadata` so the analytics UI
			// can later attribute conversion per sub-hotspot if needed.
			this.setupHotspotAnalytics( hotspotDiv, layerObj, hotspot, index );

			layerObj.layerElement.appendChild( hotspotDiv );

			const tooltipDiv = hotspotDiv.querySelector( '.hotspot-tooltip' );
			if ( tooltipDiv ) {
				requestAnimationFrame( () => {
					this.positionTooltip( hotspotDiv, tooltipDiv );
				} );
			}
		} );
	}

	/**
	 * Attach click + hover analytics handlers to a single hotspot element.
	 *
	 * Both actions deduped per (composite layer_id, page-session) inside
	 * emitHotspotEvent — one click per sub-hotspot per session, one hover
	 * per sub-hotspot per session. Matches the analytical question "did the
	 * viewer click this hotspot at least once?" — repeat clicks within the
	 * same session aren't more meaningful for conversion-rate analysis.
	 *
	 * @param {HTMLElement} hotspotDiv The hotspot DOM element.
	 * @param {Object}      layerObj   The owning layer object.
	 * @param {Object}      hotspot    The hotspot config (link, text, index).
	 * @param {number}      index      The hotspot's index inside layerObj.hotspots.
	 */
	setupHotspotAnalytics( hotspotDiv, layerObj, hotspot, index ) {
		hotspotDiv.addEventListener( 'click', ( ev ) => {
			// Skip clicks on the tooltip-close affordance, which fires its own
			// handler and shouldn't be counted as a conversion click.
			if ( ev.target?.closest?.( '.hotspot-tooltip-close' ) ) {
				return;
			}
			this.emitHotspotEvent( layerObj.layer, hotspot, index, 'clicked' );
		} );

		hotspotDiv.addEventListener( 'mouseenter', () => {
			this.emitHotspotEvent( layerObj.layer, hotspot, index, 'hovered' );
		} );
	}

	/**
	 * Compute content rectangle
	 *
	 * @return {Object|null} Content rectangle {left, top, width, height} or null
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

		// If video dimensions aren't loaded yet, use full container
		if ( ! nativeW || ! nativeH ) {
			return {
				left: 0,
				top: 0,
				width: elW,
				height: elH,
			};
		}

		const videoAspectRatio = nativeW / nativeH;
		const containerAspectRatio = elW / elH;

		let contentW, contentH, offsetX, offsetY;

		if ( containerAspectRatio > videoAspectRatio ) {
			// Pillarboxed (black bars on left/right)
			contentH = elH;
			contentW = elH * videoAspectRatio;
			offsetX = ( elW - contentW ) / 2;
			offsetY = 0;
		} else {
			// Letterboxed (black bars on top/bottom)
			contentW = elW;
			contentH = elW / videoAspectRatio;
			offsetX = 0;
			offsetY = ( elH - contentH ) / 2;
		}

		const result = {
			left: Math.round( offsetX ),
			top: Math.round( offsetY ),
			width: Math.round( contentW ),
			height: Math.round( contentH ),
		};

		return result;
	}

	/**
	 * Create hotspot element
	 *
	 * @param {Object} hotspot         - Hotspot configuration object
	 * @param {number} index           - Index of the hotspot
	 * @param {number} containerWidth  - Width of the video container
	 * @param {number} containerHeight - Height of the video container
	 * @param {number} baseWidth       - Base width for calculations
	 * @param {number} baseHeight      - Base height for calculations
	 * @return {HTMLElement} Created hotspot element
	 */
	createHotspotElement( hotspot, index, containerWidth, containerHeight, baseWidth, baseHeight ) {
		const hotspotDiv = document.createElement( 'div' );
		hotspotDiv.classList.add( 'hotspot', 'circle' );
		hotspotDiv.style.position = 'absolute';

		const contentRect = this.computeContentRect();

		// Positioning
		const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
		const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;

		let fallbackDiameter = hotspot.oSize?.diameter ?? hotspot.size?.diameter;
		if ( ! fallbackDiameter ) {
			if ( hotspot.unit === 'percent' && contentRect ) {
				fallbackDiameter = ( HOTSPOT_CONSTANTS.DEFAULT_DIAMETER_PX / contentRect.width ) * 100;
			} else {
				fallbackDiameter = hotspot.unit === 'percent' ? HOTSPOT_CONSTANTS.DEFAULT_DIAMETER_PERCENT : HOTSPOT_CONSTANTS.DEFAULT_DIAMETER_PX;
			}
		}

		let pixelX, pixelY, pixelDiameter;

		if ( hotspot.unit === 'percent' && contentRect ) {
			// New percentage-based positioning
			pixelX = contentRect.left + ( ( fallbackPosX / 100 ) * contentRect.width );
			pixelY = contentRect.top + ( ( fallbackPosY / 100 ) * contentRect.height );
			pixelDiameter = ( fallbackDiameter / 100 ) * contentRect.width;
		} else {
			// Legacy pixel-based positioning (relative to 800x600)
			// We now map these to the contentRect instead of the full container to avoid black bars
			const effectiveRect = contentRect || { left: 0, top: 0, width: containerWidth, height: containerHeight };
			pixelX = effectiveRect.left + ( ( fallbackPosX / baseWidth ) * effectiveRect.width );
			pixelY = effectiveRect.top + ( ( fallbackPosY / baseHeight ) * effectiveRect.height );
			pixelDiameter = ( fallbackDiameter / baseWidth ) * effectiveRect.width;
		}

		hotspotDiv.style.left = `${ pixelX }px`;
		hotspotDiv.style.top = `${ pixelY }px`;
		hotspotDiv.style.width = `${ pixelDiameter }px`;
		hotspotDiv.style.height = `${ pixelDiameter }px`;

		// Background color
		hotspotDiv.style.backgroundColor = ( hotspot.icon || hotspot.customIconUrl ) ? 'white' : ( hotspot.backgroundColor || '#0c80dfa6' );

		// Create content
		const hotspotContent = this.createHotspotContent( hotspot, index, hotspotDiv );
		hotspotDiv.appendChild( hotspotContent );

		return hotspotDiv;
	}

	/**
	 * Create hotspot content
	 *
	 * @param {Object}      hotspot    - Hotspot configuration object
	 * @param {number}      index      - Index of the hotspot
	 * @param {HTMLElement} hotspotDiv - Parent hotspot div element
	 * @return {HTMLElement} Created content element
	 */
	createHotspotContent( hotspot, index, hotspotDiv ) {
		const hotspotContent = document.createElement( 'div' );
		hotspotContent.classList.add( 'hotspot-content' );
		hotspotContent.style.position = 'relative';
		hotspotContent.style.width = '100%';
		hotspotContent.style.height = '100%';

		if ( hotspot.icon ) {
			const iconEl = this.createHotspotIcon( hotspot.icon );
			hotspotContent.appendChild( iconEl );
		} else if ( hotspot.customIconUrl ) {
			const customIconEl = this.createCustomIcon( hotspot.customIconUrl, hotspot.backgroundColor, hotspotDiv );
			hotspotContent.appendChild( customIconEl );
		} else {
			hotspotContent.classList.add( 'no-icon' );
		}

		const tooltipDiv = this.createHotspotTooltip( hotspot, index );
		hotspotContent.appendChild( tooltipDiv );

		return hotspotContent;
	}

	/**
	 * Create hotspot icon
	 *
	 * @param {string} icon - Icon configuration or path
	 * @return {HTMLElement} Created icon element
	 */
	createHotspotIcon( icon ) {
		const iconEl = document.createElement( 'i' );
		iconEl.className = `fa-solid fa-${ icon }`;
		iconEl.style.width = '50%';
		iconEl.style.height = '50%';
		iconEl.style.fontSize = '1.6em';
		iconEl.style.display = 'flex';
		iconEl.style.alignItems = 'center';
		iconEl.style.justifyContent = 'center';
		iconEl.style.margin = 'auto';
		iconEl.style.color = '#000';

		return iconEl;
	}

	/**
	 * Create custom icon element
	 *
	 * @param {string}      customIconUrl   - URL of the custom icon
	 * @param {string}      backgroundColor - Background color for fallback
	 * @param {HTMLElement} hotspotDiv      - Parent hotspot div element
	 * @return {HTMLElement} Created custom icon element
	 */
	createCustomIcon( customIconUrl, backgroundColor, hotspotDiv ) {
		const customIconEl = document.createElement( 'img' );
		customIconEl.src = customIconUrl;
		customIconEl.alt = __( 'Custom Icon', 'godam' );
		customIconEl.style.width = '50%';
		customIconEl.style.height = '50%';
		customIconEl.style.maxWidth = '100%';
		customIconEl.style.maxHeight = '100%';
		customIconEl.style.objectFit = 'contain';
		customIconEl.style.display = 'block';
		customIconEl.style.margin = 'auto';
		customIconEl.style.pointerEvents = 'none';

		// Add error handling for failed image loads - convert to normal hotspot point
		customIconEl.onerror = function() {
			// Remove the failed image element
			customIconEl.remove();

			// Get the hotspot content container
			const hotspotContent = hotspotDiv?.querySelector( '.hotspot-content' );
			if ( hotspotContent ) {
				// Add no-icon class to show as normal hotspot
				hotspotContent.classList.add( 'no-icon' );
			}

			// Reset hotspot background to default (non-icon) color
			if ( hotspotDiv ) {
				hotspotDiv.style.backgroundColor = backgroundColor || '#0c80dfa6';
			}
		};

		return customIconEl;
	}

	/**
	 * Create hotspot tooltip
	 *
	 * @param {Object} hotspot - Hotspot configuration object
	 * @param {number} index   - Index of the hotspot
	 * @return {HTMLElement} Created tooltip element
	 */
	createHotspotTooltip( hotspot, index ) {
		const tooltipDiv = document.createElement( 'div' );
		tooltipDiv.classList.add( 'hotspot-tooltip' );
		/* translators: %d: hotspot number */
		tooltipDiv.textContent = hotspot.tooltipText || sprintf( __( 'Hotspot %d', 'godam' ), index + 1 );

		if ( hotspot.link ) {
			const hotspotLink = document.createElement( 'a' );
			hotspotLink.href = hotspot.link;
			hotspotLink.target = '_blank';
			/* translators: %d: hotspot number */
			hotspotLink.textContent = hotspot.tooltipText || sprintf( __( 'Hotspot %d', 'godam' ), index + 1 );
			tooltipDiv.textContent = '';
			tooltipDiv.appendChild( hotspotLink );
		}

		return tooltipDiv;
	}

	/**
	 * Setup hotspot hover events
	 *
	 * @param {HTMLElement} hotspotDiv - The hotspot element to add hover events to
	 */
	setupHotspotHoverEvents( hotspotDiv ) {
		hotspotDiv.addEventListener( 'mouseenter', () => {
			this.wasPlayingBeforeHover = ! this.player.paused();
			this.player.pause();
		} );

		hotspotDiv.addEventListener( 'mouseleave', () => {
			if ( this.wasPlayingBeforeHover ) {
				this.player.play();
			}
		} );
	}

	/**
	 * Position tooltip relative to hotspot, constrained within the video container
	 *
	 * @param {HTMLElement} hotspotDiv - The hotspot element for positioning reference
	 * @param {HTMLElement} tooltipDiv - The tooltip element to position
	 */
	positionTooltip( hotspotDiv, tooltipDiv ) {
		const videoContainer = this.player.el();
		const containerRect = videoContainer.getBoundingClientRect();
		const hotspotRect = hotspotDiv.getBoundingClientRect();

		// Temporarily make tooltip visible to measure it accurately
		const originalVisibility = tooltipDiv.style.visibility;
		const originalOpacity = tooltipDiv.style.opacity;
		tooltipDiv.style.visibility = 'hidden';
		tooltipDiv.style.opacity = '0';
		tooltipDiv.style.display = 'block';

		const tooltipRect = tooltipDiv.getBoundingClientRect();

		// Restore original styles
		tooltipDiv.style.visibility = originalVisibility;
		tooltipDiv.style.opacity = originalOpacity;

		// Calculate space relative to video container (not viewport)
		const spaceAbove = hotspotRect.top - containerRect.top;
		const spaceBelow = containerRect.bottom - hotspotRect.bottom;

		const tooltipHeight = tooltipRect.height;
		const tooltipWidth = tooltipRect.width;

		// Minimum padding from container edges
		const edgePadding = 8;

		// Reset all positioning classes and styles first
		tooltipDiv.classList.remove( 'tooltip-top', 'tooltip-bottom', 'tooltip-left', 'tooltip-right', 'no-arrow' );
		tooltipDiv.style.top = '';
		tooltipDiv.style.bottom = '';
		tooltipDiv.style.left = '';
		tooltipDiv.style.right = '';
		tooltipDiv.style.transform = '';

		// Vertical positioning - prefer above, fallback to below
		if ( spaceAbove >= tooltipHeight + edgePadding ) {
			// Place above
			tooltipDiv.style.bottom = '100%';
			tooltipDiv.style.top = 'auto';
			tooltipDiv.classList.add( 'tooltip-top' );
		} else if ( spaceBelow >= tooltipHeight + edgePadding ) {
			// Place below
			tooltipDiv.style.bottom = 'auto';
			tooltipDiv.style.top = '100%';
			tooltipDiv.classList.add( 'tooltip-bottom' );
		} else if ( spaceAbove >= spaceBelow ) {
			tooltipDiv.style.bottom = '100%';
			tooltipDiv.style.top = 'auto';
			tooltipDiv.classList.add( 'tooltip-top' );
		} else {
			tooltipDiv.style.bottom = 'auto';
			tooltipDiv.style.top = '100%';
			tooltipDiv.classList.add( 'tooltip-bottom' );
		}

		// Horizontal positioning - calculate where tooltip would overflow
		const hotspotCenterInContainer = ( hotspotRect.left + ( hotspotRect.width / 2 ) ) - containerRect.left;
		const tooltipHalfWidth = tooltipWidth / 2;

		// Check if centered tooltip would overflow left or right of container
		const wouldOverflowLeft = ( hotspotCenterInContainer - tooltipHalfWidth ) < edgePadding;
		const wouldOverflowRight = ( hotspotCenterInContainer + tooltipHalfWidth ) > ( containerRect.width - edgePadding );

		if ( wouldOverflowLeft && wouldOverflowRight ) {
			// Tooltip is wider than available space, center it as best as possible
			tooltipDiv.style.left = '50%';
			tooltipDiv.style.transform = 'translateX(-50%)';
			tooltipDiv.classList.add( 'no-arrow' );
		} else if ( wouldOverflowLeft ) {
			// Align tooltip to the left edge of hotspot, but ensure it stays within container
			const leftOffset = Math.max( edgePadding - ( hotspotRect.left - containerRect.left ), 0 );
			tooltipDiv.style.left = `${ leftOffset }px`;
			tooltipDiv.style.right = 'auto';
			tooltipDiv.style.transform = 'translateX(0)';
			tooltipDiv.classList.add( 'tooltip-left', 'no-arrow' );
		} else if ( wouldOverflowRight ) {
			// Align tooltip to the right edge of hotspot, but ensure it stays within container
			const rightOffset = Math.max( edgePadding - ( containerRect.right - hotspotRect.right ), 0 );
			tooltipDiv.style.left = 'auto';
			tooltipDiv.style.right = `${ rightOffset }px`;
			tooltipDiv.style.transform = 'translateX(0)';
			tooltipDiv.classList.add( 'tooltip-right', 'no-arrow' );
		} else {
			// Centered horizontally - tooltip fits within container
			tooltipDiv.style.left = '50%';
			tooltipDiv.style.right = 'auto';
			tooltipDiv.style.transform = 'translateX(-50%)';
		}
	}

	/**
	 * Update hotspot positions on resize
	 */
	updateHotspotPositions() {
		const videoContainer = this.player.el();
		const containerWidth = videoContainer?.offsetWidth;
		const containerHeight = videoContainer?.offsetHeight;

		const baseWidth = HotspotLayerManager.BASE_WIDTH;
		const baseHeight = HotspotLayerManager.BASE_HEIGHT;

		const contentRect = this.computeContentRect();

		this.hotspotLayers.forEach( ( layerObj ) => {
			const isLayerHidden = layerObj.layerElement.classList.contains( 'hidden' );
			const hotspotDivs = layerObj.layerElement.querySelectorAll( '.hotspot' );
			hotspotDivs.forEach( ( hotspotDiv, index ) => {
				const hotspot = layerObj.hotspots[ index ];

				// Recalc position
				const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
				const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;
				const fallbackDiameter = hotspot.oSize?.diameter ?? hotspot.size?.diameter ?? 48;

				let pixelX, pixelY, pixelDiameter;

				if ( hotspot.unit === 'percent' && contentRect ) {
					// New percentage-based positioning
					pixelX = contentRect.left + ( ( fallbackPosX / 100 ) * contentRect.width );
					pixelY = contentRect.top + ( ( fallbackPosY / 100 ) * contentRect.height );
					pixelDiameter = ( fallbackDiameter / 100 ) * contentRect.width;
				} else {
					// Legacy pixel-based positioning
					// We now map these to the contentRect instead of the full container to avoid black bars
					const effectiveRect = contentRect || { left: 0, top: 0, width: containerWidth, height: containerHeight };
					pixelX = effectiveRect.left + ( ( fallbackPosX / baseWidth ) * effectiveRect.width );
					pixelY = effectiveRect.top + ( ( fallbackPosY / baseHeight ) * effectiveRect.height );
					pixelDiameter = ( fallbackDiameter / baseWidth ) * effectiveRect.width;
				}

				hotspotDiv.style.left = `${ pixelX }px`;
				hotspotDiv.style.top = `${ pixelY }px`;
				hotspotDiv.style.width = `${ pixelDiameter }px`;
				hotspotDiv.style.height = `${ pixelDiameter }px`;

				// Tooltip geometry relies on measurable layout; skip while layer is hidden.
				if ( isLayerHidden ) {
					return;
				}

				const tooltipDiv = hotspotDiv.querySelector( '.hotspot-tooltip' );
				if ( tooltipDiv ) {
					requestAnimationFrame( () => {
						this.positionTooltip( hotspotDiv, tooltipDiv );
					} );
				}
			} );
		} );
	}

	/**
	 * Reset hotspot layer state
	 */
	reset() {
		this.hotspotLayers = [];
		this.wasPlayingBeforeHover = false;
	}
}
