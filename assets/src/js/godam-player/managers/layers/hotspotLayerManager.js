/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { addLayerInteraction, updateLayerInteraction } from '../../utils/storage.js';

/**
 * Hotspot Layer Manager
 * Handles hotspot layer functionality including creation, positioning, and interaction
 */
export default class HotspotLayerManager {
	static BASE_WIDTH = 800;
	static BASE_HEIGHT = 600;

	constructor( player, isDisplayingLayers, currentPlayerVideoInstanceId ) {
		this.player = player;
		this.hotspotLayers = [];
		this.wasPlayingBeforeHover = false;
		this.isDisplayingLayers = isDisplayingLayers;
		this.currentPlayerVideoInstanceId = currentPlayerVideoInstanceId;
		this.hoveredHotspots = new Set(); // Track which hotspots have already been hovered
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
			const isActive =
				currentTime >= layerObj.displayTime && currentTime < endTime;

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

		this.updateHotspotPositions();
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
			const hotspotDiv = this.createHotspotElement(
				hotspot,
				index,
				containerWidth,
				containerHeight,
				baseWidth,
				baseHeight,
				layerObj,
			);

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
	 * Create hotspot element
	 *
	 * @param {Object} hotspot            - Hotspot configuration object
	 * @param {number} index              - Index of the hotspot
	 * @param {number} containerWidth     - Width of the video container
	 * @param {number} containerHeight    - Height of the video container
	 * @param {number} baseWidth          - Base width for calculations
	 * @param {number} baseHeight         - Base height for calculations
	 * @param {Object} parentHotspotLayer - Parent hotspot layer object
	 * @return {HTMLElement} Created hotspot element
	 */
	createHotspotElement(
		hotspot,
		index,
		containerWidth,
		containerHeight,
		baseWidth,
		baseHeight,
		parentHotspotLayer,
	) {
		const hotspotDiv = document.createElement( 'div' );
		hotspotDiv.classList.add( 'hotspot', 'circle' );
		hotspotDiv.style.position = 'absolute';

		// Positioning
		const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
		const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;
		const pixelX = ( fallbackPosX / baseWidth ) * containerWidth;
		const pixelY = ( fallbackPosY / baseHeight ) * containerHeight;

		hotspotDiv.style.left = `${ pixelX }px`;
		hotspotDiv.style.top = `${ pixelY }px`;

		// Sizing
		const fallbackDiameter = hotspot.oSize?.diameter ?? hotspot.size?.diameter ?? 48;
		const pixelDiameter = ( fallbackDiameter / baseWidth ) * containerWidth;
		hotspotDiv.style.width = `${ pixelDiameter }px`;
		hotspotDiv.style.height = `${ pixelDiameter }px`;

		// Background color
		hotspotDiv.style.backgroundColor = hotspot.icon
			? 'white'
			: hotspot.backgroundColor || '#0c80dfa6';

		// Create content
		const hotspotContent = this.createHotspotContent( hotspot, index );
		hotspotDiv.appendChild( hotspotContent );

		// insert default "sipped" entry for hotspots
		const initialInteraction = {
			layer_id: hotspot.id,
			layer_type: 'hotspot',
			action_type: 'skipped',
			layer_timestamp: parentHotspotLayer.displayTime,
			layer_name: hotspot.name || '',
		};
		addLayerInteraction(
			this.player.el().dataset.id || this.player.el().dataset.job_id,
			initialInteraction,
		);

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
		} else {
			hotspotContent.classList.add( 'no-icon' );
		}

		const tooltipDiv = this.createHotspotTooltip( hotspot, index );
		hotspotContent.appendChild( tooltipDiv );

		hotspotContent.addEventListener( 'mouseover', ( e ) => {
			e.stopPropagation();

			updateLayerInteraction(
				this.player.el().dataset.id || this.player.el().dataset.job_id,
				hotspot.id,
				'hovered',
			);
		} );

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

		//event listener to handle clicks
		tooltipDiv.addEventListener( 'click', ( e ) => {
			e.stopPropagation();

			updateLayerInteraction(
				this.player.el().dataset.id || this.player.el().dataset.job_id,
				hotspot.id,
				'clicked',
			);
		} );

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
	 * Position tooltip relative to hotspot
	 *
	 * @param {HTMLElement} hotspotDiv - The hotspot element for positioning reference
	 * @param {HTMLElement} tooltipDiv - The tooltip element to position
	 */
	positionTooltip( hotspotDiv, tooltipDiv ) {
		const hotspotRect = hotspotDiv.getBoundingClientRect();
		const tooltipRect = tooltipDiv.getBoundingClientRect();
		const viewportWidth = window.innerWidth;

		// Vertical positioning
		const spaceAbove = hotspotRect.top;
		if ( spaceAbove < tooltipRect.height + 10 ) {
			// Place below
			tooltipDiv.style.bottom = 'auto';
			tooltipDiv.style.top = '100%';
			tooltipDiv.classList.add( 'tooltip-bottom' );
			tooltipDiv.classList.remove( 'tooltip-top' );
		} else {
			// Place above
			tooltipDiv.style.bottom = '100%';
			tooltipDiv.style.top = 'auto';
			tooltipDiv.classList.add( 'tooltip-top' );
			tooltipDiv.classList.remove( 'tooltip-bottom' );
		}

		// Horizontal positioning
		const spaceLeft = hotspotRect.left;
		const spaceRight = viewportWidth - hotspotRect.right;

		if ( spaceLeft < 10 ) {
			// Adjust to the right
			tooltipDiv.style.left = '0';
			tooltipDiv.style.transform = 'translateX(0)';
			tooltipDiv.classList.add( 'tooltip-left' );
			tooltipDiv.classList.remove( 'tooltip-right' );
			tooltipDiv.classList.add( 'no-arrow' );
		} else if ( spaceRight < 10 ) {
			// Adjust to the left
			tooltipDiv.style.left = 'auto';
			tooltipDiv.style.right = '0';
			tooltipDiv.style.transform = 'translateX(0)';
			tooltipDiv.classList.add( 'tooltip-right' );
			tooltipDiv.classList.remove( 'tooltip-left' );
			tooltipDiv.classList.add( 'no-arrow' );
		} else {
			// Centered horizontally
			tooltipDiv.style.left = '50%';
			tooltipDiv.style.right = 'auto';
			tooltipDiv.style.transform = 'translateX(-50%)';
			tooltipDiv.classList.remove( 'tooltip-left', 'tooltip-right', 'no-arrow' );
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

		this.hotspotLayers.forEach( ( layerObj ) => {
			const hotspotDivs = layerObj.layerElement.querySelectorAll( '.hotspot' );
			hotspotDivs.forEach( ( hotspotDiv, index ) => {
				const hotspot = layerObj.hotspots[ index ];

				// Recalc position
				const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
				const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;
				const pixelX = ( fallbackPosX / baseWidth ) * containerWidth;
				const pixelY = ( fallbackPosY / baseHeight ) * containerHeight;
				hotspotDiv.style.left = `${ pixelX }px`;
				hotspotDiv.style.top = `${ pixelY }px`;

				// Recalc size
				const fallbackDiameter = hotspot.oSize?.diameter ?? hotspot.size?.diameter ?? 48;
				const pixelDiameter = ( fallbackDiameter / baseWidth ) * containerWidth;
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
