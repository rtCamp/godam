/**
 * Internal dependencies
 */
/**
 * Internal dependencies
 */
import { applySignedSources, applySignedTranscript, fetchSignedSources } from './signedPlayback';

const ok = ( body ) => Promise.resolve( { ok: true, json: () => Promise.resolve( body ) } );

describe( 'signed playback', () => {
	it( 'returns the signed sources and poster the route gives', async () => {
		const signed = await fetchSignedSources( '/wp-json/godam/v1/playback/job1', () =>
			ok( { sources: [ { src: 'https://cdn.test/private/a/index.mpd?token=x', type: 'application/dash+xml' } ], poster: 'https://cdn.test/private/a/t.jpg?token=y' } ),
		);
		expect( signed.sources ).toHaveLength( 1 );
		expect( signed.poster ).toContain( 'token=y' );
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

	it( 'uses the signed transcript only in place of GoDAM\'s own copy', () => {
		const signed = { transcript: 'https://cdn.test/private/a/t.vtt?token=z' };
		const none = {};
		expect( applySignedTranscript( none, signed ) ).toBe( true );
		expect( none.transcriptUrl ).toBe( signed.transcript );

		const godams = { transcriptUrl: 'https://cdn.test/private/a/t.vtt' };
		expect( applySignedTranscript( godams, signed ) ).toBe( true );

		const uploaded = { transcriptUrl: 'https://site.test/wp-content/uploads/captions.vtt' };
		expect( applySignedTranscript( uploaded, signed ) ).toBe( false );
		expect( uploaded.transcriptUrl ).toContain( 'site.test' );

		const deleted = { transcriptDeleted: 'true' };
		expect( applySignedTranscript( deleted, signed ) ).toBe( false );
		expect( deleted.transcriptUrl ).toBeUndefined();
		expect( applySignedTranscript( none, { transcript: '' } ) ).toBe( false );
	} );
} );
