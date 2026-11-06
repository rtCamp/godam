/**
 * Internal dependencies
 */
import { applySignedSources, defaultCaptionUrl, fetchSignedSources, prepareSignedPlayback } from './signedPlayback';

const ok = ( body ) => Promise.resolve( { ok: true, json: () => Promise.resolve( body ) } );

describe( 'signed playback', () => {
	it( 'returns the signed sources and poster the route gives', async () => {
		const signed = await fetchSignedSources( '/wp-json/godam/v1/playback/job1', () =>
			ok( { sources: [ { src: 'https://cdn.test/private/a/index.mpd?token=x', type: 'application/dash+xml' } ], poster: 'https://cdn.test/private/a/t.jpg?token=y' } ),
		);
		expect( signed.sources ).toHaveLength( 1 );
		expect( signed.poster ).toContain( 'token=y' );
		expect( signed.captions ).toEqual( [] );
	} );

	it( 'passes the signed caption tracks through', async () => {
		const captions = [ { language: 'en', label: 'English', vtt_path: 'https://cdn.test/private/a/en.vtt?token=c', is_default: true } ];
		const signed = await fetchSignedSources( '/x', () => ok( { sources: [ { src: 's.mpd', type: 'application/dash+xml' } ], captions } ) );
		expect( signed.captions ).toEqual( captions );
	} );

	it( 'keeps the saved sources when the route refuses, fails or has nothing', async () => {
		expect( await fetchSignedSources( '/x', () => Promise.resolve( { ok: false } ) ) ).toBeNull();
		expect( await fetchSignedSources( '/x', () => Promise.reject( new Error( 'offline' ) ) ) ).toBeNull();
		expect( await fetchSignedSources( '/x', () => ok( { sources: [] } ) ) ).toBeNull();
		expect( await fetchSignedSources( '', () => ok( {} ) ) ).toBeNull();
	} );

	it( 'replaces the sources and poster in the player setup', () => {
		const setup = { sources: [ { src: 'https://cdn.test/job/index.mpd', type: 'application/dash+xml' } ], poster: 'old.jpg' };
		const changed = applySignedSources( setup, { sources: [ { src: 'signed.mpd', type: 'application/dash+xml' } ], poster: 'signed.jpg' } );
		expect( changed ).toBe( true );
		expect( setup ).toEqual( { sources: [ { src: 'signed.mpd', type: 'application/dash+xml' } ], poster: 'signed.jpg' } );
		expect( applySignedSources( setup, null ) ).toBe( false );
	} );
} );

