/**
 * Report video view milestones to the viewer's marketing automation platform.
 *
 * Watches every GoDAM player on the page and posts 0 (started), 25, 50, 75 and 100
 * to `godam/v1/map-events`, together with the visitor's Marketo and/or HubSpot
 * cookie. The REST route forwards it to GoDAM Central server-to-server, and Central
 * records it against the lead or contact that cookie belongs to.
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
 * Collect the visitor cookies for the tools this account has connected.
 *
 * @param {string[]} providers - Provider names from the server ("Marketo", "HubSpot").
 * @return {Object} Map of cookie key to value. Empty when the visitor is unknown to every tool.
 */
function collectVisitorIds( providers ) {
	const ids = {};

	providers.forEach( ( provider ) => {
		const key = PROVIDER_COOKIES[ String( provider ).toLowerCase() ];

		if ( ! key ) {
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
 * @param {string} jobId - GoDAM Central media ID.
 * @return {string} Session ID.
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
	} else {
		id = `${ Date.now().toString( 36 ) }-${ Math.random().toString( 36 ).slice( 2, 10 ) }`;
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

	const ids = collectVisitorIds( config.providers );

	// The visitor is not known to any connected tool, so there is no record to put
	// this on. Send nothing rather than a request that can only be dropped.
	if ( Object.keys( ids ).length === 0 ) {
		return;
	}

	const sessionId = getSessionId( jobId );
	const sent = new Set();

	const report = ( milestone ) => {
		if ( sent.has( milestone ) ) {
			return;
		}

		sent.add( milestone );

		sendMilestone( config, {
			media_id: jobId,
			milestone,
			page_url: window.location.href,
			session_id: sessionId,
			ids,
		} );
	};

	player.one( 'play', () => report( 0 ) );

	player.on( 'timeupdate', () => {
		// Also covers a player that was already playing when this script ran, where
		// the `play` above has already fired and will not fire again.
		report( 0 );

		const percent = watchedPercent( player );

		MILESTONES.forEach( ( milestone ) => {
			if ( milestone > 0 && percent >= milestone ) {
				report( milestone );
			}
		} );
	} );

	// `timeupdate` stops a little short of the end on most browsers, so 100 would
	// otherwise never fire for someone who watched the whole thing. Still count only
	// what was played: skipping to the end and letting it finish is not watching it.
	player.on( 'ended', () => {
		const percent = watchedPercent( player, END_SLACK_SECONDS );

		MILESTONES.forEach( ( milestone ) => {
			if ( percent >= milestone ) {
				report( milestone );
			}
		} );
	} );
}

/**
 * Start tracking once the server has told us a tool is connected.
 *
 * @return {void}
 */
function init() {
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
	MILESTONES,
};
