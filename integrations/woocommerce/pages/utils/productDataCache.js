/**
 * Product Data Cache Utility
 *
 * Provides a lightweight cache for fetching WooCommerce product data on-demand.
 * This ensures product hotspots always display current data (price, stock, etc.)
 * without needing to synchronize data when products are updated.
 */

import apiFetch from '@wordpress/api-fetch';

// Simple in-memory cache with 10-minute TTL
const productCache = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch product data by ID from REST API with caching.
 *
 * @param {string|number} productId - The WooCommerce product ID.
 * @return {Promise<Object>} The product data object.
 */
export const fetchProductData = async ( productId ) => {
	if ( ! productId ) {
		return null;
	}

	const productIdStr = String( productId );
	const cached = productCache[ productIdStr ];

	// Return cached data if still valid
	if ( cached && Date.now() - cached.timestamp < CACHE_TTL ) {
		return cached.data;
	}

	try {
		const restURL = window.godamRestRoute?.url || '';
		const product = await apiFetch( {
			url: `${ restURL }godam/v1/wcproduct?id=${ productIdStr }`,
		} );

		// Cache the result
		productCache[ productIdStr ] = {
			data: product,
			timestamp: Date.now(),
		};

		return product;
	} catch ( error ) {
		console.error( `Error fetching product data for ID ${ productIdStr }:`, error );
		return null;
	}
};

/**
 * Clear cache for a specific product or all products.
 *
 * @param {string|number} [productId] - Optional product ID to clear. If not provided, clears entire cache.
 */
export const clearProductCache = ( productId = null ) => {
	if ( productId ) {
		delete productCache[ String( productId ) ];
	} else {
		Object.keys( productCache ).forEach( ( key ) => delete productCache[ key ] );
	}
};
