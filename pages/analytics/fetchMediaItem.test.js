/**
 * Unit tests for fetchMediaItem: the Single Video Analytics page's request for
 * the video's details. It must send the REST nonce, or WordPress treats the
 * admin as logged out and sites that close `wp/v2/media` to logged-out
 * visitors answer 401 `rest_not_logged_in`, leaving the page blank.
 *
 * @package
 */

/**
 * External dependencies
 */
import axios from 'axios';

/**
 * Internal dependencies
 */
import fetchMediaItem from './fetchMediaItem';

jest.mock( 'axios', () => ( { get: jest.fn( () => Promise.resolve( { data: {} } ) ) } ) );

describe( 'fetchMediaItem', () => {
	beforeEach( () => {
		axios.get.mockClear();
		window.pathJoin = ( parts ) => parts.join( '' ).replace( /([^:])\/\/+/g, '$1/' );
		window.godamRestRoute = { url: 'https://example.test/wp-json/' };
		delete window.videoData;
		delete window.wpApiSettings;
	} );

	it( 'sends the analytics page nonce with the media request', () => {
		window.videoData = { nonce: 'page-nonce' };
		window.wpApiSettings = { nonce: 'core-nonce' };

		fetchMediaItem( 12 );

		expect( axios.get ).toHaveBeenCalledWith( 'https://example.test/wp-json/wp/v2/media/12', {
			headers: { 'X-WP-Nonce': 'page-nonce' },
		} );
	} );

	it( 'falls back to the core REST nonce when the page nonce is missing', () => {
		window.wpApiSettings = { nonce: 'core-nonce' };

		fetchMediaItem( 7 );

		expect( axios.get.mock.calls[ 0 ][ 1 ].headers[ 'X-WP-Nonce' ] ).toBe( 'core-nonce' );
	} );
} );
