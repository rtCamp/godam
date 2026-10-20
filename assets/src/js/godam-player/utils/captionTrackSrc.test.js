/**
 * Internal dependencies
 */
import { cuesToWebVtt, isSrtUrl, toWebVttTrackSrc } from './captionTrackSrc';

const SRT = `1
00:00:00,000 --> 00:00:04,500
A pour-over station waits by the window.

2
00:00:59,500 --> 00:01:09,500
Hot water pours from a gooseneck kettle.
`;

describe( 'isSrtUrl', () => {
	it( 'matches .srt URLs, ignoring case, query string and hash', () => {
		expect( isSrtUrl( 'https://example.com/a/coffee.srt' ) ).toBe( true );
		expect( isSrtUrl( 'https://example.com/a/coffee.SRT?ver=2' ) ).toBe( true );
		expect( isSrtUrl( 'https://example.com/a/coffee.srt#t=1' ) ).toBe( true );
	} );

	it( 'does not match .vtt or other URLs', () => {
		expect( isSrtUrl( 'https://example.com/a/coffee.vtt' ) ).toBe( false );
		expect( isSrtUrl( 'https://example.com/srt/coffee.vtt' ) ).toBe( false );
		expect( isSrtUrl( '' ) ).toBe( false );
		expect( isSrtUrl( undefined ) ).toBe( false );
	} );
} );

describe( 'cuesToWebVtt', () => {
	it( 'writes a WEBVTT header and hh:mm:ss.mmm timestamps', () => {
		expect( cuesToWebVtt( [
			{ start: 0, end: 4.5, text: 'First line' },
			{ start: 3725.25, end: 3726, text: 'Past an hour' },
		] ) ).toBe( 'WEBVTT\n\n00:00:00.000 --> 00:00:04.500\nFirst line\n\n01:02:05.250 --> 01:02:06.000\nPast an hour\n' );
	} );

	it( 'keeps "-->" in cue text from ending the cue', () => {
		expect( cuesToWebVtt( [ { start: 1, end: 2, text: 'a --> b' } ] ) ).toContain( '\na -> b\n' );
	} );

	it( 'never writes an end before the start', () => {
		expect( cuesToWebVtt( [ { start: 5, end: 2, text: 'x' } ] ) ).toContain( '00:00:05.000 --> 00:00:05.000' );
	} );
} );

describe( 'toWebVttTrackSrc', () => {
	const realFetch = global.fetch;
	const realCreate = window.URL.createObjectURL;
	let blobs;

	beforeEach( () => {
		blobs = [];
		window.URL.createObjectURL = jest.fn( ( blob ) => {
			blobs.push( blob );
			return `blob:converted-${ blobs.length }`;
		} );
	} );

	afterEach( () => {
		global.fetch = realFetch;
		window.URL.createObjectURL = realCreate;
	} );

	it( 'returns a .vtt URL unchanged without fetching it', async () => {
		global.fetch = jest.fn();
		await expect( toWebVttTrackSrc( 'https://example.com/coffee.vtt' ) ).resolves.toBe( 'https://example.com/coffee.vtt' );
		expect( global.fetch ).not.toHaveBeenCalled();
	} );

	it( 'converts an .srt file to a WebVTT blob URL with the same cues', async () => {
		global.fetch = jest.fn( () => Promise.resolve( { ok: true, text: () => Promise.resolve( SRT ) } ) );
		const src = await toWebVttTrackSrc( 'https://example.com/convert-me.srt' );

		expect( src ).toBe( 'blob:converted-1' );
		expect( blobs[ 0 ].type ).toBe( 'text/vtt' );
		const vtt = await new Promise( ( resolve ) => {
			const reader = new window.FileReader();
			reader.onload = () => resolve( reader.result );
			reader.readAsText( blobs[ 0 ] );
		} );
		expect( vtt ).toBe( 'WEBVTT\n\n00:00:00.000 --> 00:00:04.500\nA pour-over station waits by the window.\n\n00:00:59.500 --> 00:01:09.500\nHot water pours from a gooseneck kettle.\n' );
	} );

	it( 'fetches each .srt once, however many players ask', async () => {
		global.fetch = jest.fn( () => Promise.resolve( { ok: true, text: () => Promise.resolve( SRT ) } ) );
		const [ a, b ] = await Promise.all( [
			toWebVttTrackSrc( 'https://example.com/shared.srt' ),
			toWebVttTrackSrc( 'https://example.com/shared.srt' ),
		] );

		expect( a ).toBe( b );
		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'falls back to the original URL when the file cannot be read', async () => {
		global.fetch = jest.fn( () => Promise.resolve( { ok: false } ) );
		await expect( toWebVttTrackSrc( 'https://example.com/missing.srt' ) ).resolves.toBe( 'https://example.com/missing.srt' );

		global.fetch = jest.fn( () => Promise.reject( new TypeError( 'Failed to fetch' ) ) );
		await expect( toWebVttTrackSrc( 'https://example.com/blocked.srt' ) ).resolves.toBe( 'https://example.com/blocked.srt' );

		global.fetch = jest.fn( () => Promise.resolve( { ok: true, text: () => Promise.resolve( 'not captions' ) } ) );
		await expect( toWebVttTrackSrc( 'https://example.com/empty.srt' ) ).resolves.toBe( 'https://example.com/empty.srt' );
		expect( window.URL.createObjectURL ).not.toHaveBeenCalled();
	} );

	it( 'fetches again after a failed fetch, so a one-off failure is not kept for the page', async () => {
		const url = 'https://example.com/flaky.srt';
		global.fetch = jest.fn()
			.mockImplementationOnce( () => Promise.resolve( { ok: false } ) )
			.mockImplementationOnce( () => Promise.resolve( { ok: true, text: () => Promise.resolve( SRT ) } ) );

		await expect( toWebVttTrackSrc( url ) ).resolves.toBe( url );
		await expect( toWebVttTrackSrc( url ) ).resolves.toBe( 'blob:converted-1' );
		expect( global.fetch ).toHaveBeenCalledTimes( 2 );
	} );
} );
