/**
 * Internal dependencies
 */
import { shouldSuppressSkip } from './layerActions';

const fired = ( ...actions ) => new Set( actions );

describe( 'shouldSuppressSkip', () => {
	it( 'drops a skip once the CTA was clicked in the same session', () => {
		expect( shouldSuppressSkip( fired( 'viewed', 'clicked' ), 'skipped' ) ).toBe( true );
	} );

	it( 'drops a skip once a form was submitted', () => {
		expect( shouldSuppressSkip( fired( 'viewed', 'submitted' ), 'skipped' ) ).toBe( true );
	} );

	it( 'drops a skip once a poll was voted', () => {
		expect( shouldSuppressSkip( fired( 'viewed', 'voted' ), 'skipped' ) ).toBe( true );
	} );

	it( 'keeps a genuine skip when no positive action was taken', () => {
		expect( shouldSuppressSkip( fired( 'viewed' ), 'skipped' ) ).toBe( false );
		expect( shouldSuppressSkip( fired(), 'skipped' ) ).toBe( false );
	} );

	it( 'never touches a non-skip action', () => {
		expect( shouldSuppressSkip( fired( 'viewed' ), 'clicked' ) ).toBe( false );
		expect( shouldSuppressSkip( fired( 'clicked' ), 'added_to_cart' ) ).toBe( false );
		expect( shouldSuppressSkip( fired( 'viewed' ), 'viewed' ) ).toBe( false );
	} );
} );
