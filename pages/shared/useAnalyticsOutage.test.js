/**
 * Unit tests for useAnalyticsOutage: the analytics-unreachable card must appear
 * once the primary request fails, STAY up while "Try again" is in flight (RTK
 * clears isError the moment a refetch starts), and go away only once a request
 * succeeds.
 *
 * Mounted into a jsdom container with react-dom/client + act, the pattern used by
 * LayerInteractionFunnel.test.js (@testing-library/react is not installed here).
 *
 * @package
 */

/**
 * External dependencies
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Internal dependencies
 */
import useAnalyticsOutage, { getAnalyticsErrorCode } from './useAnalyticsOutage';

global.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Mount a probe that runs the hook, and return helpers to re-render it with new
 * query state and read the latest result.
 *
 * @param {Object} query Initial query state.
 * @return {{update: Function, result: Function, unmount: Function}} Helpers.
 */
function mountOutage( query ) {
	let latest = null;
	const Probe = ( props ) => {
		latest = useAnalyticsOutage( props );
		return null;
	};
	const container = document.createElement( 'div' );
	document.body.appendChild( container );
	const root = createRoot( container );
	const update = ( next ) => act( () => {
		root.render( <Probe { ...next } /> );
	} );
	update( query );

	return {
		update,
		result: () => latest,
		unmount: () => {
			act( () => root.unmount() );
			container.remove();
		},
	};
}

const MICROSERVICE_ERROR = { status: 'error', errorType: 'microservice_error', message: 'Could not load the analytics history.' };

describe( 'getAnalyticsErrorCode', () => {
	it( 'prefers the errorType the plugin route returned', () => {
		expect( getAnalyticsErrorCode( MICROSERVICE_ERROR, undefined ) ).toBe( 'microservice_error' );
		expect( getAnalyticsErrorCode( undefined, { status: 500, data: { errorType: 'microservice_error' } } ) ).toBe( 'microservice_error' );
	} );

	it( 'falls back to the HTTP or fetch status', () => {
		expect( getAnalyticsErrorCode( undefined, { status: 502 } ) ).toBe( '502' );
		expect( getAnalyticsErrorCode( undefined, { status: 'FETCH_ERROR' } ) ).toBe( 'FETCH_ERROR' );
	} );

	it( 'returns an empty string when nothing is known', () => {
		expect( getAnalyticsErrorCode( undefined, undefined ) ).toBe( '' );
	} );
} );

describe( 'useAnalyticsOutage', () => {
	it( 'stays hidden during the first load', () => {
		const probe = mountOutage( { enabled: true, isError: false, isFetching: true, data: undefined } );
		expect( probe.result().unreachable ).toBe( false );
		expect( probe.result().checking ).toBe( false );
		probe.unmount();
	} );

	it( 'shows once the request fails, with the time and error code', () => {
		const probe = mountOutage( { enabled: true, isError: false, isFetching: true, data: undefined } );
		probe.update( { enabled: true, isError: true, isFetching: false, data: undefined, error: { status: 502 } } );

		expect( probe.result().unreachable ).toBe( true );
		expect( probe.result().checking ).toBe( false );
		expect( probe.result().lastChecked ).toBeInstanceOf( Date );
		expect( probe.result().errorCode ).toBe( '502' );
		probe.unmount();
	} );

	it( 'treats a 200 body with errorType microservice_error as an outage', () => {
		const probe = mountOutage( { enabled: true, isError: false, isFetching: false, data: MICROSERVICE_ERROR } );
		expect( probe.result().unreachable ).toBe( true );
		expect( probe.result().errorCode ).toBe( 'microservice_error' );
		probe.unmount();
	} );

	it( 'stays up while a retry is in flight, even though RTK clears isError', () => {
		const probe = mountOutage( { enabled: true, isError: true, isFetching: false, data: undefined, error: { status: 502 } } );
		probe.update( { enabled: true, isError: false, isFetching: true, data: undefined, error: undefined } );

		expect( probe.result().unreachable ).toBe( true );
		expect( probe.result().checking ).toBe( true );
		probe.unmount();
	} );

	it( 'goes away once a retry succeeds', () => {
		const probe = mountOutage( { enabled: true, isError: true, isFetching: false, data: undefined, error: { status: 502 } } );
		probe.update( { enabled: true, isError: false, isFetching: true, data: undefined } );
		probe.update( { enabled: true, isError: false, isFetching: false, data: { status: 'success' } } );

		expect( probe.result().unreachable ).toBe( false );
		expect( probe.result().checking ).toBe( false );
		probe.unmount();
	} );

	it( 'never shows for a disconnected or skipped site', () => {
		const probe = mountOutage( { enabled: false, isError: true, isFetching: false, data: MICROSERVICE_ERROR } );
		expect( probe.result().unreachable ).toBe( false );
		probe.unmount();
	} );
} );
