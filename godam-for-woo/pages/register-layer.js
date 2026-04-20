/**
 * WordPress dependencies
 */
import { createElement, useEffect, useState } from '@wordpress/element';

// Cache resolved module across mounts so repeat openings don't refetch/recreate the component.
let resolvedWooLayer = null;

const LazyWoocommerceLayer = ( props ) => {
	const [ Component, setComponent ] = useState( () => resolvedWooLayer );

	useEffect( () => {
		let mounted = true;

		if ( Component ) {
			return () => {
				mounted = false;
			};
		}

		import(
			/* webpackChunkName: "woo-layer-chunk" */
			'./components/WoocommerceLayer'
		)
			.then( ( module ) => {
				resolvedWooLayer = module.default;
				if ( mounted ) {
					setComponent( () => module.default );
				}
			} )
			.catch( ( error ) => {
				// eslint-disable-next-line no-console
				console.error( 'GoDAM for Woo: Failed to load WooCommerce layer chunk.', error );
			} );

		return () => {
			mounted = false;
		};
	}, [ Component ] );

	if ( ! Component ) {
		return null;
	}

	return createElement( Component, props );
};

// Expose WooCommerce layer component globally for PHP-filtered registration.
window.godamLayerComponents = window.godamLayerComponents || {};
window.godamLayerComponents.WoocommerceLayer = LazyWoocommerceLayer;

// Register WooCommerce layer creator for the video editor's addNewLayer handler.
window.godamLayerCreators = window.godamLayerCreators || {};
window.godamLayerCreators.woo = ( { layers, currentTime, type } ) => {
	const lastWooLayer = [ ...layers ]
		.reverse()
		.find( ( layer ) => layer.type === 'woo' );

	const previousDisplayTime = lastWooLayer?.displayTime ?? null;

	const firstWooLayer = layers.find( ( layer ) => layer.type === 'woo' );
	const firstWooLayerId = firstWooLayer?.id;
	const firstWooLayerMiniCart = firstWooLayer?.miniCart;

	return {
		firstWooLayerId,
		displayTime: currentTime,
		previousDisplayTime,
		type,
		duration: 5,
		pauseOnHover: false,
		miniCart: firstWooLayerMiniCart,
		productHotspots: [],
		isNew: true,
		badge: previousDisplayTime === null ? 'mini-cart' : undefined,
	};
};
