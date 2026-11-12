/**
 * GoDAM's own layer types, registered through the same API as add-ons.
 * Registration order is the "Add layer" menu order.
 */

/**
 * External dependencies
 */
import { registerLayerType, getLayerType } from '@godam/layers';

/**
 * Internal dependencies
 */
import * as cta from './cta/editor';
import * as hotspot from './hotspot/editor';
import * as form from './form/editor';
import * as poll from './poll/editor';
import * as ad from './ad/editor';

export const coreLayerTypes = [ cta, hotspot, form, poll, ad ];

export function registerCoreLayerTypes() {
	coreLayerTypes.forEach( ( { metadata, settings } ) => {
		if ( ! getLayerType( metadata.name ) ) {
			registerLayerType( metadata, settings );
		}
	} );
}
