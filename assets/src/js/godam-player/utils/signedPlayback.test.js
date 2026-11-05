/**
 * Internal dependencies
 */
/**
 * Internal dependencies
 */
import { applySignedSources, fetchSignedSources } from './signedPlayback';

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
