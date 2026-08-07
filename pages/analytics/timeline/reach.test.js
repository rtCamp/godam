/**
 * Internal dependencies
 */
import {
	parseRetentionArray,
	percentDelta,
	previousRange,
	reachAt,
	reachBase,
	reachRateAt,
	spanLengthInDays,
} from './reach';

describe( 'parseRetentionArray', () => {
	it( 'parses the JSON string the microservice returns', () => {
		expect( parseRetentionArray( '[5,4,3]' ) ).toEqual( [ 5, 4, 3 ] );
	} );

	it( 'passes an already-parsed array through, coercing values', () => {
		expect( parseRetentionArray( [ '5', 4, null ] ) ).toEqual( [ 5, 4, 0 ] );
	} );

	it( 'returns [] for every unusable input rather than throwing', () => {
		expect( parseRetentionArray( undefined ) ).toEqual( [] );
		expect( parseRetentionArray( null ) ).toEqual( [] );
		expect( parseRetentionArray( '' ) ).toEqual( [] );
		expect( parseRetentionArray( '   ' ) ).toEqual( [] );
		expect( parseRetentionArray( 'not json' ) ).toEqual( [] );
		// Valid JSON, wrong shape — the endpoint nulls the field in some modes.
		expect( parseRetentionArray( '{"a":1}' ) ).toEqual( [] );
		expect( parseRetentionArray( 'null' ) ).toEqual( [] );
	} );
} );

describe( 'reachBase', () => {
	it( 'uses second 0 as the starting-viewers baseline', () => {
		expect( reachBase( [ 10, 8, 6 ] ) ).toBe( 10 );
	} );

	it( 'falls back to the array max when second 0 recorded nothing', () => {
		// Every session\'s first beacon landed mid-video.
		expect( reachBase( [ 0, 0, 7, 4 ] ) ).toBe( 7 );
	} );

	it( 'is 0 for an empty or all-zero array', () => {
		expect( reachBase( [] ) ).toBe( 0 );
		expect( reachBase( [ 0, 0 ] ) ).toBe( 0 );
		expect( reachBase( null ) ).toBe( 0 );
	} );
} );

describe( 'reachAt', () => {
	const array = [ 10, 9, 8, 7 ];

	it( 'floors a fractional layer timestamp to the containing second', () => {
		expect( reachAt( array, 2 ) ).toBe( 8 );
		expect( reachAt( array, 2.9 ) ).toBe( 8 );
	} );

	it( 'reads second 0 for a layer at the very start', () => {
		expect( reachAt( array, 0 ) ).toBe( 10 );
	} );

	it( 'returns null past the end of the array, not the last value', () => {
		// A layer positioned beyond the video_length these events recorded.
		expect( reachAt( array, 4 ) ).toBeNull();
		expect( reachAt( array, 900 ) ).toBeNull();
	} );

	it( 'returns null when there is no retention data', () => {
		expect( reachAt( [], 1 ) ).toBeNull();
		expect( reachAt( null, 1 ) ).toBeNull();
	} );

	it( 'returns null for a negative timestamp', () => {
		expect( reachAt( array, -1 ) ).toBeNull();
	} );

	it( 'reports a real zero inside the array as 0, not null', () => {
		expect( reachAt( [ 10, 0, 5 ], 1 ) ).toBe( 0 );
	} );
} );

describe( 'reachRateAt', () => {
	it( 'is reach over starting viewers, as a percentage', () => {
		expect( reachRateAt( [ 200, 150, 100 ], 2 ) ).toBe( 50 );
	} );

	it( 'does not clamp a rewatched second above 100%', () => {
		// Matches generateRetentionCurve, which leaves headroom for these bumps.
		expect( reachRateAt( [ 100, 250 ], 1 ) ).toBe( 250 );
	} );

	it( 'returns null when the baseline is zero', () => {
		expect( reachRateAt( [ 0, 0, 0 ], 1 ) ).toBeNull();
	} );

	it( 'returns null when reach itself is unknown', () => {
		expect( reachRateAt( [ 10, 5 ], 9 ) ).toBeNull();
		expect( reachRateAt( [], 0 ) ).toBeNull();
	} );
} );

describe( 'spanLengthInDays', () => {
	it( 'counts both endpoints', () => {
		expect(
			spanLengthInDays( new Date( 2026, 7, 1 ), new Date( 2026, 7, 7 ) ),
		).toBe( 7 );
	} );

	it( 'is 1 for a single day', () => {
		expect(
			spanLengthInDays( new Date( 2026, 7, 3 ), new Date( 2026, 7, 3 ) ),
		).toBe( 1 );
	} );

	it( 'rounds through a DST transition', () => {
		// US spring-forward 2026-03-08 makes one day 23h long.
		expect(
			spanLengthInDays( new Date( 2026, 2, 5 ), new Date( 2026, 2, 11 ) ),
		).toBe( 7 );
	} );
} );

describe( 'previousRange', () => {
	it( 'returns the equal-length window ending the day before', () => {
		expect(
			previousRange( { startDate: '2026-08-01', endDate: '2026-08-07' } ),
		).toEqual( { startDate: '2026-07-25', endDate: '2026-07-31' } );
	} );

	it( 'handles a single-day range', () => {
		expect(
			previousRange( { startDate: '2026-08-03', endDate: '2026-08-03' } ),
		).toEqual( { startDate: '2026-08-02', endDate: '2026-08-02' } );
	} );

	it( 'crosses a month and a year boundary', () => {
		// 31 days ending 2025-12-31 starts 2025-12-01, since December has 31 days.
		expect(
			previousRange( { startDate: '2026-01-01', endDate: '2026-01-31' } ),
		).toEqual( { startDate: '2025-12-01', endDate: '2025-12-31' } );
	} );

	it( 'returns null for an open-ended All Time range', () => {
		expect( previousRange( { startDate: null, endDate: null } ) ).toBeNull();
		expect( previousRange( { startDate: '2026-08-01', endDate: null } ) ).toBeNull();
		expect( previousRange( {} ) ).toBeNull();
		expect( previousRange() ).toBeNull();
	} );

	it( 'returns null for malformed or impossible dates', () => {
		expect( previousRange( { startDate: 'yesterday', endDate: 'today' } ) ).toBeNull();
		expect( previousRange( { startDate: '2026-02-30', endDate: '2026-03-05' } ) ).toBeNull();
	} );

	it( 'returns null when the range is inverted', () => {
		expect(
			previousRange( { startDate: '2026-08-07', endDate: '2026-08-01' } ),
		).toBeNull();
	} );
} );

describe( 'percentDelta', () => {
	it( 'computes an ordinary change', () => {
		expect( percentDelta( 120, 100 ) ).toBe( 20 );
		expect( percentDelta( 80, 100 ) ).toBe( -20 );
	} );

	it( 'reports +100 against a zero baseline, matching the server convention', () => {
		expect( percentDelta( 5, 0 ) ).toBe( 100 );
	} );

	it( 'reports 0 when both windows are zero', () => {
		expect( percentDelta( 0, 0 ) ).toBe( 0 );
	} );

	it( 'returns null when either side is missing, so the badge hides', () => {
		expect( percentDelta( 10, null ) ).toBeNull();
		expect( percentDelta( 10, undefined ) ).toBeNull();
		expect( percentDelta( null, 10 ) ).toBeNull();
	} );

	it( 'returns null for non-numeric input', () => {
		expect( percentDelta( 'abc', 10 ) ).toBeNull();
		expect( percentDelta( 10, 'abc' ) ).toBeNull();
	} );
} );
