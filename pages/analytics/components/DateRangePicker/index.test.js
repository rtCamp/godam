/**
 * Unit tests for the analytics DateRangePicker pure helpers.
 */

/**
 * Internal dependencies
 */
import {
	PRESETS,
	spanDays,
	matchPreset,
	triggerLabelFor,
	toISO,
	fromISO,
} from './index';

describe( 'DateRangePicker helpers', () => {
	describe( 'toISO / fromISO', () => {
		it( 'round-trips a local date', () => {
			const d = new Date( 2026, 10, 7 ); // 2026-11-07 (month is 0-based)
			expect( toISO( d ) ).toBe( '2026-11-07' );
			expect( toISO( fromISO( '2026-11-07' ) ) ).toBe( '2026-11-07' );
		} );

		it( 'fromISO is null-safe', () => {
			expect( fromISO( null ) ).toBeNull();
			expect( fromISO( '' ) ).toBeNull();
		} );
	} );

	describe( 'spanDays', () => {
		it( 'produces an inclusive N-day window ending today, by calendar day', () => {
			const now = new Date();
			const todayMidnight = new Date( now.getFullYear(), now.getMonth(), now.getDate() );
			// Assert exact calendar endpoints rather than an elapsed-ms count:
			// a fixed-ms span drifts the start one calendar day early across a
			// DST spring-forward, which a `(end - start) / 86400000` check
			// cannot see (it stays exactly N-1). Expected dates are built with
			// the Date constructor so the assertion itself is DST-safe.
			for ( const n of [ 7, 15, 30 ] ) {
				const { startDate, endDate } = spanDays( n );
				expect( endDate ).toBe( toISO( todayMidnight ) );
				const expectedStart = new Date(
					todayMidnight.getFullYear(),
					todayMidnight.getMonth(),
					todayMidnight.getDate() - ( n - 1 ),
				);
				expect( startDate ).toBe( toISO( expectedStart ) );
			}
		} );
	} );

	describe( 'matchPreset', () => {
		it( 'maps an empty range to "all"', () => {
			expect( matchPreset( {} ) ).toBe( 'all' );
			expect( matchPreset( { startDate: null, endDate: null } ) ).toBe( 'all' );
		} );

		it( 'maps a resolved preset span back to its key', () => {
			const sevenDay = PRESETS.find( ( p ) => p.key === '7d' ).resolve();
			expect( matchPreset( sevenDay ) ).toBe( '7d' );
			const oneMonth = PRESETS.find( ( p ) => p.key === '1m' ).resolve();
			expect( matchPreset( oneMonth ) ).toBe( '1m' );
		} );

		it( 'maps an arbitrary range to "custom"', () => {
			expect(
				matchPreset( { startDate: '2020-01-01', endDate: '2020-01-05' } ),
			).toBe( 'custom' );
		} );
	} );

	describe( 'triggerLabelFor', () => {
		it( 'labels all-time and presets', () => {
			expect( triggerLabelFor( {} ) ).toBe( 'All Time' );
			const sevenDay = PRESETS.find( ( p ) => p.key === '7d' ).resolve();
			expect( triggerLabelFor( sevenDay ) ).toBe( 'Last 7 days' );
		} );

		it( 'labels a custom range as a start - end span', () => {
			const label = triggerLabelFor( { startDate: '2026-11-07', endDate: '2026-11-13' } );
			expect( label ).toMatch( /Nov 7\s*-\s*Nov 13/ );
		} );
	} );
} );
