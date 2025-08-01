/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Constants
 */
const FORM_TYPES = {
	GRAVITY: 'gravity',
	WPFORMS: 'wpforms',
	EVEREST: 'everestforms',
	CF7: 'cf7',
	JETPACK: 'jetpack',
	SUREFORMS: 'sureforms',
	FORMINATOR: 'forminator',
	FLUENT: 'fluentforms',
	NINJA: 'ninjaforms',
};

const LAYER_TYPES = {
	FORM: 'form',
	CTA: 'cta',
	POLL: 'poll',
	HOTSPOT: 'hotspot',
};

/**
 * Layers Manager
 * Handles form and hotspot layers functionality
 */
export default class LayersManager {
	constructor( player, video, config, isDisplayingLayers, currentPlayerVideoInstanceId ) {
		this.player = player;
		this.video = video;
		this.config = config;
		this.isDisplayingLayers = isDisplayingLayers;
		this.currentPlayerVideoInstanceId = currentPlayerVideoInstanceId;
		this.formLayers = [];
		this.hotspotLayers = [];
		this.currentFormLayerIndex = 0;
		this.wasPlayingBeforeHover = false;
	}

	/**
	 * Setup layers
	 */
	setupLayers() {
		const layers = this.config.videoSetupOptions?.layers || [];

		if ( ! this.config.isPreviewEnabled ) {
			layers.forEach( ( layer ) => this.processLayer( layer ) );
		}

		this.formLayers.sort( ( a, b ) => a.displayTime - b.displayTime );
		this.currentFormLayerIndex = 0;
		this.isDisplayingLayers[ this.currentPlayerVideoInstanceId ] = false;
	}

	/**
	 * Process individual layer
	 *
	 * @param {Object} layer - Layer configuration object
	 */
	processLayer( layer ) {
		const shouldProcess = this.shouldProcessLayer( layer );

		if ( shouldProcess ) {
			this.handleLayerDisplay( layer );
		}
	}

	/**
	 * Check if layer should be processed based on dependencies
	 *
	 * @param {Object} layer - Layer configuration object
	 * @return {boolean} True if layer should be processed
	 */
	shouldProcessLayer( layer ) {
		const dependencies = window.godamPluginDependencies;

		const layerTypeChecks = {
			[ LAYER_TYPES.FORM ]: () => this.checkFormDependency( layer.form_type, dependencies ),
			[ LAYER_TYPES.POLL ]: () => dependencies?.wpPolls,
			[ LAYER_TYPES.CTA ]: () => true,
			[ LAYER_TYPES.HOTSPOT ]: () => true,
		};

		const checker = layerTypeChecks[ layer.type ];
		return checker ? checker() : true;
	}

	/**
	 * Check form dependency
	 *
	 * @param {string} formType     - Type of form to check
	 * @param {Array}  dependencies - Array of dependency objects
	 * @return {boolean} True if form dependency is satisfied
	 */
	checkFormDependency( formType, dependencies ) {
		const formChecks = {
			[ FORM_TYPES.GRAVITY ]: dependencies?.gravityforms,
			[ FORM_TYPES.WPFORMS ]: dependencies?.wpforms,
			[ FORM_TYPES.EVEREST ]: dependencies?.everestForms,
			[ FORM_TYPES.CF7 ]: dependencies?.cf7,
			[ FORM_TYPES.JETPACK ]: dependencies?.jetpack,
			[ FORM_TYPES.SUREFORMS ]: dependencies?.sureforms,
			[ FORM_TYPES.FORMINATOR ]: dependencies?.forminator,
			[ FORM_TYPES.FLUENT ]: dependencies?.fluentForms,
			[ FORM_TYPES.NINJA ]: dependencies?.ninjaForms,
		};

		return formChecks[ formType ] || false;
	}

