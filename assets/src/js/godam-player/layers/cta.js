/**
 * The CTA layer's front-end runtime (#2294).
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { registerLayerRuntime, getLayerRuntime } from '../../godam-layers/runtime/registry.js';
import { mountOverlayLayer } from './overlay.js';

/**
 * Register the CTA runtime, unless something already did.
 */
export function registerCtaRuntime() {
	if ( getLayerRuntime( 'cta' ) ) {
		return;
	}
	registerLayerRuntime( 'cta', {
		title: 'CTA',
		mount: mountOverlayLayer( () => ( {
			// An end-of-video CTA has nothing left to skip to.
			skipText: ( layer ) => ( layer.trigger === 'end_of_video' ? __( 'Done', 'godam' ) : __( 'Skip', 'godam' ) ),
			trackClicks: true,
		} ) ),
	} );
}
