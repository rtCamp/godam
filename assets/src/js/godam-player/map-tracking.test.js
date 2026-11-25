/**
 * Unit tests for the MAP milestone tracker.
 *
 * The things worth pinning here are the ones a viewer's page depends on: a cookie
 * is only read for a tool the account actually connected, a view keeps one session
 * ID across a reload, "how far did they watch" is measured from what was played
 * rather than from where the playhead happens to sit, and a view is reported once
 * (on the viewer's pause, the end, or leaving the page), rounded up to a quarter.
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
	it( 'rounds what was watched up to the next quarter', () => {
		expect( milestoneFor( 0.5 ) ).toBe( 25 );
		expect( milestoneFor( 10 ) ).toBe( 25 );
		expect( milestoneFor( 25.1 ) ).toBe( 50 );
		expect( milestoneFor( 49 ) ).toBe( 50 );
		expect( milestoneFor( 60 ) ).toBe( 75 );
		expect( milestoneFor( 75.1 ) ).toBe( 100 );
		expect( milestoneFor( 80 ) ).toBe( 100 );
		expect( milestoneFor( 100 ) ).toBe( 100 );
	} );

	it( 'puts a boundary in the range below it, even a hair over from float sums', () => {
		expect( milestoneFor( 25 ) ).toBe( 25 );
		expect( milestoneFor( 50 ) ).toBe( 50 );
		expect( milestoneFor( 50.0000001 ) ).toBe( 50 );
		expect( milestoneFor( 75 ) ).toBe( 75 );
	} );

	it( 'has no milestone when nothing was watched', () => {
		expect( milestoneFor( 0 ) ).toBeNull();
		expect( milestoneFor( NaN ) ).toBeNull();
	} );
} );

describe( 'readStoredView', () => {
	beforeEach( () => window.sessionStorage.clear() );

	it( 'reads a bare session ID as a view not reported yet', () => {
		window.sessionStorage.setItem( 'godam-map-session-job-1', 'session-0001' );

		expect( readStoredView( 'job-1' ) ).toEqual( { sessionId: 'session-0001', sent: -1 } );
	} );

	it( 'reads the milestone posted after the ID', () => {
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

describe( 'the one report for a view', () => {
	const originalFetch = window.fetch;
	const originalNow = Date.now;
	const players = [];
	let now = 0;

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
		window.fetch = jest.fn( () => Promise.resolve( { ok: true } ) );
		window.sessionStorage.clear();
		document.cookie = `hubspotutk=${ HUTK }; path=/`;

		// A clock the tests move, for the window after the viewer's input.
		now = 1000000;
		Date.now = () => now;
	} );

	afterEach( () => {
		// Every player listens to the page; dispose of them so one test's page
		// leave or key press does not reach another test's player.
		players.splice( 0 ).forEach( ( player ) => player.trigger( 'dispose' ) );

		window.fetch = originalFetch;
		Date.now = originalNow;
		clearCookies();
	} );

	/**
	 * Hand the tracker a Video.js-shaped player whose events the test fires itself.
	 *
	 * @param {number} duration - Duration in seconds.
	 * @return {Object} The player, plus `ranges` to push played ranges to, `trigger( name )`, and flags `isEnded`, `isScrubbing`.
	 */
	function readyPlayer( duration ) {
		const handlers = {};
		const ranges = [];
		const root = document.createElement( 'div' );
		const controlBar = document.createElement( 'div' );
		const listen = ( name, handler ) => {
			handlers[ name ] = handlers[ name ] || [];
			handlers[ name ].push( handler );
		};

		root.appendChild( controlBar );
		document.body.appendChild( root );

		const player = {
			ranges,
			isEnded: false,
			isScrubbing: false,
			godamAutoPause: false,
			controlBar: { el: () => controlBar },
			el: () => root,
			duration: () => duration,
			ended: () => player.isEnded,
			scrubbing: () => player.isScrubbing,
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
	 * Play from one point to another, as playback would leave the played ranges.
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
	 * The viewer clicks the player's pause control.
	 *
	 * @param {Object} player - Player from readyPlayer().
	 */
	function viewerPause( player ) {
		player.el().dispatchEvent( new Event( 'pointerdown', { bubbles: true } ) );
		player.trigger( 'pause' );
	}

	/**
	 * The video plays to its end: the browser fires `pause`, then `ended`.
	 *
	 * @param {Object} player - Player from readyPlayer().
	 */
	function reachEnd( player ) {
		player.isEnded = true;
		player.trigger( 'pause' );
		player.trigger( 'ended' );
	}

	/**
	 * Let a promise's callbacks run, for what happens after a post's response.
	 *
	 * @return {Promise} Resolves on the next turn.
	 */
	const settle = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

	/**
	 * @return {number[]} Milestones posted so far, in order.
	 */
	function postedMilestones() {
		return window.fetch.mock.calls.map( ( [ , init ] ) => JSON.parse( init.body ).milestone );
	}

	it( 'posts nothing while the video plays', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 80 );

		expect( postedMilestones() ).toEqual( [] );
	} );

	it( 'posts the watched share, rounded up, on the viewer\'s first pause', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 10 );
		viewerPause( player );

		expect( postedMilestones() ).toEqual( [ 25 ] );
	} );

	it.each( [
		[ 20, 25 ],
		[ 40, 50 ],
		[ 60, 75 ],
		[ 80, 100 ],
	] )( 'reports a pause at %i%% as %i', ( watched, milestone ) => {
		const player = readyPlayer( 100 );

		play( player, 0, watched );
		viewerPause( player );

		expect( postedMilestones() ).toEqual( [ milestone ] );
	} );

	it( 'posts only once per view, whatever the viewer does after', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 30 );
		viewerPause( player );

		play( player, 30, 70 );
		viewerPause( player );
		play( player, 70, 100 );
		reachEnd( player );
		window.dispatchEvent( new Event( 'pagehide' ) );

		expect( postedMilestones() ).toEqual( [ 50 ] );
	} );

	it( 'posts 100 once when the video ends, though `pause` fires first', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 100 );
		reachEnd( player );

		expect( postedMilestones() ).toEqual( [ 100 ] );
	} );

	it( 'posts 100 when a short clip ends with its played range just short of the end', () => {
		const player = readyPlayer( 10 );

		play( player, 0, 9.4 );
		reachEnd( player );

		expect( postedMilestones() ).toEqual( [ 100 ] );
	} );

	it( 'counts only what was played when the viewer skips to the end', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 5 );
		player.ranges.push( [ 98, 100 ] );
		reachEnd( player );

		expect( postedMilestones() ).toEqual( [ 25 ] );
	} );

	it( 'posts on page leave if the view was not reported yet', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 60 );
		window.dispatchEvent( new Event( 'pagehide' ) );

		expect( postedMilestones() ).toEqual( [ 75 ] );
	} );

	it( 'posts nothing on tab switch', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 60 );
		Object.defineProperty( document, 'visibilityState', { value: 'hidden', configurable: true } );
		document.dispatchEvent( new Event( 'visibilitychange' ) );
		delete document.visibilityState;

		expect( postedMilestones() ).toEqual( [] );
	} );

	it( 'posts nothing when the player is removed while the page stays open', () => {
		const player = readyPlayer( 100 );

		play( player, 0, 60 );
		player.trigger( 'dispose' );
		window.dispatchEvent( new Event( 'pagehide' ) );

		expect( postedMilestones() ).toEqual( [] );
	} );

	describe( 'pauses that are not the viewer\'s', () => {
		it( 'ignores a pause with no input from the viewer, such as a layer appearing', () => {
			const player = readyPlayer( 100 );

			play( player, 0, 23 );
			player.trigger( 'pause' );

			expect( postedMilestones() ).toEqual( [] );

			// The viewer skips the layer, watches on, and pauses themselves.
			play( player, 23, 60 );
			viewerPause( player );

			expect( postedMilestones() ).toEqual( [ 75 ] );
		} );

		it( 'ignores a pause that comes more than a second after the viewer\'s last click', () => {
			const player = readyPlayer( 100 );

			play( player, 0, 30 );
			player.el().dispatchEvent( new Event( 'pointerdown', { bubbles: true } ) );
			now += 1500;
			player.trigger( 'pause' );

			expect( postedMilestones() ).toEqual( [] );
		} );

		it( 'counts a pause from GoDAM\'s keyboard shortcut, pressed anywhere on the page', () => {
			const player = readyPlayer( 100 );

			play( player, 0, 30 );
			document.dispatchEvent( new KeyboardEvent( 'keydown', { key: ' ' } ) );
			player.trigger( 'pause' );

			expect( postedMilestones() ).toEqual( [ 50 ] );
		} );

		it( 'ignores GoDAM\'s auto-pause, even right after a click', () => {
			const player = readyPlayer( 100 );

			play( player, 0, 30 );
			player.godamAutoPause = true;
			viewerPause( player );

			expect( postedMilestones() ).toEqual( [] );
		} );

		it( 'ignores the pause from dragging the seek bar', () => {
			const player = readyPlayer( 100 );

			play( player, 0, 30 );
			player.isScrubbing = true;
			viewerPause( player );

			expect( postedMilestones() ).toEqual( [] );
		} );

		it( 'ignores a hover preview, so leaving the page after one posts nothing', () => {
			const player = readyPlayer( 100 );

			player.controlBar.el().classList.add( 'hide' );
			play( player, 0, 5 );
			player.trigger( 'pause' );
			player.controlBar.el().classList.remove( 'hide' );
			window.dispatchEvent( new Event( 'pagehide' ) );

			expect( postedMilestones() ).toEqual( [] );
		} );

		it( 'ignores a blocked autoplay, which never shows a frame', () => {
			const player = readyPlayer( 100 );

			player.trigger( 'play' );
			viewerPause( player );
			window.dispatchEvent( new Event( 'pagehide' ) );

			expect( postedMilestones() ).toEqual( [] );
		} );
	} );

	it( 'does not report the view again after a reload', () => {
		const first = readyPlayer( 100 );

		play( first, 0, 60 );
		viewerPause( first );
		expect( postedMilestones() ).toEqual( [ 75 ] );

		// The reloaded page's player starts from nothing, but sessionStorage keeps the view.
		const reloaded = readyPlayer( 100 );

		play( reloaded, 0, 100 );
		reachEnd( reloaded );
		window.dispatchEvent( new Event( 'pagehide' ) );

		expect( postedMilestones() ).toEqual( [ 75 ] );
	} );

	it( 'shares the one report between two players of the same video', () => {
		const one = readyPlayer( 100 );
		const two = readyPlayer( 100 );

		play( one, 0, 30 );
		viewerPause( one );
		play( two, 0, 90 );
		viewerPause( two );

		expect( postedMilestones() ).toEqual( [ 50 ] );
	} );

	it( 'tries again at the next pause when the post did not get through', async () => {
		window.fetch = jest.fn( () => Promise.resolve( { ok: false } ) );

		const player = readyPlayer( 100 );

		play( player, 0, 30 );
		viewerPause( player );
		await settle();

		expect( window.fetch ).toHaveBeenCalledTimes( 1 );
		expect( readStoredView( 'job-1' ).sent ).toBe( -1 );

		window.fetch.mockImplementation( () => Promise.resolve( { ok: true } ) );
		play( player, 30, 60 );
		viewerPause( player );
		await settle();

		expect( postedMilestones() ).toEqual( [ 50, 75 ] );
		expect( readStoredView( 'job-1' ).sent ).toBe( 75 );
	} );

	it( 'treats a network error as not delivered', async () => {
		window.fetch = jest.fn( () => Promise.reject( new Error( 'offline' ) ) );

		const player = readyPlayer( 100 );

		play( player, 0, 30 );
		viewerPause( player );
		await settle();

		expect( readStoredView( 'job-1' ).sent ).toBe( -1 );
	} );

	/*
	 * The tracking script that writes the cookie is third-party and async, so on a
	 * visitor's first page view it often lands after the player is ready.
	 */
	it( 'reports the view at the next pause once the cookie arrives', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		play( player, 0, 30 );
		viewerPause( player );
		expect( postedMilestones() ).toEqual( [] );

		document.cookie = `hubspotutk=${ HUTK }; path=/`;
		play( player, 30, 60 );
		viewerPause( player );

		expect( postedMilestones() ).toEqual( [ 75 ] );
	} );

	it( 'sends the media ID, the session, and the cookie that arrived', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		play( player, 0, 30 );
		document.cookie = `hubspotutk=${ HUTK }; path=/`;
		viewerPause( player );

		const [ url, init ] = window.fetch.mock.calls[ 0 ];

		expect( url ).toBe( 'https://example.com/wp-json/godam/v1/map-events' );
		expect( init.keepalive ).toBe( true );
		expect( JSON.parse( init.body ) ).toEqual(
			expect.objectContaining( { media_id: 'job-1', milestone: 50, ids: { hubspotutk: HUTK } } ),
		);
	} );

	it( 'reports nothing for a viewer whose cookie never arrives', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		play( player, 0, 30 );
		viewerPause( player );
		play( player, 30, 100 );
		reachEnd( player );
		window.dispatchEvent( new Event( 'pagehide' ) );

		expect( postedMilestones() ).toEqual( [] );
		expect( window.sessionStorage.length ).toBe( 0 );
	} );

	/*
	 * The visitor's privacy choices can change before the view is reported: each
	 * attempt has to ask again, not reuse an earlier answer.
	 */
	it( 'waits while marketing consent is withheld, and reports once it is given', () => {
		window.wp_has_consent = ( category ) => 'marketing' !== category;

		try {
			const player = readyPlayer( 100 );

			play( player, 0, 30 );
			viewerPause( player );
			window.dispatchEvent( new Event( 'pagehide' ) );
			expect( postedMilestones() ).toEqual( [] );

			window.wp_has_consent = () => true;
			play( player, 30, 60 );
			viewerPause( player );
			expect( postedMilestones() ).toEqual( [ 75 ] );
		} finally {
			delete window.wp_has_consent;
		}
	} );

	it( 'reports nothing while Global Privacy Control is on', () => {
		const player = readyPlayer( 100 );

		Object.defineProperty( window.navigator, 'globalPrivacyControl', { value: true, configurable: true } );

		try {
			play( player, 0, 100 );
			reachEnd( player );
			window.dispatchEvent( new Event( 'pagehide' ) );
			expect( postedMilestones() ).toEqual( [] );
		} finally {
			delete window.navigator.globalPrivacyControl;
		}
	} );

	it( 'reports nothing to HubSpot once the visitor opts out of it', () => {
		const player = readyPlayer( 100 );

		document.cookie = '__hs_opt_out=yes; path=/';
		play( player, 0, 60 );
		viewerPause( player );

		expect( postedMilestones() ).toEqual( [] );
	} );
} );

describe( 'MILESTONES', () => {
	it( 'matches the set godam-core accepts', () => {
		expect( MILESTONES ).toEqual( [ 0, 25, 50, 75, 100 ] );
	} );
} );
