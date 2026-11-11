# Layers Manager Components

This directory contains the refactored components of the LayersManager class, split into focused, maintainable modules.

## Structure

- **`FormLayerManager.js`** - Manages the CTA, form and poll layers (pause on display, skip button, outcome observation, time-based updates). Each type's runtime passes it a `behaviour`; it never branches on the layer type.
- **`HotspotLayerManager.js`** - Manages hotspot layer functionality including creation, positioning, tooltip management, and interactions
- **`WooCommerceLayerManager.js`** - Manages WooCommerce layer functionality including creation, positioning, tooltip management, and interactions of Product Hotspots
- **`../layersManager.js`** - Mounts every saved layer through its type's Layer API runtime and forwards player events to it

Each core type's runtime lives in `../../layers/` (`cta.js`, `form.js` with `form-providers.js`, `poll.js`, `hotspot.js`). Whether a layer runs is decided by its runtime's `validate()` (see `godam-layers/runtime/registry.js`).

## Benefits of this refactoring

1. **Single Responsibility Principle**: Each module has a clear, focused purpose
2. **Better Maintainability**: Smaller files are easier to understand and modify
3. **Improved Testability**: Individual components can be tested in isolation
4. **Enhanced Reusability**: Components can potentially be reused in other contexts
5. **Reduced Complexity**: The original 713-line file is now split into manageable chunks

## Public Interface

The main `LayersManager` class maintains the same public interface to ensure backward compatibility with existing code that depends on it.
