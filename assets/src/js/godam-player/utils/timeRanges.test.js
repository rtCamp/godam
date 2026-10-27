/**
 * Internal dependencies
 */
import { addRange, mergeRanges, subtractRanges } from './timeRanges';

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
} );
