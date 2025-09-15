/**
 * GoDAM Player API - Player Class
 *
 * This file contains the Player class which provides a simplified developer API
 * for the GoDAM video player system. It allows developers to create custom
 * HTML layers with time-based display, control video playback, and interact
 * with the underlying VideoJS player instance.
 *
 * The Player class wraps VideoJS functionality and integrates with GoDAM's
 * layer system, providing methods for:
 * - Creating custom HTML layers with time-based display
 * - Controlling video playback (play, pause, seek, volume)
 * - Managing layer lifecycle (show, hide, dismiss)
 * - Converting between absolute and percentage-based timing
 *
 * @since n.e.x.t
 */

/* eslint-disable no-console */

/**
 * Player Class for the GoDAM Video Player API
 *
 * Provides a developer-friendly interface for creating custom video layers
 * and controlling video playback. This class wraps VideoJS functionality
 * and integrates seamlessly with the existing GoDAM layer system.
 *
 * @class Player
 * @example
 * // Get player instance
 * const player = window.GoDAMAPI.getPlayer('1641');
 *
 * // Create a custom layer
 * const layer = player.createLayer({
 *     html: '<div><h3>My Custom Layer</h3></div>',
 *     displayTime: 10,
 *     duration: 5,
 *     onShow: (element, player) => {
 *         // Handle layer display
 *     }
 * });
 *
 * // Control playback
 * player.play();
 * player.pause();
 * player.seek(30);
 *
 * @since n.e.x.t
 */
class Player {
	videoJs = null;
	video = null;
	customLayers = [];
	layerIdCounter = 0;
	timeUpdateHandler = null; // Store reference for cleanup

	constructor( videoJs, video ) {
		// Input validation
		if ( ! videoJs || ! video ) {
			throw new Error( 'Player requires both videoJs and video elements' );
		}

		this.videoJs = videoJs;
		this.video = video;
		this.instanceId = video.dataset.instanceId;

		// Validate instanceId exists
		if ( ! this.instanceId ) {
			console.warn( 'Video element missing data-instance-id attribute' );
			this.instanceId = `player-${ Date.now() }`;
		}

		// Setup time update listener for custom layers
		this.setupTimeUpdateListener();
	}

	/**
	 * Setup time update listener for custom layers
	 */
	setupTimeUpdateListener() {
		// Store handler reference for potential cleanup
		this.timeUpdateHandler = () => {
			const currentTime = this.videoJs.currentTime();
			this.handleCustomLayersTimeUpdate( currentTime );
		};

		this.videoJs.on( 'timeupdate', this.timeUpdateHandler );
	}

