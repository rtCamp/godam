/**
 * Visitor consent for GoDAM's front-end analytics.
 *
 * GoDAM counts video views and hotspot clicks with three items in the visitor's
 * browser (an anonymous visitor id, a per-video "seen" flag and a per-tab buffer
 * of layer clicks) and sends events to analytics.godam.io. With the WP Consent API
 * active, none of that may happen until the visitor allows "statistics".
 *
 * Rules (rtCamp/godam-plugin-wp#47, Phase 1):
 * No WP Consent API on the site: today's behaviour, unless the site turned visitor
 * tracking off with the `godam_visitor_tracking_enabled` PHP filter. Before the
 * visitor chooses: store nothing and send nothing; nothing is queued to send later,
 * and the visitor id lives only in memory (see consentAwareStorage). The visitor
 * allows "statistics" mid-page: tracking starts from that moment. The visitor
 * withdraws "statistics": tracking stops and GoDAM's items are deleted.
 *
 * The PHP side passes `videoAnalyticsParams.consent` (see
 * RTGODAM\Inc\Visitor_Consent::get_script_config()).
 *
 * @package
 */

/**
 * The visitor's device storage for the analytics library's keys, in the format
 * the library's own default storage uses (JSON in localStorage), so ids stored
 * before this change are still read. When localStorage is unavailable, values
 * stay in memory for the page (the library's default fell back to a cookie).
 */