describe( 'signed playback, edge cases', () => {
	const okWith = ( body ) => jest.fn( () => Promise.resolve( { ok: true, json: () => Promise.resolve( body ) } ) );

	it( 'uses the page\'s fetch when none is given', async () => {
		const original = window.fetch;
		window.fetch = jest.fn( () => Promise.resolve( { ok: true, json: () => Promise.resolve( { sources: [ { src: 'a.mp4', type: 'video/mp4' } ] } ) } ) );
		try {
			expect( ( await fetchSignedSources( '/r' ) ).sources ).toHaveLength( 1 );
			expect( window.fetch ).toHaveBeenCalledWith( '/r', expect.objectContaining( { credentials: 'same-origin' } ) );
		} finally {
			window.fetch = original;
		}
	} );

	it( 'asks nothing without a playback URL', async () => {
		const fetchFn = jest.fn();
		expect( await fetchSignedSources( '', fetchFn ) ).toBeNull();
		expect( fetchFn ).not.toHaveBeenCalled();
	} );

	it( 'drops sources without a URL and defaults the poster and captions', async () => {
		const signed = await fetchSignedSources( '/r', okWith( { sources: [ { type: 'video/mp4' }, { src: 'a.mp4', type: 'video/mp4' } ], captions: 'x' } ) );
		expect( signed ).toEqual( { sources: [ { src: 'a.mp4', type: 'video/mp4' } ], poster: '', captions: [] } );
		expect( await fetchSignedSources( '/r', okWith( { sources: 'nope' } ) ) ).toBeNull();
	} );

	it( 'works where AbortController is missing', async () => {
		const original = global.AbortController;
		delete global.AbortController;
		try {
			const fetchFn = okWith( { sources: [ { src: 'a.m3u8', type: 'application/x-mpegURL' } ] } );
			expect( ( await fetchSignedSources( '/r', fetchFn ) ).sources ).toHaveLength( 1 );
			expect( fetchFn.mock.calls[ 0 ][ 1 ].signal ).toBeUndefined();
		} finally {
			global.AbortController = original;
		}
	} );

	it( 'gives up after its timeout', async () => {
		jest.useFakeTimers();
		try {
			const fetchFn = jest.fn( ( url, { signal } ) => new Promise( ( resolve, reject ) => {
				signal.addEventListener( 'abort', () => reject( new Error( 'aborted' ) ) );
			} ) );
			const pending = fetchSignedSources( '/r', fetchFn );
			jest.advanceTimersByTime( 5000 );
			expect( await pending ).toBeNull();
		} finally {
			jest.useRealTimers();
		}
	} );

	it( 'leaves a missing setup alone', () => {
		expect( applySignedSources( null, { sources: [ { src: 'a' } ] } ) ).toBe( false );
		const setup = { sources: [ 'saved' ], poster: 'saved.jpg' };
		expect( applySignedSources( setup, { sources: [ { src: 'a' } ], poster: '' } ) ).toBe( true );
		expect( setup.poster ).toBe( 'saved.jpg' );
	} );

	it( 'picks the default ready caption, else the first ready one, else none', () => {
		expect( defaultCaptionUrl( [ { vtt_path: 'en.vtt' }, { vtt_path: 'fr.vtt', is_default: true } ] ) ).toBe( 'fr.vtt' );
		expect( defaultCaptionUrl( [ { vtt_path: '' }, { vtt_path: 'de.vtt' } ] ) ).toBe( 'de.vtt' );
		expect( defaultCaptionUrl( null ) ).toBe( '' );
	} );
} );

describe( 'prepareSignedPlayback', () => {
	const route = ( body, okay = true ) => jest.fn( () => Promise.resolve( { ok: okay, json: () => Promise.resolve( body ) } ) );

	it( 'puts the signed sources and poster in place and returns the caption tracks', async () => {
		const video = document.createElement( 'video' );
		video.dataset.playbackUrl = '/wp-json/godam/v1/playback/job-a';
		const setup = { sources: [ 'saved' ] };
		const captions = await prepareSignedPlayback( video, setup, route( {
			sources: [ { src: 'https://cdn.test/private/p/index.m3u8?token=a', type: 'application/x-mpegURL' } ],
			poster: 'https://cdn.test/private/p/thumb.jpg?token=b',
			captions: [ { vtt_path: 'en.vtt' } ],
		} ) );
		expect( setup.sources[ 0 ].src ).toContain( '/private/' );
		expect( video.poster ).toBe( 'https://cdn.test/private/p/thumb.jpg?token=b' );
		expect( captions ).toEqual( [ { vtt_path: 'en.vtt' } ] );
	} );

	it( 'changes nothing when the route refuses', async () => {
		const video = document.createElement( 'video' );
		video.dataset.playbackUrl = '/r';
		video.poster = 'https://cdn.test/job/thumb.jpg';
		const setup = { sources: [ 'saved' ] };
		expect( await prepareSignedPlayback( video, setup, route( {}, false ) ) ).toBeNull();
		expect( setup.sources ).toEqual( [ 'saved' ] );
		expect( video.poster ).toBe( 'https://cdn.test/job/thumb.jpg' );
	} );

	it( 'keeps the stored poster when the signed answer has none, and returns no tracks', async () => {
		const video = document.createElement( 'video' );
		video.dataset.playbackUrl = '/r';
		video.poster = 'https://cdn.test/job/thumb.jpg';
		const setup = {};
		expect( await prepareSignedPlayback( video, setup, route( { sources: [ { src: 'a.mp4', type: 'video/mp4' } ] } ) ) ).toBeNull();
		expect( video.poster ).toBe( 'https://cdn.test/job/thumb.jpg' );
		expect( setup.sources ).toHaveLength( 1 );
	} );
} );
