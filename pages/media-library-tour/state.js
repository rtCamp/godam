/**
 * Persistence for the Media Library guided tour.
 *
 * Two layers:
 * - The long-lived per-user state (pending / completed / dismissed) lives in WP
 * user meta behind `godam/v1/onboarding/media-library-guide`, so the tour
 * auto-starts once per user across browsers and devices. The initial value is
 * localized into `window.godamMediaLibraryTour.state` so the first paint can
 * decide whether to auto-start without a round-trip.
 * - The in-progress position (current step + tour context such as the folder
 * the user just created) lives in sessionStorage, so a tour survives the page
 * reloads the Media Library performs (switching to grid view, list-view moves)
 * and picks up where the user left off.
 */

const config = window.godamMediaLibraryTour || {};

const restURL = config.restUrl || window.wpApiSettings?.root || '/wp-json/';

const ENDPOINT = 'godam/v1/onboarding/media-library-guide';

const SESSION_KEY = 'godam-media-library-tour';

export const TOUR_STATES = {
	PENDING: 'pending',
	COMPLETED: 'completed',
	DISMISSED: 'dismissed',
};

let cachedState = Object.values( TOUR_STATES ).includes( config.state ) ? config.state : TOUR_STATES.PENDING;

/**
 * Current persisted tour state (synchronous, from the in-memory cache).
 *
 * @return {string} One of TOUR_STATES.
 */
export const getTourState = () => cachedState;

/**
 * Whether the tour should auto-start for this user on this page load.
 *
 * @return {boolean} True for users who never completed or dismissed the tour.
 */
export const shouldAutoStart = () => cachedState === TOUR_STATES.PENDING && false !== config.autoStart && '' !== config.autoStart;

/**
 * Persist the per-user tour state. Optimistic; network errors are non-fatal
 * because the tour is a nicety, never a blocker.
 *
 * @param {string} status One of TOUR_STATES.
 * @return {Promise<void>} Resolves once the request settles.
 */
export const setTourState = async ( status ) => {
	cachedState = status;

	try {
		await fetch( `${ restURL.replace( /\/$/, '' ) }/${ ENDPOINT }`, {
			method: 'POST',
			credentials: 'same-origin',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': config.nonce || window.wpApiSettings?.nonce,
			},
			body: JSON.stringify( { status } ),
		} );
	} catch {
		// Best-effort; ignore network errors.
	}
};

/**
 * Read the in-progress session (current step + context), if any.
 *
 * @return {Object|null} `{ stepId, ctx, pendingStart }` or null.
 */
export const readSession = () => {
	try {
		const raw = window.sessionStorage.getItem( SESSION_KEY );
		return raw ? JSON.parse( raw ) : null;
	} catch {
		return null;
	}
};

/**
 * Save the in-progress session.
 *
 * @param {Object} data Session payload.
 */
export const writeSession = ( data ) => {
	try {
		window.sessionStorage.setItem( SESSION_KEY, JSON.stringify( data ) );
	} catch {
		// Storage unavailable (private mode, blocked site data) — resume just won't work.
	}
};

/**
 * Clear the in-progress session.
 */
export const clearSession = () => {
	try {
		window.sessionStorage.removeItem( SESSION_KEY );
	} catch {
		// Ignore.
	}
};

export const tourConfig = config;