const deviceStorage = {
	getItem( key ) {
		try {
			const raw = window.localStorage.getItem( key );
			if ( raw === null || raw === '' ) {
				return undefined;
			}
			try {
				return JSON.parse( raw );
			} catch ( e ) {
				return raw;
			}
		} catch ( e ) {
			return undefined;
		}
	},
	setItem( key, value ) {
		try {
			window.localStorage.setItem( key, JSON.stringify( value ) );
		} catch ( e ) {
			// Private mode or quota: keep the value in memory only.
		}
	},
	removeItem( key ) {
		try {
			window.localStorage.removeItem( key );
		} catch ( e ) {
			// Nothing stored.
		}
		// The library's default storage used a cookie when localStorage was
		// unavailable; remove that copy too.
		document.cookie = `${ key }=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
	},
};

/**
 * WP Consent API category GoDAM's analytics waits for.
 */
export const CONSENT_CATEGORY = 'statistics';

/**
 * Keys the analytics library keeps for a visitor (anonymous id, user id, traits).
 */
export const ANALYTICS_STORAGE_KEYS = [ '__anon_id', '__user_id', '__user_traits' ];

/**
 * Prefix of the per-video "seen before" flags (analytics-helpers.js).
 */
export const VIDEO_SEEN_PREFIX = 'godamVideoSeen:';

/**
 * Per-tab layer-interactions buffer key (utils/storage.js).
 */
export const LAYER_BUFFER_KEY = 'godamLayerInteractions';

/**
 * Consent settings printed by PHP.
 *
 * @return {{trackingEnabled?: boolean, consentApi?: boolean}} Settings, empty when not printed.
 */
function getConsentConfig() {
	return window.videoAnalyticsParams?.consent || {};
}

/**
 * Whether the site uses the WP Consent API, by the PHP flag or by its JS being loaded.
 *
 * @return {boolean} True when consent comes from the WP Consent API.
 */
export function usesConsentApi() {
	return Boolean( getConsentConfig().consentApi ) || typeof window.wp_has_consent === 'function';
}

/**
 * Whether GoDAM may store items in the browser and send analytics events now.
 *
 * Re-evaluated on every call: the answer can change while the page is open.
 *
 * @return {boolean} True when statistics tracking is allowed right now.
 */
export function hasStatisticsConsent() {
	if ( getConsentConfig().trackingEnabled === false ) {
		return false;
	}

	if ( ! usesConsentApi() ) {
		return true;
	}

	// The API is active but its script has not run yet (it prints after GoDAM's
	// footer scripts). Wait: syncConsent() re-checks on DOMContentLoaded.
	if ( typeof window.wp_has_consent !== 'function' ) {
		return false;
	}

	// An explicit refusal recorded by the banner always wins. wp_has_consent()
	// returns true whenever no consent type (opt-in or opt-out) is set on the page,
	// and some banners set it only when the visitor acts: CookieYes 3.5, on the
	// next page after "Reject All", leaves it unset while its deny cookie is there.
	if ( readConsentCookie() === 'deny' ) {
		return false;
	}

	try {
		return Boolean( window.wp_has_consent( CONSENT_CATEGORY ) );
	} catch ( e ) {
		return false;
	}
}

/**
 * The WP Consent API's own cookie for GoDAM's category ('allow', 'deny' or '').
 *
 * @return {string} Cookie value, '' when not set.
 */
function readConsentCookie() {
	const prefix = window.consent_api?.cookie_prefix || 'wp_consent';
	const name = `${ prefix }_${ CONSENT_CATEGORY }=`;
	const match = document.cookie
		.split( ';' )
		.map( ( part ) => part.trim() )
		.find( ( part ) => part.indexOf( name ) === 0 );
	return match ? match.substring( name.length ) : '';
}

/**
 * In-memory values held while there is no consent, so the analytics library can
 * still build its instance (and an anonymous id) without touching the device.
 */
const memoryStore = {};

/**
 * Storage for the `analytics` library: the device (localStorage) once consent is
 * given, memory before that.
 *
 * Passed as the `storage` option of Analytics(), which replaces the library's
 * default, so no visitor id is written to the device before consent.
 */
export const consentAwareStorage = {
	getItem( key ) {
		if ( ! hasStatisticsConsent() ) {
			return memoryStore[ key ];
		}

		const stored = deviceStorage.getItem( key );
		if ( stored !== undefined && stored !== null ) {
			return stored;
		}

		// Held in memory but missing on the device (e.g. the library made it
		// before consent and the grant event never reached us): store it now,
		// so the next page reads the id this page sends.
		if ( memoryStore[ key ] !== undefined ) {
			deviceStorage.setItem( key, memoryStore[ key ] );
		}
		return memoryStore[ key ];
	},
	setItem( key, value ) {
		memoryStore[ key ] = value;
		if ( hasStatisticsConsent() ) {
			deviceStorage.setItem( key, value );
		}
	},
	removeItem( key ) {
		delete memoryStore[ key ];
		deviceStorage.removeItem( key );
	},
};

/**
 * Once consent is known, line memory and the device up.
 *
 * A value already on the device wins: it is the id of a visitor who consented on
 * an earlier page. That is the common case, not an edge: the WP Consent API's
 * script prints after GoDAM's, so on every page load GoDAM first sees "no
 * consent yet", the library makes a fresh id in memory, and only then consent is
 * confirmed. Overwriting the stored id there would count a returning visitor as
 * new on every page. The live instance is switched to the stored id too.
 *
 * A value only in memory (consent given on this page) is written to the device.
 *
 * @return {string|null} The stored visitor id the live instance is switching to, or null.
 */
function persistMemoryStore() {
	let adoptedId = null;
	Object.keys( memoryStore ).forEach( ( key ) => {
		const stored = deviceStorage.getItem( key );
		if ( stored === undefined ) {
			deviceStorage.setItem( key, memoryStore[ key ] );
			return;
		}
		if ( stored === memoryStore[ key ] ) {
			return;
		}
		memoryStore[ key ] = stored;
		if ( key === '__anon_id' && typeof window.analytics?.setAnonymousId === 'function' ) {
			window.analytics.setAnonymousId( stored );
			adoptedId = stored;
		}
	} );
	return adoptedId;
}

/**
 * Run a callback once the live analytics instance reports the given visitor id.
 * setAnonymousId() finishes asynchronously (a few ms); waiting means no event that
 * the grant callbacks start goes out with the id made in memory before consent.
 *
 * @param {string}   id       Visitor id to wait for.
 * @param {Function} callback Called once, at the latest after one second.
 */
function whenVisitorIdIs( id, callback ) {
	const deadline = Date.now() + 1000;
	const check = () => {
		if ( window.analytics?.user?.()?.anonymousId === id || Date.now() > deadline ) {
			callback();
			return;
		}
		setTimeout( check, 10 );
	};
	check();
}

/**
 * Delete every item GoDAM keeps in the visitor's browser for statistics.
 */
export function clearStatisticsStorage() {
	ANALYTICS_STORAGE_KEYS.forEach( ( key ) => deviceStorage.removeItem( key ) );

	try {
		const seenKeys = [];
		for ( let i = 0; i < window.localStorage.length; i++ ) {
			const key = window.localStorage.key( i );
			if ( key && key.indexOf( VIDEO_SEEN_PREFIX ) === 0 ) {
				seenKeys.push( key );
			}
		}
		seenKeys.forEach( ( key ) => window.localStorage.removeItem( key ) );
	} catch ( e ) {
		// localStorage unavailable: nothing was stored there.
	}

	try {
		window.sessionStorage.removeItem( LAYER_BUFFER_KEY );
	} catch ( e ) {
		// sessionStorage unavailable: nothing was stored there.
	}
}

const grantCallbacks = [];
let lastKnownConsent = null;
let listenersAdded = false;

/**
 * Compare the current consent with the last known state and react to a change:
 * persist and start on grant, delete on withdrawal.
 */
export function syncConsent() {
	const allowed = hasStatisticsConsent();

	if ( allowed === lastKnownConsent ) {
		return;
	}

	const wasAllowed = lastKnownConsent;
	lastKnownConsent = allowed;

	if ( allowed ) {
		const runGrantCallbacks = () => {
			grantCallbacks.forEach( ( callback ) => {
				try {
					callback();
				} catch ( e ) {
					// One failing listener must not stop the others.
				}
			} );
		};
		const adoptedId = persistMemoryStore();
		if ( adoptedId ) {
			whenVisitorIdIs( adoptedId, runGrantCallbacks );
		} else {
			runGrantCallbacks();
		}
		return;
	}

	// Only delete on a real withdrawal, not on the first check of a page where
	// the visitor has not chosen yet (nothing of ours is stored then anyway).
	if ( wasAllowed === true ) {
		clearStatisticsStorage();
	}
}

/**
 * Listen for the WP Consent API's events, once per page.
 */
function addConsentListeners() {
	if ( listenersAdded ) {
		return;
	}
	listenersAdded = true;

	// A banner sets the region's consent type (opt-in or opt-out).
	document.addEventListener( 'wp_consent_type_defined', syncConsent );
	// The visitor changed a category; detail is { statistics: 'allow' | 'deny', ... }.
	document.addEventListener( 'wp_listen_for_consent_change', ( event ) => {
		if ( event?.detail && event.detail[ CONSENT_CATEGORY ] === undefined ) {
			return;
		}
		syncConsent();
	} );
	// The WP Consent API script prints after GoDAM's, so check again once all
	// footer scripts have run.
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', syncConsent );
	}
}

/**
 * Run a callback once statistics consent is given: now if it already is,
 * otherwise when the visitor allows it.
 *
 * @param {Function} callback Called with no arguments.
 */
export function onStatisticsConsent( callback ) {
	addConsentListeners();

	if ( lastKnownConsent === null ) {
		lastKnownConsent = hasStatisticsConsent();
	}

	grantCallbacks.push( callback );

	if ( lastKnownConsent ) {
		callback();
	}
}

/**
 * Test-only: reset module state between tests.
 */
export function resetConsentStateForTests() {
	grantCallbacks.length = 0;
	lastKnownConsent = null;
	Object.keys( memoryStore ).forEach( ( key ) => delete memoryStore[ key ] );
}
