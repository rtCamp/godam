/**
 * The front-end entry starts watching for failed GoDAM thumbnails as soon as it loads.
 */
jest.mock( './signed-thumbnails', () => ( { init: jest.fn() } ) );

describe( 'front-end entry', () => {
	it( 'starts the signed-thumbnail watcher', () => {
		require( './main' );
		expect( require( './signed-thumbnails' ).init ).toHaveBeenCalledTimes( 1 );
	} );
} );
