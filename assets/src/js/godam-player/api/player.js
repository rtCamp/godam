class Player {
	videoJs = null;
	video = null;
	customLayers = [];
	layerIdCounter = 0;

	constructor( videoJs, video ) {
		this.videoJs = videoJs;
		this.video = video;
		this.instanceId = video.dataset.instanceId;

		this.setupTimeUpdateListener();
	}

	/**
	 * Setup time update listener for custom layers
	 */
	setupTimeUpdateListener() {
		this.videoJs.on( 'timeupdate', () => {
			const currentTime = this.videoJs.currentTime();
			this.handleCustomLayersTimeUpdate( currentTime );
		} );
	}

	/**
	 * Handle time-based display for custom layers
	 *
	 * @param {number} currentTime - Current video time in seconds
	 */
	handleCustomLayersTimeUpdate( currentTime ) {
		this.customLayers.forEach( ( layerObj ) => {
			const { displayTime, duration = Infinity, element, onShow, pauseOnShow, hasTriggeredCallback, isDismissed } = layerObj;

			// Skip dismissed layers
			if ( isDismissed ) {
				return;
			}

			// Convert percentage-based times to absolute time
			const absoluteDisplayTime = this.convertToAbsoluteTime( displayTime );
			const absoluteDuration = duration === Infinity ? Infinity : this.convertToAbsoluteTime( duration );
			const endTime = absoluteDuration === Infinity ? Infinity : absoluteDisplayTime + absoluteDuration;

			// Show/hide layer based on current time
			if ( currentTime >= absoluteDisplayTime && ( endTime === Infinity || currentTime <= endTime ) ) {
				if ( element.classList.contains( 'hidden' ) ) {
					element.classList.remove( 'hidden' );
					layerObj.visible = true;

					// Pause video if requested (default behavior)
					if ( pauseOnShow ) {
						this.videoJs.pause();
					}

					// Call onShow callback only once per display cycle
					if ( onShow && typeof onShow === 'function' && ! hasTriggeredCallback ) {
						layerObj.hasTriggeredCallback = true;
						try {
							onShow( element, this );
						} catch ( error ) {
							// eslint-disable-next-line no-console
							console.error( 'Error in layer onShow callback:', error );
						}
					}
				}
			} else if ( ! element.classList.contains( 'hidden' ) ) {
				element.classList.add( 'hidden' );
				layerObj.visible = false;
				// Reset callback trigger for next display cycle - is this necessary?
				layerObj.hasTriggeredCallback = false;
			}
		} );
	}

	/**
	 * Convert percentage or absolute time to absolute seconds
	 *
	 * @param {string|number} timeValue - Time value (e.g., "25%" or 30)
	 * @return {number} Absolute time in seconds
	 */
	convertToAbsoluteTime( timeValue ) {
		if ( typeof timeValue === 'string' && timeValue.includes( '%' ) ) {
			const percentage = parseFloat( timeValue.replace( '%', '' ) );
			const videoDuration = this.videoJs.duration() || 0;
			return ( percentage / 100 ) * videoDuration;
		}
		return parseFloat( timeValue ) || 0;
	}

	/**
	 * Create a custom layer with HTML content and time-based display
	 *
	 * @param {Object}        layerConfig                 - Layer configuration
	 * @param {string}        layerConfig.html            - HTML content for the layer
	 * @param {string|number} layerConfig.displayTime     - When to show (seconds or percentage like "25%")
	 * @param {string|number} layerConfig.duration        - How long to show (seconds or percentage, optional)
	 * @param {string}        layerConfig.backgroundColor - Background color (optional)
	 * @param {Function}      layerConfig.onShow          - Callback function when layer is displayed (optional)
	 * @param {boolean}       layerConfig.pauseOnShow     - Whether to pause video when layer shows (default: true)
	 * @return {HTMLElement} The created layer DOM element
	 */
	createLayer( layerConfig ) {
		if ( ! layerConfig.html || layerConfig.displayTime === undefined ) {
			throw new Error( 'createLayer requires html and displayTime properties' );
		}

		// Generate unique layer ID
		this.layerIdCounter++;
		const layerId = `custom-${ this.layerIdCounter }-${ Date.now() }`;

		// Create layer element following GoDAM's structure - that also means existing CSS would affect it
		const layer = document.createElement( 'div' );
		layer.id = `layer-${ this.instanceId }-${ layerId }`;
		layer.className = 'easydam-layer hidden';

		// Set background color (default to semi-transparent white like CTA layers)
		const backgroundColor = layerConfig.backgroundColor || '#FFFFFFB3';
		layer.style.backgroundColor = backgroundColor;

		// Create content wrapper following CTA HTML structure
		const contentWrapper = document.createElement( 'div' );
		contentWrapper.className = 'easydam-layer--cta-html';
		contentWrapper.innerHTML = layerConfig.html;

		layer.appendChild( contentWrapper );

		// Find the video container
		const videoContainer = this.video.closest( '.easydam-video-container' );
		if ( videoContainer ) {
			videoContainer.appendChild( layer );
		} else {
			// Fallback: look for the container as a sibling or parent - is that fallback valid or just not show at all?
			const fallbackContainer = this.video.parentElement?.querySelector( '.easydam-video-container' ) ||
				this.video.parentElement;
			if ( fallbackContainer ) {
				fallbackContainer.appendChild( layer );
			} else {
				this.video.parentElement.appendChild( layer );
			}
		}

		const layerObj = {
			id: layerId,
			element: layer,
			displayTime: layerConfig.displayTime,
			duration: layerConfig.duration,
			onShow: layerConfig.onShow,
			pauseOnShow: layerConfig.pauseOnShow !== false,
			visible: false,
			hasTriggeredCallback: false,
			isDismissed: false,
		};

		this.customLayers.push( layerObj );

		/**
		 * Adding a custom callback to element object like this?
		 *
		 * It has to be called for the layer to be dismissed, otherwise it would show again and again.
		 */
		layer.dismiss = () => {
			layerObj.isDismissed = true;
			layer.classList.add( 'hidden' );
		};

		return layer;
	}

	/**
	 * Remove a custom layer
	 *
	 * @param {string} layerId - Layer ID to remove
	 * @return {boolean} True if layer was removed
	 */
	removeCustomLayer( layerId ) {
		const layerIndex = this.customLayers.findIndex( ( layer ) => layer.id === layerId );
		if ( layerIndex === -1 ) {
			return false;
		}

		const layerObj = this.customLayers[ layerIndex ];

		// Remove from DOM
		if ( layerObj.element && layerObj.element.parentNode ) {
			layerObj.element.parentNode.removeChild( layerObj.element );
		}

		// Remove from tracking array
		this.customLayers.splice( layerIndex, 1 );

		return true;
	}

	/**
	 * Get custom layer by ID
	 *
	 * @param {string} layerId - Layer ID
	 * @return {HTMLElement|null} Layer element or null if not found
	 */
	getCustomLayer( layerId ) {
		const layerObj = this.customLayers.find( ( layer ) => layer.id === layerId );
		return layerObj ? layerObj.element : null;
	}

	/**
	 * Get all custom layers
	 *
	 * @return {Array} Array of layer objects
	 */
	getCustomLayers() {
		return this.customLayers.map( ( layer ) => ( {
			id: layer.id,
			element: layer.element,
			displayTime: layer.displayTime,
			duration: layer.duration,
			pauseOnShow: layer.pauseOnShow,
			visible: ! layer.element.classList.contains( 'hidden' ),
		} ) );
	}

	// ==============================
	// PLAYER CONTROL METHODS
	// ==============================

	/**
	 * Play the video
	 */
	play() {
		return this.videoJs.play();
	}

	/**
	 * Pause the video
	 */
	pause() {
		this.videoJs.pause();
	}

	/**
	 * Seek to specific time
	 *
	 * @param {number} time - Time in seconds
	 */
	seek( time ) {
		this.videoJs.currentTime( time );
	}

	/**
	 * Get current time
	 *
	 * @return {number} Current time in seconds
	 */
	currentTime() {
		return this.videoJs.currentTime();
	}

	/**
	 * Get video duration
	 *
	 * @return {number} Duration in seconds
	 */
	duration() {
		return this.videoJs.duration();
	}

	/**
	 * Set volume
	 *
	 * @param {number} volume - Volume level (0-1)
	 */
	setVolume( volume ) {
		this.videoJs.volume( Math.max( 0, Math.min( 1, volume ) ) );
	}

	/**
	 * Get volume
	 *
	 * @return {number} Current volume level (0-1)
	 */
	getVolume() {
		return this.videoJs.volume();
	}

	/**
	 * Toggle fullscreen
	 */
	toggleFullscreen() {
		if ( this.videoJs.isFullscreen() ) {
			this.videoJs.exitFullscreen();
		} else {
			this.videoJs.requestFullscreen();
		}
	}

	/**
	 * Check if video is paused
	 *
	 * @return {boolean} True if paused
	 */
	isPaused() {
		return this.videoJs.paused();
	}

	/**
	 * Check if video is in fullscreen
	 *
	 * @return {boolean} True if in fullscreen
	 */
	isFullscreen() {
		return this.videoJs.isFullscreen();
	}
}

export default Player;
