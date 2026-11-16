/**
 * Unit tests for TrialDaysNotice: the GoDAM dashboard says how many trial days are left
 * (#114), and stays quiet for anything that isn't a usable trial with a known end.
 *
 * @package
 */

/**
 * External dependencies
 */
import { act } from 'react';

/**
 * WordPress dependencies
 */
import { createRoot } from '@wordpress/element';

/**
 * Internal dependencies
 */
import TrialDaysNotice, { trialMessage } from './TrialDaysNotice';

const TRIAL = {
	connectionStatus: 'trial',
	validApiKey: true,
	trialDaysLeft: 5,
	renewalUrl: 'https://app.godam.io/godam_upgrade?organization=acme&wp_return=x',
};

let container;
let root;

/**
 * Mount the notice (Notice uses hooks, so it needs a real render) and return its HTML.
 *
 * @param {Object|undefined} userData The localized user data.
 *
 * @return {string} What it rendered.
 */
const render = ( userData ) => {
	act( () => root.render( <TrialDaysNotice userData={ userData } /> ) );

	return container.innerHTML;
};

describe( 'TrialDaysNotice', () => {
	beforeAll( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
	} );

	beforeEach( () => {
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
	} );

	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
	} );

	it( 'says how many days are left, with an upgrade link', () => {
		const html = render( TRIAL );

		expect( html ).toContain( 'Your GoDAM trial ends in 5 days.' );
		expect( html ).toContain( 'href="https://app.godam.io/godam_upgrade?organization=acme&amp;wp_return=x"' );
		expect( html ).toContain( 'godam-dashboard-notice-trial-days' );
		expect( html ).toContain( '↗' );
		expect( html ).toMatch( /<\/a>\./ );
	} );

	it( 'reads the days left as wp_localize_script() sends them, as strings', () => {
		const html = render( { ...TRIAL, trialDaysLeft: '5', validApiKey: '1' } );

		expect( html ).toContain( 'Your GoDAM trial ends in 5 days.' );
		expect( render( { ...TRIAL, trialDaysLeft: '0', validApiKey: '1' } ) ).toContain( 'Your GoDAM trial ends today.' );
	} );

	it( 'counts one day in the singular and says when it ends today', () => {
		expect( trialMessage( 1 ) ).toBe( 'Your GoDAM trial ends in 1 day.' );
		expect( trialMessage( 0 ) ).toBe( 'Your GoDAM trial ends today.' );
	} );

	it( 'is a warning in the last three days, information before that', () => {
		expect( render( { ...TRIAL, trialDaysLeft: 3 } ) ).toContain( 'is-warning' );
		expect( render( TRIAL ) ).toContain( 'is-info' );
	} );

	it.each( [
		[ 'a paid plan', { connectionStatus: 'connected' } ],
		[ 'an expired plan', { connectionStatus: 'expired' } ],
		[ 'a trial whose key this site can\'t use', { validApiKey: false } ],
		[ 'a trial with no end date from Central', { trialDaysLeft: null } ],
		[ 'a trial with no end date, as an empty string', { trialDaysLeft: '' } ],
		[ 'a key that doesn\'t work, as wp_localize_script() sends false', { validApiKey: '' } ],
		[ 'no user data', null ],
	] )( 'shows nothing for %s', ( _label, override ) => {
		expect( render( null === override ? {} : { ...TRIAL, ...override } ) ).toBe( '' );
	} );

	it( 'never links to anything but http(s)', () => {
		// eslint-disable-next-line no-script-url
		const html = render( { ...TRIAL, renewalUrl: 'javascript:alert(1)' } );

		expect( html ).toContain( 'Your GoDAM trial ends in 5 days.' );
		expect( html ).not.toContain( '<a ' );
	} );
} );
