/**
 * Report video view milestones to the viewer's marketing automation platform.
 *
 * Watches every GoDAM player on the page and reports a milestone from the fixed set
 * 0/25/50/75/100 at two moments: when the viewer pauses (the milestone nearest the
 * share watched so far) and when the video ends (the highest milestone actually
 * watched). A milestone is only sent when it is higher than the last one sent for the
 * view, so a straight-through watch produces one event and repeated pauses at the same
 * point produce none. Each is posted to `godam/v1/map-events` with the visitor's
 * Marketo and/or HubSpot cookie. The REST route forwards it to GoDAM Central
 * server-to-server, and Central records it against the lead or contact that cookie
 * belongs to.
 *
 * Nothing here identifies anyone on its own: the cookie is the customer's own
 * first-party cookie, it is read but never written, and a page with neither cookie
 * makes no request at all.
 *
 * Enqueued only when the account has a connected tool with tracking on
 * (RTGODAM\Inc\Map_Tracker::maybe_enqueue_script).
 */

const MILESTONES = [ 0, 25, 50, 75, 100 ];

/**
 * How far short of the end a played range can stop and still count as reaching it,
 * in seconds. `timeupdate` stops a little short of the end on most browsers, so a
 * full watch can finish with its played range a fraction of a second shy.
 */
const END_SLACK_SECONDS = 1;

/**
 * Cookie each provider identifies its visitors with.
 */
const PROVIDER_COOKIES = {
	marketo: 'mkto_trk',
	hubspot: 'hubspotutk',
};

/**
 * Browser cookie name behind each key we send.
 */
const COOKIE_NAMES = {
	mkto_trk: '_mkto_trk',
	hubspotutk: 'hubspotutk',
};

/**
 * Read one cookie.
 *
 * @param {string} name - Cookie name.
 * @return {string} Decoded value, or an empty string when it is not set.
 */
function readCookie( name ) {
	const match = document.cookie.match(
		new RegExp( '(?:^|; )' + name.replace( /([.*+?^${}()|[\]\\])/g, '\\$1' ) + '=([^;]*)' ),
	);

	if ( ! match ) {
		return '';
	}

	try {
		return decodeURIComponent( match[ 1 ] );
	} catch ( e ) {
		// A cookie that is not valid percent-encoding is not one of ours.
		return '';
	}
}

/**
 * Whether the browser carries a page-wide "do not sell or share" signal.
 *
 * Global Privacy Control is the standard opt-out a visitor sets once for every
 * site, so it suppresses every tool, not just one — the same as GoDAM Central's
 * own `v1.js`. We never report a view for a visitor who has turned this on.
 *
 * @return {boolean} True when the browser signals a page-wide opt-out.
 */
function privacyOptedOut() {
	try {
		return window.navigator && window.navigator.globalPrivacyControl === true;
	} catch ( e ) {
		return false;
	}
}

/**
 * Whether the site's consent banner says this visitor declined marketing.
 *
 * With the WP Consent API active, `wp_has_consent( 'marketing' )` is false until
 * the visitor accepts marketing, and stays false if they refuse; with no consent
 * banner the API answers true. Without the WP Consent API nothing changes.
 * GoDAM declares `godam-map-session-*` to the API as a marketing item, so the
 * view is only sent, and the session only written, with marketing consent.
 *
 * @since 2.11.0
 *
 * @return {boolean} True when the WP Consent API is active and marketing is not allowed.
 */
function marketingConsentWithheld() {
	try {
		return typeof window.wp_has_consent === 'function' && ! window.wp_has_consent( 'marketing' );
	} catch ( e ) {
		return false;
	}
}

/**
 * Whether the visitor has opted out of HubSpot's own tracking.
 *
 * HubSpot sets `__hs_opt_out=yes` when a visitor declines its cookie banner and
 * `__hs_do_not_track` when tracking is disabled programmatically. The `hubspotutk`
 * cookie can still be in the jar from before, so its presence is not consent:
 * these two are what HubSpot itself honours, and so do we.
 *
 * @return {boolean} True when the visitor has opted out of HubSpot tracking.
 */
