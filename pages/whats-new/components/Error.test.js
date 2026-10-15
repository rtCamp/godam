/**
 * Unit tests for the What's New error screen.
 *
 * A failed load is a real failure, so it comes with a Contact Support link. The
 * "no new features" state is not an error and gets none.
 *
 * Rendered to a static HTML string so the test asserts the actual output.
 */

/**
 * WordPress dependencies
 */
import { renderToString } from '@wordpress/element';

/**
 * Internal dependencies
 */
import Error from './Error';

describe( 'What\'s New Error', () => {
	it( 'shows the load error with a Contact Support link', () => {
		const html = renderToString( <Error hasError /> );

		expect( html ).toContain( 'Unable to load the latest updates. Please try again later.' );
		expect( html ).toContain( 'data-test-id="godam-whats-new-link-contact-support"' );
		expect( html ).toContain( 'target="_blank"' );
		expect( html ).toContain( 'Contact Support' );
	} );

	it( 'shows no link when there is simply nothing new to show', () => {
		const html = renderToString( <Error hasError={ false } /> );

		expect( html ).toContain( 'There are no new features to display at the moment.' );
		expect( html ).not.toContain( 'Contact Support' );
	} );
} );
