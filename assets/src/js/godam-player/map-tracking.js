/**
 * Report how far a viewer watched to the viewer's marketing automation platform.
 *
 * Watches every GoDAM player on the page and posts one milestone per view to
 * `godam/v1/map-events`, together with the visitor's Marketo and/or HubSpot cookie.
 * The REST route forwards it to GoDAM Central server-to-server, and Central records
 * it against the lead or contact that cookie belongs to, as "Watched N% of
 * <video title>" (Central adds the title from its own media record).
 *
 * The milestone is how much of the video was played, rounded up to the next
 * quarter: up to 25% is 25, up to 50% is 50, up to 75% is 75, and anything more is
 * 100 (milestoneFor()). There is no "started" (0) post.
 *
 * Exactly one post per view, sent the first time the viewer pauses the video, the
 * video ends, or the viewer leaves the page. Nothing after that: Marketo allows a
 * limited number of API requests a day. Only the viewer's own pauses count
 * (isViewerPause()); the pauses GoDAM makes itself, for layers, auto-pause and
 * hover previews, do not.
 *
 * Nothing here identifies anyone on its own: the cookie is the customer's own
 * first-party cookie, it is read but never written, and a page with neither cookie
 * makes no request at all.
 *
 * Enqueued only when the account has a connected tool with tracking on
 * (RTGODAM\Inc\Map_Tracker::maybe_enqueue_script).
 */

/**
 * Every milestone the REST route and Central accept. The player itself only ever
 * posts 25, 50, 75 or 100; 0 stays valid for Central's embed player.
 */
const MILESTONES = [ 0, 25, 50, 75, 100 ];

/**
 * How long after the viewer's own click, tap or key press a pause still counts as
 * theirs, in milliseconds. Long enough for Video.js to act on the input, short
 * enough that a layer pausing the video a moment later is not mistaken for it.
 */
const VIEWER_INPUT_WINDOW_MS = 1000;

/**
 * A view's sessionStorage value: its session ID, then, once the view has been
 * reported, `.` and the milestone that was posted.
 *
 * The ID part matches Central's `^[A-Za-z0-9-]{8,64}$`. A bare ID (a view not
 * reported yet, or one stored by an earlier version) still matches.
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
 * @return {{sessionId: string, sent: number}} Session ID ('' when there is none) and the milestone posted for the view (-1 while it has not been reported).
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
 * Mark a view as reported, so neither a reload of the page (the session ID carries
 * on) nor another player of the same video reports it again.
 *
 * @param {string} jobId     - GoDAM Central media ID.
 * @param {string} sessionId - The view's session ID.
 * @param {number} milestone - Milestone posted for it.
 * @return {void}
 */
function markViewReported( jobId, sessionId, milestone ) {
	try {
		window.sessionStorage.setItem( viewStorageKey( jobId ), `${ sessionId }.${ milestone }` );
	} catch ( e ) {
		// Not being able to remember it only risks a second post after a reload,
		// which Central (and the REST route, given a persistent object cache) drops.
	}
}

/**
 * Undo markViewReported() when the post did not get through, so the view's next
 * pause, end or page leave can report it. Leaves the value alone if something
 * else has reported the view since.
 *
 * @param {string} jobId     - GoDAM Central media ID.
 * @param {string} sessionId - The view's session ID.
 * @param {number} milestone - Milestone that failed to post.
 * @return {void}
 */