function hubspotOptedOut() {
	return 'yes' === readCookie( '__hs_opt_out' ) || '' !== readCookie( '__hs_do_not_track' );
}

/**
 * Whether GoDAM may attribute this view to the visitor's marketing profile.
 *
 * Marketing/attribution tools — Woo's consent module included — expose nothing
 * on `window`, so a site's banner or a tester otherwise has to infer consent
 * from whether a request went out. Exposed as `window.GoDAM.hasAttributionConsent`
 * so GoDAM's own decision is observable. It is false when the browser carries a
 * page-wide "do not sell or share" opt-out (Global Privacy Control), the one
 * signal that suppresses every tool; per-tool opt-outs (such as HubSpot's) still
 * apply on top of it when a view is collected.
 *
 * @return {boolean} True when attribution is allowed for this visitor.
 */
function hasAttributionConsent() {
	return ! privacyOptedOut();
}

/**
 * Collect the visitor cookies for the tools this account has connected.
 *
 * Honours the visitor's privacy choices before reading anything: a page-wide
 * opt-out (GPC) suppresses every tool, and HubSpot's own opt-out suppresses
 * HubSpot even when its cookie is still present.
 *
 * @param {string[]} providers - Provider names from the server ("Marketo", "HubSpot").
 * @return {Object} Map of cookie key to value. Empty when the visitor is unknown to every tool.
 */
function collectVisitorIds( providers ) {
	const ids = {};

	// A page-wide opt-out means no tool should hear about this view at all, and so
	// does a consent banner on which the visitor hasn't accepted marketing. Read on
	// every milestone, so accepting mid-view still carries the rest of the view.
	if ( privacyOptedOut() || marketingConsentWithheld() ) {
		return ids;
	}

	providers.forEach( ( provider ) => {
		const key = PROVIDER_COOKIES[ String( provider ).toLowerCase() ];

		if ( ! key ) {
			return;
		}

		// Respect HubSpot's own opt-out, which governs its cookie regardless of
		// whether the cookie itself is still set.
		if ( 'hubspotutk' === key && hubspotOptedOut() ) {
			return;
		}

		const value = readCookie( COOKIE_NAMES[ key ] );

		if ( value ) {
			ids[ key ] = value;
		}
	} );

	return ids;
}

/**
 * A random ID that groups the milestones of one view, so Central can tell a
 * re-watch from a duplicate.
 *
 * Kept in sessionStorage per video: a reload continues the same view rather than
 * sending every milestone again. Matches Central's `^[A-Za-z0-9-]{8,64}$`.
 *
 * Always from the browser's cryptographic generator: `crypto.randomUUID()`
 * where available (HTTPS pages), otherwise `crypto.getRandomValues()`, which
 * plain-HTTP pages have too. Never `Math.random()`, whose output can be
 * predicted.
 *
 * @param {string} jobId - GoDAM Central media ID.
 * @return {string} Session ID, or '' when the browser has no crypto API.
 */
function getSessionId( jobId ) {
	const storageKey = `godam-map-session-${ jobId }`;

	try {
		const existing = window.sessionStorage.getItem( storageKey );

		if ( existing && /^[A-Za-z0-9-]{8,64}$/.test( existing ) ) {
			return existing;
		}
	} catch ( e ) {
		// Private mode, or storage is full or blocked: fall through to a fresh ID.
	}

	let id;

	if ( window.crypto && typeof window.crypto.randomUUID === 'function' ) {
		id = window.crypto.randomUUID();
	} else if ( window.crypto && typeof window.crypto.getRandomValues === 'function' ) {
		// 16 random bytes as 32 hex characters, the same entropy as a UUID.
		id = Array.from( window.crypto.getRandomValues( new Uint8Array( 16 ) ), ( byte ) =>
			byte.toString( 16 ).padStart( 2, '0' ),
		).join( '' );
	} else {
		// No crypto API at all (a very old browser): no view can be sent.
		return '';
	}

	try {
		window.sessionStorage.setItem( storageKey, id );
	} catch ( e ) {
		// Not being able to remember it only costs a new ID on the next page.
	}

	return id;
}

