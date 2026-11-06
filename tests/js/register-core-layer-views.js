/**
 * Test helper: register the front-end runtimes of GoDAM's core layer types.
 *
 * On a page each core layer's built view script registers its own runtime
 * (`assets/src/layers/<type>/view.js`); tests call this after resetting the
 * registry. Safe to call more than once.
 */

/**
 * Internal dependencies
 */
import { registerCtaRuntime } from '../../assets/src/layers/cta/view.js';
import { registerFormRuntime } from '../../assets/src/layers/form/view.js';
import { registerPollRuntime } from '../../assets/src/layers/poll/view.js';
import { registerHotspotRuntime } from '../../assets/src/layers/hotspot/view.js';

/**
 * Register the CTA, Form (with its providers), Poll and Hotspot runtimes.
 */
export function registerCoreLayerRuntimes() {
	registerCtaRuntime();
	registerFormRuntime();
	registerPollRuntime();
	registerHotspotRuntime();
}
