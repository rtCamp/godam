/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { HOTSPOT_CONSTANTS } from '../../utils/constants';

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
					if ( ! layerObj.layerElement.dataset?.hotspotsInitialized ) {
						this.createHotspots( layerObj );
						layerObj.layerElement.dataset.hotspotsInitialized = true;
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
		const hotspotContent = this.createHotspotContent( hotspot, index );
		hotspotDiv.appendChild( hotspotContent );

		return hotspotDiv;
	}

	/**
	 * Create hotspot content
	 *
	 * @param {Object} hotspot - Hotspot configuration object
	 * @param {number} index   - Index of the hotspot
	 * @return {HTMLElement} Created content element
	 */
	createHotspotContent( hotspot, index ) {
		const hotspotContent = document.createElement( 'div' );
		hotspotContent.classList.add( 'hotspot-content' );
		hotspotContent.style.position = 'relative';
		hotspotContent.style.width = '100%';
		hotspotContent.style.height = '100%';

		if ( hotspot.icon ) {
			const iconEl = this.createHotspotIcon( hotspot.icon );
			hotspotContent.appendChild( iconEl );
		} else if ( hotspot.customIconUrl ) {
			const customIconEl = this.createCustomIcon( hotspot.customIconUrl );
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
	 * @param {string} customIconUrl - URL of the custom icon
	 * @return {HTMLElement} Created custom icon element
	 */
	createCustomIcon( customIconUrl ) {
		const customIconEl = document.createElement( 'img' );
		customIconEl.src = customIconUrl;
		customIconEl.alt = 'Custom Icon';
		customIconEl.style.width = '50%';
		customIconEl.style.height = '50%';
		customIconEl.style.maxWidth = '100%';
		customIconEl.style.maxHeight = '100%';
		customIconEl.style.objectFit = 'contain';
		customIconEl.style.display = 'block';
		customIconEl.style.margin = 'auto';
		customIconEl.style.pointerEvents = 'none';

		// Add error handling for failed image loads
		customIconEl.onerror = function() {
			// Hide the element if image fails to load
			customIconEl.style.display = 'none';
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
