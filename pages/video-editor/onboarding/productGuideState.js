/**
 * Read / write the per-user product-guide state.
 *
 * State lives in WP user meta (see the `godam/v1/onboarding/product-guide`
 * REST route) so it is consistent across browsers and devices. The initial
 * value is localized into `window.videoData.productGuideState` so the welcome
 * modal can decide whether to auto-show on first paint without a round-trip;
 * writes go through the REST endpoint.
 */

const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

const ENDPOINT = 'godam/v1/onboarding/product-guide';

export const PRODUCT_GUIDE_STATES = {
	PENDING: 'pending',
	COMPLETED: 'completed',
	DISMISSED: 'dismissed',
};

/**
 * The state known at page load (localized from PHP). Kept in a module variable
 * so subsequent reads reflect in-session writes without re-fetching.
 *
 * @type {string}
 */
let cachedState = window?.videoData?.productGuideState || PRODUCT_GUIDE_STATES.PENDING;

/**
 * Get the current product-guide state (synchronous, from the in-memory cache).
 *
 * @return {string} One of PRODUCT_GUIDE_STATES.
 */
export const getProductGuideState = () => cachedState;

/**
 * Whether the welcome modal should auto-show — only for users who have neither
 * completed nor dismissed the guide.
 *
 * @return {boolean} True when the guide has never been completed or dismissed.
 */
export const shouldAutoStartGuide = () => cachedState === PRODUCT_GUIDE_STATES.PENDING;

/**
 * Persist a new product-guide state to user meta. Updates the in-memory cache
 * optimistically; network failures are non-fatal (the guide is a nicety).
 *
 * @param {string} status One of PRODUCT_GUIDE_STATES.
 * @return {Promise<void>} Resolves once the request settles.
 */
export const setProductGuideState = async ( status ) => {
	cachedState = status;

	try {
		await fetch( window.pathJoin( [ restURL, ENDPOINT ] ), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': window?.videoData?.nonce || window?.wpApiSettings?.nonce,
			},
			body: JSON.stringify( { status } ),
		} );
	} catch {
		// Persisting onboarding state is best-effort; ignore network errors.
	}
};
