/**
 * Unit tests for the analytics emit-path helpers: the request-body contract
 * (placement slug + host-page attribution) and the page_load batch grouping.
 */

/**
 * Internal dependencies
 */
import {
	buildAnalyticsRequestBody,
	groupBatchByHostPostId,
} from './analytics-helpers';

// Minimal shape buildAnalyticsRequestBody reads off the page.
const setParams = ( overrides = {} ) => {
	window.videoAnalyticsParams = {
		endpoint: 'https://analytics.test',
		token: 'tok',
		userId: 1,
		emailId: 'a@b.test',
		locationIP: '10.0.0.1',
		isPost: false,
		isPage: true,
		isArchive: false,
		postType: 'page',
		postId: 500,
		postTitle: 'Host Page',
		categories: '',
		tags: '',
		author: 'someone',
		...overrides,
	};
};

const build = ( opts ) => buildAnalyticsRequestBody( { type: 1, ...opts } );

describe( 'buildAnalyticsRequestBody — placement attribution', () => {
	beforeEach( () => {
		setParams();
	} );

	it( 'defaults block_source to an empty string', () => {
		const { body } = build( {} );
		expect( body.block_source ).toBe( '' );
	} );

	it( 'passes the placement slug through verbatim', () => {
		const { body } = build( { blockSource: 'wc-product-gallery' } );
		expect( body.block_source ).toBe( 'wc-product-gallery' );
	} );

	it( 'uses the page post_id when no host is stamped', () => {
		const { body } = build( {} );
		expect( body.post_id ).toBe( 500 );
	} );

	it( 'overrides post_id with hostPostId inside an embed iframe', () => {
		// The embed page's own get_the_ID() is meaningless for attribution, so a
		// stamped host id must win — this is what makes gallery/lightbox plays
		// count against the hosting page.
		const { body } = build( { hostPostId: 42 } );
		expect( body.post_id ).toBe( 42 );
	} );

	it.each( [
		[ 'zero', 0 ],
		[ 'null', null ],
		[ 'undefined', undefined ],
		[ 'a non-numeric string', 'abc' ],
		[ 'a negative number', -5 ],
	] )( 'leaves post_id untouched for %s', ( _label, hostPostId ) => {
		const { body } = build( { hostPostId } );
		expect( body.post_id ).toBe( 500 );
	} );

	it( 'coerces a numeric-string hostPostId', () => {
		const { body } = build( { hostPostId: '77' } );
		expect( body.post_id ).toBe( 77 );
	} );

	it( 'passes type=1 video_ids triples through unchanged', () => {
		const triples = [
			[ 11, 'job-a', 'video-block' ],
			[ 22, '', 'video-gallery' ],
		];
		const { body } = build( { videoIds: triples } );
		expect( body.video_ids ).toEqual( triples );
	} );

	it( 'sends no video_ids for non-page_load events', () => {
		const { body } = buildAnalyticsRequestBody( {
			type: 2,
			videoId: 11,
			videoIds: [ [ 11, '', 'video-block' ] ],
		} );
		expect( body.video_ids ).toEqual( [] );
	} );

	// Callers must check `endpoint` before sending; these are the two bail
	// conditions, so a beacon is never emitted for an unusable configuration.
	it( 'returns a null endpoint and body when the endpoint is missing', () => {
		setParams( { endpoint: '' } );
		expect( build( {} ) ).toEqual( { endpoint: null, body: null } );
	} );

	it( 'returns a null endpoint and body when the token is unverified', () => {
		setParams( { token: 'unverified' } );
		expect( build( {} ) ).toEqual( { endpoint: null, body: null } );
	} );
} );

describe( 'groupBatchByHostPostId', () => {
	const entry = ( overrides = {} ) => ( {
		videoId: 1,
		jobId: '',
		blockSource: 'video-block',
		hostPostId: null,
		...overrides,
	} );

	it( 'keeps an unstamped batch in a single group keyed 0', () => {
		const groups = groupBatchByHostPostId( [
			entry( { videoId: 1 } ),
			entry( { videoId: 2 } ),
		] );
		expect( [ ...groups.keys() ] ).toEqual( [ 0 ] );
		expect( groups.get( 0 ) ).toEqual( [
			[ 1, '', 'video-block' ],
			[ 2, '', 'video-block' ],
		] );
	} );

	it( 'splits entries with different host attributions', () => {
		// The regression this guards: one host-stamped player must not drag the
		// rest of the page's videos into its post_id override.
		const groups = groupBatchByHostPostId( [
			entry( { videoId: 1, hostPostId: null } ),
			entry( { videoId: 2, hostPostId: 42 } ),
			entry( { videoId: 3, hostPostId: 42 } ),
			entry( { videoId: 4, hostPostId: 99 } ),
		] );
		expect( [ ...groups.keys() ].sort() ).toEqual( [ 0, 42, 99 ] );
		expect( groups.get( 0 ).map( ( t ) => t[ 0 ] ) ).toEqual( [ 1 ] );
		expect( groups.get( 42 ).map( ( t ) => t[ 0 ] ) ).toEqual( [ 2, 3 ] );
		expect( groups.get( 99 ).map( ( t ) => t[ 0 ] ) ).toEqual( [ 4 ] );
	} );

	it( 'emits wire triples, dropping the internal hostPostId field', () => {
		const groups = groupBatchByHostPostId( [
			entry( { videoId: 7, jobId: 'job-x', blockSource: 'reel-pop', hostPostId: 5 } ),
		] );
		expect( groups.get( 5 ) ).toEqual( [ [ 7, 'job-x', 'reel-pop' ] ] );
	} );

	it( 'normalizes a missing blockSource / jobId to empty strings', () => {
		const groups = groupBatchByHostPostId( [
			{ videoId: 9, hostPostId: 0 },
		] );
		expect( groups.get( 0 ) ).toEqual( [ [ 9, '', '' ] ] );
	} );

	it( 'treats non-positive and unparseable host ids as "no host"', () => {
		const groups = groupBatchByHostPostId( [
			entry( { videoId: 1, hostPostId: 0 } ),
			entry( { videoId: 2, hostPostId: -3 } ),
			entry( { videoId: 3, hostPostId: 'abc' } ),
		] );
		expect( [ ...groups.keys() ] ).toEqual( [ 0 ] );
		expect( groups.get( 0 ) ).toHaveLength( 3 );
	} );

	it( 'returns an empty map for an empty or invalid batch', () => {
		expect( groupBatchByHostPostId( [] ).size ).toBe( 0 );
		expect( groupBatchByHostPostId( null ).size ).toBe( 0 );
	} );
} );
