/**
 * Internal dependencies
 */
import { getMediaRouteTypeParams } from './utilities';

describe( 'getMediaRouteTypeParams', () => {
	it( 'sends exact MIME types as mime_type, never media_type', () => {
		// The caption picker in the video editor's Transcription tab.
		expect( getMediaRouteTypeParams( [ 'text/vtt', 'application/x-subrip', 'text/plain' ] ) ).toEqual( {
			mime_type: [ 'text/vtt', 'application/x-subrip', 'text/plain' ],
		} );
	} );

	it( 'keeps whole types on media_type', () => {
		expect( getMediaRouteTypeParams( 'video' ) ).toEqual( { media_type: [ 'video' ] } );
		expect( getMediaRouteTypeParams( [ 'image' ] ) ).toEqual( { media_type: [ 'image' ] } );
	} );

	it( 'splits a comma-separated string', () => {
		// The media grid's Documents filter and the `post_mime_type` URL param arrive as one string.
		expect( getMediaRouteTypeParams( 'application/pdf, application/msword' ) ).toEqual( {
			mime_type: [ 'application/pdf', 'application/msword' ],
		} );
	} );

	it( 'sends a mix of whole and exact types to both args', () => {
		expect( getMediaRouteTypeParams( [ 'image', 'application/pdf' ] ) ).toEqual( {
			media_type: [ 'image' ],
			mime_type: [ 'application/pdf' ],
		} );
	} );

	it( 'returns no args when there is no filter', () => {
		expect( getMediaRouteTypeParams( undefined ) ).toEqual( {} );
		expect( getMediaRouteTypeParams( '' ) ).toEqual( {} );
		expect( getMediaRouteTypeParams( [] ) ).toEqual( {} );
	} );
} );
