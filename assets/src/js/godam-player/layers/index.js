/**
 * Register the front-end runtimes of GoDAM's core layer types (#2294).
 *
 * Safe to call more than once; a type something already registered is kept.
 */

/**
 * Internal dependencies
 */
import { registerCtaRuntime } from './cta.js';
import { registerFormRuntime } from './form.js';
import { registerPollRuntime } from './poll.js';
import { registerHotspotRuntime } from './hotspot.js';

/**
 * Register the CTA, Form (with its providers), Poll and Hotspot runtimes.
 */
export function registerCoreLayerRuntimes() {
	registerCtaRuntime();
	registerFormRuntime();
	registerPollRuntime();
	registerHotspotRuntime();
}
