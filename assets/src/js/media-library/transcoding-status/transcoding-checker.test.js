/**
 * Unit tests for the status poller's request: it sends the REST nonce, so the route can
 * tell a logged-in editor (who gets Central's own wording for a refused job) from anyone.
 */

/**
 * Internal dependencies
 */
import TranscodingChecker from './transcoding-checker';

describe( 'TranscodingChecker — request', () => {
	afterEach( () => {
		delete window.transcoderSettings;
	} );

	it( 'sends the REST nonce when one is localized', async () => {
		window.transcoderSettings = { nonce: 'abc123' };
		global.fetch = jest.fn().mockResolvedValue( { json: () => Promise.resolve( {} ) } );

		await new TranscodingChecker( 'https://example.test/status', jest.fn(), [ 5 ] ).fetchStatusOnce( [ 5 ] );

		expect( global.fetch ).toHaveBeenCalledWith( expect.any( String ), { headers: { 'X-WP-Nonce': 'abc123' } } );
	} );

	it( 'sends no header without a nonce', async () => {
		global.fetch = jest.fn().mockResolvedValue( { json: () => Promise.resolve( {} ) } );

		await new TranscodingChecker( 'https://example.test/status', jest.fn(), [ 5 ] ).fetchStatusOnce( [ 5 ] );

		expect( global.fetch ).toHaveBeenCalledWith( expect.any( String ), {} );
	} );
} );

describe( 'TranscodingChecker — batches', () => {
	it( 'asks for at most 100 IDs a request and merges the answers', async () => {
		const ids = Array.from( { length: 250 }, ( unused, index ) => index + 1 );
		const callback = jest.fn();
		global.fetch = jest.fn( ( url ) => {
			const asked = new URL( url ).searchParams.getAll( 'ids[]' );
			return Promise.resolve( {
				json: () => Promise.resolve( Object.fromEntries( asked.map( ( id ) => [ id, { status: 'transcoded' } ] ) ) ),
			} );
		} );

		await new TranscodingChecker( 'https://example.test/status', callback, ids ).fetchStatusOnce( ids );

		expect( global.fetch ).toHaveBeenCalledTimes( 3 );
		global.fetch.mock.calls.forEach( ( [ url ] ) => {
			expect( new URL( url ).searchParams.getAll( 'ids[]' ).length ).toBeLessThanOrEqual( 100 );
		} );
		expect( Object.keys( callback.mock.calls[ 0 ][ 0 ] ) ).toHaveLength( 250 );
	} );

	it( 'sends one request for a short list', async () => {
		global.fetch = jest.fn().mockResolvedValue( { json: () => Promise.resolve( {} ) } );

		await new TranscodingChecker( 'https://example.test/status', jest.fn(), [ 5, 6 ] ).fetchStatusOnce( [ 5, 6 ] );

		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
	} );
} );
