/**
 * Unit tests for the MAP milestone tracker's pure helpers.
 *
 * The three things worth pinning here are the ones a viewer's page depends on:
 * a cookie is only read for a tool the account actually connected, a view keeps
 * one session ID across a reload, and "how far did they watch" is measured from
 * what was played rather than from where the playhead happens to sit.
 */

/**
 * Internal dependencies
 */
import {
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
} from './map-tracking';

const MKTO = 'id:123-ABC-456&token:_mch-example.com-1760000000000-12345';
const HUTK = '0123456789abcdef0123456789abcdef';

/**
 * Build a stand-in for a Video.js player's played()/duration() pair.
 *
 * @param {number}  duration - Duration in seconds.
 * @param {Array[]} ranges   - Played ranges as [start, end] pairs.
 * @return {Object} Player-shaped object.
 */
function fakePlayer( duration, ranges ) {
	return {
		duration: () => duration,
		played: () => ( {
			length: ranges.length,
			start: ( i ) => ranges[ i ][ 0 ],
			end: ( i ) => ranges[ i ][ 1 ],
		} ),
	};
}

/**
 * Clear every cookie jsdom is currently holding.
 */
function clearCookies() {
	document.cookie.split( ';' ).forEach( ( pair ) => {
		const name = pair.split( '=' )[ 0 ].trim();
		if ( name ) {
			document.cookie = `${ name }=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
		}
	} );
}

describe( 'readCookie', () => {
	afterEach( clearCookies );

	it( 'reads a cookie by exact name', () => {
		document.cookie = `hubspotutk=${ HUTK }; path=/`;

		expect( readCookie( 'hubspotutk' ) ).toBe( HUTK );
	} );

	it( 'does not match a cookie whose name merely ends with the one asked for', () => {
		document.cookie = 'not_hubspotutk=wrong; path=/';

		expect( readCookie( 'hubspotutk' ) ).toBe( '' );
	} );

	it( 'decodes a percent-encoded value, as Marketo writes it', () => {
		document.cookie = `_mkto_trk=${ encodeURIComponent( MKTO ) }; path=/`;

		expect( readCookie( '_mkto_trk' ) ).toBe( MKTO );
	} );

	it( 'returns an empty string for a cookie that is not set', () => {
		expect( readCookie( '_mkto_trk' ) ).toBe( '' );
	} );
} );

describe( 'collectVisitorIds', () => {
	afterEach( clearCookies );

	it( 'collects the cookie for each connected provider', () => {
		document.cookie = `_mkto_trk=${ encodeURIComponent( MKTO ) }; path=/`;
		document.cookie = `hubspotutk=${ HUTK }; path=/`;

		expect( collectVisitorIds( [ 'Marketo', 'HubSpot' ] ) ).toEqual( {
			mkto_trk: MKTO,
			hubspotutk: HUTK,
		} );
	} );

	it( 'ignores a cookie whose tool is not connected', () => {
		document.cookie = `_mkto_trk=${ encodeURIComponent( MKTO ) }; path=/`;
		document.cookie = `hubspotutk=${ HUTK }; path=/`;

		expect( collectVisitorIds( [ 'HubSpot' ] ) ).toEqual( { hubspotutk: HUTK } );
	} );

	it( 'matches provider names regardless of case', () => {
		document.cookie = `hubspotutk=${ HUTK }; path=/`;

		expect( collectVisitorIds( [ 'hubspot' ] ) ).toEqual( { hubspotutk: HUTK } );
	} );

	it( 'returns nothing for a visitor with no marketing cookie', () => {
		expect( collectVisitorIds( [ 'Marketo', 'HubSpot' ] ) ).toEqual( {} );
	} );

	it( 'ignores providers it has no cookie name for', () => {
		expect( collectVisitorIds( [ 'Mailchimp' ] ) ).toEqual( {} );
	} );

	it( 'reports nothing for a visitor with Global Privacy Control on', () => {
		document.cookie = `_mkto_trk=${ encodeURIComponent( MKTO ) }; path=/`;
		document.cookie = `hubspotutk=${ HUTK }; path=/`;

		Object.defineProperty( window.navigator, 'globalPrivacyControl', {
			value: true,
			configurable: true,
		} );

		expect( collectVisitorIds( [ 'Marketo', 'HubSpot' ] ) ).toEqual( {} );

		delete window.navigator.globalPrivacyControl;
	} );

	it( 'drops HubSpot, but keeps Marketo, when HubSpot is opted out', () => {
		document.cookie = `_mkto_trk=${ encodeURIComponent( MKTO ) }; path=/`;
		document.cookie = `hubspotutk=${ HUTK }; path=/`;
		document.cookie = '__hs_opt_out=yes; path=/';

		expect( collectVisitorIds( [ 'Marketo', 'HubSpot' ] ) ).toEqual( { mkto_trk: MKTO } );
	} );

	it( 'drops HubSpot when __hs_do_not_track is set', () => {
		document.cookie = `hubspotutk=${ HUTK }; path=/`;
		document.cookie = '__hs_do_not_track=true; path=/';

		expect( collectVisitorIds( [ 'HubSpot' ] ) ).toEqual( {} );
	} );
} );

describe( 'marketing consent (WP Consent API)', () => {
	afterEach( () => {
		clearCookies();
		delete window.wp_has_consent;
	} );

	it( 'reports nothing while the visitor has not accepted marketing', () => {
		document.cookie = `_mkto_trk=${ encodeURIComponent( MKTO ) }; path=/`;
		document.cookie = `hubspotutk=${ HUTK }; path=/`;
		window.wp_has_consent = ( category ) => 'marketing' !== category;

		expect( marketingConsentWithheld() ).toBe( true );
		expect( collectVisitorIds( [ 'Marketo', 'HubSpot' ] ) ).toEqual( {} );
	} );

	it( 'reports the view once marketing is accepted', () => {
		document.cookie = `hubspotutk=${ HUTK }; path=/`;
		window.wp_has_consent = () => true;

		expect( marketingConsentWithheld() ).toBe( false );
		expect( collectVisitorIds( [ 'HubSpot' ] ) ).toEqual( { hubspotutk: HUTK } );
	} );

	it( 'changes nothing without the WP Consent API', () => {
		document.cookie = `hubspotutk=${ HUTK }; path=/`;

		expect( marketingConsentWithheld() ).toBe( false );
		expect( collectVisitorIds( [ 'HubSpot' ] ) ).toEqual( { hubspotutk: HUTK } );
	} );

	it( 'does not block tracking if the consent check throws', () => {
		window.wp_has_consent = () => {
			throw new Error( 'banner not ready' );
		};

		expect( marketingConsentWithheld() ).toBe( false );
	} );
} );

describe( 'privacyOptedOut', () => {
	afterEach( () => {
		delete window.navigator.globalPrivacyControl;
	} );

	it( 'is true only when Global Privacy Control is exactly true', () => {
		expect( privacyOptedOut() ).toBe( false );

		Object.defineProperty( window.navigator, 'globalPrivacyControl', {
			value: true,
			configurable: true,
		} );
		expect( privacyOptedOut() ).toBe( true );
	} );
} );

describe( 'hasAttributionConsent', () => {
	afterEach( () => {
		delete window.navigator.globalPrivacyControl;
	} );

	it( 'is the inverse of a page-wide opt-out', () => {
		expect( hasAttributionConsent() ).toBe( true );

		Object.defineProperty( window.navigator, 'globalPrivacyControl', {
			value: true,
			configurable: true,
		} );
		expect( hasAttributionConsent() ).toBe( false );
	} );

	it( 'is exposed on window.GoDAM for banners and testers to read', () => {
		expect( typeof window.GoDAM.hasAttributionConsent ).toBe( 'function' );
		expect( window.GoDAM.hasAttributionConsent() ).toBe( true );
	} );
} );

describe( 'hubspotOptedOut', () => {
	afterEach( clearCookies );

	it( 'is false with no opt-out cookie', () => {
		expect( hubspotOptedOut() ).toBe( false );
	} );

	it( 'is true when __hs_opt_out is yes', () => {
		document.cookie = '__hs_opt_out=yes; path=/';
		expect( hubspotOptedOut() ).toBe( true );
	} );

	it( 'is true when __hs_do_not_track is present', () => {
		document.cookie = '__hs_do_not_track=true; path=/';
		expect( hubspotOptedOut() ).toBe( true );
	} );
} );

describe( 'getSessionId', () => {
	beforeEach( () => window.sessionStorage.clear() );

	it( 'produces an ID Central will accept', () => {
		expect( getSessionId( 'job-1' ) ).toMatch( /^[A-Za-z0-9-]{8,64}$/ );
	} );

	it( 'keeps one ID per video across calls, so a reload continues the same view', () => {
		const first = getSessionId( 'job-1' );

		expect( getSessionId( 'job-1' ) ).toBe( first );
	} );

	it( 'gives each video its own ID', () => {
		expect( getSessionId( 'job-1' ) ).not.toBe( getSessionId( 'job-2' ) );
	} );

	it( 'replaces a stored value that no longer matches the expected shape', () => {
		window.sessionStorage.setItem( 'godam-map-session-job-1', 'bad id!' );

		expect( getSessionId( 'job-1' ) ).toMatch( /^[A-Za-z0-9-]{8,64}$/ );
	} );

	it( 'uses crypto.getRandomValues when randomUUID is missing (plain-HTTP pages)', () => {
		const randomUUID = window.crypto.randomUUID;
		const random = jest.spyOn( Math, 'random' );
		Object.defineProperty( window.crypto, 'randomUUID', { value: undefined, configurable: true } );

		const id = getSessionId( 'job-1' );

		expect( id ).toMatch( /^[0-9a-f]{32}$/ );
		expect( random ).not.toHaveBeenCalled();

		Object.defineProperty( window.crypto, 'randomUUID', { value: randomUUID, configurable: true } );
		random.mockRestore();
	} );

	it( 'returns no ID, rather than a predictable one, without a crypto API', () => {
		const crypto = Object.getOwnPropertyDescriptor( window, 'crypto' );
		Object.defineProperty( window, 'crypto', { value: undefined, configurable: true } );

		expect( getSessionId( 'job-1' ) ).toBe( '' );

		Object.defineProperty( window, 'crypto', crypto );
	} );

	it( 'still returns an ID when storage is unavailable', () => {
		const getItem = jest.spyOn( window.sessionStorage.__proto__, 'getItem' ).mockImplementation( () => {
			throw new Error( 'denied' );
		} );
		const setItem = jest.spyOn( window.sessionStorage.__proto__, 'setItem' ).mockImplementation( () => {
			throw new Error( 'denied' );
		} );

		expect( getSessionId( 'job-1' ) ).toMatch( /^[A-Za-z0-9-]{8,64}$/ );

		getItem.mockRestore();
		setItem.mockRestore();
	} );
} );

describe( 'watchedPercent', () => {
	it( 'sums the played ranges rather than reading the playhead', () => {
		// Watched the first and last quarter, then skipped back: 50% seen, even
		// though the playhead sits at the end.
		expect( watchedPercent( fakePlayer( 100, [ [ 0, 25 ], [ 75, 100 ] ] ) ) ).toBe( 50 );
	} );

	it( 'reports 100 for a fully watched video', () => {
		expect( watchedPercent( fakePlayer( 60, [ [ 0, 60 ] ] ) ) ).toBe( 100 );
	} );

	it( 'does not count seeking ahead as watching', () => {
		expect( watchedPercent( fakePlayer( 100, [ [ 0, 2 ] ] ) ) ).toBe( 2 );
	} );

	it( 'never exceeds 100 when the ranges overlap the duration', () => {
		expect( watchedPercent( fakePlayer( 10, [ [ 0, 10 ], [ 0, 10 ] ] ) ) ).toBe( 100 );
	} );

	it( 'returns 0 for a live or still-loading video with no usable duration', () => {
		expect( watchedPercent( fakePlayer( 0, [ [ 0, 5 ] ] ) ) ).toBe( 0 );
		expect( watchedPercent( fakePlayer( Infinity, [ [ 0, 5 ] ] ) ) ).toBe( 0 );
		expect( watchedPercent( fakePlayer( NaN, [ [ 0, 5 ] ] ) ) ).toBe( 0 );
	} );

	it( 'returns 0 before anything has played', () => {
		expect( watchedPercent( fakePlayer( 100, [] ) ) ).toBe( 0 );
	} );

	it( 'survives a player that exposes neither duration nor played', () => {
		expect( watchedPercent( {} ) ).toBe( 0 );
	} );

	it( 'counts a range that stops within the slack of the end as reaching it', () => {
		expect( watchedPercent( fakePlayer( 100, [ [ 0, 99.7 ] ] ), 1 ) ).toBe( 100 );
	} );

	it( 'does not stretch a range that stops further from the end than the slack', () => {
		expect( watchedPercent( fakePlayer( 100, [ [ 0, 98 ] ] ), 1 ) ).toBe( 98 );
	} );

	it( 'gives nothing extra to a viewer who skipped to the end', () => {
		expect( watchedPercent( fakePlayer( 100, [ [ 0, 1 ], [ 98, 100 ] ] ), 1 ) ).toBe( 3 );
	} );
} );

describe( 'nearestMilestone', () => {
	it( 'rounds to the closest milestone, the way a pause reports it', () => {
		expect( nearestMilestone( 0 ) ).toBe( 0 );
		expect( nearestMilestone( 12 ) ).toBe( 0 );
		expect( nearestMilestone( 13 ) ).toBe( 25 );
		expect( nearestMilestone( 24 ) ).toBe( 25 );
		expect( nearestMilestone( 60 ) ).toBe( 50 );
		expect( nearestMilestone( 88 ) ).toBe( 100 );
		expect( nearestMilestone( 100 ) ).toBe( 100 );
	} );

	it( 'never rounds above 100', () => {
		expect( nearestMilestone( 100 ) ).toBe( 100 );
	} );
} );

describe( 'highestMilestoneReached', () => {
	it( 'floors to the highest milestone passed, the way the end reports it', () => {
		expect( highestMilestoneReached( 0 ) ).toBe( 0 );
		expect( highestMilestoneReached( 3 ) ).toBe( 0 );
		expect( highestMilestoneReached( 24 ) ).toBe( 0 );
		expect( highestMilestoneReached( 25 ) ).toBe( 25 );
		expect( highestMilestoneReached( 88 ) ).toBe( 75 );
		expect( highestMilestoneReached( 100 ) ).toBe( 100 );
	} );
} );

describe( 'milestones reported for one view', () => {
	const originalFetch = window.fetch;

	/**
	 * Load a second copy of the tracker with tracking switched on, so its init()
	 * listens for godamPlayerReady. Loaded once: every copy adds its own listener,
	 * and each test uses a fresh <video> so the copy's de-duplication never bites.
	 */
	beforeAll( () => {
		window.godamMapTracking = {
			restUrl: 'https://example.com/wp-json/godam/v1/map-events',
			providers: [ 'HubSpot' ],
		};

		jest.isolateModules( () => {
			require( './map-tracking' );
		} );
	} );

	afterAll( () => {
		delete window.godamMapTracking;
	} );

	beforeEach( () => {
		window.fetch = jest.fn( () => Promise.resolve() );
		window.sessionStorage.clear();
		document.cookie = `hubspotutk=${ HUTK }; path=/`;
	} );

	/**
	 * Players handed out in the current test. Disposed after it, so their page-leave
	 * listeners do not report into the next test.
	 */
	let players = [];

	afterEach( () => {
		players.forEach( ( player ) => player.trigger( 'dispose' ) );
		players = [];
		window.fetch = originalFetch;
		clearCookies();
	} );

	/**
	 * Fire the page events a browser sends when the viewer switches tabs or leaves.
	 *
	 * @param {string} name - 'visibilitychange' (the page turns hidden) or 'pagehide'.
	 * @return {void}
	 */
	function leavePage( name ) {
		if ( 'pagehide' === name ) {
			window.dispatchEvent( new Event( 'pagehide' ) );
			return;
		}

		Object.defineProperty( document, 'visibilityState', { configurable: true, get: () => 'hidden' } );
		document.dispatchEvent( new Event( 'visibilitychange' ) );
		delete document.visibilityState;
	}

	/**
	 * Hand the tracker a Video.js-shaped player whose events the test fires itself.
	 *
	 * Playback has started (a `playing` outside a hover preview) unless `start` is false.
	 *
	 * @param {number}  duration        - Duration in seconds.
	 * @param {Object}  [options]       - Options.
	 * @param {boolean} [options.start] - Fire `playing` once the player is tracked. Default true.
	 * @return {Object} The player, plus `ranges` to push played ranges to, `trigger( name )`, `viewerPause()` (the viewer clicks pause) and `finish()` (the video plays to its end).
	 */
	function readyPlayer( duration, { start = true } = {} ) {
		const handlers = {};
		const ranges = [];
		const el = document.createElement( 'div' );
		const controlBarEl = document.createElement( 'div' );
		let isEnded = false;
		const listen = ( name, handler ) => {
			handlers[ name ] = handlers[ name ] || [];
			handlers[ name ].push( handler );
		};

		const player = {
			ranges,
			duration: () => duration,
			played: () => ( {
				length: ranges.length,
				start: ( i ) => ranges[ i ][ 0 ],
				end: ( i ) => ranges[ i ][ 1 ],
			} ),
			on: listen,
			one: ( name, handler ) => {
				let fired = false;
				listen( name, () => {
					if ( ! fired ) {
						fired = true;
						handler();
					}
				} );
			},
			trigger: ( name ) => ( handlers[ name ] || [] ).forEach( ( handler ) => handler() ),
			el: () => el,
			controlBar: { el: () => controlBarEl },
			paused: () => true,
			ended: () => isEnded,
			scrubbing: () => false,
			godamAutoPause: false,
			// The viewer clicks the player's pause control.
			viewerPause: () => {
				el.dispatchEvent( new Event( 'pointerdown' ) );
				player.trigger( 'pause' );
			},
			// Playback reaches the end: the browser fires `pause` with ended() already
			// true, then `ended`.
			finish: () => {
				isEnded = true;
				player.trigger( 'pause' );
				player.trigger( 'ended' );
			},
		};

		const video = document.createElement( 'video' );
		video.dataset.job_id = 'job-1';

		document.dispatchEvent(
			new CustomEvent( 'godamPlayerReady', { detail: { player, videoElement: video } } ),
		);

		players.push( player );

		if ( start ) {
			player.trigger( 'playing' );
		}

		return player;
	}

	/**
	 * @return {number[]} Milestones posted so far, in order.
	 */
	function postedMilestones() {
		return window.fetch.mock.calls.map( ( [ , init ] ) => JSON.parse( init.body ).milestone );
	}

	it( 'reports the nearest milestone once when the viewer pauses partway', () => {
		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 60 ] );
		player.viewerPause();
		// Pausing again at the same spot adds nothing.
		player.viewerPause();

		expect( postedMilestones() ).toEqual( [ 50 ] );
	} );

	it( 'reports each new high as the viewer pauses further in, and nothing when it does not climb', () => {
		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 40 ] );
		player.viewerPause(); // nearest( 40 ) = 50

		// A little more watched, still nearest 50: no new event.
		player.ranges.push( [ 40, 45 ] );
		player.viewerPause();

		player.ranges.push( [ 45, 100 ] );
		player.viewerPause(); // nearest( 100 ) = 100

		expect( postedMilestones() ).toEqual( [ 50, 100 ] );
	} );

	it( 'reports a single 100 for a full straight-through watch', () => {
		const player = readyPlayer( 100 );

		// The browser fires pause at the end, then ended; only one 100 goes out.
		player.ranges.push( [ 0, 99.7 ] );
		player.finish();

		expect( postedMilestones() ).toEqual( [ 100 ] );
	} );

	it( 'reports the highest milestone watched when the video ends', () => {
		const player = readyPlayer( 100 );

		// No manual pause: the ended handler alone reports the floor milestone.
		player.ranges.push( [ 0, 60 ] );
		player.finish();

		expect( postedMilestones() ).toEqual( [ 50 ] );
	} );

	it( 'reports only the start when the viewer skips to the end and lets it finish', () => {
		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 1 ] );
		player.ranges.push( [ 98, 100 ] );
		player.finish(); // ~3% watched: floor is 0

		expect( postedMilestones() ).toEqual( [ 0 ] );
	} );

	/*
	 * The tracking script that writes the cookie is third-party and async, so on a
	 * visitor's first page view it often lands after the player is ready. A pause
	 * before the cookie arrives must not spend the view: the next pause still reports.
	 */
	it( 'carries the view when the cookie only arrives after an earlier pause', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 60 ] );
		player.viewerPause();

		expect( postedMilestones() ).toEqual( [] );

		document.cookie = `hubspotutk=${ HUTK }; path=/`;
		player.ranges.push( [ 60, 100 ] );
		player.viewerPause();

		expect( postedMilestones() ).toEqual( [ 100 ] );
	} );

	it( 'sends the cookie that arrived, not an empty set', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		document.cookie = `hubspotutk=${ HUTK }; path=/`;
		player.ranges.push( [ 0, 30 ] );
		player.viewerPause();

		const [ , init ] = window.fetch.mock.calls[ 0 ];

		expect( JSON.parse( init.body ).ids ).toEqual( { hubspotutk: HUTK } );
	} );

	it( 'reports nothing for a viewer whose cookie never arrives', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 100 ] );
		player.finish();

		expect( postedMilestones() ).toEqual( [] );
	} );

	it( 'leaves no session ID behind for a viewer no tool knows', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 100 ] );
		player.finish();

		expect( window.sessionStorage.length ).toBe( 0 );
	} );

	it.each( [ 'visibilitychange', 'pagehide' ] )(
		'reports the nearest milestone when the viewer leaves mid-video (%s)',
		( name ) => {
			const player = readyPlayer( 100 );

			player.ranges.push( [ 0, 40 ] );
			leavePage( name );

			expect( postedMilestones() ).toEqual( [ 50 ] );
		},
	);

	it( 'sends one event when switching tabs is followed by closing the page', () => {
		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 60 ] );
		leavePage( 'visibilitychange' );
		leavePage( 'pagehide' );

		expect( postedMilestones() ).toEqual( [ 50 ] );
	} );

	it( 'reports nothing on leaving after a pause at the same spot', () => {
		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 40 ] );
		player.viewerPause();
		leavePage( 'visibilitychange' );

		expect( postedMilestones() ).toEqual( [ 50 ] );
	} );

	it( 'reports a new high after coming back and watching to the end', () => {
		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 40 ] );
		leavePage( 'visibilitychange' );
		player.ranges.push( [ 40, 99.7 ] );
		player.finish();

		expect( postedMilestones() ).toEqual( [ 50, 100 ] );
	} );

	it( 'reports nothing on leaving for a player that was never started', () => {
		readyPlayer( 100, { start: false } );

		leavePage( 'visibilitychange' );
		leavePage( 'pagehide' );

		expect( postedMilestones() ).toEqual( [] );
	} );

	it( 'ignores the page turning visible again', () => {
		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 40 ] );
		document.dispatchEvent( new Event( 'visibilitychange' ) );

		expect( postedMilestones() ).toEqual( [] );
	} );

	it( 'stops listening for page leave once the player is disposed', () => {
		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 40 ] );
		player.trigger( 'dispose' );
		leavePage( 'pagehide' );

		expect( postedMilestones() ).toEqual( [] );
	} );

	/*
	 * Review on #2412: at the end the browser fires `pause` before `ended`. Rounding
	 * that pause would turn 89.5% watched into 100 for a viewer who skipped the end.
	 */
	it( 'does not credit a full watch to a viewer who skipped the last part', () => {
		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 87.5 ] );
		player.ranges.push( [ 98, 100 ] );
		player.finish(); // 89.5% watched: floor is 75, not nearest 100

		expect( postedMilestones() ).toEqual( [ 75 ] );
	} );

	it( 'ignores a pause GoDAM makes for a layer', () => {
		const player = readyPlayer( 100 );

		// A form layer pauses the video at 23% with no click from the viewer.
		player.ranges.push( [ 0, 23 ] );
		player.trigger( 'pause' );

		expect( postedMilestones() ).toEqual( [] );

		// The viewer fills it in, watches on and pauses at 60%.
		player.ranges.push( [ 23, 60 ] );
		player.viewerPause();

		expect( postedMilestones() ).toEqual( [ 50 ] );
	} );

	it( 'ignores an auto-pause even right after the viewer clicked', () => {
		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 40 ] );
		player.godamAutoPause = true; // Scrolled out of view, or another player started.
		player.viewerPause();

		expect( postedMilestones() ).toEqual( [] );
	} );

	it( 'ignores the pause from dragging the seek bar', () => {
		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 40 ] );
		player.scrubbing = () => true;
		player.viewerPause();

		expect( postedMilestones() ).toEqual( [] );
	} );

	it( 'counts a pause from the keyboard', () => {
		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 40 ] );
		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: ' ' } ) );
		player.trigger( 'pause' );

		expect( postedMilestones() ).toEqual( [ 50 ] );
	} );

	it( 'ignores a pause that comes more than a second after the viewer clicked', () => {
		const now = jest.spyOn( Date, 'now' ).mockReturnValue( 1000 );
		const player = readyPlayer( 100 );

		player.el().dispatchEvent( new Event( 'pointerdown' ) );
		now.mockReturnValue( 2500 );
		player.ranges.push( [ 0, 40 ] );
		player.trigger( 'pause' );
		now.mockRestore();

		expect( postedMilestones() ).toEqual( [] );
	} );

	it( 'still reports leaving the page after a layer paused the video', () => {
		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 40 ] );
		player.trigger( 'pause' ); // The layer's pause: ignored.
		leavePage( 'pagehide' );

		expect( postedMilestones() ).toEqual( [ 50 ] );
	} );

	it( 'reports nothing on leaving after only a hover preview', () => {
		const player = readyPlayer( 100, { start: false } );

		// Hover previews hide the control bar while they play.
		player.controlBar.el().classList.add( 'hide' );
		player.trigger( 'playing' );
		player.ranges.push( [ 0, 5 ] );
		player.trigger( 'pause' );
		leavePage( 'visibilitychange' );

		expect( postedMilestones() ).toEqual( [] );
	} );

	it( 'reports nothing on leaving for a viewer whose cookie never arrives', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		player.ranges.push( [ 0, 40 ] );
		leavePage( 'pagehide' );

		expect( postedMilestones() ).toEqual( [] );
	} );
} );

describe( 'MILESTONES', () => {
	it( 'matches the set godam-core accepts', () => {
		expect( MILESTONES ).toEqual( [ 0, 25, 50, 75, 100 ] );
	} );
} );
