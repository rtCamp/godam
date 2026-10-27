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

	afterEach( () => {
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

		return player;
	}

	/**
	 * @return {number[]} Milestones posted so far, in order.
	 */
	function postedMilestones() {
		return window.fetch.mock.calls.map( ( [ , init ] ) => JSON.parse( init.body ).milestone );
	}

	it( 'reports only the start when the viewer skips to the end and lets it finish', () => {
		const player = readyPlayer( 100 );

		player.trigger( 'play' );
		player.ranges.push( [ 0, 1 ] );
		player.trigger( 'timeupdate' );
		player.ranges.push( [ 98, 100 ] );
		player.trigger( 'timeupdate' );
		player.trigger( 'ended' );

		expect( postedMilestones() ).toEqual( [ 0 ] );
	} );

	it( 'reports 100 for a full watch whose played range stops just short of the end', () => {
		const player = readyPlayer( 100 );

		player.trigger( 'play' );
		player.ranges.push( [ 0, 99.7 ] );
		player.trigger( 'timeupdate' );
		player.trigger( 'ended' );

		expect( postedMilestones() ).toEqual( [ 0, 25, 50, 75, 100 ] );
	} );

	it( 'reports what was watched before a skip to the end, and no more', () => {
		const player = readyPlayer( 100 );

		player.trigger( 'play' );
		player.ranges.push( [ 0, 60 ] );
		player.trigger( 'timeupdate' );
		player.ranges.push( [ 99, 100 ] );
		player.trigger( 'timeupdate' );
		player.trigger( 'ended' );

		expect( postedMilestones() ).toEqual( [ 0, 25, 50 ] );
	} );

	/*
	 * The tracking script that writes the cookie is third-party and async, so on a
	 * visitor's first page view it often lands after the player is ready. The whole
	 * view has to survive that, not just the milestones that follow it.
	 */
	it( 'carries the whole view when the cookie only arrives mid-watch', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		player.trigger( 'play' );
		player.ranges.push( [ 0, 10 ] );
		player.trigger( 'timeupdate' );

		expect( postedMilestones() ).toEqual( [] );

		document.cookie = `hubspotutk=${ HUTK }; path=/`;
		player.ranges.push( [ 10, 60 ] );
		player.trigger( 'timeupdate' );

		expect( postedMilestones() ).toEqual( [ 0, 25, 50 ] );
	} );

	it( 'sends the cookie that arrived, not an empty set', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		player.trigger( 'play' );
		document.cookie = `hubspotutk=${ HUTK }; path=/`;
		player.ranges.push( [ 0, 30 ] );
		player.trigger( 'timeupdate' );

		const [ , init ] = window.fetch.mock.calls[ 0 ];

		expect( JSON.parse( init.body ).ids ).toEqual( { hubspotutk: HUTK } );
	} );

	it( 'reports nothing for a viewer whose cookie never arrives', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		player.trigger( 'play' );
		player.ranges.push( [ 0, 100 ] );
		player.trigger( 'timeupdate' );
		player.trigger( 'ended' );

		expect( postedMilestones() ).toEqual( [] );
	} );

	it( 'leaves no session ID behind for a viewer no tool knows', () => {
		clearCookies();

		const player = readyPlayer( 100 );

		player.trigger( 'play' );
		player.ranges.push( [ 0, 100 ] );
		player.trigger( 'timeupdate' );
		player.trigger( 'ended' );

		expect( window.sessionStorage.length ).toBe( 0 );
	} );
} );

describe( 'MILESTONES', () => {
	it( 'matches the set godam-core accepts', () => {
		expect( MILESTONES ).toEqual( [ 0, 25, 50, 75, 100 ] );
	} );
} );
