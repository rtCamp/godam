/**
 * GoDAM Layer API: the front-end runtime registry as its own script (#2295).
 *
 * Built as `godam-layer-runtime`. An add-on's `viewScript` depends on it, so
 * `window.godam.layers.registerLayerRuntime()` exists when the add-on runs,
 * on video and image pages alike. The player and image scripts bundle the
 * same registry and share this one through `window.godam.layers`.
 */

/**
 * Internal dependencies
 */
import { getRuntimeRegistry } from './registry';

getRuntimeRegistry();
