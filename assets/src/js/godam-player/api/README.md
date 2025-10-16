# GoDAM Player API Documentation

The GoDAM Player API provides a simple and powerful interface for developers to interact with GoDAM video players, create custom layers, and control video playback programmatically.

## Table of Contents

- [Getting Started](#getting-started)
- [Main API Methods](#main-api-methods)
- [Player Instance Methods](#player-instance-methods)
  - [Custom Layer Management](#custom-layer-management)
  - [Native Layer Management](#native-layer-management)
  - [Playback Control](#playback-control)
  - [Player State Methods](#player-state-methods)
  - [Utility Methods](#utility-methods)
- [Examples](#examples)
- [Error Handling](#error-handling)

## Getting Started

The GoDAM Player API is available globally as `window.GoDAMAPI` once the GoDAM player scripts are loaded.

```javascript
// Check if API is available
if (window.GoDAMAPI) {
    // API is ready to use
    const player = window.GoDAMAPI.getPlayer('1641');
}
```

## Main API Methods

### `getPlayer(attachmentID, videoElement?, player?)`

Get a player instance for a specific video.

**Parameters:**

- `attachmentID` (string): The attachment ID of the video
- `videoElement` (HTMLElement, optional): The video element or container
- `player` (Object, optional): The VideoJS player instance

**Returns:** `Player` instance

**Example:**

```javascript
// Get player by attachment ID (recommended)
const player = window.GoDAMAPI.getPlayer('1641');

// Get player with specific video element
const videoEl = document.querySelector('[data-id="1641"]');
const player = window.GoDAMAPI.getPlayer('1641', videoEl);
```

### `getAllPlayers()`

Get all player instances on the current page.

**Returns:** Array of player objects with properties:

- `attachmentId`: The video attachment ID
- `player`: The Player instance
- `container`: The video container element
- `videoElement`: The video HTML element
- `isReady`: Boolean indicating if the player is ready

**Example:**

```javascript
const allPlayers = window.GoDAMAPI.getAllPlayers();
console.log(`Found ${allPlayers.length} players on this page`);

allPlayers.forEach(playerObj => {
    console.log(`Player ${playerObj.attachmentId} is ${playerObj.isReady ? 'ready' : 'not ready'}`);
});
```

### `getAllReadyPlayers()`

Get all ready player instances on the current page.

**Returns:** Array of ready player objects (same structure as `getAllPlayers()`)

**Example:**

```javascript
const readyPlayers = window.GoDAMAPI.getAllReadyPlayers();
readyPlayers.forEach(playerObj => {
    // Safe to use these players immediately
    playerObj.player.play();
});
```

## Player Instance Methods

Once you have a player instance, you can use the following methods:

### Custom Layer Management

#### `createLayer(layerConfig)`

Create a custom HTML layer that appears at specific times during video playback.

**Parameters:**

- `layerConfig` (Object): Configuration object with the following properties:
  - `html` (string, required): HTML content for the layer
  - `displayTime` (string|number, required): When to show the layer (seconds or percentage like "25%")
  - `duration` (string|number, optional): How long to show the layer (seconds or percentage)
  - `backgroundColor` (string, optional): Background color (default: "#FFFFFFB3")
  - `onShow` (Function, optional): Callback when layer is displayed `(element, player) => {}`
  - `pauseOnShow` (boolean, optional): Whether to pause video when layer shows (default: true)
  - `className` (string, optional): Additional CSS classes

**Returns:** `HTMLElement` - The created layer DOM element

**Layer Element Methods:**
The returned element has these additional methods:

- `dismiss()`: Permanently hide the layer
- `show()`: Manually show the layer (if not dismissed)
- `hide()`: Manually hide the layer

#### `removeCustomLayer(layerId)`

Remove a specific custom layer by its ID.

**Parameters:**

- `layerId` (string): The ID of the layer to remove

**Returns:** `boolean` - True if layer was removed successfully

**Example:**

```javascript
const layer = player.createLayer({
    html: '<div>My Layer</div>',
    displayTime: 10
});

// Later, remove the layer
const layerObj = player.getCustomLayers()[0];
player.removeCustomLayer(layerObj.id);
```

#### `removeAllCustomLayers()`

Remove all custom layers from the player.

**Returns:** `number` - Number of layers removed

**Example:**

```javascript
const removedCount = player.removeAllCustomLayers();
console.log(`Removed ${removedCount} custom layers`);
```

#### `getCustomLayer(layerId)`

Get a specific custom layer element by its ID.

**Parameters:**

- `layerId` (string): The ID of the layer to retrieve

**Returns:** `HTMLElement|null` - Layer element or null if not found

**Example:**

```javascript
const layerElement = player.getCustomLayer('custom-1-12345');
if (layerElement) {
    layerElement.style.backgroundColor = 'red';
}
```

#### `getCustomLayers()`

Get all custom layers with their configuration details.

**Returns:** Array of layer objects with properties:

- `id`: Layer ID
- `element`: Layer DOM element
- `displayTime`: When the layer should display
- `duration`: How long the layer should display
- `pauseOnShow`: Whether video pauses when layer shows
- `visible`: Whether the layer is currently visible
- `isDismissed`: Whether the layer was manually dismissed
- `createdAt`: Timestamp when layer was created

**Example:**

```javascript
const layers = player.getCustomLayers();
layers.forEach(layer => {
    console.log(`Layer ${layer.id} is ${layer.visible ? 'visible' : 'hidden'}`);
});
```

#### `updateLayer(layerId, updates)`

Update an existing layer's configuration.

**Parameters:**

- `layerId` (string): The ID of the layer to update
- `updates` (Object): Properties to update (displayTime, duration, pauseOnShow, onShow, html, backgroundColor)

**Returns:** `boolean` - True if layer was updated successfully

**Example:**

```javascript
const layerObj = player.getCustomLayers()[0];
player.updateLayer(layerObj.id, {
    displayTime: 15,
    duration: 5,
    html: '<div>Updated content!</div>',
    backgroundColor: '#FF0000'
});
```

### Native Layer Management

These methods interact with GoDAM's built-in form layers (CTA, email capture, etc.).

#### `dismissNativeLayer(layerHtmlId?)`

Dismiss a native layer - either the current active layer or a specific layer by HTML ID.

**Parameters:**

- `layerHtmlId` (string, optional): HTML ID of the layer to dismiss. If not provided, dismisses current active layer

**Returns:** `boolean` - True if a layer was dismissed successfully

**Example:**

```javascript
// Dismiss current active layer
player.dismissNativeLayer();

// Dismiss specific layer by ID
player.dismissNativeLayer('layer-123-cta-1');
```

#### `getCurrentNativeLayer()`

Get the currently active native layer.

**Returns:** `Object|null` - Current layer object or null if no active layer

**Example:**

```javascript
const currentLayer = player.getCurrentNativeLayer();
if (currentLayer) {
    console.log('Active layer:', currentLayer);
}
```

#### `getAllNativeLayers()`

Get all native form layers configured for this video.

**Returns:** Array of layer information objects

**Example:**

```javascript
const nativeLayers = player.getAllNativeLayers();
console.log(`Found ${nativeLayers.length} native layers`);
```

#### `hasVisibleNativeLayers()`

Check if there are any native layers currently visible.

**Returns:** `boolean` - True if any native layer is visible

**Example:**

```javascript
if (player.hasVisibleNativeLayers()) {
    console.log('Native layers are visible');
}
```

#### `getCurrentNativeLayerIndex()`

Get the current native layer index.

**Returns:** `number` - Current form layer index or -1 if no FormLayerManager

**Example:**

```javascript
const layerIndex = player.getCurrentNativeLayerIndex();
console.log(`Current layer index: ${layerIndex}`);
```

**Example:**

```javascript
const player = window.GoDAMAPI.getPlayer('1641');

// Create a simple notification layer
const layer = player.createLayer({
    html: '<div><h3>Subscribe to our channel!</h3><button>Subscribe</button></div>',
    displayTime: 30, // Show at 30 seconds
    duration: 10,    // Show for 10 seconds
    backgroundColor: '#FF6B6B',
    pauseOnShow: true,
    className: 'my-custom-layer',
    onShow: (element, player) => {
        console.log('Layer is now visible!');

        // Add click handler to button
        const button = element.querySelector('button');
        button.addEventListener('click', () => {
            alert('Thanks for subscribing!');
            element.dismiss(); // Hide layer permanently
            player.play(); // Resume video
        });
    }
});

// Create a layer that shows at 50% of video duration
const midpointLayer = player.createLayer({
    html: '<div><p>You're halfway through!</p></div>',
    displayTime: '50%', // Show at 50% of video duration
    duration: '5%',     // Show for 5% of video duration
    pauseOnShow: false  // Don't pause video
});
```

### Playback Control

#### `play()`

Start video playback.

**Returns:** `Promise` that resolves when play starts

**Example:**

```javascript
player.play().then(() => {
    console.log('Video started playing');
}).catch(error => {
    console.error('Failed to play video:', error);
});
```

#### `pause()`

Pause video playback.

**Example:**

```javascript
player.pause();
```

#### `seek(time)`

Seek to a specific time in the video.

**Parameters:**

- `time` (number): Time in seconds

**Returns:** `boolean` - True if seek was successful

**Example:**

```javascript
// Seek to 2 minutes (120 seconds)
const success = player.seek(120);
if (success) {
    console.log('Seeked to 2:00');
}
```

#### `currentTime()`

Get the current playback time.

**Returns:** `number` - Current time in seconds

**Example:**

```javascript
const currentTime = player.currentTime();
console.log(`Current time: ${Math.floor(currentTime)}s`);
```

#### `duration()`

Get the total video duration.

**Returns:** `number` - Duration in seconds

**Example:**

```javascript
const duration = player.duration();
const minutes = Math.floor(duration / 60);
const seconds = Math.floor(duration % 60);
console.log(`Video duration: ${minutes}:${seconds.toString().padStart(2, '0')}`);
```

#### `setVolume(volume)`

Set the video volume.

**Parameters:**

- `volume` (number): Volume level between 0 and 1

**Returns:** `boolean` - True if volume was set successfully

**Example:**

```javascript
// Set volume to 50%
player.setVolume(0.5);

// Mute video
player.setVolume(0);
```

#### `getVolume()`

Get the current volume level.

**Returns:** `number` - Volume level between 0 and 1

**Example:**

```javascript
const volume = player.getVolume();
console.log(`Current volume: ${Math.round(volume * 100)}%`);
```

#### `toggleFullscreen()`

Toggle fullscreen mode for the video player.

**Returns:** `boolean` - True if toggle was successful

**Example:**

```javascript
// Toggle fullscreen
const success = player.toggleFullscreen();
if (success) {
    console.log('Fullscreen toggled successfully');
}
```

### Player State Methods

#### `isPaused()`

Check if the video is currently paused.

**Returns:** `boolean` - True if video is paused

**Example:**

```javascript
if (player.isPaused()) {
    console.log('Video is paused');
    player.play();
} else {
    console.log('Video is playing');
}
```

#### `isFullscreen()`

Check if the video is currently in fullscreen mode.

**Returns:** `boolean` - True if in fullscreen

**Example:**

```javascript
if (player.isFullscreen()) {
    console.log('Video is in fullscreen mode');
} else {
    console.log('Video is in normal mode');
}
```

#### `isReady()`

Check if the video player is ready for interaction.

**Returns:** `boolean` - True if player is ready

**Example:**

```javascript
if (player.isReady()) {
    // Safe to perform operations
    player.play();
    player.seek(30);
} else {
    console.log('Player is not ready yet');
}
```

### Utility Methods

#### `replay(reloadLayers?)`

Replay the video from the beginning, optionally resetting layers.

**Parameters:**

- `reloadLayers` (boolean, optional): Whether to reset and replay layers (default: true)

**Example:**

```javascript
// Replay video and reset all layers
player.replay();

// Replay video but keep layer states
player.replay(false);
```

#### `destroy()`

Clean up resources when the player is no longer needed. This removes event listeners and clears custom layers.

**Example:**

```javascript
// Clean up player resources
player.destroy();
```

#### `convertToAbsoluteTime(timeValue)`

Convert percentage or absolute time to absolute seconds. This is useful for working with time-based features.

**Parameters:**

- `timeValue` (string|number): Time value (e.g., "25%" or 30)

**Returns:** `number` - Absolute time in seconds

**Example:**

```javascript
// Convert percentage to seconds
const timeInSeconds = player.convertToAbsoluteTime('50%');
console.log(`50% of video is ${timeInSeconds} seconds`);

// Pass through absolute time
const absoluteTime = player.convertToAbsoluteTime(30);
console.log(`Absolute time: ${absoluteTime} seconds`);
```

## Examples

### Complete Interactive Layer Example

```javascript
// Get player instance
const player = window.GoDAMAPI.getPlayer('1641');

// Create an interactive quiz layer
const quizLayer = player.createLayer({
    html: `
        <div style="padding: 20px; text-align: center;">
            <h3>Quick Quiz!</h3>
            <p>What's the capital of France?</p>
            <button id="answer-a">London</button>
            <button id="answer-b">Paris</button>
            <button id="answer-c">Rome</button>
        </div>
    `,
    displayTime: '25%', // Show at 25% of video
    duration: 30,       // Show for 30 seconds max
    backgroundColor: '#4ECDC4',
    pauseOnShow: true,
    onShow: (element, player) => {
        // Add click handlers for quiz answers
        element.querySelector('#answer-a').addEventListener('click', () => {
            alert('Incorrect! Try again.');
        });

        element.querySelector('#answer-b').addEventListener('click', () => {
            alert('Correct! Paris is the capital of France.');
            element.dismiss();
            player.play(); // Resume video
        });

        element.querySelector('#answer-c').addEventListener('click', () => {
            alert('Incorrect! Try again.');
        });

        // Auto-dismiss after 25 seconds with warning
        setTimeout(() => {
            if (!element.classList.contains('hidden')) {
                alert('Time up! The correct answer was Paris.');
                element.dismiss();
                player.play();
            }
        }, 25000);
    }
});
```

### Video Progress Tracker Example

```javascript
const player = window.GoDAMAPI.getPlayer('1641');

// Create progress milestones
const milestones = [25, 50, 75, 100];
let completedMilestones = [];

milestones.forEach(percent => {
    player.createLayer({
        html: `
            <div style="padding: 15px; background: linear-gradient(45deg, #667eea, #764ba2); color: white; border-radius: 8px;">
                <h4>🎉 ${percent}% Complete!</h4>
                <p>You're making great progress!</p>
            </div>
        `,
        displayTime: `${percent}%`,
        duration: 3,
        pauseOnShow: false,
        onShow: (element, player) => {
            completedMilestones.push(percent);
            console.log(`Milestone reached: ${percent}%`);

            // Track completion
            if (percent === 100) {
                console.log('Video completed!', completedMilestones);
            }
        }
    });
});
```

### Advanced Player Control Example

```javascript
const player = window.GoDAMAPI.getPlayer('1641');

// Create a custom control panel layer
const controlPanel = player.createLayer({
    html: `
        <div style="padding: 20px; background: rgba(0,0,0,0.8); color: white; border-radius: 10px;">
            <h3>Custom Controls</h3>
            <div style="margin: 10px 0;">
                <button id="play-pause-btn">Play/Pause</button>
                <button id="fullscreen-btn">Toggle Fullscreen</button>
                <button id="mute-btn">Mute/Unmute</button>
            </div>
            <div style="margin: 10px 0;">
                <label>Volume: <input type="range" id="volume-slider" min="0" max="1" step="0.1" value="1"></label>
            </div>
            <div style="margin: 10px 0;">
                <label>Seek: <input type="range" id="seek-slider" min="0" max="100" step="1" value="0"></label>
            </div>
            <div id="status" style="margin: 10px 0; font-size: 12px;"></div>
        </div>
    `,
    displayTime: 5,
    duration: 60, // Show for 60 seconds
    pauseOnShow: true,
    onShow: (element, player) => {
        const playPauseBtn = element.querySelector('#play-pause-btn');
        const fullscreenBtn = element.querySelector('#fullscreen-btn');
        const muteBtn = element.querySelector('#mute-btn');
        const volumeSlider = element.querySelector('#volume-slider');
        const seekSlider = element.querySelector('#seek-slider');
        const status = element.querySelector('#status');

        // Update status display
        const updateStatus = () => {
            const currentTime = Math.floor(player.currentTime());
            const duration = Math.floor(player.duration());
            const volume = Math.round(player.getVolume() * 100);
            const isPaused = player.isPaused();
            const isFullscreen = player.isFullscreen();
            const isReady = player.isReady();

            status.innerHTML = `
                Time: ${currentTime}s / ${duration}s |
                Volume: ${volume}% |
                State: ${isPaused ? 'Paused' : 'Playing'} |
                Fullscreen: ${isFullscreen ? 'Yes' : 'No'} |
                Ready: ${isReady ? 'Yes' : 'No'}
            `;
        };

        // Initial status update
        updateStatus();

        // Update status every second
        const statusInterval = setInterval(updateStatus, 1000);

        // Play/Pause button
        playPauseBtn.addEventListener('click', () => {
            if (player.isPaused()) {
                player.play();
            } else {
                player.pause();
            }
        });

        // Fullscreen toggle
        fullscreenBtn.addEventListener('click', () => {
            player.toggleFullscreen();
        });

        // Mute toggle
        muteBtn.addEventListener('click', () => {
            const currentVolume = player.getVolume();
            if (currentVolume > 0) {
                // Store current volume and mute
                muteBtn.dataset.previousVolume = currentVolume;
                player.setVolume(0);
                volumeSlider.value = 0;
            } else {
                // Restore previous volume or set to 50%
                const previousVolume = parseFloat(muteBtn.dataset.previousVolume) || 0.5;
                player.setVolume(previousVolume);
                volumeSlider.value = previousVolume;
            }
        });

        // Volume control
        volumeSlider.addEventListener('input', (e) => {
            const volume = parseFloat(e.target.value);
            player.setVolume(volume);
        });

        // Seek control
        seekSlider.addEventListener('input', (e) => {
            const percentage = parseFloat(e.target.value);
            const duration = player.duration();
            const seekTime = (percentage / 100) * duration;
            player.seek(seekTime);
        });

        // Update seek slider as video progresses
        const seekUpdateInterval = setInterval(() => {
            const currentTime = player.currentTime();
            const duration = player.duration();
            if (duration > 0) {
                seekSlider.value = (currentTime / duration) * 100;
            }
        }, 1000);

        // Cleanup when layer is dismissed
        const originalDismiss = element.dismiss;
        element.dismiss = function() {
            clearInterval(statusInterval);
            clearInterval(seekUpdateInterval);
            originalDismiss.call(this);
        };
    }
});
```

### Multiple Players Management Example

```javascript
// Get all ready players and add synchronized controls
const players = window.GoDAMAPI.getAllReadyPlayers();

if (players.length > 1) {
    // Create a master control panel
    const controlPanel = document.createElement('div');
    controlPanel.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; z-index: 9999; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h4>Master Controls</h4>
            <button id="play-all">Play All</button>
            <button id="pause-all">Pause All</button>
            <button id="mute-all">Mute All</button>
            <input type="range" id="volume-all" min="0" max="1" step="0.1" value="1">
        </div>
    `;
    document.body.appendChild(controlPanel);

    // Play all videos
    document.getElementById('play-all').addEventListener('click', () => {
        players.forEach(playerObj => playerObj.player.play());
    });

    // Pause all videos
    document.getElementById('pause-all').addEventListener('click', () => {
        players.forEach(playerObj => playerObj.player.pause());
    });

    // Mute all videos
    document.getElementById('mute-all').addEventListener('click', () => {
        players.forEach(playerObj => playerObj.player.setVolume(0));
    });

    // Volume control for all videos
    document.getElementById('volume-all').addEventListener('input', (e) => {
        const volume = parseFloat(e.target.value);
        players.forEach(playerObj => playerObj.player.setVolume(volume));
    });
}
```

## Error Handling

The GoDAM Player API includes built-in error handling, but you should always wrap your calls in try-catch blocks for production use:

```javascript
try {
    const player = window.GoDAMAPI.getPlayer('1641');

    if (player) {
        const layer = player.createLayer({
            html: '<div>My Layer</div>',
            displayTime: 10
        });

        player.play().catch(error => {
            console.error('Playback failed:', error);
        });
    }
} catch (error) {
    console.error('GoDAM API Error:', error);
}
```

### Common Error Scenarios

1. **Player not found**: Check that the attachment ID exists and the video has loaded
2. **Invalid layer configuration**: Ensure required properties (`html`, `displayTime`) are provided
3. **Playback restrictions**: Some browsers require user interaction before allowing autoplay
4. **API not loaded**: Make sure the GoDAM scripts have loaded before using the API

---

**Note:** This API is designed to work seamlessly with the existing GoDAM layer system and provides full backward compatibility with existing video configurations.
