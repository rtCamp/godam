/**
 * Unit tests for the canViewStoreData flag reader.
 *
 * @package
 */

/**
 * Internal dependencies
 */
import { canViewStoreData } from './canViewStoreData';

describe( 'canViewStoreData', () => {
	afterEach( () => {
		delete window.videoData;
	} );

	it( 'is true when PHP localized the flag as true', () => {
		window.videoData = { canViewStoreData: true };
		expect( canViewStoreData() ).toBe( true );
	} );

	it( 'is false when PHP localized the flag as false', () => {
		window.videoData = { canViewStoreData: false };
		expect( canViewStoreData() ).toBe( false );
	} );

	it( 'fails closed when the flag or the whole global is missing', () => {
		expect( canViewStoreData() ).toBe( false );
		window.videoData = { isWoo: true };
		expect( canViewStoreData() ).toBe( false );
	} );

	it( 'reads the flag on every call, not once at import time', () => {
		window.videoData = { canViewStoreData: false };
		expect( canViewStoreData() ).toBe( false );
		window.videoData = { canViewStoreData: true };
		expect( canViewStoreData() ).toBe( true );
	} );
} );
