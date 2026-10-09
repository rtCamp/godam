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