/**
 * Share of the video the viewer has actually seen, as a percentage.
 *
 * Summed from the played ranges rather than taken from the current position, so
 * skipping ahead does not count as watching and watching out of order does.
 *
 * With `endSlack`, a range that stops within that many seconds of the end is
 * counted to the end. Only that missing tail is credited, not the slack itself, so
 * a viewer who skipped to the end gains nothing from it.
 *
 * @param {Object} player     - Video.js player.
 * @param {number} [endSlack] - Seconds short of the end that still reach it.
 * @return {number} 0-100.
 */
function watchedPercent( player, endSlack = 0 ) {
	const duration = typeof player.duration === 'function' ? player.duration() : 0;

	if ( ! duration || ! isFinite( duration ) || duration <= 0 ) {
		return 0;
	}

	const played = typeof player.played === 'function' ? player.played() : null;

	if ( ! played || typeof played.length !== 'number' ) {
		return 0;
	}

	let seconds = 0;

	for ( let i = 0; i < played.length; i++ ) {
		const end = duration - played.end( i ) <= endSlack ? duration : played.end( i );

		seconds += Math.max( 0, end - played.start( i ) );
	}

	return Math.min( 100, ( seconds / duration ) * 100 );
}

/**
 * The milestone nearest a watched percentage.
 *
 * Central only records the fixed set 0/25/50/75/100, so a pause partway through has
 * to report the closest of them rather than the raw percentage: 88 becomes 100, 24
 * becomes 25, 12 becomes 0.
 *
 * @param {number} percent - Share watched, 0-100.
 * @return {number} A value from MILESTONES.
 */
function nearestMilestone( percent ) {
	return Math.min( 100, Math.round( percent / 25 ) * 25 );
}

/**
 * The highest milestone a watched percentage has reached (floored, never rounded up).
 *
 * Used when the video ends, so finishing a video the viewer skipped through reports
 * only what they actually played, not 100.
 *
 * @param {number} percent - Share watched, 0-100.
 * @return {number} A value from MILESTONES; 0 when none is reached.
 */
function highestMilestoneReached( percent ) {
	let reached = 0;

	MILESTONES.forEach( ( milestone ) => {
		if ( percent >= milestone ) {
			reached = milestone;
		}
	} );

	return reached;
}

/**
 * Post one milestone. Failures are deliberately silent: tracking must never
 * interrupt playback or fill the console on a viewer's page.
 *
 * @param {Object} config - Localized settings (restUrl).
 * @param {Object} event  - Event payload.
 * @return {void}
 */
function sendMilestone( config, event ) {
	const body = JSON.stringify( event );

	try {
		window.fetch( config.restUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
			// The last milestone usually fires as the viewer leaves the page.
			keepalive: true,
			credentials: 'omit',
		} ).catch( () => {} );
	} catch ( e ) {
		// fetch unavailable or refused: nothing to recover, drop the event.
	}
}

/**
 * Players already being tracked, so a player seen by both godamPlayerReady and the
 * startup sweep is not reported twice.
 */
const tracked = new WeakSet();

/**
 * Watch one player and report its milestones.
 *
 * @param {Object}      config - Localized settings.
 * @param {Object}      player - Video.js player.
 * @param {HTMLElement} video  - The <video> element carrying data-job_id.
 * @return {void}
 */
