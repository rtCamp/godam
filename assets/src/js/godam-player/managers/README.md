# Video Player Refactoring

This directory contains the refactored video player code that breaks down the large `GodamVideoPlayer` class into smaller, more manageable components following the Single Responsibility Principle.

## File Structure

### Core Files

- **`videoPlayer.js`** - Main video player class that orchestrates all managers
- **`configurationManager.js`** - Handles video configuration and data parsing
- **`controlsManager.js`** - Manages video controls, UI elements, and player customization
- **`previewManager.js`** - Handles video preview functionality and state management
- **`layersManager.js`** - Manages form and hotspot layers functionality
- **`eventsManager.js`** - Handles video events, resize logic, and time updates
- **`adsManager.js`** - Handles advertisement integration

### Existing Files (Unchanged)
- **`hoverManager.js`** - Existing hover functionality
- **`shareManager.js`** - Existing share functionality

## Refactoring Benefits

### 1. **Single Responsibility Principle**
Each manager class has a single, well-defined responsibility:
- Configuration parsing and setup
- UI controls and customization
- Preview mode handling
- Layer management (forms/hotspots)
- Event handling and coordination
- Advertisement integration

### 2. **Improved Maintainability**
- Smaller files are easier to understand and modify
- Changes to one feature don't affect unrelated functionality
- Easier to locate and fix bugs
- Better code organization

### 3. **Better Testability**
- Each manager can be unit tested independently
- Mocking dependencies is easier
- Test files can be smaller and more focused

### 4. **Enhanced Reusability**
- Individual managers can be reused in other contexts
- Feature-specific functionality is encapsulated
- Easier to add new features without touching existing code

### 5. **Cleaner Dependencies**
- Clear separation of concerns
- Reduced coupling between different features
- Manager communication is explicit and controlled

## Usage

### Original Usage (Deprecated)
```javascript
import GodamVideoPlayer from './videoPlayer.js';
const player = new GodamVideoPlayer(video, isDisplayingLayers);
player.initialize();
```

### New Usage (Recommended)
```javascript
import GodamVideoPlayer from './managers/videoPlayer.js';
const player = new GodamVideoPlayer(video, isDisplayingLayers);
player.initialize();
```

The public API remains the same, so existing code doesn't need to change.

## Manager Communication

The refactored architecture uses explicit communication between managers:

1. **Main Player** coordinates all managers
2. **Events Manager** acts as the central event hub
3. **Callback system** allows managers to communicate without direct dependencies
4. **Shared configuration** is passed to managers that need it

## Migration Guide

To complete the migration:

1. **Update imports** in files that use the video player
2. **Test thoroughly** to ensure all functionality works as expected
3. **Remove the original file** after confirming everything works
4. **Update any documentation** that references the old file structure

## File Size Comparison

- **Original file**: ~1600 lines
- **Refactored files**: 
  - Main player: ~200 lines
  - Individual managers: 50-400 lines each
  - Total: Similar line count but better organized

## Next Steps

1. Add unit tests for each manager
2. Consider further breaking down large managers if needed
3. Add TypeScript types for better development experience
4. Document manager APIs for future developers
