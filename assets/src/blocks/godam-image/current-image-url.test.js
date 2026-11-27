/**
 * Internal dependencies
 */
import { getCurrentImageUrl, isAttachmentImageUrl } from './current-image-url';

const LOCAL_URL = 'https://example.test/wp-content/uploads/2026/11/photo.png';

/**
 * An attachment record as the REST API returns it.
 *
 * @param {string} sourceUrl The attachment's current URL.
 * @param {string} file      `media_details.file`.
 * @return {Object} Attachment record.
 */
const media = ( sourceUrl, file = '2026/11/photo.png' ) => ( {
	source_url: sourceUrl,
	media_details: { file },
} );

describe( 'getCurrentImageUrl', () => {
	it( 'shows the CDN copy when the block saved the local file', () => {
		expect( getCurrentImageUrl( LOCAL_URL, media( 'https://abc.gdcdn.us/xyz/photo.webp?v=v1' ) ) )
			.toBe( 'https://abc.gdcdn.us/xyz/photo.webp?v=v1' );
	} );

	it( 'shows the replaced version when the block saved an older one', () => {
		expect( getCurrentImageUrl( 'https://abc.gdcdn.us/xyz/photo.webp?v=v2', media( 'https://abc.gdcdn.us/xyz/photo.webp?v=v3' ) ) )
			.toBe( 'https://abc.gdcdn.us/xyz/photo.webp?v=v3' );
	} );

	it( 'shows the replacement when it has another file name', () => {
		expect( getCurrentImageUrl( 'https://abc.gdcdn.us/xyz/old-name.webp?v=v1', media( 'https://abc.gdcdn.us/xyz/new-name.webp?v=v2', '2026/11/old-name.png' ) ) )
			.toBe( 'https://abc.gdcdn.us/xyz/new-name.webp?v=v2' );
	} );

	it( 'shows the current URL when the site moved to another domain', () => {
		expect( getCurrentImageUrl( 'https://old-domain.test/wp-content/uploads/2026/11/photo.png', media( LOCAL_URL ) ) )
			.toBe( LOCAL_URL );
	} );

	it( 'decodes the ampersands GoDAM\'s URL filter escapes', () => {
		expect( getCurrentImageUrl( LOCAL_URL, media( 'https://abc.gdcdn.us/xyz/photo.webp?v=v2&#038;w=1' ) ) )
			.toBe( 'https://abc.gdcdn.us/xyz/photo.webp?v=v2&w=1' );
	} );

	it.each( [
		[ 'while the attachment is loading', undefined ],
		[ 'when the attachment is gone', null ],
		[ 'when the attachment has no URL', { media_details: { file: '2026/11/photo.png' } } ],
	] )( 'keeps the saved URL %s', ( name, record ) => {
		expect( getCurrentImageUrl( LOCAL_URL, record ) ).toBe( LOCAL_URL );
	} );

	it( 'keeps the saved URL of a block copied from another site', () => {
		expect( getCurrentImageUrl( 'https://staging.test/wp-content/uploads/2026/11/hero.png', media( 'https://abc.gdcdn.us/p1/product.webp', '2026/10/product.jpg' ) ) )
			.toBe( 'https://staging.test/wp-content/uploads/2026/11/hero.png' );
	} );
} );

describe( 'isAttachmentImageUrl', () => {
	it( 'is false for a file in another folder on the same CDN host', () => {
		expect( isAttachmentImageUrl( 'https://abc.gdcdn.us/h7/hero.webp', media( 'https://abc.gdcdn.us/p1/product.webp', '2026/10/product.jpg' ) ) )
			.toBe( false );
	} );

	it( 'is false when only the end of the file name matches', () => {
		expect( isAttachmentImageUrl( 'https://staging.test/wp-content/uploads/2026/11/my-photo.png', media( LOCAL_URL ) ) )
			.toBe( false );
	} );

	it( 'is false for another upload in the same month folder while the local file is shown', () => {
		expect( isAttachmentImageUrl( 'https://example.test/wp-content/uploads/2026/11/other.png', media( LOCAL_URL ) ) )
			.toBe( false );
	} );

	it( 'is false for a URL that is not absolute', () => {
		expect( isAttachmentImageUrl( '/wp-content/uploads/2026/11/photo.png', media( LOCAL_URL ) ) ).toBe( false );
	} );

	it( 'matches the CDN folder when the attachment has no file name', () => {
		expect( isAttachmentImageUrl( 'https://abc.gdcdn.us/xyz/photo.webp?v=v1', { source_url: 'https://abc.gdcdn.us/xyz/photo.webp?v=v2' } ) )
			.toBe( true );
	} );
} );
