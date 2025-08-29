/**
 * GoDAM Player Developer API
 * Comprehensive API for external developers to control player behavior, styles, and functionality
 * 
 * @since n.e.x.t
 */

import videojs from 'video.js';

export default class GodamDeveloperAPI {
	constructor() {
		this.players = new Map();
		this.layerHooks = new Map();
		this.globalHooks = [];
		this.customButtons = new Map();
		this.styleOverrides = new Map();
		this.isInitialized = false;
		
		this.init();
	}

	/**
	 * Initialize the developer API
	 */
	init() {
		if (this.isInitialized) {
			return;
		}

		// Wait for DOM to be ready
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', () => this.setupGlobalAccess());
		} else {
			this.setupGlobalAccess();
		}

		this.isInitialized = true;
	}

	/**
	 * Setup global access to the API
	 */
	setupGlobalAccess() {
		// Create global godam object if it doesn't exist
		window.godam = window.godam || {};
		
		// Expose the developer API
		window.godam.player = this;
		
		// Expose convenience methods for player control
		window.godam.getPlayer = (instanceId) => this.getPlayer(instanceId);
		window.godam.getAllPlayers = () => this.getAllPlayers();
		
		// REMOVED: Layer hook methods - not needed
		// Simple layer control methods
		window.godam.showLayer = (layerId, instanceId) => this.showLayer(layerId, instanceId);
		window.godam.hideLayer = (layerId, instanceId) => this.hideLayer(layerId, instanceId);
		
		// Custom UI methods
		window.godam.addCustomButton = (config) => this.addCustomButton(config);
		window.godam.removeCustomButton = (buttonId) => this.removeCustomButton(buttonId);
		
		// Style management methods
		window.godam.addPlayerStyle = (instanceId, styles) => this.addPlayerStyle(instanceId, styles);
		window.godam.removePlayerStyle = (instanceId, styleId) => this.removePlayerStyle(instanceId, styleId);
		
		// Player control methods
		window.godam.playVideo = (instanceId) => this.playVideo(instanceId);
		window.godam.pauseVideo = (instanceId) => this.pauseVideo(instanceId);
		window.godam.seekTo = (instanceId, time) => this.seekTo(instanceId, time);
		window.godam.setVolume = (instanceId, volume) => this.setVolume(instanceId, volume);
		window.godam.toggleFullscreen = (instanceId) => this.toggleFullscreen(instanceId);
		
		// Global hooks
		window.godam.addGlobalHook = (hook) => this.addGlobalHook(hook);
		window.godam.removeGlobalHook = (hookId) => this.removeGlobalHook(hookId);
		
		console.log('GoDAM Developer API initialized. Access via window.godam.player');
	}

	/**
	 * Register a VideoJS player instance
	 * 
	 * @param {string} instanceId - Unique instance identifier
	 * @param {Object} player - VideoJS player instance
	 * @param {Object} layersManager - Layers manager instance
	 * @param {Object} controlsManager - Controls manager instance
	 */
	registerPlayer(instanceId, player, layersManager, controlsManager = null) {
		const playerData = {
			player,
			layersManager,
			controlsManager,
			instanceId,
			layers: [],
			customButtons: [],
			customStyles: [],
			metadata: this.extractPlayerMetadata(player)
		};

		this.players.set(instanceId, playerData);
		
		// Extract layers from the player
		this.extractLayers(instanceId, layersManager);
		
		// Setup player event listeners for API
		this.setupPlayerEventListeners(instanceId, player);
		
		console.log(`GoDAM Player registered: ${instanceId}`);
		
		// Execute global hooks for this new player
		this.executeGlobalHooks();
	}

	/**
	 * Setup event listeners for player API integration
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @param {Object} player - VideoJS player instance
	 */
	setupPlayerEventListeners(instanceId, player) {
		// REMOVED: All unnecessary event listeners that were interfering with existing functionality
		// Developers don't need real-time monitoring - they can control layers directly
		
		// Only keep essential non-intrusive listeners
		player.ready(() => {
			this.applyCustomStyles(instanceId);
			this.renderCustomButtons(instanceId);
		});

		player.on('fullscreenchange', () => {
			this.handleFullscreenChange(instanceId);
		});
	}

	/**
	 * Handle fullscreen changes
	 * 
	 * @param {string} instanceId - Player instance ID
	 */
	handleFullscreenChange(instanceId) {
		const playerData = this.players.get(instanceId);
		if (!playerData) return;

		// Reposition custom buttons in fullscreen
		this.repositionCustomButtons(instanceId);
	}

	/**
	 * Extract player metadata
	 * 
	 * @param {Object} player - VideoJS player instance
	 * @return {Object} Player metadata
	 */
	extractPlayerMetadata(player) {
		return {
			currentTime: player.currentTime(),
			duration: player.duration(),
			paused: player.paused(),
			volume: player.volume(),
			muted: player.muted(),
			fullscreen: player.isFullscreen(),
			poster: player.poster(),
			sources: player.currentSources(),
			aspectRatio: player.aspectRatio(),
			fluid: player.fluid(),
			controls: player.controls()
		};
	}

	/**
	 * Extract layers from the layers manager
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @param {Object} layersManager - Layers manager instance
	 */
	extractLayers(instanceId, layersManager) {
		const playerData = this.players.get(instanceId);
		if (!playerData) return;

		// Get layers from the DOM
		const layerElements = document.querySelectorAll(`[id^="layer-${instanceId}-"]`);
		
		playerData.layers = Array.from(layerElements).map(element => {
			const layerId = element.id.replace(`layer-${instanceId}-`, '');
			const layerType = this.detectLayerType(element);
			
			return {
				id: layerId,
				element,
				type: layerType,
				instanceId,
				visible: !element.classList.contains('hidden'),
				metadata: this.extractLayerMetadata(element, layerType)
			};
		});

		console.log(`Extracted ${playerData.layers.length} layers for player ${instanceId}`);
	}

	/**
	 * Detect layer type from DOM element
	 * 
	 * @param {HTMLElement} element - Layer DOM element
	 * @return {string} Layer type
	 */
	detectLayerType(element) {
		if (element.querySelector('.easydam-layer--cta-text, .easydam-layer--cta-html, .image-cta-container')) {
			return 'cta';
		}
		if (element.querySelector('.form-container')) {
			return 'form';
		}
		if (element.querySelector('.poll-container')) {
			return 'poll';
		}
		if (element.classList.contains('hotspot-layer')) {
			return 'hotspot';
		}
		return 'unknown';
	}

	/**
	 * Extract layer metadata
	 * 
	 * @param {HTMLElement} element - Layer DOM element
	 * @param {string} type - Layer type
	 * @return {Object} Layer metadata
	 */
	extractLayerMetadata(element, type) {
		const metadata = {
			type,
			className: element.className,
			style: element.getAttribute('style'),
			backgroundColor: element.style.backgroundColor
		};

		switch (type) {
			case 'cta':
				metadata.text = element.querySelector('.easydam-layer--cta-text')?.textContent || '';
				metadata.html = element.querySelector('.easydam-layer--cta-html')?.innerHTML || '';
				metadata.image = element.querySelector('img')?.src || '';
				break;
			case 'form':
				metadata.formType = this.detectFormType(element);
				break;
			case 'poll':
				metadata.pollId = element.querySelector('.wp-polls-form')?.getAttribute('data-poll-id') || '';
				break;
		}

		return metadata;
	}

	/**
	 * Detect form type
	 * 
	 * @param {HTMLElement} element - Form element
	 * @return {string} Form type
	 */
	detectFormType(element) {
		if (element.querySelector('.gform_wrapper')) return 'gravity';
		if (element.querySelector('.wpforms-container')) return 'wpforms';
		if (element.querySelector('.wpcf7-form')) return 'cf7';
		if (element.querySelector('.ff-message-success')) return 'forminator';
		return 'unknown';
	}

	/**
	 * Get a specific player instance
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @return {Object|null} Player data or null if not found
	 */
	getPlayer(instanceId) {
		return this.players.get(instanceId) || null;
	}

	/**
	 * Get all registered players
	 * 
	 * @return {Array} Array of player data objects
	 */
	getAllPlayers() {
		return Array.from(this.players.values());
	}

	// ==============================
	// LAYER MANAGEMENT METHODS - SIMPLIFIED
	// ==============================

	/**
	 * REMOVED: All layer hook methods - developers can control layers directly
	 * The existing system already handles layer management perfectly
	 */

	/**
	 * Get layer by ID - Simple access to existing layers
	 * 
	 * @param {string} layerId - Layer ID
	 * @param {string} instanceId - Player instance ID (optional)
	 * @return {Object|null} Layer object or null if not found
	 */
	getLayer(layerId, instanceId = null) {
		if (instanceId) {
			const player = this.players.get(instanceId);
			return player ? player.layers.find(layer => layer.id === layerId) : null;
		}

		// Search all players
		for (const playerData of this.players.values()) {
			const layer = playerData.layers.find(layer => layer.id === layerId);
			if (layer) return layer;
		}

		return null;
	}

	/**
	 * Show a specific layer - Simple wrapper around existing functionality
	 * 
	 * @param {string} layerId - Layer ID
	 * @param {string} instanceId - Player instance ID (optional)
	 */
	showLayer(layerId, instanceId = null) {
		const layer = this.getLayer(layerId, instanceId);
		if (layer && layer.element) {
			// Use the existing system's approach
			layer.element.classList.remove('hidden');
			layer.element.style.display = '';
		}
	}

	/**
	 * Hide a specific layer - Simple wrapper around existing functionality
	 * 
	 * @param {string} layerId - Layer ID
	 * @param {string} instanceId - Player instance ID (optional)
	 */
	hideLayer(layerId, instanceId = null) {
		const layer = this.getLayer(layerId, instanceId);
		if (layer && layer.element) {
			// Use the existing system's approach
			layer.element.classList.add('hidden');
			layer.element.style.display = 'none';
		}
	}

	/**
	 * Completely remove a layer from ALL systems (DOM, managers, configuration, events)
	 * 
	 * @param {string} layerId - Layer ID to remove
	 * @param {string} instanceId - Player instance ID
	 * @return {boolean} Success status
	 */
	removeLayerCompletely(layerId, instanceId) {
		console.log(`🗑️ Completely removing layer ${layerId} from player ${instanceId}`);
		
		const playerData = this.players.get(instanceId);
		if (!playerData || !playerData.player) {
			console.warn(`❌ Cannot remove layer - player not found`);
			return false;
		}
		
		const player = playerData.player;
		
		try {
			// Step 1: Remove from FormLayerManager's internal state
			if (player.layersManager?.formLayerManager) {
				const formManager = player.layersManager.formLayerManager;
				const formLayerIndex = formManager.formLayers.findIndex(
					formLayer => formLayer.layerElement && formLayer.layerElement.id === `layer-${instanceId}-${layerId}`
				);
				
				if (formLayerIndex !== -1) {
					formManager.formLayers.splice(formLayerIndex, 1)[0];
					console.log(`  ✅ Removed from FormLayerManager`);
					
					// Reset currentFormLayerIndex if needed
					if (formManager.currentFormLayerIndex > formLayerIndex) {
						formManager.currentFormLayerIndex--;
					}
					
					// Reset isDisplayingLayers state
					if (formManager.isDisplayingLayers) {
						formManager.isDisplayingLayers[instanceId] = false;
					}
				}
			}
			
			// Step 2: Remove from ConfigurationManager (CRITICAL!)
			if (player.configManager?.videoSetupOptions?.layers) {
				const config = player.configManager.videoSetupOptions;
				const configLayerIndex = config.layers.findIndex(
					configLayer => configLayer.id === layerId
				);
				
				if (configLayerIndex !== -1) {
					config.layers.splice(configLayerIndex, 1)[0];
					console.log(`  ✅ Removed from ConfigurationManager`);
				}
			}
			
			// Step 3: Remove DOM element
			const layerElement = document.querySelector(`#layer-${instanceId}-${layerId}`);
			if (layerElement && layerElement.parentNode) {
				layerElement.parentNode.removeChild(layerElement);
				console.log(`  ✅ DOM element removed`);
			}
			
			// Step 4: Remove from player's layers array
			const layerIndex = playerData.layers.findIndex(l => l.id === layerId);
			if (layerIndex !== -1) {
				playerData.layers.splice(layerIndex, 1)[0];
				console.log(`  ✅ Removed from player data`);
			}
			
			console.log(`✅ Layer ${layerId} completely removed from all systems`);
			return true;
			
		} catch (error) {
			console.error(`❌ Error completely removing layer ${layerId}:`, error);
			return false;
		}
	}

	/**
	 * Completely disable the layer processing system for a player
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @param {boolean} disable - Whether to disable (true) or enable (false)
	 */
	setLayerSystemEnabled(instanceId, disable) {
		console.log(`🔧 Setting layer system ${disable ? 'disabled' : 'enabled'} for player ${instanceId}`);
		
		const playerData = this.players.get(instanceId);
		if (!playerData || !playerData.player) {
			console.warn(`❌ Cannot modify layer system - player not found`);
			return;
		}
		
		const player = playerData.player;
		
		if (disable) {
			// Override setupLayers to do nothing
			if (player.layersManager && player.layersManager.setupLayers) {
				const originalSetupLayers = player.layersManager.setupLayers;
				player.layersManager.setupLayers = function() {
					console.log(`  🔧 setupLayers intercepted and blocked`);
					// Do nothing - this prevents layer recreation
				};
				console.log(`  ✅ setupLayers overridden`);
			}
			
			// Override handleFormLayersTimeUpdate to do nothing
			if (player.layersManager && player.layersManager.handleFormLayersTimeUpdate) {
				const originalHandleFormLayersTimeUpdate = player.layersManager.handleFormLayersTimeUpdate;
				player.layersManager.handleFormLayersTimeUpdate = function(currentTime) {
					console.log(`  🔧 handleFormLayersTimeUpdate intercepted and blocked`);
					// Do nothing - this prevents time-based pausing
				};
				console.log(`  ✅ handleFormLayersTimeUpdate overridden`);
			}
			
			// Override handlePlay to do nothing
			if (player.layersManager && player.layersManager.handlePlay) {
				const originalHandlePlay = player.layersManager.handlePlay;
				player.layersManager.handlePlay = function() {
					console.log(`  🔧 handlePlay intercepted and blocked`);
					// Do nothing - this prevents play-based pausing
					return false; // Always return false to prevent pausing
				};
				console.log(`  ✅ handlePlay overridden`);
			}
			
			console.log(`✅ Layer system disabled for player ${instanceId}`);
			
		} else {
			// Restore original methods (if we stored them)
			console.log(`✅ Layer system re-enabled for player ${instanceId}`);
		}
	}

	/**
	 * Override specific VideoJS event handlers
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @param {string} eventName - Event name (timeupdate, play, etc.)
	 * @param {Function} newHandler - New handler function
	 */
	overrideVideoJSEvent(instanceId, eventName, newHandler) {
		console.log(`🔧 Overriding VideoJS ${eventName} event for player ${instanceId}`);
		
		const playerData = this.players.get(instanceId);
		if (!playerData || !playerData.player) {
			console.warn(`❌ Cannot override event - player not found`);
			return;
		}
		
		const player = playerData.player;
		
		// Remove all existing listeners for this event
		player.off(eventName);
		
		// Add new event listener
		player.on(eventName, newHandler);
		
		console.log(`✅ VideoJS ${eventName} event overridden for player ${instanceId}`);
	}

	/**
	 * Get comprehensive player state including all layer information
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @return {Object} Complete player state
	 */
	getPlayerState(instanceId) {
		const playerData = this.players.get(instanceId);
		if (!playerData || !playerData.player) {
			throw new Error(`Player ${instanceId} not found`);
		}
		
		const player = playerData.player;
		
		return {
			// Video state
			currentTime: player.currentTime(),
			duration: player.duration(),
			paused: player.paused(),
			playing: !player.paused(),
			
			// Layer information
			layers: playerData.layers.map(layer => ({
				id: layer.id,
				type: layer.type,
				visible: layer.visible,
				element: layer.element ? layer.element.id : null
			})),
			
			// Manager states
			layersManager: {
				formLayersCount: player.layersManager?.formLayerManager?.formLayers?.length || 0,
				isDisplayingLayers: player.layersManager?.isDisplayingLayers?.[instanceId] || false
			},
			
			// Configuration
			configLayersCount: player.configManager?.videoSetupOptions?.layers?.length || 0,
			
			// Event listeners
			hasTimeUpdateListener: player.eventHandlers?.timeupdate?.length > 0,
			hasPlayListener: player.eventHandlers?.play?.length > 0
		};
	}

	/**
	 * Override the setupLayers method to prevent form layer recreation on non-target posts
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @param {number} targetPostId - Post ID where forms should be shown
	 */
	overrideSetupLayers(instanceId, targetPostId) {
		console.log(`🔧 Overriding setupLayers for player ${instanceId} on post ${targetPostId}`);
		
		const playerData = this.players.get(instanceId);
		if (!playerData || !playerData.player || !playerData.player.layersManager) {
			console.warn(`❌ Cannot override setupLayers - player or layersManager not found`);
			return;
		}
		
		const layersManager = playerData.player.layersManager;
		const originalSetupLayers = layersManager.setupLayers;
		
		// Override the setupLayers method
		layersManager.setupLayers = function() {
			console.log(`🔧 Overridden setupLayers called for player ${instanceId}`);
			
			// Check if we're on the target post
			const currentPostId = window.godam?.currentPostId || targetPostId;
			
			if (currentPostId === targetPostId) {
				console.log(`✅ On target post ${targetPostId}, running original setupLayers`);
				// Run the original method
				return originalSetupLayers.call(this);
			} else {
				console.log(` On non-target post ${currentPostId}, skipping setupLayers to prevent form recreation`);
				// Don't run setupLayers - this prevents form layers from being recreated
				return;
			}
		};
		
		console.log(`✅ setupLayers method overridden for player ${instanceId}`);
	}

	/**
	 * Override the time update handling to prevent form layer processing on non-target posts
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @param {number} targetPostId - Post ID where forms should be shown
	 */
	overrideTimeUpdateHandling(instanceId, targetPostId) {
		console.log(`🔧 Overriding time update handling for player ${instanceId} on post ${targetPostId}`);
		
		const playerData = this.players.get(instanceId);
		if (!playerData || !playerData.player || !playerData.player.layersManager) {
			console.warn(`❌ Cannot override time update handling - player or layersManager not found`);
			return;
		}
		
		const layersManager = playerData.player.layersManager;
		const originalHandleFormLayersTimeUpdate = layersManager.handleFormLayersTimeUpdate;
		
		// Override the handleFormLayersTimeUpdate method
		layersManager.handleFormLayersTimeUpdate = function(currentTime) {
			// Check if we're on the target post
			const currentPostId = window.godam?.currentPostId || targetPostId;
			
			if (currentPostId === targetPostId) {
				console.log(`✅ On target post ${targetPostId}, running original form layer time update`);
				// Run the original method
				return originalHandleFormLayersTimeUpdate.call(this, currentTime);
			} else {
				console.log(` On non-target post ${currentPostId}, skipping form layer time update to prevent pause`);
				// Don't run the time update - this prevents the pause behavior
				return;
			}
		};
		
		console.log(`✅ Form layer time update handling overridden for player ${instanceId}`);
	}

	/**
	 * Override the play event handling to prevent form layer pausing on non-target posts
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @param {number} targetPostId - Post ID where forms should be shown
	 */
	overridePlayEventHandling(instanceId, targetPostId) {
		console.log(`🔧 Overriding play event handling for player ${instanceId} on post ${targetPostId}`);
		
		const playerData = this.players.get(instanceId);
		if (!playerData || !playerData.player || !playerData.player.layersManager) {
			console.warn(`❌ Cannot override play event handling - player or layersManager not found`);
			return;
		}
		
		const layersManager = playerData.player.layersManager;
		const originalHandlePlay = layersManager.handlePlay;
		
		// Override the handlePlay method
		layersManager.handlePlay = function() {
			// Check if we're on the target post
			const currentPostId = window.godam?.currentPostId || targetPostId;
			
			if (currentPostId === targetPostId) {
				console.log(`✅ On target post ${targetPostId}, running original play event handling`);
				// Run the original method
				return originalHandlePlay.call(this);
			} else {
				console.log(` On non-target post ${currentPostId}, skipping play event handling to prevent pause`);
				// Don't run the play handling - this prevents the pause behavior
				return false;
			}
		};
		
		console.log(`✅ Play event handling overridden for player ${instanceId}`);
	}

	/**
	 * Remove layer from a specific player instance
	 * 
	 * @param {string} layerId - Layer ID
	 * @param {Object} playerData - Player data object
	 * @return {boolean} True if layer was removed
	 */
	removeLayerFromPlayer(layerId, playerData) {
		const layer = playerData.layers.find(l => l.id === layerId);
		if (!layer) return false;
		
		try {
			console.log(`  ️ Removing layer ${layerId} from player ${playerData.instanceId}`);
			
			// Step 1: Remove from FormLayerManager's internal state
			if (playerData.player?.layersManager?.formLayerManager) {
				const formManager = playerData.player.layersManager.formLayerManager;
				const formLayerIndex = formManager.formLayers.findIndex(
					formLayer => formLayer.layerElement === layer.element
				);
				
				if (formLayerIndex !== -1) {
					formManager.formLayers.splice(formLayerIndex, 1)[0];
					console.log(`  ✅ Removed from FormLayerManager`);
					
					// Reset currentFormLayerIndex if needed
					if (formManager.currentFormLayerIndex > formLayerIndex) {
						formManager.currentFormLayerIndex--;
					}
					
					// Reset isDisplayingLayers state
					if (formManager.isDisplayingLayers) {
						formManager.isDisplayingLayers[playerData.instanceId] = false;
					}
				}
			}
			
			// Step 2: Remove from ConfigurationManager (now accessible!)
			if (playerData.player?.configManager?.videoSetupOptions?.layers) {
				const config = playerData.player.configManager.videoSetupOptions;
				const configLayerIndex = config.layers.findIndex(
					configLayer => configLayer.id === layerId
				);
				
				if (configLayerIndex !== -1) {
					config.layers.splice(configLayerIndex, 1)[0];
					console.log(`  ✅ Removed from ConfigurationManager`);
				}
			}
			
			// Step 3: Remove DOM element
			if (layer.element && layer.element.parentNode) {
				layer.element.parentNode.removeChild(layer.element);
				console.log(`  ✅ DOM element removed`);
			}
			
			// Step 4: Remove from player's layers array
			const layerIndex = playerData.layers.findIndex(l => l.id === layerId);
			if (layerIndex !== -1) {
				playerData.layers.splice(layerIndex, 1)[0];
				console.log(`  ✅ Removed from player data`);
			}
			
			return true;
			
		} catch (error) {
			console.error(`❌ Error removing layer ${layerId}:`, error);
			return false;
		}
	}

	// ==============================
	// CUSTOM UI CONTROLS METHODS
	// ==============================

	/**
	 * Add a custom button to player(s)
	 * 
	 * @param {Object} config - Button configuration
	 * @param {string} config.id - Unique button identifier
	 * @param {string} config.text - Button text
	 * @param {string} config.icon - Button icon (FontAwesome class or SVG)
	 * @param {Function} config.onClick - Click handler function
	 * @param {string} config.position - Button position ('bottom-right', 'bottom-left', 'top-right', 'top-left', 'control-bar')
	 * @param {string} config.instanceId - Specific player instance (optional, applies to all if not specified)
	 * @param {Object} config.styles - Custom CSS styles object (optional)
	 * @param {string} config.className - Additional CSS classes (optional)
	 * @return {string} Button ID
	 */
	addCustomButton(config) {
		if (!config.id || !config.onClick || typeof config.onClick !== 'function') {
			throw new Error('Button must have an id and onClick function');
		}

		const buttonConfig = {
			...config,
			position: config.position || 'bottom-right',
			text: config.text || '',
			icon: config.icon || '',
			styles: config.styles || {},
			className: config.className || ''
		};

		this.customButtons.set(config.id, buttonConfig);
		
		// Apply to existing players
		if (config.instanceId) {
			this.renderCustomButton(config.instanceId, buttonConfig);
		} else {
			// Apply to all players
			this.players.forEach((playerData, instanceId) => {
				this.renderCustomButton(instanceId, buttonConfig);
			});
		}

		console.log(`Custom button added: ${config.id}`);
		return config.id;
	}

	/**
	 * Remove a custom button
	 * 
	 * @param {string} buttonId - Button identifier
	 * @return {boolean} True if button was removed
	 */
	removeCustomButton(buttonId) {
		const buttonConfig = this.customButtons.get(buttonId);
		if (!buttonConfig) return false;

		// Remove from all players
		this.players.forEach((playerData, instanceId) => {
			this.removeCustomButtonFromPlayer(instanceId, buttonId);
		});

		const removed = this.customButtons.delete(buttonId);
		if (removed) {
			console.log(`Custom button removed: ${buttonId}`);
		}
		return removed;
	}

	/**
	 * Render a custom button on a specific player
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @param {Object} buttonConfig - Button configuration
	 */
	renderCustomButton(instanceId, buttonConfig) {
		const playerData = this.players.get(instanceId);
		if (!playerData) return;

		const player = playerData.player;
		const playerEl = player.el();

		// Remove existing button if it exists
		this.removeCustomButtonFromPlayer(instanceId, buttonConfig.id);

		let button;

		if (buttonConfig.position === 'control-bar') {
			// Add to VideoJS control bar
			button = this.createControlBarButton(player, buttonConfig);
		} else {
			// Add as overlay button
			button = this.createOverlayButton(playerEl, buttonConfig);
		}

		// Store reference for removal
		if (!playerData.customButtons) {
			playerData.customButtons = [];
		}
		playerData.customButtons.push({
			id: buttonConfig.id,
			element: button,
			config: buttonConfig
		});
	}

	/**
	 * Create a control bar button
	 * 
	 * @param {Object} player - VideoJS player instance
	 * @param {Object} buttonConfig - Button configuration
	 * @return {Object} VideoJS button component
	 */
	createControlBarButton(player, buttonConfig) {
		const Button = videojs.getComponent('Button');

		class CustomButton extends Button {
			constructor(player, options) {
				super(player, options);
				this.buttonConfig = buttonConfig;
			}

			buildCSSClass() {
				return `godam-custom-button ${buttonConfig.className} ${super.buildCSSClass()}`;
			}

			createEl() {
				const element = super.createEl();
				
				if (buttonConfig.icon) {
					if (buttonConfig.icon.startsWith('<svg')) {
						element.innerHTML = buttonConfig.icon;
					} else {
						const icon = document.createElement('i');
						icon.className = buttonConfig.icon;
						element.appendChild(icon);
					}
				}
				
				if (buttonConfig.text) {
					const text = document.createElement('span');
					text.textContent = buttonConfig.text;
					element.appendChild(text);
				}

				// Apply custom styles
				Object.assign(element.style, buttonConfig.styles);

				return element;
			}

			handleClick(event) {
				event.preventDefault();
				buttonConfig.onClick(this.player_, event);
			}
		}

		// Register and add to control bar
		if (!videojs.getComponent(`CustomButton_${buttonConfig.id}`)) {
			videojs.registerComponent(`CustomButton_${buttonConfig.id}`, CustomButton);
		}

		const controlBar = player.controlBar;
		const button = controlBar.addChild(`CustomButton_${buttonConfig.id}`, {});
		
		return button;
	}

	/**
	 * Create an overlay button
	 * 
	 * @param {HTMLElement} playerEl - Player element
	 * @param {Object} buttonConfig - Button configuration
	 * @return {HTMLElement} Button element
	 */
	createOverlayButton(playerEl, buttonConfig) {
		const button = document.createElement('button');
		button.className = `godam-custom-overlay-button ${buttonConfig.className}`;
		button.setAttribute('data-button-id', buttonConfig.id);

		// Add content
		if (buttonConfig.icon) {
			if (buttonConfig.icon.startsWith('<svg')) {
				const iconWrapper = document.createElement('span');
				iconWrapper.innerHTML = buttonConfig.icon;
				button.appendChild(iconWrapper);
			} else {
				const icon = document.createElement('i');
				icon.className = buttonConfig.icon;
				button.appendChild(icon);
			}
		}

		if (buttonConfig.text) {
			const text = document.createElement('span');
			text.textContent = buttonConfig.text;
			button.appendChild(text);
		}

		// Apply position styles
		const positionStyles = this.getPositionStyles(buttonConfig.position);
		Object.assign(button.style, positionStyles, buttonConfig.styles);

		// Add click handler
		button.addEventListener('click', (event) => {
			buttonConfig.onClick(playerEl, event);
		});

		// Add to player
		playerEl.appendChild(button);
		
		return button;
	}

	/**
	 * Get position styles for overlay buttons
	 * 
	 * @param {string} position - Position identifier
	 * @return {Object} CSS styles object
	 */
	getPositionStyles(position) {
		const baseStyles = {
			position: 'absolute',
			zIndex: '20',
			padding: '8px 12px',
			backgroundColor: 'rgba(0, 0, 0, 0.7)',
			color: 'white',
			border: 'none',
			borderRadius: '4px',
			cursor: 'pointer',
			fontSize: '14px',
			display: 'flex',
			alignItems: 'center',
			gap: '6px',
			transition: 'all 0.3s ease'
		};

		const positions = {
			'bottom-right': { bottom: '20px', right: '20px' },
			'bottom-left': { bottom: '20px', left: '20px' },
			'top-right': { top: '20px', right: '20px' },
			'top-left': { top: '20px', left: '20px' },
			'center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
		};

		return { ...baseStyles, ...positions[position] };
	}

	/**
	 * Remove a custom button from a specific player
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @param {string} buttonId - Button ID
	 */
	removeCustomButtonFromPlayer(instanceId, buttonId) {
		const playerData = this.players.get(instanceId);
		if (!playerData || !playerData.customButtons) return;

		const buttonIndex = playerData.customButtons.findIndex(btn => btn.id === buttonId);
		if (buttonIndex !== -1) {
			const buttonData = playerData.customButtons[buttonIndex];
			
			// Remove from DOM
			if (buttonData.config.position === 'control-bar') {
				// Remove from control bar
				const controlBar = playerData.player.controlBar;
				try {
					controlBar.removeChild(buttonData.element);
				} catch (e) {
					// Element might already be removed
				}
			} else {
				// Remove overlay button
				if (buttonData.element && buttonData.element.parentNode) {
					buttonData.element.parentNode.removeChild(buttonData.element);
				}
			}

			// Remove from array
			playerData.customButtons.splice(buttonIndex, 1);
		}
	}

	/**
	 * Render all custom buttons for a player
	 * 
	 * @param {string} instanceId - Player instance ID
	 */
	renderCustomButtons(instanceId) {
		this.customButtons.forEach(buttonConfig => {
			if (!buttonConfig.instanceId || buttonConfig.instanceId === instanceId) {
				this.renderCustomButton(instanceId, buttonConfig);
			}
		});
	}

	/**
	 * Reposition custom buttons (useful for fullscreen changes)
	 * 
	 * @param {string} instanceId - Player instance ID
	 */
	repositionCustomButtons(instanceId) {
		const playerData = this.players.get(instanceId);
		if (!playerData || !playerData.customButtons) return;

		playerData.customButtons.forEach(buttonData => {
			if (buttonData.config.position !== 'control-bar') {
				const positionStyles = this.getPositionStyles(buttonData.config.position);
				Object.assign(buttonData.element.style, positionStyles);
			}
		});
	}

	// ==============================
	// STYLE MANAGEMENT METHODS
	// ==============================

	/**
	 * Add custom styles to a player
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @param {Object} styles - Styles configuration
	 * @param {string} styles.id - Unique style identifier
	 * @param {string} styles.css - CSS rules as string
	 * @param {Object} styles.playerStyles - Direct player element styles
	 * @param {Object} styles.controlBarStyles - Control bar styles
	 * @param {Object} styles.layerStyles - Layer styles
	 * @return {string} Style ID
	 */
	addPlayerStyle(instanceId, styles) {
		if (!styles.id) {
			throw new Error('Style must have an id');
		}

		const playerData = this.players.get(instanceId);
		if (!playerData) {
			throw new Error(`Player ${instanceId} not found`);
		}

		// Store style configuration
		if (!playerData.customStyles) {
			playerData.customStyles = [];
		}

		const existingIndex = playerData.customStyles.findIndex(s => s.id === styles.id);
		if (existingIndex !== -1) {
			playerData.customStyles[existingIndex] = styles;
		} else {
			playerData.customStyles.push(styles);
		}

		// Apply styles immediately
		this.applyCustomStyles(instanceId);

		console.log(`Custom styles added to player ${instanceId}: ${styles.id}`);
		return styles.id;
	}

	/**
	 * Remove custom styles from a player
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @param {string} styleId - Style identifier
	 * @return {boolean} True if style was removed
	 */
	removePlayerStyle(instanceId, styleId) {
		const playerData = this.players.get(instanceId);
		if (!playerData || !playerData.customStyles) return false;

		const styleIndex = playerData.customStyles.findIndex(s => s.id === styleId);
		if (styleIndex !== -1) {
			playerData.customStyles.splice(styleIndex, 1);
			
			// Remove style element from DOM
			const styleElement = document.getElementById(`godam-custom-style-${instanceId}-${styleId}`);
			if (styleElement) {
				styleElement.remove();
			}

			console.log(`Custom styles removed from player ${instanceId}: ${styleId}`);
			return true;
		}

		return false;
	}

	/**
	 * Apply all custom styles to a player
	 * 
	 * @param {string} instanceId - Player instance ID
	 */
	applyCustomStyles(instanceId) {
		const playerData = this.players.get(instanceId);
		if (!playerData || !playerData.customStyles) return;

		const player = playerData.player;
		const playerEl = player.el();

		playerData.customStyles.forEach(styles => {
			// Apply CSS styles
			if (styles.css) {
				this.injectCSS(instanceId, styles.id, styles.css);
			}

			// Apply direct player styles
			if (styles.playerStyles) {
				Object.assign(playerEl.style, styles.playerStyles);
			}

			// Apply control bar styles
			if (styles.controlBarStyles) {
				const controlBar = player.controlBar.el();
				Object.assign(controlBar.style, styles.controlBarStyles);
			}

			// Apply layer styles
			if (styles.layerStyles) {
				playerData.layers.forEach(layer => {
					if (layer.element) {
						Object.assign(layer.element.style, styles.layerStyles);
					}
				});
			}
		});
	}

	/**
	 * Inject CSS into the document
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @param {string} styleId - Style identifier
	 * @param {string} css - CSS rules
	 */
	injectCSS(instanceId, styleId, css) {
		const elementId = `godam-custom-style-${instanceId}-${styleId}`;
		let styleElement = document.getElementById(elementId);

		if (!styleElement) {
			styleElement = document.createElement('style');
			styleElement.id = elementId;
			document.head.appendChild(styleElement);
		}

		// Scope CSS to specific player instance
		const scopedCSS = css.replace(/\.easydam-player/g, `[data-instance-id="${instanceId}"] .easydam-player`);
		styleElement.textContent = scopedCSS;
	}

	// ==============================
	// PLAYER CONTROL METHODS
	// ==============================

	/**
	 * Play video
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @return {Promise} Play promise
	 */
	playVideo(instanceId) {
		const playerData = this.players.get(instanceId);
		if (!playerData) {
			throw new Error(`Player ${instanceId} not found`);
		}

		return playerData.player.play();
	}

	/**
	 * Pause video
	 * 
	 * @param {string} instanceId - Player instance ID
	 */
	pauseVideo(instanceId) {
		const playerData = this.players.get(instanceId);
		if (!playerData) {
			throw new Error(`Player ${instanceId} not found`);
		}

		playerData.player.pause();
	}

	/**
	 * Seek to specific time
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @param {number} time - Time in seconds
	 */
	seekTo(instanceId, time) {
		const playerData = this.players.get(instanceId);
		if (!playerData) {
			throw new Error(`Player ${instanceId} not found`);
		}

		playerData.player.currentTime(time);
	}

	/**
	 * Set volume
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @param {number} volume - Volume level (0-1)
	 */
	setVolume(instanceId, volume) {
		const playerData = this.players.get(instanceId);
		if (!playerData) {
			throw new Error(`Player ${instanceId} not found`);
		}

		playerData.player.volume(Math.max(0, Math.min(1, volume)));
	}

	/**
	 * Toggle fullscreen
	 * 
	 * @param {string} instanceId - Player instance ID
	 */
	toggleFullscreen(instanceId) {
		const playerData = this.players.get(instanceId);
		if (!playerData) {
			throw new Error(`Player ${instanceId} not found`);
		}

		const player = playerData.player;
		if (player.isFullscreen()) {
			player.exitFullscreen();
		} else {
			player.requestFullscreen();
		}
	}

	// ==============================
	// GLOBAL HOOKS METHODS
	// ==============================

	/**
	 * Add a global hook that runs for all players
	 * 
	 * @param {Object} hook - Global hook configuration
	 * @param {string} hook.id - Unique hook identifier
	 * @param {Function} hook.callback - Function to execute
	 * @param {string} hook.description - Hook description
	 * @return {string} Hook ID
	 */
	addGlobalHook(hook) {
		if (!hook.id || !hook.callback || typeof hook.callback !== 'function') {
			throw new Error('Global hook must have an id and callback function');
		}

		this.globalHooks.push(hook);
		console.log(`Global hook added: ${hook.id} - ${hook.description || 'No description'}`);
		
		// Execute hook immediately
		hook.callback(this);
		
		return hook.id;
	}

	/**
	 * Remove a global hook
	 * 
	 * @param {string} hookId - Hook identifier
	 * @return {boolean} True if hook was removed
	 */
	removeGlobalHook(hookId) {
		const index = this.globalHooks.findIndex(hook => hook.id === hookId);
		if (index !== -1) {
			this.globalHooks.splice(index, 1);
			console.log(`Global hook removed: ${hookId}`);
			return true;
		}
		return false;
	}

	/**
	 * Execute all global hooks
	 */
	executeGlobalHooks() {
		this.globalHooks.forEach(hook => {
			try {
				hook.callback(this);
			} catch (error) {
				console.error(`Error in global hook ${hook.id}:`, error);
			}
		});
	}

	// ==============================
	// UTILITY METHODS
	// ==============================

	/**
	 * Refresh layer data (useful after dynamic changes)
	 * 
	 * @param {string} instanceId - Player instance ID (optional)
	 */
	refreshLayers(instanceId = null) {
		if (instanceId) {
			const player = this.players.get(instanceId);
			if (player && player.layersManager) {
				this.extractLayers(instanceId, player.layersManager);
			}
		} else {
			this.players.forEach((playerData, id) => {
				if (playerData.layersManager) {
					this.extractLayers(id, playerData.layersManager);
				}
			});
		}
	}

	/**
	 * Get player statistics
	 * 
	 * @param {string} instanceId - Player instance ID
	 * @return {Object} Player statistics
	 */
	getPlayerStats(instanceId) {
		const playerData = this.players.get(instanceId);
		if (!playerData) {
			throw new Error(`Player ${instanceId} not found`);
		}

		const player = playerData.player;
		return {
			currentTime: player.currentTime(),
			duration: player.duration(),
			buffered: player.buffered(),
			volume: player.volume(),
			muted: player.muted(),
			paused: player.paused(),
			ended: player.ended(),
			fullscreen: player.isFullscreen(),
			layers: playerData.layers.map(layer => ({
				id: layer.id,
				type: layer.type,
				visible: layer.visible
			})),
			customButtons: playerData.customButtons?.length || 0,
			customStyles: playerData.customStyles?.length || 0
		};
	}

	/**
	 * Create preset button configurations
	 * 
	 * @return {Object} Preset configurations
	 */
	getPresetButtons() {
		return {
			skipVideo: {
				id: 'skip-video',
				text: 'Skip Video',
				icon: 'fas fa-forward',
				position: 'bottom-right',
				onClick: (player, event) => {
					// Seek to end of video
					player.currentTime(player.duration());
				}
			},
			replayVideo: {
				id: 'replay-video',
				text: 'Replay',
				icon: 'fas fa-redo',
				position: 'bottom-left',
				onClick: (player, event) => {
					// Reset video to beginning and play
					player.currentTime(0);
					player.play();
				}
			},
			muteToggle: {
				id: 'mute-toggle',
				text: 'Mute',
				icon: 'fas fa-volume-mute',
				position: 'top-right',
				onClick: (player, event) => {
					// Toggle mute
					player.muted(!player.muted());
				}
			}
		};
	}
}
