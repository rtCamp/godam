/**
 * Report how far a viewer watched to the viewer's marketing automation platform.
 *
 * Watches every GoDAM player on the page and posts the highest milestone the viewer
 * has reached (0 = started, then 25, 50, 75, 100) to `godam/v1/map-events`,
 * together with the visitor's Marketo and/or HubSpot cookie. The REST route
 * forwards it to GoDAM Central server-to-server, and Central records it against the
 * lead or contact that cookie belongs to.
 *
 * It posts only when the viewer pauses, leaves the tab or the page, or has watched
 * COMPLETE_PERCENT of the video, and only when the milestone has gone up since the
 * last post. Marketo allows a limited number of API requests a day, so a view
 * should cost one or two requests, not one per milestone crossed.
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
 * Share of the video, as a percentage, that counts as watching all of it.
 *
 * Reaching it posts 100 straight away, without waiting for a pause: most people
 * who get this far close the tab or move on during the credits, and the end of a
 * video is often a call to action rather than content.
 */
const COMPLETE_PERCENT = 95;

/**
 * A view's sessionStorage value: its session ID, then optionally `.` and the
 * highest milestone already posted for it.
 *
 * The ID part matches Central's `^[A-Za-z0-9-]{8,64}$`. A value from before the
 * milestone was kept (the bare ID) still matches.
 */
const STORED_VIEW_PATTERN = /^([A-Za-z0-9-]{8,64})(?:\.(\d{1,3}))?$/;

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
	// every post, so accepting mid-view still carries the rest of the view.
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
 * sessionStorage key for one video's view.
 *
 * Declared to the WP Consent API as a marketing item
 * (RTGODAM\Inc\Visitor_Consent::get_storage_items), so keep the two in step.
 *
 * @param {string} jobId - GoDAM Central media ID.
 * @return {string} Storage key.
 */
function viewStorageKey( jobId ) {
	return `godam-map-session-${ jobId }`;
}

/**
 * Read the view kept in sessionStorage for one video.
 *
 * @param {string} jobId - GoDAM Central media ID.
 * @return {{sessionId: string, sent: number}} Session ID ('' when there is none) and the highest milestone posted (-1 when none).
 */
function readStoredView( jobId ) {
	const view = { sessionId: '', sent: -1 };

	try {
		const match = STORED_VIEW_PATTERN.exec( window.sessionStorage.getItem( viewStorageKey( jobId ) ) || '' );

		if ( match ) {
			view.sessionId = match[ 1 ];

			const sent = Number( match[ 2 ] );

			if ( undefined !== match[ 2 ] && MILESTONES.includes( sent ) ) {
				view.sent = sent;
			}
		}
	} catch ( e ) {
		// Private mode, or storage is blocked: nothing kept.
	}

	return view;
}

/**
 * Remember the highest milestone posted for a view, so a reload of the page does
 * not post a lower one for the same view: the played ranges start again from
 * nothing on reload, but the session ID carries on.
 *
 * Never lowers what is kept, since the same video can be on the page twice and
 * both players share the view.
 *
 * @param {string} jobId     - GoDAM Central media ID.
 * @param {string} sessionId - The view's session ID.
 * @param {number} milestone - Milestone just posted.
 * @return {void}
 */
function rememberSentMilestone( jobId, sessionId, milestone ) {
	const kept = readStoredView( jobId );

	if ( kept.sessionId === sessionId && kept.sent >= milestone ) {
		return;
	}

	try {
		window.sessionStorage.setItem( viewStorageKey( jobId ), `${ sessionId }.${ milestone }` );
	} catch ( e ) {
		// Not being able to remember it only risks a lower milestone after a reload,
		// which Central (and the REST route, given a persistent object cache) drops.
	}
}

/**
 * A random ID that groups the posts of one view, so Central can tell a re-watch
 * from a duplicate.
 *
 * Kept in sessionStorage per video: a reload continues the same view rather than
 * starting a new one. Matches Central's `^[A-Za-z0-9-]{8,64}$`.
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
	const existing = readStoredView( jobId ).sessionId;

	if ( existing ) {
		return existing;
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
		window.sessionStorage.setItem( viewStorageKey( jobId ), id );
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
 * The milestone a watched percentage has reached: COMPLETE_PERCENT and above
 * counts as 100, anything else rounds down to 75, 50, 25 or 0.
 *
 * @param {number} percent - Share of the video watched, 0-100.
 * @return {number} One of MILESTONES.
 */
