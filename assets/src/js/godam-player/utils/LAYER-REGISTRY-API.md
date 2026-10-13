# GoDAM Layer Registry Usage Guide

/**

* LAYER REGISTRY USAGE GUIDE FOR ADD-ONS
*
* The GoDAM player now supports dynamically registering custom layer types via JavaScript hooks.
* Add-ons can register custom layers that will be processed alongside built-in layers.
*
* GLOBAL API
* ==========
* Available at: window.godamLayerRegistry
*
* API Methods:
* -----------
* 1. registerLayerType(id, config)
* Register a new custom layer type
* @param {string} id - Unique identifier (e.g., 'woo', 'custom-layer')
* @param {Object} config
*      - label {string} - Human-readable label
*      - validator {Function} - Validation function: (layer, dependencies) => boolean
*      - manager {Class} - [Optional] Layer manager class
* @return {boolean} - True if registered, false if already exists
*
* 1. getLayerTypes()
* Get all registered layer type IDs
* @return {Object} - { FORM: 'form', HOTSPOT: 'hotspot', WOO: 'woo', ... }
*
* 1. isLayerTypeRegistered(layerType)
* Check if a layer type is registered
* @param {string} layerType - The layer type ID
* @return {boolean}
*
* 1. getLayerValidator(layerType)
* Get the validator function for a layer type
* @param {string} layerType - The layer type ID
* @return {Function|null}
*
* 1. getLayerManager(layerType)
* Get the manager class for a layer type
* @param {string} layerType - The layer type ID
* @return {Function|null}
*
* 1. getAllRegisteredLayerTypes()
* Get metadata for all custom registered types
* @return {Object}
*
* 1. addLayerRegistryHook(callback)
* Add a hook that fires when custom layers are registered
* @param {Function} callback - (action, layerId, config) => void
*
*
* EXAMPLE 1: SIMPLE CUSTOM LAYER (No Manager)
* =============================================
* If you only need to validate whether a custom layer should be processed,
* register without a manager class:
*
* window.godamLayerRegistry.registerLayerType('my-custom', {
*     label: 'My Custom Layer',
*     validator: (layer, dependencies) => {
*       // Check if required dependencies are available
*       return dependencies?.myPlugin === true;
*     },
* });
*
*
* EXAMPLE 2: CUSTOM LAYER WITH MANAGER
* =====================================
* For layers that need setup and interaction logic, provide a manager class:
*
* class MyCustomLayerManager {
*     constructor(player, isDisplayingLayers, currentPlayerVideoInstanceId) {
*       this.player = player;
*       this.isDisplayingLayers = isDisplayingLayers;
*       this.currentPlayerVideoInstanceId = currentPlayerVideoInstanceId;
*     }
*
*     // Called when a layer of this type needs to be set up
*     setupLayer(layer, layerElement) {
*       // Initialize your layer UI
*       console.log('Setting up custom layer:', layer);
*     }
*
*     // Called on video time updates
*     handleTimeUpdate(currentTime) {
*       // Handle time-based logic
*     }
*
*     // Called when video is resized (optional)
*     handleResize() {
*       // Handle resize logic
*     }
* }
*
* window.godamLayerRegistry.registerLayerType('my-custom', {
*     label: 'My Custom Layer',
*     validator: (layer, dependencies) => dependencies?.myPlugin === true,
*     manager: MyCustomLayerManager,
* });
*
*
* EXAMPLE 3: REGISTERING FROM ADD-ON PLUGIN
* ==========================================
* Most commonly, you'll register from your add-on's main JavaScript file:
*
* File: wp-content/plugins/my-addon/assets/js/my-addon-layer.js
*
* import MyLayerManager from './managers/my-layer-manager.js';
*
* document.addEventListener('DOMContentLoaded', () => {
*     if (window.godamLayerRegistry) {
*       window.godamLayerRegistry.registerLayerType('my-addon', {
*         label: 'My Addon Layer',
*         validator: (layer, dependencies) => {
*           return dependencies?.myAddon === true;
*         },
*         manager: MyLayerManager,
*       });
*     } else {
*       console.error('GoDAM layer registry not available');
*     }
* });
*
*
* LAYER STRUCTURE IN DATABASE
* ============================
* When creating a layer in GoDAM, the layer object includes:
*
* {
*     type: 'my-custom',        // Must match the registered ID
*     id: 123,                  // Unique layer ID
*     content: {...},           // Your custom content
*     startTime: 5,
*     endTime: 15,
*     // ... other layer data
* }
*
*
* MANAGER CLASS INTERFACE
* =======================
* Your manager class should implement these methods:
*
* setupLayer(layer, layerElement)
*     - Called when layer should be initialized
*     - layer: the layer config object
*     - layerElement: the DOM element for this layer
*
* handleTimeUpdate(currentTime) [optional]
*     - Called on every video time update
*     - currentTime: current playback time in seconds
*
* handleResize() [optional]
*     - Called when video is resized
*     - Use to reposition layer elements
*
*
* BUILT-IN LAYER TYPES
* ====================
* These are already available:
*
* * 'form' - Form layers (Gravity Forms, WPForms, etc.)
* * 'cta' - Call-to-action layers
* * 'poll' - Poll layers
* * 'hotspot' - Interactive hotspot layers
* * 'woo' - WooCommerce layers (from GoDAM for Woo add-on)
*
*
* DEPENDENCIES OBJECT
* ===================
* The validator receives a `dependencies` object with plugin availability flags:
*
* dependencies = {
*     gravityforms: true,        // If Gravity Forms is active
*     wpforms: true,             // If WPForms is active
*     cf7: true,                 // If Contact Form 7 is active
*     woocommerce: true,         // If WooCommerce is active
*     wpPolls: true,             // If WP Polls is active
*     jetpack: true,             // If Jetpack is active
*     // ... other dependencies
* }
*
* Use these to determine if your layer should be processed.
*
*
* VALIDATION FLOW
* ===============
* For each layer in a video:
* 1. LayersManager.processLayer() is called
* 1. LayerValidator.shouldProcessLayer() checks validation
* * Looks up validator via window.godamLayerRegistry.getLayerValidator()
* * Calls validator(layer, dependencies)
* 1. If validator returns true:
* * LayersManager.handleLayerDisplay() is called
* * Looks up manager via window.godamLayerRegistry.getLayerManager()
* * Instantiates and calls setupLayer()
*
*
* HOOKS
* =====
* Add custom hooks to be notified when layers are registered:
*
* window.godamLayerRegistry.addLayerRegistryHook((action, layerId, config) => {
*     if (action === 'register') {
*       console.log(`Custom layer registered: ${layerId}`);
*       console.log('Config:', config);
*     }
* });
*
*
* ERROR HANDLING
* ==============
* * Duplicate registration attempt: Logs a warning, returns false
* * Missing required config fields: Logs an error, returns false
* * Manager class not found: Layer will still be validated, but no setupLayer() called
*
*
* BEST PRACTICES
* ==============
* 1. Register layers early in your add-on's initialization
* 1. Use descriptive layer type IDs to avoid conflicts (e.g., 'addon-name-layer-type')
* 1. Always provide a validator function, even if it just returns true
* 1. If providing a manager, implement setupLayer() at minimum
* 1. Check window.godamLayerRegistry exists before calling
* 1. Use console for debugging during development
 */

// This file is for documentation purposes and should be reviewed by add-on developers.
export default {};
