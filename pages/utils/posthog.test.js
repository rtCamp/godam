/**
 * Unit tests for the PostHog bootstrap.
 *
 * PostHog must only start when PHP sent an explicit opt-in (`enabled` of '1' or 1).
 * A missing, zero or otherwise unexpected value means "do not track".
 *
 * @package
 */

jest.mock( 'posthog-js', () => ( {
	__esModule: true,
	default: { init: jest.fn(), register: jest.fn() },
} ) );

const KEY = 'phc_test_key';
const HOST = 'https://posthog.test';

/**
 * Load a fresh copy of the bootstrap with the given `window.posthogConfig`.
 *
 * The bootstrap runs once at import time, so each case needs its own module registry.
 *
 * @param {Object|undefined} config What PHP localized as `posthogConfig`.
 * @return {Object} The mocked PostHog client the bootstrap received.
 */
const loadWith = ( config ) => {
	jest.resetModules();
	if ( config === undefined ) {
		delete window.posthogConfig;
	} else {
		window.posthogConfig = config;
	}
	require( './posthog' );
	return require( 'posthog-js' ).default;
};

describe( 'posthog bootstrap', () => {
	afterEach( () => {
		delete window.posthogConfig;
	} );

	it.each( [ [ '1' ], [ 1 ] ] )( 'starts PostHog when enabled is %p', ( enabled ) => {
		const posthog = loadWith( { key: KEY, host: HOST, enabled } );

		expect( posthog.init ).toHaveBeenCalledTimes( 1 );
		expect( posthog.init.mock.calls[ 0 ][ 0 ] ).toBe( KEY );
		expect( posthog.init.mock.calls[ 0 ][ 1 ].api_host ).toBe( HOST );
	} );

	it.each( [ [ '0' ], [ 0 ], [ false ], [ '' ], [ null ], [ 'yes' ] ] )(
		'does not start PostHog when enabled is %p',
		( enabled ) => {
			const posthog = loadWith( { key: KEY, host: HOST, enabled, properties: { plugin_version: '2.3.2' } } );

			expect( posthog.init ).not.toHaveBeenCalled();
			expect( posthog.register ).not.toHaveBeenCalled();
		},
	);

	it( 'does not start PostHog when the config carries no enabled flag', () => {
		const posthog = loadWith( { key: KEY, host: HOST } );

		expect( posthog.init ).not.toHaveBeenCalled();
	} );

	it( 'does not start PostHog when the page has no config at all', () => {
		const posthog = loadWith( undefined );

		expect( posthog.init ).not.toHaveBeenCalled();
	} );

	it( 'still needs a key and a host after an opt-in', () => {
		expect( loadWith( { host: HOST, enabled: '1' } ).init ).not.toHaveBeenCalled();
		expect( loadWith( { key: KEY, enabled: '1' } ).init ).not.toHaveBeenCalled();
	} );

	it( 'registers the site properties once started', () => {
		const properties = { plugin_version: '2.3.2' };
		const posthog = loadWith( { key: KEY, host: HOST, enabled: '1', properties } );

		expect( posthog.register ).toHaveBeenCalledWith( properties );
	} );
} );
