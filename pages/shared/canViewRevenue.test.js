/**
 * Unit tests for the canViewRevenue flag reader.
 *
 * @package
 */

/**
 * Internal dependencies
 */
import { canViewRevenue } from './canViewRevenue';

describe( 'canViewRevenue', () => {
	afterEach( () => {
		delete window.videoData;
	} );

	it( 'is true when PHP localized the flag as true', () => {
		window.videoData = { canViewRevenue: true };
		expect( canViewRevenue() ).toBe( true );
	} );

	it( 'is false when PHP localized the flag as false', () => {
		window.videoData = { canViewRevenue: false };
		expect( canViewRevenue() ).toBe( false );
	} );

	it( 'fails closed when the flag or the whole global is missing', () => {
		expect( canViewRevenue() ).toBe( false );
		window.videoData = { isWoo: true };
		expect( canViewRevenue() ).toBe( false );
	} );

	it( 'reads the flag on every call, not once at import time', () => {
		window.videoData = { canViewRevenue: false };
		expect( canViewRevenue() ).toBe( false );
		window.videoData = { canViewRevenue: true };
		expect( canViewRevenue() ).toBe( true );
	} );
} );
