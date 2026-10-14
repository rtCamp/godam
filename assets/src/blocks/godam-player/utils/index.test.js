/**
 * Internal dependencies
 */
import { getFileNameFromUrl, isFilenameLikeTitle } from './index';

describe( 'isFilenameLikeTitle', () => {
	it.each( [
		[ 'product-demo_v2', '' ],
		[ 'IMG_2041', '' ],
		[ 'my-video', '' ],
		[ 'final_cut_FINAL', '' ],
		[ 'IMG2041.mp4', '' ],
		[ 'clip.MOV', '' ],
	] )( 'flags "%s" (hyphens/underscores and no spaces, or a file extension)', ( title, fileName ) => {
		expect( isFilenameLikeTitle( title, fileName ) ).toBe( true );
	} );

	it( 'flags a title that matches the file name, with or without extension', () => {
		expect( isFilenameLikeTitle( 'Intro', 'https://example.test/wp-content/uploads/2026/10/intro.mp4' ) ).toBe( true );
		expect( isFilenameLikeTitle( 'intro.mp4', 'intro.mp4' ) ).toBe( true );
		expect( isFilenameLikeTitle( 'My Clip', 'https://example.test/uploads/My%20Clip.mov?ver=2' ) ).toBe( true );
	} );

	it.each( [
		'How to set up GoDAM',
		'Product demo - part 2',
		'Q3_results review',
		'Intro',
		'',
		'   ',
	] )( 'does not flag "%s"', ( title ) => {
		expect( isFilenameLikeTitle( title, 'https://example.test/uploads/other-file.mp4' ) ).toBe( false );
	} );

	it( 'handles missing values', () => {
		expect( isFilenameLikeTitle( undefined ) ).toBe( false );
		expect( isFilenameLikeTitle( null, null ) ).toBe( false );
	} );
} );

describe( 'getFileNameFromUrl', () => {
	it( 'returns the decoded file name without folders or query string', () => {
		expect( getFileNameFromUrl( 'https://cdn.example.test/a/b/My%20Video.mp4?x=1#t=3' ) ).toBe( 'My Video.mp4' );
		expect( getFileNameFromUrl( 'clip.mov' ) ).toBe( 'clip.mov' );
	} );

	it( 'returns an empty string for empty input', () => {
		expect( getFileNameFromUrl( '' ) ).toBe( '' );
		expect( getFileNameFromUrl( undefined ) ).toBe( '' );
	} );
} );