	/**
	 * Handle time-based display for custom layers
	 *
	 * @param {number} currentTime - Current video time in seconds
	 */
	handleCustomLayersTimeUpdate( currentTime ) {
		// Early return if no layers
		if ( this.customLayers.length === 0 ) {
			return;
		}

		this.customLayers.forEach( ( layerObj ) => {
			const { displayTime, duration = Infinity, element, onShow, pauseOnShow, hasTriggeredCallback, isDismissed } = layerObj;

			// Skip dismissed layers
			if ( isDismissed ) {
				return;
			}

			// Skip if element no longer exists in DOM
			if ( ! element || ! document.contains( element ) ) {
				return;
			}

			// Convert percentage-based times to absolute time
			const absoluteDisplayTime = this.convertToAbsoluteTime( displayTime );
			const absoluteDuration = duration === Infinity ? Infinity : this.convertToAbsoluteTime( duration );
			const endTime = absoluteDuration === Infinity ? Infinity : absoluteDisplayTime + absoluteDuration;

			// Show/hide layer based on current time
			const shouldShow = currentTime >= absoluteDisplayTime && ( endTime === Infinity || currentTime <= endTime );
			const isCurrentlyHidden = element.classList.contains( 'hidden' );

			if ( shouldShow && isCurrentlyHidden ) {
				element.classList.remove( 'hidden' );
				layerObj.visible = true;

				// Pause video if requested (default behavior)
				if ( pauseOnShow && ! this.videoJs.paused() ) {
					this.videoJs.pause();
				}

				// Call onShow callback only once per display cycle
				if ( onShow && typeof onShow === 'function' && ! hasTriggeredCallback ) {
					layerObj.hasTriggeredCallback = true;
					try {
						onShow( element, this );
					} catch ( error ) {
						console.error( 'Error in layer onShow callback:', error );
					}
				}
			} else if ( ! shouldShow && ! isCurrentlyHidden ) {
				element.classList.add( 'hidden' );
				layerObj.visible = false;
				// Reset callback trigger for next display cycle
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

			// Validate percentage
			if ( isNaN( percentage ) || percentage < 0 ) {
				console.warn( `Invalid percentage value: ${ timeValue }. Using 0.` );
				return 0;
			}

			const videoDuration = this.videoJs.duration() || 0;

			// Handle case where duration isn't available yet
			if ( videoDuration === 0 ) {
				console.warn( 'Video duration not available for percentage calculation' );
				return 0;
			}

			return ( percentage / 100 ) * videoDuration;
		}

		const numericValue = parseFloat( timeValue );
		if ( isNaN( numericValue ) || numericValue < 0 ) {
			console.warn( `Invalid time value: ${ timeValue }. Using 0.` );
			return 0;
		}

		return numericValue;
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
	 * @param {string}        layerConfig.className       - Additional CSS classes (optional)
	 * @return {HTMLElement} The created layer DOM element
	 */
	createLayer( layerConfig ) {
		// Enhanced input validation
		if ( ! layerConfig || typeof layerConfig !== 'object' ) {
			throw new Error( 'createLayer requires a configuration object' );
		}

		if ( ! layerConfig.html || typeof layerConfig.html !== 'string' ) {
			throw new Error( 'createLayer requires a valid html string' );
		}

		if ( layerConfig.displayTime === undefined || layerConfig.displayTime === null ) {
			throw new Error( 'createLayer requires displayTime property' );
		}

		// Validate displayTime
		const testTime = this.convertToAbsoluteTime( layerConfig.displayTime );
		if ( testTime < 0 ) {
			throw new Error( 'displayTime must be a positive number or valid percentage' );
		}

		// Generate unique layer ID with better uniqueness
		this.layerIdCounter++;
		const layerId = `custom-${ this.layerIdCounter }-${ Date.now() }-${ Math.random().toString( 36 ).substr( 2, 9 ) }`;

		// Create layer element following GoDAM's structure
		const layer = document.createElement( 'div' );
		layer.id = `layer-${ this.instanceId }-${ layerId }`;

		// Build class list
		let classNames = 'easydam-layer hidden';
		if ( layerConfig.className ) {
			classNames += ` ${ layerConfig.className }`;
		}
		layer.className = classNames;

		// Set background color (default to semi-transparent white like CTA layers)
		const backgroundColor = layerConfig.backgroundColor || '#FFFFFFB3';
		layer.style.backgroundColor = backgroundColor;

		// Create content wrapper following CTA HTML structure
		const contentWrapper = document.createElement( 'div' );
		contentWrapper.className = 'easydam-layer--cta-html';

		// Sanitize HTML content (basic protection)
		try {
			contentWrapper.innerHTML = layerConfig.html;
		} catch ( error ) {
			console.error( 'Error setting layer HTML content:', error );
			contentWrapper.textContent = 'Error loading layer content';
		}

		layer.appendChild( contentWrapper );

		// Enhanced container finding logic
		const container = this.findVideoContainer();
		if ( container ) {
			container.appendChild( layer );
		} else {
			console.warn( 'Could not find appropriate container for layer, using video parent' );
			this.video.parentElement?.appendChild( layer );
		}

		// Store layer object for time-based management
		const layerObj = {
			id: layerId,
			element: layer,
			displayTime: layerConfig.displayTime,
			duration: layerConfig.duration,
			onShow: layerConfig.onShow,
			pauseOnShow: layerConfig.pauseOnShow !== false, // Default to true
			visible: false,
			hasTriggeredCallback: false, // Track if callback was already called
			isDismissed: false, // Track if layer was manually dismissed
			createdAt: Date.now(), // Track creation time for debugging
		};

		this.customLayers.push( layerObj );

		// Add dismiss method to the layer element
		layer.dismiss = () => {
			layerObj.isDismissed = true;
			layer.classList.add( 'hidden' );
			layerObj.visible = false;
		};

		// Add show method for manual control
		layer.show = () => {
			if ( ! layerObj.isDismissed ) {
				layer.classList.remove( 'hidden' );
				layerObj.visible = true;
			}
		};

		// Add hide method for manual control
		layer.hide = () => {
			layer.classList.add( 'hidden' );
			layerObj.visible = false;
			layerObj.hasTriggeredCallback = false; // Reset callback trigger
		};

		// Return the DOM element so developers can manipulate it
		return layer;
	}

	/**
	 * Find the appropriate video container
	 *
	 * @return {HTMLElement|null} Container element or null
	 */
	findVideoContainer() {
		// Try multiple strategies to find container
		let container = this.video.closest( '.easydam-video-container' );

		if ( ! container ) {
			container = this.video.parentElement?.querySelector( '.easydam-video-container' );
		}

		if ( ! container ) {
			container = this.video.parentElement;
		}

		return container;
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
			console.warn( `Layer with ID ${ layerId } not found` );
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
	 * Remove all custom layers
	 *
	 * @return {number} Number of layers removed
	 */
	removeAllCustomLayers() {
		const count = this.customLayers.length;

		this.customLayers.forEach( ( layerObj ) => {
			if ( layerObj.element && layerObj.element.parentNode ) {
				layerObj.element.parentNode.removeChild( layerObj.element );
			}
		} );

		this.customLayers = [];
		return count;
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
			isDismissed: layer.isDismissed,
			createdAt: layer.createdAt,
		} ) );
	}

	/**
	 * Update layer configuration
	 *
	 * @param {string} layerId - Layer ID to update
	 * @param {Object} updates - Properties to update
	 * @return {boolean} True if layer was updated
	 */
	updateLayer( layerId, updates ) {
		const layerObj = this.customLayers.find( ( layer ) => layer.id === layerId );

		if ( ! layerObj ) {
			console.warn( `Layer with ID ${ layerId } not found` );
			return false;
		}

		// Update allowed properties
		const allowedUpdates = [ 'displayTime', 'duration', 'pauseOnShow', 'onShow' ];

		allowedUpdates.forEach( ( prop ) => {
			if ( updates.hasOwnProperty( prop ) ) {
				layerObj[ prop ] = updates[ prop ];
			}
		} );

		// Update HTML content if provided
		if ( updates.html && typeof updates.html === 'string' ) {
			const contentWrapper = layerObj.element.querySelector( '.easydam-layer--cta-html' );
			if ( contentWrapper ) {
				contentWrapper.innerHTML = updates.html;
			}
		}

		// Update background color if provided
		if ( updates.backgroundColor ) {
			layerObj.element.style.backgroundColor = updates.backgroundColor;
		}

		return true;
	}

	// ==============================
	// PLAYER CONTROL METHODS
	// ==============================

	/**
	 * Play the video
	 *
	 * @return {Promise} Promise that resolves when play starts
	 */
	play() {
		try {
			return this.videoJs.play();
		} catch ( error ) {
			console.error( 'Error playing video:', error );
			return Promise.reject( error );
		}
	}

	/**
	 * Pause the video
	 */
	pause() {
		try {
			this.videoJs.pause();
		} catch ( error ) {
			console.error( 'Error pausing video:', error );
		}
	}

	/**
	 * Seek to specific time
	 *
	 * @param {number} time - Time in seconds
	 * @return {boolean} True if seek was successful
	 */
	seek( time ) {
		try {
			const duration = this.videoJs.duration() || 0;
			const clampedTime = Math.max( 0, Math.min( time, duration ) );

			if ( clampedTime !== time ) {
				console.warn( `Seek time ${ time } clamped to ${ clampedTime } (duration: ${ duration })` );
			}

			this.videoJs.currentTime( clampedTime );
			return true;
		} catch ( error ) {
			console.error( 'Error seeking video:', error );
			return false;
		}
	}

	/**
	 * Get current time
	 *
	 * @return {number} Current time in seconds
	 */
	currentTime() {
		try {
			return this.videoJs.currentTime() || 0;
		} catch ( error ) {
			console.error( 'Error getting current time:', error );
			return 0;
		}
	}

	/**
	 * Get video duration
	 *
	 * @return {number} Duration in seconds
	 */
	duration() {
		try {
			return this.videoJs.duration() || 0;
		} catch ( error ) {
			console.error( 'Error getting duration:', error );
			return 0;
		}
	}

	/**
	 * Set volume
	 *
	 * @param {number} volume - Volume level (0-1)
	 * @return {boolean} True if volume was set successfully
	 */
	setVolume( volume ) {
		try {
			const clampedVolume = Math.max( 0, Math.min( 1, volume ) );
			this.videoJs.volume( clampedVolume );
			return true;
		} catch ( error ) {
			console.error( 'Error setting volume:', error );
			return false;
		}
	}

	/**
	 * Get volume
	 *
	 * @return {number} Current volume level (0-1)
	 */
	getVolume() {
		try {
			return this.videoJs.volume() || 0;
		} catch ( error ) {
			console.error( 'Error getting volume:', error );
			return 0;
		}
	}

	/**
	 * Toggle fullscreen
	 *
	 * @return {boolean} True if toggle was successful
	 */
	toggleFullscreen() {
		try {
			const fullScreenButton = this.video.querySelector( '.godam-fullscreen-button' );
			if ( fullScreenButton ) {
				fullScreenButton.click();
			} else if ( this.videoJs.isFullscreen() ) {
				this.videoJs.exitFullscreen();
			} else {
				this.videoJs.requestFullscreen();
			}
			return true;
		} catch ( error ) {
			console.error( 'Error toggling fullscreen:', error );
			return false;
		}
	}

	/**
	 * Check if video is paused
	 *
	 * @return {boolean} True if paused
	 */
	isPaused() {
		try {
			return this.videoJs.paused();
		} catch ( error ) {
			console.error( 'Error checking paused state:', error );
			return true; // Assume paused on error
		}
	}

	/**
	 * Check if video is in fullscreen
	 *
	 * @return {boolean} True if in fullscreen
	 */
	isFullscreen() {
		try {
			return this.videoJs.isFullscreen();
		} catch ( error ) {
			console.error( 'Error checking fullscreen state:', error );
			return false;
		}
	}

	/**
	 * Get video ready state
	 *
	 * @return {boolean} True if video is ready
	 */
	isReady() {
		try {
			return this.videoJs.readyState() >= 1;
		} catch ( error ) {
			console.error( 'Error checking ready state:', error );
			return false;
		}
	}

	/**
	 * Clean up resources when player is no longer needed
	 */
	destroy() {
		// Remove time update listener
		if ( this.timeUpdateHandler ) {
			this.videoJs.off( 'timeupdate', this.timeUpdateHandler );
			this.timeUpdateHandler = null;
		}

		// Remove all custom layers
		this.removeAllCustomLayers();

		// Clear references
		this.videoJs = null;
		this.video = null;
		this.customLayers = [];
	}

	/**
	 * Replay player state and layers
	 *
	 * This method is necessary if we also want to replay the layers.
	 *
	 * @param {boolean} reloadLayers - Whether to reset and replay layers (default: true)
	 */
	replay( reloadLayers = true ) {
		// Reset video state
		this.videoJs.currentTime( 0 );
		this.dismissNativeLayer();

		if ( reloadLayers ) {
			// Reset all custom layers
			this.layersManager = this.getFormLayerManager();
			if ( this.layersManager ) {
				this.layersManager.replay();
			}
		}
	}

	// ==============================
	// NATIVE LAYER MANAGEMENT METHODS
	// ==============================

	/**
	 * Get the FormLayerManager instance if available
	 *
	 * @return {Object|null} FormLayerManager instance or null
	 */
	getFormLayerManager() {
		// Alternative: Try to find it through the VideoJS player
		if ( this.videoJs.layersManager ) {
			return this.videoJs.layersManager;
		}

		console.warn( 'LayersManager not found. Make sure the player is fully initialized.' );
		return null;
	}

	/**
	 * Dismiss a native layer - either current active layer or specific layer by HTML ID
	 *
	 * @param {string} layerHtmlId - Optional HTML ID of the layer to dismiss. If not provided, dismisses current active layer
	 * @return {boolean} True if a layer was dismissed successfully
	 */
	dismissNativeLayer( layerHtmlId = null ) {
		const formLayerManager = this.getFormLayerManager();

		if ( ! formLayerManager ) {
			return false;
		}

		return formLayerManager.dismissLayer( layerHtmlId );
	}

	/**
	 * Get the currently active native layer
	 *
	 * @return {Object|null} Current layer object or null if no active layer
	 */
	getCurrentNativeLayer() {
		const formLayerManager = this.getFormLayerManager();

		if ( ! formLayerManager ) {
			return null;
		}

		return formLayerManager.getCurrentLayer();
	}

	/**
	 * Get all native form layers
	 *
	 * @return {Array} Array of layer information objects
	 */
	getAllNativeLayers() {
		const formLayerManager = this.getFormLayerManager();

		if ( ! formLayerManager ) {
			return [];
		}

		return formLayerManager.getAllLayers();
	}

	/**
	 * Check if there are any native layers currently visible
	 *
	 * @return {boolean} True if any native layer is visible
	 */
	hasVisibleNativeLayers() {
		const allLayers = this.getAllNativeLayers();
		return allLayers.some( ( layer ) => layer.isVisible );
	}

	/**
	 * Get the current native layer index
	 *
	 * @return {number} Current form layer index or -1 if no FormLayerManager
	 */
	getCurrentNativeLayerIndex() {
		const formLayerManager = this.getFormLayerManager();

		if ( ! formLayerManager ) {
			return -1;
		}

		return formLayerManager.currentFormLayerIndex;
	}
}

export default Player;

/* eslint-enable no-console */
