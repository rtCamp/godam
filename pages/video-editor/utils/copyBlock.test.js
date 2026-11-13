/**
 * Unit tests for the Media Editor's Copy block helpers.
 *
 * The media details come from core's `wp/v2/media` route through `apiFetch`,
 * which adds the REST nonce (sites that close the route to logged-out requests
 * refuse a request without it). A failed request must not be cached: before,
 * one failed prefetch made every later Copy put a block with no video source on
 * the clipboard for the rest of the session.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { copyGoDAMVideoBlock, prefetchMediaDataForCopy } from './index';

jest.mock( '@wordpress/api-fetch', () => jest.fn() );

const media = ( id ) => ( {
	id,
	source_url: `https://example.test/video-${ id }.mp4`,
	mime_type: 'video/mp4',
	media_details: { width: 1920, height: 1080 },
	meta: {},
} );

describe( 'Copy block helpers', () => {
	let writeText;

	beforeEach( () => {
		apiFetch.mockReset();
		writeText = jest.fn( () => Promise.resolve() );
		Object.defineProperty( window.navigator, 'clipboard', { value: { writeText }, configurable: true } );
	} );

	it( 'reads the media through apiFetch and copies a block with the video source', async () => {
		apiFetch.mockResolvedValue( media( 101 ) );

		await expect( copyGoDAMVideoBlock( 101 ) ).resolves.toBe( true );

		expect( apiFetch ).toHaveBeenCalledWith( { path: '/wp/v2/media/101' } );
		expect( writeText.mock.calls[ 0 ][ 0 ] ).toContain( '"src":"https://example.test/video-101.mp4"' );
	} );

	it( 'reports failure and caches nothing when the media request fails', async () => {
		apiFetch.mockRejectedValueOnce( { code: 'rest_not_logged_in', data: { status: 401 } } );

		await expect( copyGoDAMVideoBlock( 102 ) ).resolves.toBe( false );
		expect( writeText ).not.toHaveBeenCalled();

		apiFetch.mockResolvedValueOnce( media( 102 ) );
		await expect( copyGoDAMVideoBlock( 102 ) ).resolves.toBe( true );

		expect( apiFetch ).toHaveBeenCalledTimes( 2 );
		expect( writeText.mock.calls[ 0 ][ 0 ] ).toContain( '"src":"https://example.test/video-102.mp4"' );
	} );

	it( 'does not let a failed prefetch poison later copies', async () => {
		apiFetch.mockRejectedValueOnce( { code: 'rest_not_logged_in', data: { status: 401 } } );
		await prefetchMediaDataForCopy( 103 );

		apiFetch.mockResolvedValueOnce( media( 103 ) );
		await expect( copyGoDAMVideoBlock( 103 ) ).resolves.toBe( true );

		expect( apiFetch ).toHaveBeenCalledTimes( 2 );
		expect( writeText.mock.calls[ 0 ][ 0 ] ).toContain( '"src":"https://example.test/video-103.mp4"' );
	} );
} );
