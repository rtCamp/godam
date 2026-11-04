/**
 * Unit tests for AnalyticsForbiddenNotice: the notice the Single Video Analytics
 * page shows when the analytics route refuses the video (403), so an Author who
 * opens someone else's video is told why instead of being shown the
 * "analytics is temporarily unavailable" notice.
 *
 * @package
 */

/**
 * WordPress dependencies
 */
import { renderToString } from '@wordpress/element';

// Only the text matters here; the real components pull in a second copy of React.
jest.mock( '@wordpress/components', () => ( {
	Notice: ( { status, children } ) => <div data-status={ status }>{ children }</div>,
} ) );
jest.mock( '../shared/analytics-unavailable.scss', () => ( {} ) );

/**
 * Internal dependencies
 */
import AnalyticsForbiddenNotice, { isAnalyticsForbidden } from './AnalyticsForbiddenNotice';

describe( 'isAnalyticsForbidden', () => {
	it( 'is true only for a 403 rest_forbidden answer', () => {
		expect( isAnalyticsForbidden( { status: 403, data: { code: 'rest_forbidden' } } ) ).toBe( true );
	} );

	it.each( [
		[ 'a server error', { status: 500 } ],
		[ 'a network error', { status: 'FETCH_ERROR', error: 'TypeError: Failed to fetch' } ],
		[ 'a signed-out answer', { status: 401 } ],
		[ 'an expired nonce', { status: 403, data: { code: 'rest_cookie_invalid_nonce' } } ],
		[ 'a 403 with no error code', { status: 403 } ],
		[ 'no error', undefined ],
	] )( 'is false for %s', ( label, error ) => {
		expect( isAnalyticsForbidden( error ) ).toBe( false );
	} );
} );

describe( 'AnalyticsForbiddenNotice', () => {
	it( 'says the user cannot view this video and why', () => {
		const html = renderToString( <AnalyticsForbiddenNotice /> );

		expect( html ).toContain( 'godam-analytics-notice-analytics-forbidden' );
		expect( html ).toContain( 'analytics for this video' );
		expect( html ).toContain( 'only for videos you can edit' );
		expect( html ).toContain( 'data-status="warning"' );
		expect( html ).not.toContain( 'temporarily unavailable' );
	} );
} );