function unmarkViewReported( jobId, sessionId, milestone ) {
	try {
		if ( window.sessionStorage.getItem( viewStorageKey( jobId ) ) === `${ sessionId }.${ milestone }` ) {
			window.sessionStorage.setItem( viewStorageKey( jobId ), sessionId );
		}
	} catch ( e ) {
		// Storage blocked: the mark was never written either.
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
 * The milestone for a watched percentage, rounded up to the next quarter: more
 * than 0% up to 25% is 25, up to 50% is 50, up to 75% is 75, and more is 100.
 *
 * A boundary itself belongs to the range below it (exactly 50% is 50). The played
 * ranges are float seconds, so a sum that lands a hair over a boundary
 * (50.0000001%) still counts as that boundary.
 *
 * @param {number} percent - Share of the video watched, 0-100.
 * @return {number|null} 25, 50, 75 or 100, or null when nothing was watched.
 */
function milestoneFor( percent ) {
	if ( ! ( percent > 0 ) ) {
		return null;
	}

	const step = Math.ceil( ( percent - 1e-6 ) / 25 ) * 25;

	return Math.min( 100, Math.max( 25, step ) );
}

/**
 * Post one milestone. Failures are deliberately silent: tracking must never
 * interrupt playback or fill the console on a viewer's page.
 *
 * @param {Object} config - Localized settings (restUrl).
 * @param {Object} event  - Event payload.
 * @return {Promise<boolean>} Whether the route received it. False on a network error or an error status.
 */
function sendMilestone( config, event ) {
	const body = JSON.stringify( event );

	try {
		return window
			.fetch( config.restUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body,
				// Often sent as the viewer leaves the page: keepalive lets it finish.
				keepalive: true,
				credentials: 'omit',
			} )
			.then( ( response ) => !! response && false !== response.ok )
			.catch( () => false );
	} catch ( e ) {
		// fetch unavailable or refused: nothing went out.
		return Promise.resolve( false );
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

	// The viewer started playback: a `playing` outside a hover preview.
	let started = false;

	// This player's view has been reported, or a post for it is on its way.
	let reported = false;

	// When the viewer last clicked, tapped or pressed a key, for isViewerPause().
	let lastViewerInputAt = -Infinity;

	/**
	 * The visitor's cookies and privacy choices, read afresh on every attempt.
	 *
	 * Both tracking scripts are third-party and load asynchronously, so on a
	 * visitor's first page view the cookie is often written after the player is
	 * ready. Reading it once at setup would drop that whole view — which is the
	 * view that matters most, someone arriving on a landing page for the first
	 * time.
	 *
	 * Never kept between attempts, because the answer can also go the other way: a
	 * visitor who withdraws marketing consent on the site's banner, or opts out of
	 * HubSpot, before the view is reported must not have it sent.
	 *
	 * @return {Object} Map of cookie key to value. Empty while the visitor is unknown or opted out.
	 */
	const visitorIds = () => collectVisitorIds( config.providers );

	/**
	 * Whether a hover preview is playing the video: both preview modes hide the
	 * control bar while they play, and a real playback always shows it.
	 *
	 * @return {boolean} True during a preview.
	 */
	const isPreviewing = () => {
		try {
			return !! player.controlBar?.el()?.classList.contains( 'hide' );
		} catch ( e ) {
			return false;
		}
	};

	/**
	 * Whether this pause is the viewer's own: it follows their click, tap or key
	 * press, and it is not GoDAM auto-pausing the player (scrolled out of view,
	 * another player started) or the viewer dragging the seek bar, which pauses
	 * and resumes playback. Layers and hover previews pause without any input from
	 * the viewer, so they never count.
	 *
	 * @return {boolean} True for a pause the viewer made.
	 */
	const isViewerPause = () => {
		if ( player.godamAutoPause ) {
			return false;
		}

		if ( typeof player.scrubbing === 'function' && player.scrubbing() ) {
			return false;
		}

		return Date.now() - lastViewerInputAt <= VIEWER_INPUT_WINDOW_MS;
	};

	/**
	 * Report this view, once: the milestone for how much was played, rounded up.
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
	const report = ( endSlack = 0 ) => {
		if ( reported || ! started ) {
			return;
		}

		const milestone = milestoneFor( watchedPercent( player, endSlack ) );

		if ( null === milestone ) {
			return;
		}

		const ids = visitorIds();

		// The visitor is not known to any connected tool yet, or has opted out, so
		// there is no record to put this on. The view stays unreported, so its next
		// pause, end or page leave can still report it once the cookie turns up.
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
		// already have been reported.
		const kept = readStoredView( jobId );

		if ( kept.sessionId === sessionId && kept.sent >= 0 ) {
			reported = true;
			return;
		}

		// Marked before the post goes out, because `pause` and `ended` fire
		// back to back at the end of a video and must not both post.
		reported = true;
		markViewReported( jobId, sessionId, milestone );

		sendMilestone( config, {
			media_id: jobId,
			milestone,
			page_url: window.location.href,
			session_id: sessionId,
			ids,
		} ).then( ( delivered ) => {
			// Lost on the way (offline, or an error status): let the next pause, end
			// or page leave try again, so one failed post does not lose the view.
			if ( ! delivered ) {
				reported = false;
				unmarkViewReported( jobId, sessionId, milestone );
			}
		} );
	};

	const onViewerInput = () => {
		lastViewerInputAt = Date.now();
	};

	// Clicks and taps on the player, caught on the way down so they are recorded
	// before Video.js acts on them. GoDAM's keyboard shortcuts listen on the whole
	// document, so key presses are caught there.
	const root = typeof player.el === 'function' ? player.el() : null;

	root?.addEventListener( 'pointerdown', onViewerInput, true );
	root?.addEventListener( 'click', onViewerInput, true );
	document.addEventListener( 'keydown', onViewerInput, true );

	// `playing`, not `play`: a blocked autoplay fires `play` and then `pause`
	// without a frame being shown, which is not a view. Neither is a hover preview.
	player.on( 'playing', () => {
		if ( ! started && ! isPreviewing() ) {
			started = true;
		}
	} );

	player.on( 'pause', () => {
		// At the end of a video the browser fires `pause` and then `ended`; the
		// `ended` handler reports it, with the end slack.
		if ( typeof player.ended === 'function' && player.ended() ) {
			return;
		}

		if ( isViewerPause() ) {
			report();
		}
	} );

	// `timeupdate` stops a little short of the end on most browsers, so a full
	// watch can finish with its played range a fraction of a second shy. Listeners
	// get an event as their first argument, so report() is never handed straight
	// to `on()`: the event would arrive as endSlack.
	player.on( 'ended', () => report( END_SLACK_SECONDS ) );

	// Leaving the page with the video still playing, or paused by GoDAM rather
	// than the viewer, is the view's last chance to be reported.
	const onPageHide = () => report();

	window.addEventListener( 'pagehide', onPageHide );

	// A player removed with its modal or gallery: stop listening to the page on
	// its behalf. The page itself is still open, so this is not a page leave.
	player.on( 'dispose', () => {
		window.removeEventListener( 'pagehide', onPageHide );
		document.removeEventListener( 'keydown', onViewerInput, true );
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
	privacyOptedOut,
	marketingConsentWithheld,
	hubspotOptedOut,
	hasAttributionConsent,
	MILESTONES,
};