function trackPlayer( config, player, video ) {
	const jobId = video?.dataset?.job_id || '';

	// Without a Central media ID there is nothing Central could match this to.
	if ( ! jobId || ! player ) {
		return;
	}

	// A player can arrive both from godamPlayerReady and from the sweep below.
	if ( tracked.has( video ) ) {
		return;
	}

	tracked.add( video );

	let sessionId = '';
	let knownIds = null;

	// Highest milestone already sent for this view. A milestone is reported only when
	// it climbs past this, so repeated pauses at the same point send nothing and the
	// sequence can only go up. -1 lets the first 0 through.
	let highestSent = -1;

	/**
	 * The visitor's cookies, read afresh until they turn up.
	 *
	 * Both tracking scripts are third-party and load asynchronously, so on a
	 * visitor's first page view the cookie is often written after the player is
	 * ready. Reading it once at setup would drop that whole view — which is the
	 * view that matters most, someone arriving on a landing page for the first
	 * time. Once found it is kept, so a known visitor costs one read per view.
	 *
	 * @return {Object} Map of cookie key to value. Empty while the visitor is unknown.
	 */
	const visitorIds = () => {
		if ( knownIds ) {
			return knownIds;
		}

		const found = collectVisitorIds( config.providers );

		if ( Object.keys( found ).length > 0 ) {
			knownIds = found;
		}

		return found;
	};

	const report = ( milestone ) => {
		// Only ever report a milestone higher than the last one sent for this view.
		if ( milestone <= highestSent ) {
			return;
		}

		const ids = visitorIds();

		// The visitor is not known to any connected tool yet, so there is no record
		// to put this on. Leave the milestone unsent rather than sending something
		// that can only be dropped: the handlers below re-report every milestone
		// already passed, so a cookie that arrives mid-view still carries the view.
		if ( Object.keys( ids ).length === 0 ) {
			return;
		}

		// Minted only once there is somewhere to send it, so a visitor no tool
		// knows leaves nothing behind in sessionStorage.
		if ( ! sessionId ) {
			sessionId = getSessionId( jobId );
		}

		// A browser with no crypto API cannot mint one, and Central refuses a
		// milestone without it.
		if ( ! sessionId ) {
			return;
		}

		highestSent = milestone;

		sendMilestone( config, {
			media_id: jobId,
			milestone,
			page_url: window.location.href,
			session_id: sessionId,
			ids,
		} );
	};

	// On pause, report the milestone nearest the share watched so far. report() drops
	// it unless it is higher than the last one sent, so pausing again at the same spot
	// sends nothing. A browser fires `pause` just before `ended` too, which lands the
	// closing milestone even when the `ended` handler below does not run.
	player.on( 'pause', () => {
		report( nearestMilestone( watchedPercent( player ) ) );
	} );

	// On end, report the highest milestone actually watched. `timeupdate` stops a
	// little short of the end on most browsers, so END_SLACK_SECONDS lets a full watch
	// reach 100; a viewer who skipped to the end still reports only what they played.
	player.on( 'ended', () => {
		report( highestMilestoneReached( watchedPercent( player, END_SLACK_SECONDS ) ) );
	} );
}

/**
 * Start tracking once the server has told us a tool is connected.
 *
 * @return {void}
 */
function init() {
	// Expose GoDAM's attribution-consent decision even when no tool is connected,
	// so a consent banner or a tester can read it instead of inferring it.
	window.GoDAM = window.GoDAM || {};
	window.GoDAM.hasAttributionConsent = hasAttributionConsent;

	const config = window.godamMapTracking;

	if ( ! config || ! config.restUrl || ! Array.isArray( config.providers ) || config.providers.length === 0 ) {
		return;
	}

	document.addEventListener( 'godamPlayerReady', ( event ) => {
		trackPlayer( config, event.detail?.player, event.detail?.videoElement );
	} );

	// This script runs in the footer, so a fast player may have become ready before
	// the listener above existed. Pick those up too; trackPlayer() de-duplicates.
	sweepReadyPlayers( config );
}

/**
 * Track players that were already ready when this script ran.
 *
 * @param {Object} config - Localized settings.
 * @return {void}
 */
function sweepReadyPlayers( config ) {
	const videojs = window.videojs;

	if ( ! videojs || typeof videojs.getPlayer !== 'function' ) {
		return;
	}

	document.querySelectorAll( '.easydam-player.video-js' ).forEach( ( video ) => {
		if ( video.dataset.videojsInitializing === 'true' ) {
			return;
		}

		let player = null;

		try {
			player = videojs.getPlayer( video );
		} catch ( e ) {
			// Not a player element, or not initialized: godamPlayerReady will cover it.
			return;
		}

		if ( player ) {
			trackPlayer( config, player, video );
		}
	} );
}

init();

export {
	collectVisitorIds,
	getSessionId,
	readCookie,
	watchedPercent,
	nearestMilestone,
	highestMilestoneReached,
	privacyOptedOut,
	marketingConsentWithheld,
	hubspotOptedOut,
	hasAttributionConsent,
	MILESTONES,
};
