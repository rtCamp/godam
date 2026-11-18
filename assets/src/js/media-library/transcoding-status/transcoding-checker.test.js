/**
 * Unit tests for the status poller's request: it sends the REST nonce, so the route can
 * tell a logged-in editor (who gets Central's own wording for a refused job) from anyone.
 */

/**
 * Internal dependencies
 */
import TranscodingChecker, { RETRYING_INTERVAL } from './transcoding-checker';

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

describe( 'TranscodingChecker — files waiting for an automatic retry', () => {
	/**
	 * Answer every status request with these statuses, and record which IDs were asked for.
	 *
	 * @param {Object} statuses Statuses keyed by ID.
	 * @return {Array} The IDs asked for, per request.
	 */
	const answer = ( statuses ) => {
		const asked = [];
		global.fetch = jest.fn( ( url ) => {
			const ids = new URL( url ).searchParams.getAll( 'ids[]' );
			asked.push( ids.map( Number ) );
			return Promise.resolve( { json: () => Promise.resolve( Object.fromEntries( ids.map( ( id ) => [ id, statuses[ id ] ] ) ) ) } );
		} );

		return asked;
	};

	const retrying = { status: 'failed', progress: 0, failure: { kind: 'retrying' } };

	it( 'keeps checking a retrying file, once a minute instead of every tick', async () => {
		const statuses = { 5: retrying, 6: { status: 'transcoding', progress: 10 } };
		const asked = answer( statuses );
		const callback = jest.fn();
		const checker = new TranscodingChecker( 'https://example.test/status', callback, [ 5, 6 ] );

		await checker.fetchStatus( 0 );
		expect( checker.retryingIds ).toEqual( [ 5 ] );
		expect( checker.postIds ).toEqual( [ 6 ] );

		await checker.fetchStatus( 5000 );
		expect( asked[ 1 ] ).toEqual( [ 6 ] );

		// The cron retried it and it's transcoding now: the list shows that without a reload.
		statuses[ 5 ] = { status: 'transcoding', progress: 5 };
		await checker.fetchStatus( RETRYING_INTERVAL );
		expect( asked[ 2 ] ).toEqual( [ 6, 5 ] );
		expect( callback ).toHaveBeenLastCalledWith( expect.objectContaining( { 5: statuses[ 5 ] } ) );
		expect( checker.retryingIds ).toEqual( [] );
		expect( checker.postIds ).toEqual( [ 6, 5 ] );
	} );

	it( 'stops checking once nothing is in progress or retrying', async () => {
		answer( { 5: { status: 'failed', progress: 0, failure: { kind: 'failed' } } } );
		const checker = new TranscodingChecker( 'https://example.test/status', jest.fn(), [ 5 ] );
		checker.polling = 1;
		checker.stopPolling = jest.fn();

		await checker.fetchStatus( 0 );

		expect( checker.retryingIds ).toEqual( [] );
		expect( checker.stopPolling ).toHaveBeenCalled();
	} );
} );
