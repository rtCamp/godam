/**
 * Unit tests for the MAP milestone tracker.
 *
 * The things worth pinning here are the ones a viewer's page depends on: a cookie
 * is only read for a tool the account actually connected, a view keeps one session
 * ID across a reload, "how far did they watch" is measured from what was played
 * rather than from where the playhead happens to sit, and a view costs one or two
 * posts (on pause, on leaving, at 95%) rather than one per milestone crossed.
 */

/**
 * Internal dependencies
 */
import {
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

describe( 'milestoneFor', () => {
	it( 'rounds down to the milestone reached', () => {
		expect( milestoneFor( 0 ) ).toBe( 0 );
		expect( milestoneFor( 24.9 ) ).toBe( 0 );
		expect( milestoneFor( 25 ) ).toBe( 25 );
		expect( milestoneFor( 49 ) ).toBe( 25 );
		expect( milestoneFor( 50 ) ).toBe( 50 );
		expect( milestoneFor( 74 ) ).toBe( 50 );
		expect( milestoneFor( 75 ) ).toBe( 75 );
		expect( milestoneFor( 94.9 ) ).toBe( 75 );
	} );

	it( 'counts COMPLETE_PERCENT and above as a full watch', () => {
		expect( COMPLETE_PERCENT ).toBe( 95 );
		expect( milestoneFor( 95 ) ).toBe( 100 );
		expect( milestoneFor( 100 ) ).toBe( 100 );
	} );
} );

describe( 'readStoredView', () => {
	beforeEach( () => window.sessionStorage.clear() );

	it( 'reads a bare session ID as a view with nothing posted yet', () => {
		window.sessionStorage.setItem( 'godam-map-session-job-1', 'session-0001' );

		expect( readStoredView( 'job-1' ) ).toEqual( { sessionId: 'session-0001', sent: -1 } );
	} );

	it( 'reads the highest milestone posted after the ID', () => {
		window.sessionStorage.setItem( 'godam-map-session-job-1', 'session-0001.50' );

		expect( readStoredView( 'job-1' ) ).toEqual( { sessionId: 'session-0001', sent: 50 } );
		expect( getSessionId( 'job-1' ) ).toBe( 'session-0001' );
	} );

	it( 'ignores a stored milestone that is not one of MILESTONES', () => {
		window.sessionStorage.setItem( 'godam-map-session-job-1', 'session-0001.60' );

		expect( readStoredView( 'job-1' ) ).toEqual( { sessionId: 'session-0001', sent: -1 } );
	} );

	it( 'reads nothing from a value of the wrong shape', () => {
		window.sessionStorage.setItem( 'godam-map-session-job-1', 'bad id!.50' );

		expect( readStoredView( 'job-1' ) ).toEqual( { sessionId: '', sent: -1 } );
	} );
} );

describe( 'milestones reported for one view', () => {
	const originalFetch = window.fetch;
	const players = [];

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

	afterEach( () => {
		// Every player listens to the page for tab switches; dispose of them so one
		// test's hidden tab does not flush another test's player.
		players.splice( 0 ).forEach( ( player ) => player.trigger( 'dispose' ) );

		window.fetch = originalFetch;
		clearCookies();
	} );

	/**
	 * Hand the tracker a Video.js-shaped player whose events the test fires itself.
	 *
	 * @param {number} duration - Duration in seconds.
	 * @return {Object} The player, plus `ranges` to push played ranges to and `trigger( name )`.
	 */
	function readyPlayer( duration ) {
		const handlers = {};
		const ranges = [];
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
		};

		const video = document.createElement( 'video' );
		video.dataset.job_id = 'job-1';

		document.dispatchEvent(
			new CustomEvent( 'godamPlayerReady', { detail: { player, videoElement: video } } ),
		);

		players.push( player );

		return player;
	}

	/**
	 * Play up to a point, as a stream of `timeupdate`s would leave the played ranges.
	 *
	 * @param {Object} player - Player from readyPlayer().
	 * @param {number} from   - Start of the range, in seconds.
	 * @param {number} to     - End of the range, in seconds.
	 */
	function play( player, from, to ) {
		player.trigger( 'playing' );
		player.ranges.push( [ from, to ] );
		player.trigger( 'timeupdate' );
	}

	/**
	 * Fire `visibilitychange` with the tab hidden.
	 */
	function hideTab() {
		Object.defineProperty( document, 'visibilityState', { value: 'hidden', configurable: true } );
		document.dispatchEvent( new Event( 'visibilitychange' ) );
		delete document.visibilityState;
	}

	/**
	 * @return {number[]} Milestones posted so far, in order.
	 */
	function postedMilestones() {
		return window.fetch.mock.calls.map( ( [ , init ] ) => JSON.parse( init.body ).milestone );
	}

	it( 'posts nothing while the video plays, until a pause, a leave or the end', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 80 );

		expect( postedMilestones() ).toEqual( [] );
	} );

	it( 'posts once, at COMPLETE_PERCENT, for a full watch without a pause', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 94 );
		expect( postedMilestones() ).toEqual( [] );

		player.ranges[ 0 ][ 1 ] = 95;
		player.trigger( 'timeupdate' );
		expect( postedMilestones() ).toEqual( [ 100 ] );

		player.ranges[ 0 ][ 1 ] = 100;
		player.trigger( 'timeupdate' );
		player.trigger( 'pause' );
		player.trigger( 'ended' );

		expect( postedMilestones() ).toEqual( [ 100 ] );
	} );

	it( 'posts the milestone reached on pause, then only a higher one', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 40 );
		player.trigger( 'pause' );
		expect( postedMilestones() ).toEqual( [ 25 ] );

		play( player, 40, 100 );
		expect( postedMilestones() ).toEqual( [ 25, 100 ] );
	} );

	it( 'posts nothing new for a pause after watching no further', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 40 );
		player.trigger( 'pause' );
		player.trigger( 'playing' );
		player.trigger( 'pause' );

		// Watched a little more, but not into the next milestone.
		play( player, 40, 45 );
		player.trigger( 'pause' );

		expect( postedMilestones() ).toEqual( [ 25 ] );
	} );

	it( 'posts the start for a viewer who pauses before 25%', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 5 );
		player.trigger( 'pause' );

		expect( postedMilestones() ).toEqual( [ 0 ] );
	} );

	it( 'posts nothing for a pause before the video ever played (blocked autoplay)', () => {
		const player = readyPlayer( 100 );

		player.trigger( 'play' );
		player.trigger( 'pause' );

		expect( postedMilestones() ).toEqual( [] );
	} );

	it( 'counts a player that was already playing when the script ran', () => {
		const player = readyPlayer( 100 );

		// Its `playing` fired before the tracker was listening.
		player.ranges.push( [ 0, 30 ] );
		player.trigger( 'pause' );

		expect( postedMilestones() ).toEqual( [ 25 ] );
	} );

	it( 'posts when the viewer leaves the tab, and once only when the page then goes', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 60 );
		hideTab();
		window.dispatchEvent( new Event( 'pagehide' ) );

		expect( postedMilestones() ).toEqual( [ 50 ] );
	} );

	it( 'posts nothing when the tab becomes visible again', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 60 );
		document.dispatchEvent( new Event( 'visibilitychange' ) );

		expect( postedMilestones() ).toEqual( [] );
	} );

	it( 'posts when the page is left', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 80 );
		window.dispatchEvent( new Event( 'pagehide' ) );

		expect( postedMilestones() ).toEqual( [ 75 ] );
	} );

	it( 'posts when the player is disposed, then stops listening to the page', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 30 );
		player.trigger( 'dispose' );
		expect( postedMilestones() ).toEqual( [ 25 ] );

		player.ranges.push( [ 30, 60 ] );
		window.dispatchEvent( new Event( 'pagehide' ) );

		expect( postedMilestones() ).toEqual( [ 25 ] );
	} );

	it( 'reports only the start when the viewer skips to the end and lets it finish', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 1 );
		player.ranges.push( [ 98, 100 ] );
		player.trigger( 'timeupdate' );
		player.trigger( 'pause' );
		player.trigger( 'ended' );

		expect( postedMilestones() ).toEqual( [ 0 ] );
	} );

	it( 'reports 100 when a short clip ends with its played range just short of the end', () => {
		// 94% by the played range, but the video did reach its end.
		const player = readyPlayer( 10 );

		play( player, 0, 9.4 );
		expect( postedMilestones() ).toEqual( [] );

		player.trigger( 'ended' );

		expect( postedMilestones() ).toEqual( [ 100 ] );
	} );

	it( 'does not count a pause a second before the end of a short clip as a full watch', () => {
		const player = readyPlayer( 10 );

		play( player, 0, 9.2 );
		player.trigger( 'pause' );

		expect( postedMilestones() ).toEqual( [ 75 ] );
	} );

	it( 'reports what was watched before a skip to the end, and no more', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 60 );
		player.ranges.push( [ 99, 100 ] );
		player.trigger( 'timeupdate' );
		player.trigger( 'ended' );

		expect( postedMilestones() ).toEqual( [ 50 ] );
	} );

	it( 'does not post a lower milestone for the same view after a reload', () => {
		const first = readyPlayer( 100 );

		play( first, 0, 60 );
		first.trigger( 'pause' );
		expect( postedMilestones() ).toEqual( [ 50 ] );

		// The reloaded page's player starts its played ranges from nothing, but
		// sessionStorage keeps the view.
		const reloaded = readyPlayer( 100 );

		play( reloaded, 0, 30 );
		reloaded.trigger( 'pause' );
		expect( postedMilestones() ).toEqual( [ 50 ] );

		play( reloaded, 30, 80 );
		reloaded.trigger( 'pause' );
		expect( postedMilestones() ).toEqual( [ 50, 75 ] );

		const sessions = window.fetch.mock.calls.map( ( [ , init ] ) => JSON.parse( init.body ).session_id );
		expect( sessions[ 0 ] ).toBe( sessions[ 1 ] );
	} );

	/*
	 * The tracking script that writes the cookie is third-party and async, so on a
	 * visitor's first page view it often lands after the player is ready. The whole
	 * view has to survive that, not just what is watched after it.
	 */
	it( 'carries the whole view when the cookie only arrives mid-watch', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		play( player, 0, 30 );
		player.trigger( 'pause' );

		expect( postedMilestones() ).toEqual( [] );

		document.cookie = `hubspotutk=${ HUTK }; path=/`;
		play( player, 30, 60 );
		player.trigger( 'pause' );

		expect( postedMilestones() ).toEqual( [ 50 ] );
	} );

	it( 'sends the cookie that arrived, not an empty set', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		play( player, 0, 30 );
		document.cookie = `hubspotutk=${ HUTK }; path=/`;
		player.trigger( 'pause' );

		const [ , init ] = window.fetch.mock.calls[ 0 ];

		expect( JSON.parse( init.body ) ).toEqual(
			expect.objectContaining( { media_id: 'job-1', milestone: 25, ids: { hubspotutk: HUTK } } ),
		);
	} );

	it( 'reports nothing for a viewer whose cookie never arrives', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		play( player, 0, 100 );
		player.trigger( 'pause' );
		player.trigger( 'ended' );
		hideTab();

		expect( postedMilestones() ).toEqual( [] );
	} );

	/*
	 * The cookie is known from the first post, but the visitor's privacy choices
	 * can change after it: each post has to ask again, not reuse the first answer.
	 */
	it( 'stops posting when marketing consent is withdrawn mid-view, and resumes on consent', () => {
		window.wp_has_consent = () => true;

		try {
			const player = readyPlayer( 100 );

			play( player, 0, 30 );
			player.trigger( 'pause' );
			expect( postedMilestones() ).toEqual( [ 25 ] );

			window.wp_has_consent = ( category ) => 'marketing' !== category;
			play( player, 30, 60 );
			player.trigger( 'pause' );
			hideTab();
			window.dispatchEvent( new Event( 'pagehide' ) );
			expect( postedMilestones() ).toEqual( [ 25 ] );

			window.wp_has_consent = () => true;
			player.trigger( 'pause' );
			expect( postedMilestones() ).toEqual( [ 25, 50 ] );
		} finally {
			delete window.wp_has_consent;
		}
	} );

	it( 'stops posting when Global Privacy Control turns on mid-view', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 30 );
		player.trigger( 'pause' );

		Object.defineProperty( window.navigator, 'globalPrivacyControl', { value: true, configurable: true } );

		try {
			play( player, 30, 100 );
			player.trigger( 'ended' );
			expect( postedMilestones() ).toEqual( [ 25 ] );
		} finally {
			delete window.navigator.globalPrivacyControl;
		}
	} );

	it( 'stops posting to HubSpot when the visitor opts out of it mid-view', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 30 );
		player.trigger( 'pause' );

		document.cookie = '__hs_opt_out=yes; path=/';
		play( player, 30, 60 );
		player.trigger( 'pause' );

		expect( postedMilestones() ).toEqual( [ 25 ] );
	} );

	it( 'leaves no session ID behind for a viewer no tool knows', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		play( player, 0, 100 );
		player.trigger( 'ended' );

		expect( window.sessionStorage.length ).toBe( 0 );
	} );
} );

describe( 'MILESTONES', () => {
	it( 'matches the set godam-core accepts', () => {
		expect( MILESTONES ).toEqual( [ 0, 25, 50, 75, 100 ] );
	} );
} );
