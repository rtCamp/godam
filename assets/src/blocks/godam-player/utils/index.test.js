/**
 * Internal dependencies
 */
import { getFileNameFromUrl, isFilenameLikeTitle } from './index';

describe( 'isFilenameLikeTitle', () => {
	it.each( [
		[ 'product-demo_v2', '' ],
		[ 'my-video-final', '' ],
		[ 'final_cut_FINAL', '' ],
		[ 'Mike-was-impressed-by-Harvey_s-influence', '' ],
		[ 'IMG_2041', '' ],
		[ 'DSC-0001', '' ],
		[ 'VID_20240115', '' ],
		[ 'IMG2041.mp4', '' ],
		[ 'clip.MOV', '' ],
	] )( 'flags "%s" (2+ separators, camera-style name or file extension, no spaces)', ( title, fileName ) => {
		expect( isFilenameLikeTitle( title, fileName ) ).toBe( true );
	} );

	it.each( [
		'Spider-Man',
		'COVID-19',
		'e-commerce',
		'Add-ons',
		'Q3_review',
		'Self-hosting',
		'Paris-2024',
		'Euro-2024',
		'CES-2025',
	] )( 'does not flag the real one-separator title "%s"', ( title ) => {
		expect( isFilenameLikeTitle( title ) ).toBe( false );
	} );

	it( 'flags a title WordPress made from the uploaded file name', () => {
		expect(
			isFilenameLikeTitle( 'Screen Recording 2024-01-15 at 10.30.45', 'https://example.test/uploads/Screen-Recording-2024-01-15-at-10.30.45.mov' ),
		).toBe( true );
		expect( isFilenameLikeTitle( 'my video final', 'my_video_final.mp4' ) ).toBe( true );
	} );

	it( 'flags camera-style names', () => {
		[ 'PXL_20240115', 'MVI_0042', 'DJI_0001', 'GOPR0123' ].forEach( ( title ) => {
			expect( isFilenameLikeTitle( title ) ).toBe( true );
		} );
	} );

	it( 'flags a one-separator title when it is the file name', () => {
		expect( isFilenameLikeTitle( 'my-video', 'https://example.test/uploads/my-video.mp4' ) ).toBe( true );
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