function milestoneFor( percent ) {
	if ( percent >= COMPLETE_PERCENT ) {
		return 100;
	}

	let reached = 0;

	MILESTONES.forEach( ( milestone ) => {
		if ( milestone < 100 && percent >= milestone ) {
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
			// Often sent as the viewer leaves the page: keepalive lets it finish.
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
	let started = false;

	// Highest milestone this player has posted. A reload's earlier posts are
	// checked in sessionStorage at send time, in flush().
	let lastSent = -1;

	/**
	 * The visitor's cookies and privacy choices, read afresh on every post.
	 *
	 * Both tracking scripts are third-party and load asynchronously, so on a
	 * visitor's first page view the cookie is often written after the player is
	 * ready. Reading it once at setup would drop that whole view — which is the
	 * view that matters most, someone arriving on a landing page for the first
	 * time.
	 *
	 * Never kept between posts, because the answer can also go the other way: a
	 * visitor who withdraws marketing consent on the site's banner, or opts out of
	 * HubSpot, partway through a view must not have the rest of it sent. A view
	 * posts a handful of times at most, so reading the cookies each time costs
	 * nothing worth saving.
	 *
	 * @return {Object} Map of cookie key to value. Empty while the visitor is unknown or opted out.
	 */
	const visitorIds = () => collectVisitorIds( config.providers );

	/**
	 * Post the highest milestone reached, if it is higher than anything posted
	 * for this view so far.
	 *
	 * Counts only what was played: skipping to the end and letting it finish is
	 * not watching it.
	 *
	 * The end slack is only for `ended`, where the video really did reach the end.
	 * On a pause, a short clip stopped a second before the end has not been
	 * watched to the end.
	 *
	 * @param {number} [endSlack] - Seconds short of the end that still reach it.
	 * @return {void}
	 */
	const flush = ( endSlack = 0 ) => {
		const percent = watchedPercent( player, endSlack );

		// `playing` covers a normal start. Played ranges cover a player that was
		// already playing when this script ran, whose `playing` has come and gone.
		// Neither means the viewer never started, and there is no view to report.
		if ( ! started && percent <= 0 ) {
			return;
		}

		const milestone = milestoneFor( percent );

		if ( milestone <= lastSent ) {
			return;
		}

		const ids = visitorIds();

		// The visitor is not known to any connected tool yet, so there is no record
		// to put this on. Leave the milestone unsent rather than sending something
		// that can only be dropped: lastSent stays where it is, so the next pause or
		// leave carries the whole view once the cookie turns up.
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

		// Before a reload, or in another player of the same video, this view may
		// already have posted this much or more.
		const kept = readStoredView( jobId );

		if ( kept.sessionId === sessionId && milestone <= kept.sent ) {
			lastSent = kept.sent;
			return;
		}

		lastSent = milestone;
		rememberSentMilestone( jobId, sessionId, milestone );

		sendMilestone( config, {
			media_id: jobId,
			milestone,
			page_url: window.location.href,
			session_id: sessionId,
			ids,
		} );
	};

	// `playing`, not `play`: a blocked autoplay fires `play` and then `pause`
	// without a frame being shown, which is not a view.
	player.one( 'playing', () => {
		started = true;
	} );

	// Listeners get an event as their first argument, so none of these hand
	// flush() straight to `on()`: the event would arrive as endSlack.
	player.on( 'pause', () => flush() );

	// `timeupdate` stops a little short of the end on most browsers, so a full
	// watch can finish with its played range a fraction of a second shy.
	player.on( 'ended', () => flush( END_SLACK_SECONDS ) );

	// Reaching COMPLETE_PERCENT posts straight away. Once 100 has gone out, the
	// check on lastSent skips scanning the played ranges on every tick.
	player.on( 'timeupdate', () => {
		if ( lastSent < 100 && watchedPercent( player ) >= COMPLETE_PERCENT ) {
			flush();
		}
	} );

	// Leaving the tab is the last chance on mobile, where a page in the background
	// can be discarded without `pagehide` ever firing.
	const onVisibilityChange = () => {
		if ( 'hidden' === document.visibilityState ) {
			flush();
		}
	};

	const onPageHide = () => flush();

	document.addEventListener( 'visibilitychange', onVisibilityChange );
	window.addEventListener( 'pagehide', onPageHide );

	// A player closed with its modal or gallery: report it, then stop listening to
	// the page on its behalf.
	player.on( 'dispose', () => {
		try {
			flush();
		} catch ( e ) {
			// The tech may already be gone; nothing to report then.
		}

		document.removeEventListener( 'visibilitychange', onVisibilityChange );
		window.removeEventListener( 'pagehide', onPageHide );
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
	readStoredView,
	readCookie,
	watchedPercent,
	milestoneFor,
	COMPLETE_PERCENT,
	privacyOptedOut,
	marketingConsentWithheld,
	hubspotOptedOut,
	hasAttributionConsent,
	MILESTONES,
};
