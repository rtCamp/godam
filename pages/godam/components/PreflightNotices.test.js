/**
 * Unit tests for the settings-page preflight notices: Central's raw diagnostics never
 * reach the site owner.
 */

/**
 * WordPress dependencies
 */
import { renderToString } from '@wordpress/element';

/**
 * Internal dependencies
 */
import PreflightNotices from './PreflightNotices';

jest.mock( '../utils/index.js', () => ( { hasValidAPIKey: true } ) );
// Only the text matters here; the real components pull in a second copy of React.
jest.mock( '@wordpress/components', () => ( {
	Notice: ( { children } ) => <div>{ children }</div>,
	Button: ( { children, href } ) => <a href={ href }>{ children }</a>,
} ) );

const render = ( checks ) => {
	window.userData = { userApiData: { preflight: { checks } } };

	return renderToString( <PreflightNotices /> );
};

describe( 'PreflightNotices', () => {
	it( 'uses Central\'s fix text when it has one', () => {
		const html = render( [ { id: 'check_dns', status: 'fail', label: 'DNS', message: 'socket.gaierror: [Errno -2]', remediation: 'Point your domain at this server.' } ] );

		expect( html ).toContain( 'Point your domain at this server.' );
		expect( html ).not.toContain( 'gaierror' );
	} );

	it( 'falls back to plain copy instead of the raw diagnostic', () => {
		const html = render( [ { id: 'check_future', status: 'warn', label: 'Future check', message: 'Traceback (most recent call last): KeyError' } ] );

		expect( html ).toContain( 'A setup check for this site didn' );
		expect( html ).not.toContain( 'Traceback' );
	} );

	it( 'renders nothing when every check passed', () => {
		expect( render( [ { id: 'check_dns', status: 'pass' } ] ) ).toBe( '' );
	} );
} );
