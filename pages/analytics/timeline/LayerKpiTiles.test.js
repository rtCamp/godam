/**
 * Internal dependencies
 */
import { formatKpiValue } from './LayerKpiTiles';
import { barShade } from './PollAnswerDistribution';

describe( 'formatKpiValue', () => {
	it( 'renders a rate with one decimal and a percent sign', () => {
		expect( formatKpiValue( { kind: 'rate', value: 24 } ) ).toBe( '24%' );
		expect( formatKpiValue( { kind: 'rate', value: 14.23 } ) ).toBe( '14.2%' );
		expect( formatKpiValue( { kind: 'reachRate', value: 91.96 } ) ).toBe( '92%' );
	} );

	it( 'renders counts in full, with separators and no abbreviation', () => {
		// The 2.0 treatment is full numbers: no "1.2K", no hover-to-reveal.
		expect( formatKpiValue( { kind: 'count', value: 1200 } ) ).toBe(
			( 1200 ).toLocaleString(),
		);
		expect( formatKpiValue( { kind: 'count', value: 0 } ) ).toBe( '0' );
	} );

	it( 'renders a dash for an unknown value rather than a measured zero', () => {
		expect( formatKpiValue( { kind: 'rate', value: null } ) ).toBe( '-' );
		expect( formatKpiValue( { kind: 'count', value: null } ) ).toBe( '-' );
		expect( formatKpiValue( { kind: 'reachRate', value: undefined } ) ).toBe( '-' );
		expect( formatKpiValue( { kind: 'rate', value: NaN } ) ).toBe( '-' );
		expect( formatKpiValue( { kind: 'rate', value: Infinity } ) ).toBe( '-' );
	} );

	it( 'shows a rate above 100% as measured, without clamping', () => {
		expect( formatKpiValue( { kind: 'rate', value: 120 } ) ).toBe( '120%' );
	} );
} );

describe( 'barShade', () => {
	it( 'starts at the full admin accent and steps lighter', () => {
		const first = barShade( 0, 3 );
		const last = barShade( 2, 3 );
		expect( first ).toContain( '100%' );
		expect( first ).toContain( 'var(--wp-admin-theme-color' );
		expect( last ).toContain( '30%' );
	} );

	it( 'keeps a single bar at the full accent', () => {
		expect( barShade( 0, 1 ) ).toContain( '100%' );
	} );

	it( 'never drops below the legibility floor', () => {
		for ( let count = 1; count <= 8; count++ ) {
			for ( let idx = 0; idx < count; idx++ ) {
				const mix = Number( /(\d+)%/.exec( barShade( idx, count ) )[ 1 ] );
				expect( mix ).toBeGreaterThanOrEqual( 30 );
				expect( mix ).toBeLessThanOrEqual( 100 );
			}
		}
	} );
} );
