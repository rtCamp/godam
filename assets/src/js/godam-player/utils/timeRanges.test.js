/**
 * Internal dependencies
 */
import { addRange, getWatchedRanges, mergeRanges, subtractRanges } from './timeRanges';

describe( 'timeRanges', () => {
	it( 'merges overlapping and touching ranges', () => {
		expect( mergeRanges( [ [ 5, 8 ], [ 0, 2 ], [ 2, 3 ], [ 7, 10 ] ] ) ).toEqual( [ [ 0, 3 ], [ 5, 10 ] ] );
	} );

	it( 'drops empty and malformed ranges', () => {
		expect( mergeRanges( [ [ 3, 3 ], [ 4, 2 ], null, [ 1, 2 ] ] ) ).toEqual( [ [ 1, 2 ] ] );
	} );

	it( 'adds a range and keeps the list merged', () => {
		expect( addRange( [ [ 0, 2 ] ], 1.5, 4 ) ).toEqual( [ [ 0, 4 ] ] );
	} );

	it( 'subtracts ranges, splitting where needed', () => {
		expect( subtractRanges( [ [ 0, 10 ] ], [ [ 2, 4 ], [ 8, 12 ] ] ) ).toEqual( [ [ 0, 2 ], [ 4, 8 ] ] );
	} );

	it( 'returns the input unchanged when nothing overlaps', () => {
		expect( subtractRanges( [ [ 0, 2 ], [ 5, 6 ] ], [ [ 3, 4 ] ] ) ).toEqual( [ [ 0, 2 ], [ 5, 6 ] ] );
	} );

	it( 'getWatchedRanges drops seconds that only played out of view', () => {
		const ranges = [ [ 0, 20 ] ];
		const player = {
			played: () => ( { length: 1, start: ( i ) => ranges[ i ][ 0 ], end: ( i ) => ranges[ i ][ 1 ] } ),
			godamHiddenRanges: [ [ 5, 15 ] ],
			godamVisibleRanges: [ [ 0, 5 ], [ 10, 12 ], [ 15, 20 ] ],
		};
		expect( getWatchedRanges( player ) ).toEqual( [ [ 0, 5 ], [ 10, 12 ], [ 15, 20 ] ] );
	} );

	it( 'getWatchedRanges returns played ranges as-is when nothing was hidden', () => {
		const player = { played: () => ( { length: 1, start: () => 1, end: () => 4 } ) };
		expect( getWatchedRanges( player ) ).toEqual( [ [ 1, 4 ] ] );
	} );
} );
