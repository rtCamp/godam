# GoDAM Player Developer API Guide

The GoDAM Player Developer API provides external developers with comprehensive control over video players, layers, custom UI elements, and styling. This guide covers all available functionality and provides practical examples.

## Table of Contents

1. [Getting Started](#getting-started)
2. [API Overview](#api-overview)
3. [Player Control](#player-control)
4. [Layer Management](#layer-management)
5. [Custom UI Elements](#custom-ui-elements)
6. [Style Management](#style-management)
7. [Integration Methods](#integration-methods)
8. [Examples](#examples)
9. [Best Practices](#best-practices)

## Getting Started

The GoDAM Developer API is automatically available after the player initializes. Access it through the global `window.godam` object.

### Basic Setup

```javascript
// Wait for the API to be ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if API is available
    if (window.godam && window.godam.player) {
        console.log('GoDAM API is ready!');
        setupCustomLogic();
    } else {
        // Wait for API to initialize
        const checkAPI = setInterval(function() {
            if (window.godam && window.godam.player) {
                clearInterval(checkAPI);
                setupCustomLogic();
            }
        }, 100);
    }
});

function setupCustomLogic() {
    const api = window.godam.player;
    // Your custom code here
}
```

## API Overview

### Global Access Points

- `window.godam.player` - Main API instance
- `window.godam.getPlayer(instanceId)` - Get specific player
- `window.godam.getAllPlayers()` - Get all players
- `window.godam.*` - Convenience methods

### Core Functionality

1. **Player Control** - Play, pause, seek, volume, fullscreen
2. **Layer Management** - Show/hide layers conditionally
3. **Custom UI** - Add buttons, controls, overlays
4. **Style Management** - Apply custom CSS and styling
5. **Event Hooks** - React to player events and states

## Player Control

### Basic Player Operations

```javascript
const api = window.godam.player;

// Get a specific player
const player = api.getPlayer('player-instance-id');

// Play/pause video
api.playVideo('player-instance-id');
api.pauseVideo('player-instance-id');

// Seek to specific time (in seconds)
api.seekTo('player-instance-id', 30);

// Set volume (0-1)
api.setVolume('player-instance-id', 0.5);

// Toggle fullscreen
api.toggleFullscreen('player-instance-id');

// Get player statistics
const stats = api.getPlayerStats('player-instance-id');
console.log(stats);
```

### Direct VideoJS Access

```javascript
// Access VideoJS player directly
const playerData = api.getPlayer('player-instance-id');
const videojsPlayer = playerData.player;

// Use any VideoJS method
videojsPlayer.on('play', function() {
    console.log('Video started playing');
});

videojsPlayer.currentTime(60); // Seek to 60 seconds
videojsPlayer.volume(0.8);      // Set volume to 80%
```

## Layer Management

### Conditional Layer Display

```javascript
// Hide layers based on conditions
api.addLayerHook({
    id: 'conditional-layer-display',
    description: 'Hide CTA layers for specific conditions',
    type: 'cta', // or 'form', 'poll', 'hotspot'
    condition: function(layer, player, currentTime) {
        // Your condition logic here
        // Return false to hide, true to show
        
        // Example: Hide CTA layers for mobile users
        if (window.innerWidth <= 768) {
            return false;
        }
        
        // Example: Show only during specific time range
        if (currentTime >= 30 && currentTime <= 60) {
            return true;
        }
        
        return true; // Default: show layer
    }
});
```

### Layer Control Examples

```javascript
// Hide specific layer
api.hideLayer('layer-id', 'player-instance-id');

// Show specific layer
api.showLayer('layer-id', 'player-instance-id');

// Get layer information
const layer = api.getLayer('layer-id', 'player-instance-id');
console.log(layer);

// Remove layer hook
api.removeLayerHook('hook-id');
```

### Advanced Layer Hooks

```javascript
// Multiple conditions
api.addLayerHook({
    id: 'complex-layer-logic',
    description: 'Complex layer visibility logic',
    condition: function(layer, player, currentTime) {
        const now = new Date();
        const hour = now.getHours();
        const isMobile = window.innerWidth <= 768;
        const userCountry = getUserCountry(); // Your function
        
        // Hide if any condition is met
        if (isMobile || hour < 9 || hour > 17 || userCountry === 'DE') {
            return false;
        }
        
        return true;
    }
});

// Layer-specific hook
api.addLayerHook({
    id: 'specific-layer-hide',
    layerId: 'cta-123', // Only apply to this specific layer
    condition: function(layer, player) {
        // Custom logic for this specific layer
        return !shouldHideThisLayer();
    }
});
```

## Custom UI Elements

### Adding Custom Buttons

```javascript
// Add a skip video button
api.addCustomButton({
    id: 'skip-video',
    text: 'Skip Video',
    icon: 'fas fa-forward',
    position: 'bottom-right',
    className: 'theme-primary',
    onClick: function(playerEl, event) {
        // Get the VideoJS player from the element
        const player = api.getPlayer(playerEl.dataset.instanceId);
        if (player) {
            // Seek to end of video
            player.player.currentTime(player.player.duration());
        }
    }
});

// Add a replay button
api.addCustomButton({
    id: 'replay-video',
    text: 'Replay',
    icon: 'fas fa-redo',
    position: 'bottom-left',
    onClick: function(playerEl, event) {
        const player = api.getPlayer(playerEl.dataset.instanceId);
        if (player) {
            // Reset to beginning and play
            player.player.currentTime(0);
            player.player.play();
        }
    }
});
```

### Button Positioning Options

- `bottom-right` - Bottom right corner
- `bottom-left` - Bottom left corner  
- `top-right` - Top right corner
- `top-left` - Top left corner
- `center` - Center of video
- `control-bar` - Inside VideoJS control bar

### Advanced Button Configuration

```javascript
api.addCustomButton({
    id: 'advanced-button',
    text: 'Custom Action',
    icon: '<svg>...</svg>', // SVG icon
    position: 'top-right',
    className: 'theme-secondary custom-class',
    styles: {
        backgroundColor: '#ff6b6b',
        color: 'white',
        borderRadius: '20px',
        padding: '10px 15px'
    },
    instanceId: 'specific-player-id', // Only add to this player
    onClick: function(playerEl, event) {
        // Custom functionality
        console.log('Custom button clicked');
    }
});
```

### Preset Buttons

```javascript
// Use preset button configurations
const presets = api.getPresetButtons();

// Add skip button preset
api.addCustomButton(presets.skipVideo);

// Add replay button preset
api.addCustomButton(presets.replayVideo);

// Add mute toggle preset
api.addCustomButton(presets.muteToggle);
```

## Style Management

### Adding Custom Styles

```javascript
// Add custom CSS styles to a player
api.addPlayerStyle('player-instance-id', {
    id: 'custom-theme',
    css: `
        .easydam-player .vjs-control-bar {
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
        }
        
        .easydam-layer {
            backdrop-filter: blur(10px);
        }
    `,
    playerStyles: {
        borderRadius: '20px',
        overflow: 'hidden'
    },
    controlBarStyles: {
        height: '60px'
    },
    layerStyles: {
        borderRadius: '10px'
    }
});
```

### Style Management

```javascript
// Remove custom styles
api.removePlayerStyle('player-instance-id', 'style-id');

// Apply multiple styles
api.addPlayerStyle('player-instance-id', {
    id: 'dark-theme',
    css: `
        .easydam-player {
            filter: brightness(0.8) contrast(1.2);
        }
    `
});
```

## Integration Methods

### 1. WordPress Theme Integration

Create a file in your theme: `/wp-content/themes/your-theme/godam-integration.php`

```php
<?php
add_action('godam_developer_script', 'your_custom_godam_logic');

function your_custom_godam_logic() {
    ?>
    <script>
    document.addEventListener('DOMContentLoaded', function() {
        if (window.godam && window.godam.player) {
            setupCustomPlayerFeatures();
        }
    });
    
    function setupCustomPlayerFeatures() {
        const api = window.godam.player;
        
        // Your custom code here
        api.addCustomButton({
            id: 'theme-skip-button',
            text: 'Skip',
            position: 'bottom-right',
            onClick: function(playerEl, event) {
                // Custom skip functionality
            }
        });
    }
    </script>
    <?php
}
```

### 2. Plugin Integration

```php
<?php
add_action('godam_plugin_custom_script', 'your_plugin_godam_integration');

function your_plugin_godam_integration() {
    // Your JavaScript integration code
}
```

### 3. Direct Hook in functions.php

```php
<?php
add_action('godam_developer_script', function() {
    ?>
    <script>
    // Your custom JavaScript
    </script>
    <?php
});
```

## Examples

### Example 1: Geolocation-Based Layer Control

```javascript
// Hide CTA layers for European users
function setupGeolocationControl() {
    // First, detect user location
    fetch('https://ipapi.co/json/')
        .then(response => response.json())
        .then(data => {
            const isEurope = isEuropeanCountry(data.country_code);
            
            if (isEurope) {
                api.addLayerHook({
                    id: 'europe-cta-hide',
                    type: 'cta',
                    description: 'Hide CTA layers for European users',
                    condition: function(layer, player) {
                        return false; // Hide all CTA layers
                    }
                });
            }
        })
        .catch(error => {
            console.warn('Geolocation detection failed:', error);
        });
}

function isEuropeanCountry(countryCode) {
    const europeanCountries = ['DE', 'FR', 'IT', 'ES', 'GB', 'NL', 'PL', 'BE'];
    return europeanCountries.includes(countryCode);
}
```

### Example 2: Business Hours Layer Display

```javascript
// Show layers only during business hours
api.addLayerHook({
    id: 'business-hours-only',
    description: 'Show layers only during business hours',
    condition: function(layer, player) {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Business hours: Monday-Friday, 9 AM - 5 PM
        const isWeekday = day >= 1 && day <= 5;
        const isBusinessHours = hour >= 9 && hour < 17;
        
        return isWeekday && isBusinessHours;
    }
});
```

### Example 3: Custom Video Controls

```javascript
function setupCustomControls() {
    const api = window.godam.player;
    
    // Add skip button
    api.addCustomButton({
        id: 'skip-to-end',
        text: 'Skip Video',
        icon: 'fas fa-fast-forward',
        position: 'bottom-right',
        className: 'theme-primary',
        onClick: function(playerEl, event) {
            const instanceId = playerEl.closest('.video-js').dataset.instanceId;
            api.seekTo(instanceId, api.getPlayerStats(instanceId).duration - 5);
        }
    });
    
    // Add replay button
    api.addCustomButton({
        id: 'replay-from-start',
        text: 'Replay',
        icon: 'fas fa-redo',
        position: 'bottom-left',
        onClick: function(playerEl, event) {
            const instanceId = playerEl.closest('.video-js').dataset.instanceId;
            api.seekTo(instanceId, 0);
            api.playVideo(instanceId);
        }
    });
    
    // Add speed control
    api.addCustomButton({
        id: 'speed-toggle',
        text: '1x',
        position: 'control-bar',
        onClick: function(player, event) {
            const currentRate = player.playbackRate();
            const speeds = [1, 1.25, 1.5, 2];
            const currentIndex = speeds.indexOf(currentRate);
            const nextIndex = (currentIndex + 1) % speeds.length;
            const newSpeed = speeds[nextIndex];
            
            player.playbackRate(newSpeed);
            event.target.textContent = newSpeed + 'x';
        }
    });
}
```

### Example 4: User Preference Based Control

```javascript
function setupUserPreferences() {
    // Check user preferences
    const userPrefs = {
        hideAds: localStorage.getItem('hideAds') === 'true',
        autoplay: localStorage.getItem('autoplay') === 'true',
        preferredVolume: parseFloat(localStorage.getItem('volume') || '1')
    };
    
    // Apply layer preferences
    if (userPrefs.hideAds) {
        api.addLayerHook({
            id: 'user-hide-ads',
            type: 'cta',
            condition: function(layer, player) {
                return false; // Hide all CTA layers
            }
        });
    }
    
    // Apply player preferences
    api.addGlobalHook({
        id: 'apply-user-preferences',
        callback: function(api) {
            api.getAllPlayers().forEach(playerData => {
                const player = playerData.player;
                
                // Set volume
                player.volume(userPrefs.preferredVolume);
                
                // Configure autoplay
                if (userPrefs.autoplay) {
                    player.autoplay(true);
                }
            });
        }
    });
}
```

### Example 5: Advanced Custom Styling

```javascript
function setupCustomStyling() {
    // Apply custom theme to all players
    api.getAllPlayers().forEach(playerData => {
        api.addPlayerStyle(playerData.instanceId, {
            id: 'custom-dark-theme',
            css: `
                .easydam-player {
                    border-radius: 15px;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                }
                
                .easydam-player .vjs-control-bar {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    backdrop-filter: blur(10px);
                }
                
                .easydam-layer {
                    backdrop-filter: blur(8px);
                    border-radius: 10px;
                    margin: 20px;
                }
                
                .skip-button {
                    background: linear-gradient(45deg, #ff6b6b, #ee5a24);
                    border-radius: 25px;
                    padding: 12px 20px;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
            `,
            playerStyles: {
                transform: 'scale(1.02)',
                transition: 'all 0.3s ease'
            }
        });
    });
}
```

## Best Practices

### 1. Error Handling

```javascript
function safeAPICall(callback) {
    try {
        if (window.godam && window.godam.player) {
            callback(window.godam.player);
        } else {
            console.warn('GoDAM API not available');
        }
    } catch (error) {
        console.error('GoDAM API error:', error);
    }
}

// Usage
safeAPICall(function(api) {
    api.addCustomButton({
        // button config
    });
});
```

### 2. Performance Considerations

```javascript
// Debounce frequent operations
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Debounced layer updates
const updateLayers = debounce(function() {
    api.refreshLayers();
}, 300);
```

### 3. Cleanup

```javascript
// Store hook IDs for cleanup
const hookIds = [];

function addHook(config) {
    const hookId = api.addLayerHook(config);
    hookIds.push(hookId);
    return hookId;
}

function cleanup() {
    // Remove all hooks when done
    hookIds.forEach(id => {
        api.removeLayerHook(id);
    });
    hookIds.length = 0;
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);
```

### 4. Responsive Design

```javascript
// Responsive button management
function setupResponsiveButtons() {
    function updateButtons() {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            // Hide complex buttons on mobile
            api.removeCustomButton('complex-button');
            
            // Add mobile-optimized buttons
            api.addCustomButton({
                id: 'mobile-skip',
                icon: 'fas fa-forward',
                position: 'bottom-right',
                styles: { padding: '6px' },
                onClick: skipVideo
            });
        } else {
            // Desktop buttons
            api.addCustomButton({
                id: 'desktop-controls',
                text: 'Skip Video',
                icon: 'fas fa-forward',
                position: 'bottom-right',
                onClick: skipVideo
            });
        }
    }
    
    // Update on resize
    window.addEventListener('resize', debounce(updateButtons, 300));
    updateButtons(); // Initial setup
}
```

## API Reference

### Methods

#### Player Control
- `getPlayer(instanceId)` - Get player data
- `getAllPlayers()` - Get all players
- `playVideo(instanceId)` - Play video
- `pauseVideo(instanceId)` - Pause video
- `seekTo(instanceId, time)` - Seek to time
- `setVolume(instanceId, volume)` - Set volume
- `toggleFullscreen(instanceId)` - Toggle fullscreen
- `getPlayerStats(instanceId)` - Get player statistics

#### Layer Management
- `addLayerHook(config)` - Add layer visibility hook
- `removeLayerHook(hookId)` - Remove layer hook
- `showLayer(layerId, instanceId)` - Show layer
- `hideLayer(layerId, instanceId)` - Hide layer
- `getLayer(layerId, instanceId)` - Get layer data
- `refreshLayers(instanceId)` - Refresh layer data

#### Custom UI
- `addCustomButton(config)` - Add custom button
- `removeCustomButton(buttonId)` - Remove custom button
- `getPresetButtons()` - Get preset configurations

#### Style Management
- `addPlayerStyle(instanceId, styles)` - Add custom styles
- `removePlayerStyle(instanceId, styleId)` - Remove styles

#### Global Hooks
- `addGlobalHook(config)` - Add global hook
- `removeGlobalHook(hookId)` - Remove global hook

### Events

The API integrates with VideoJS events and provides additional hooks for layer management and custom functionality.

### Support

For additional support and examples, check the GoDAM documentation or contact the development team.
