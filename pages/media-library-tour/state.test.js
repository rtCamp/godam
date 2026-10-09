/**
 * Unit tests for persisting the per-user tour state.
 */

/**
 * Internal dependencies
 */
import { getTourState, setTourState, shouldAutoStart, TOUR_STATES } from './state';

describe( 'setTourState', () => {
	const originalFetch = global.fetch;

	afterEach( () => {
		global.fetch = originalFetch;
	} );

	it( 'keeps the new state when the save succeeds', async () => {
		global.fetch = jest.fn().mockResolvedValue( { ok: true } );

		await expect( setTourState( TOUR_STATES.DISMISSED ) ).resolves.toBe( true );
		expect( getTourState() ).toBe( TOUR_STATES.DISMISSED );

		await setTourState( TOUR_STATES.PENDING );
	} );

	it.each( [
		[ 'an HTTP error', () => Promise.resolve( { ok: false, status: 403 } ) ],
		[ 'a network error', () => Promise.reject( new Error( 'offline' ) ) ],
	] )( 'rolls the cache back on %s', async ( _label, response ) => {
		global.fetch = jest.fn( response );

		const saving = setTourState( TOUR_STATES.DISMISSED );
		expect( getTourState() ).toBe( TOUR_STATES.DISMISSED );

		await expect( saving ).resolves.toBe( false );
		expect( getTourState() ).toBe( TOUR_STATES.PENDING );
		expect( shouldAutoStart() ).toBe( true );
	} );
} );
