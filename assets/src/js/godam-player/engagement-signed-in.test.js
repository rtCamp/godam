/**
 * Telling a signed-in visitor apart on a cached signed-out page.
 *
 * A full-page cache can serve the signed-out copy of a page, with its printed
 * 'non-user' data and signed-out nonce, to a visitor who is signed in. The player
 * then asks core's `rest-nonce` admin-ajax action, which answers only a signed-in
 * visitor, and moves the fresh nonce into core's api-fetch nonce middleware.
 */

// The emoji picker ships as ESM and is not used here.
jest.mock( 'emoji-picker-react', () => () => null );

jest.mock( '@wordpress/api-fetch', () => {
	const mock = jest.fn();
	mock.use = jest.fn();
	mock.nonceEndpoint = '/wp-admin/admin-ajax.php?action=rest-nonce';
	mock.nonceMiddleware = { nonce: 'signed-out-nonce' };
	return { __esModule: true, default: mock };
} );

// What a cached signed-out page prints.
window.godamData = {
	currentLoggedInUserData: { name: 'Anonymous', type: 'non-user' },
	loginUrl: '/wp-login.php',
	registrationUrl: '/wp-login.php?action=register',
	defaultAvatar: 'https://avatar.test/default',
};

/**
 * Load engagement.js fresh, so its once-per-page check starts over.
 *
 * @return {Object} The module and the api-fetch mock it sees.
 */
const loadFresh = () => {
	let loaded;
	jest.isolateModules( () => {
		loaded = {
			engagement: require( './engagement' ),
			apiFetch: require( '@wordpress/api-fetch' ).default,
		};
	} );
	return loaded;
};

afterEach( () => {
	delete window.fetch;
} );

describe( 'checkSignedIn', () => {
	it( 'says signed in and takes the fresh nonce when rest-nonce answers', async () => {
		window.fetch = jest.fn( () => Promise.resolve( { ok: true, text: () => Promise.resolve( 'fresh-nonce' ) } ) );
		const { engagement, apiFetch } = loadFresh();

		await expect( engagement.checkSignedIn() ).resolves.toBe( true );
		expect( window.fetch ).toHaveBeenCalledWith( '/wp-admin/admin-ajax.php?action=rest-nonce', { credentials: 'same-origin' } );
		expect( apiFetch.nonceMiddleware.nonce ).toBe( 'fresh-nonce' );
	} );

	it( 'says signed out when rest-nonce refuses, and keeps the nonce', async () => {
		// admin-ajax answers a signed-out visitor with "0" and status 400.
		window.fetch = jest.fn( () => Promise.resolve( { ok: false, text: () => Promise.resolve( '0' ) } ) );
		const { engagement, apiFetch } = loadFresh();

		await expect( engagement.checkSignedIn() ).resolves.toBe( false );
		expect( apiFetch.nonceMiddleware.nonce ).toBe( 'signed-out-nonce' );
	} );

	it( 'says signed out when the request fails', async () => {
		window.fetch = jest.fn( () => Promise.reject( new Error( 'offline' ) ) );
		const { engagement } = loadFresh();

		await expect( engagement.checkSignedIn() ).resolves.toBe( false );
	} );

	it( 'asks only once per page', async () => {
		window.fetch = jest.fn( () => Promise.resolve( { ok: false, text: () => Promise.resolve( '0' ) } ) );
		const { engagement } = loadFresh();

		await engagement.checkSignedIn();
		await engagement.checkSignedIn();

		expect( window.fetch ).toHaveBeenCalledTimes( 1 );
	} );
} );
