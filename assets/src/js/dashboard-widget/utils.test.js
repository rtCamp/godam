/**
 * Internal dependencies
 */
import { playsMilestone, roundWatchTime, scaleBars } from './utils';

describe( 'scaleBars', () => {
	it( 'scales each day against the busiest one', () => {
		expect( scaleBars( [ 0, 25, 50 ] ) ).toEqual( [ 0, 0.5, 1 ] );
	} );

	it( 'returns zeros for a month with no plays', () => {
		expect( scaleBars( [ 0, 0, 0 ] ) ).toEqual( [ 0, 0, 0 ] );
	} );

	it( 'handles an empty series and ignores negative values', () => {
		expect( scaleBars( [] ) ).toEqual( [] );
		expect( scaleBars( [ -5, 10 ] ) ).toEqual( [ 0, 1 ] );
	} );
} );

describe( 'playsMilestone', () => {
	it( 'is 0 below the first milestone', () => {
		expect( playsMilestone( 0 ) ).toBe( 0 );
		expect( playsMilestone( 99 ) ).toBe( 0 );
	} );

	it( 'counts a milestone once it is reached', () => {
		expect( playsMilestone( 100 ) ).toBe( 100 );
	} );

	it( 'rounds down to the largest milestone passed', () => {
		expect( playsMilestone( 3412 ) ).toBe( 2500 );
		expect( playsMilestone( 9999 ) ).toBe( 5000 );
	} );

	it( 'tops out at the last milestone', () => {
		expect( playsMilestone( 2000000 ) ).toBe( 100000 );
	} );
} );

describe( 'roundWatchTime', () => {
	it( 'uses whole hours from ten hours up', () => {
		expect( roundWatchTime( 187560 ) ).toEqual( { amount: 52, unit: 'hours' } );
	} );

	it( 'keeps one decimal between one and ten hours', () => {
		expect( roundWatchTime( 9048 ) ).toEqual( { amount: 2.5, unit: 'hours' } );
		expect( roundWatchTime( 3600 ) ).toEqual( { amount: 1, unit: 'hours' } );
	} );

	it( 'uses whole minutes under an hour, never below one', () => {
		expect( roundWatchTime( 1800 ) ).toEqual( { amount: 30, unit: 'minutes' } );
		expect( roundWatchTime( 20 ) ).toEqual( { amount: 1, unit: 'minutes' } );
	} );
} );