	/**
	 * Handle layer display setup
	 *
	 * @param {Object} layer - Layer configuration object
	 */
	handleLayerDisplay( layer ) {
		const instanceId = this.video.dataset.instanceId;
		const layerId = `layer-${ instanceId }-${ layer.id }`;
		const layerElement = document.querySelector( `#${ layerId }` );

		if ( ! layerElement ) {
			return;
		}

		this.setupLayerEnvironment();
		layerElement.classList.add( 'hidden' );

		if ( this.isFormOrCTAOrPoll( layer.type ) ) {
			this.setupFormLayer( layer, layerElement );
		} else if ( layer.type === LAYER_TYPES.HOTSPOT ) {
			this.setupHotspotLayer( layer, layerElement );
		}
	}

	/**
	 * Setup layer environment
	 */
	setupLayerEnvironment() {
		if ( typeof window.wpforms !== 'undefined' ) {
			window.wpforms.scrollToError = () => {};
			window.wpforms.animateScrollTop = () => {};
		}
	}

	/**
	 * Check if layer is form, CTA, or poll
	 *
	 * @param {string} layerType - Type of layer to check
	 * @return {boolean} True if layer is form-based
	 */
	isFormOrCTAOrPoll( layerType ) {
		return [ LAYER_TYPES.FORM, LAYER_TYPES.CTA, LAYER_TYPES.POLL ].includes( layerType );
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
	 */
	setupFormObserver( layerObj, skipButton ) {
		const observer = new MutationObserver( () => {
			if ( this.hasConfirmationMessage( layerObj.layerElement ) ) {
				skipButton.textContent = __( 'Continue', 'godam' );
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
		const wpPollsAnswer = element.querySelector( '.wp-polls-answer' );
		if ( ! wpPollsForm && wpPollsAnswer ) {
			return true;
		}

		const nfResponse = element.querySelector( '.nf-response-msg' );
		if ( nfResponse && nfResponse.innerHTML !== '' ) {
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
	 * Handle hotspot layers time update
	 *
	 * @param {number} currentTime - Current video time in seconds
	 */
	handleHotspotLayersTimeUpdate( currentTime ) {
		this.hotspotLayers.forEach( ( layerObj ) => {
			if ( ! layerObj.show ) {
				return;
			}

			const endTime = layerObj.displayTime + layerObj.duration;
			const isActive = currentTime >= layerObj.displayTime && currentTime < endTime;

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
	 * Handle fullscreen changes for layers
	 */
	handleFullscreenChange() {
		const isFullscreen = this.player.isFullscreen();
		const videoContainer = this.player.el();

		this.formLayers.forEach( ( layerObj ) => {
			if ( isFullscreen ) {
				videoContainer.appendChild( layerObj.layerElement );
				layerObj.layerElement.classList.add( 'fullscreen-layer' );
			} else {
				layerObj.layerElement.classList.remove( 'fullscreen-layer' );
			}
		} );

		this.hotspotLayers.forEach( ( layerObj ) => {
			if ( isFullscreen && ! videoContainer.contains( layerObj.layerElement ) ) {
				videoContainer.appendChild( layerObj.layerElement );
			}
		} );

		this.updateHotspotPositions();
	}

	/**
	 * Handle play events for layers
	 */
	handlePlay() {
		const isAnyLayerVisible = this.formLayers.some(
			( layerObj ) => ! layerObj.layerElement.classList.contains( 'hidden' ) && layerObj.show,
		);

		if ( isAnyLayerVisible ) {
			this.player.pause();
		}
	}

	/**
	 * Handle preview state change callback
	 *
	 * @param {boolean} newValue - New preview state value
	 */
	handlePreviewStateChange( newValue ) {
		this.formLayers.forEach( ( layer ) => {
			if ( ! newValue ) {
				this.handleLayerDisplay( layer );
			}
		} );
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

		const baseWidth = 800;
		const baseHeight = 600;

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
		hotspotDiv.style.backgroundColor = hotspot.icon ? 'white' : ( hotspot.backgroundColor || '#0c80dfa6' );

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

		const baseWidth = 800;
		const baseHeight = 600;

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
}
