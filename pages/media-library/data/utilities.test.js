/**
 * Internal dependencies
 */
import { getAllMediaCountRequest } from './utilities';

const AJAX_URL = 'http://localhost/wp-admin/admin-ajax.php';

describe( 'getAllMediaCountRequest', () => {
	beforeEach( () => {
		global.wp = { ajax: { settings: { url: '/wp-admin/admin-ajax.php' } } };
		window.history.replaceState( {}, '', '/wp-admin/upload.php' );
	} );

	afterEach( () => {
		delete global.wp;
	} );

	it( 'counts exact MIME types through query-attachments, never media_type', () => {
		// The caption picker in the video editor's Transcription tab.
		expect( getAllMediaCountRequest( [ 'text/vtt', 'application/x-subrip', 'text/plain' ] ) ).toEqual( {
			url: AJAX_URL,
			params: {
				action: 'query-attachments',
				'query[post_mime_type]': 'text/vtt,application/x-subrip,text/plain',
				'query[posts_per_page]': 1,
			},
		} );
	} );

	it( 'keeps whole types on the REST route as media_type', () => {
		expect( getAllMediaCountRequest( 'video' ) ).toEqual( {
			url: 'wp/v2/media',
			params: { _fields: 'id', per_page: 1, media_type: [ 'video' ] },
		} );
		expect( getAllMediaCountRequest( [ 'image' ] ).params.media_type ).toEqual( [ 'image' ] );
	} );

	it( 'splits and trims a comma-separated string', () => {
		// The media grid's Documents filter and the `post_mime_type` URL param arrive as one string.
		expect( getAllMediaCountRequest( 'application/pdf, application/msword' ).params ).toEqual( {
			action: 'query-attachments',
			'query[post_mime_type]': 'application/pdf,application/msword',
			'query[posts_per_page]': 1,
		} );
	} );

	it( 'sends a mix of whole and exact types to query-attachments together', () => {
		expect( getAllMediaCountRequest( [ 'image', 'application/pdf' ] ).params[ 'query[post_mime_type]' ] ).toBe( 'image,application/pdf' );
	} );

	it( 'asks the REST route for everything when there is no filter', () => {
		const everything = { url: 'wp/v2/media', params: { _fields: 'id', per_page: 1 } };
		expect( getAllMediaCountRequest( undefined ) ).toEqual( everything );
		expect( getAllMediaCountRequest( '' ) ).toEqual( everything );
		expect( getAllMediaCountRequest( [ '' ] ) ).toEqual( everything );
	} );

	it( 'reads the open media frame when called with no argument', () => {
		const props = { get: () => [ 'text/vtt', 'application/x-subrip', 'text/plain' ] };
		global.wp.media = { frame: { state: () => ( { get: () => ( { props } ) } ) } };

		expect( getAllMediaCountRequest().params[ 'query[post_mime_type]' ] ).toBe( 'text/vtt,application/x-subrip,text/plain' );
	} );

	it( 'reads the post_mime_type URL param when called with no argument', () => {
		window.history.replaceState( {}, '', '/wp-admin/upload.php?post_mime_type=application/pdf' );

		expect( getAllMediaCountRequest().params[ 'query[post_mime_type]' ] ).toBe( 'application/pdf' );
	} );
} );
