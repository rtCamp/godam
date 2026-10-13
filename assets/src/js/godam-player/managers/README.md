# Video Player Refactoring

This directory contains the refactored video player manager components that support the main `videoPlayer.js` class. The main video player class is located at the parent level alongside `frontend.js`.

## File Structure

### Main Files (Parent Directory)
- **`videoPlayer.js`** - Main video player class that orchestrates all managers
- **`frontend.js`** - Existing frontend functionality

### Manager Files (This Directory)
- **`configurationManager.js`** - Handles video configuration and data parsing
- **`controlsManager.js`** - Manages video controls, UI elements, and player customization
- **`previewManager.js`** - Handles video preview functionality and state management
- **`layersManager.js`** - Manages form and hotspot layers functionality
- **`eventsManager.js`** - Handles video events, resize logic, and time updates
- **`adsManager.js`** - Handles advertisement integration

### Existing Files (Unchanged)
- **`hoverManager.js`** - Existing hover functionality
- **`shareManager.js`** - Existing share functionality

### Lightbox
- **`modalManager.js`** - The "Show in lightbox" overlay, shared page-wide

## Lightbox

`modalManager.js` owns one body-level overlay for the whole page. Get it with the
`getLightbox()` singleton — never `new ModalManager()`, since a second instance
means a second overlay stacked on the first.

Two content modes share that overlay:

- **`openElement( playerRoot, options )`** moves an on-page player into the
  overlay and puts it back on close, leaving a comment anchor behind to restore
  its exact position. Used by an inline click on a lightbox player, by a trigger
  pointing at one, and by the deep-link handler. Because the player instance is
  the same one, layers, chapters, ads and analytics all keep working.
- **`openIframe( src, options )`** renders the embed page instead. Used when the
  requested video is not on the page, so there is no player to move.

`openLightboxForId( id, options )` is the entry point that picks between them, and
is what both element triggers and `GoDAMAPI.openLightbox()` call.

Only a player rendered with `data-show-in-lightbox="true"` is ever moved. An
ordinary visible inline player is deliberately left alone: moving it would tear a
hole in the page layout and hijack a player the visitor may already be watching.

### Addressing a video

`utils/lightboxTargets.js` holds the shared, unit-tested resolution logic. A video
is looked up by `data-job_id` first and `data-id` (the WordPress attachment ID)
second — share links carry the job ID, while hand-written triggers usually carry
the attachment ID.

Always match on `video[data-*]`, never on `.easydam-player.video-js`: Video.js
wraps the `<video>` in a generated div that inherits those classes, so the class
selector matches different nodes before and after initialisation.

### Triggers and deep links

- **`../lightboxTriggers.js`** binds one delegated, capture-phase listener pair on
  `document` for `[data-godam-lightbox]` elements, so markup injected later needs
  no re-binding. It also gives non-interactive triggers (`<div>`, `<img>`) the
  `role="button"` / `tabindex="0"` they need for keyboard use.
- **`../frontend.js`** handles `#godam-video-{id}` URLs on load. It waits for the
  per-player `godamPlayerReady` event (not `godamAllPlayersReady`, which can fire
  before Video.js has created the instance) and then opens the lightbox for a
  lightbox video, or scrolls to and seeks any other video.

### The URL is the source of truth

Opening pushes `#godam-video-{id}` so the view is shareable and Back closes it. A
deep-link *entry* passes `pushHistory: false`, since the hash is already there and
a duplicate entry would make Back a no-op. Exactly one history entry ever means "a
lightbox is open" — switching videos replaces the hash rather than stacking, so
closing never needs more than one Back.

Closing always clears the hash. When the pushed entry is ours, `close()` steps off
it with `history.back()`; otherwise (a deep-link arrival or an anchor click, where
the entry belongs to the browser) `stripLightboxHash()` removes it in place. That
strip matches *any* `#godam-video-` hash rather than the one the entry recorded,
because the two differ whenever a visitor follows a link written with the job ID
while the canonical hash uses the attachment ID.

`initLightboxUrlSync()` then keeps the two in step for the life of the page,
reconciling on both `popstate` (Back/Forward) and `hashchange` (anchor links,
which push an entry without firing `popstate`). This is deliberately a *persistent*
listener rather than a while-open one: the interesting case is the visitor arriving
*at* a lightbox URL — pressing Forward after closing, or following an in-page
`<a href="#godam-video-{id}">` — which a while-open listener can never see. A
plain anchor is therefore a working trigger with no data attribute at all.

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
import GodamVideoPlayer from './videoPlayer.js'; // Old large file
const player = new GodamVideoPlayer(video, isDisplayingLayers);
player.initialize();
```

### New Usage (Recommended)
```javascript
import GodamVideoPlayer from './videoPlayer.js'; // New refactored file
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

1. **Update imports** in files that use the video player (now at `./videoPlayer.js`)
2. **Test thoroughly** to ensure all functionality works as expected
3. **Remove the original large file** after confirming everything works
4. **Update any documentation** that references the old file structure

## File Size Comparison

- **Original file**: ~1600 lines (single large file)
- **Refactored structure**: 
  - Main player: ~200 lines (`videoPlayer.js`)
  - Individual managers: 50-400 lines each (in `managers/` directory)
  - Total: Similar line count but better organized and maintainable

## Next Steps

1. Add unit tests for each manager
2. Consider further breaking down large managers if needed
3. Add TypeScript types for better development experience
4. Document manager APIs for future developers
