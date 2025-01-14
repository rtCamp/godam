/**
 * External dependencies
 */
import DOMPurify from 'isomorphic-dompurify';

const AttachmentDetailsTwoColumn = wp?.media?.view?.Attachment?.Details?.TwoColumn;

export default AttachmentDetailsTwoColumn?.extend( {
	initialize() {
		this.getExifDetails( this.model.get( 'id' ) ).then( ( data ) => {
			this.renderExifDetails( data.data );
		} );
	},

	async getExifDetails( attachmentId ) {
		if ( ! attachmentId ) {
			return null;
		}

		try {
			const response = await fetch(
				`${ window.location.origin }/wp-json/easydam/v1/media-library/get-exif-data?attachment_id=${ attachmentId }`,
				{
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.wpApiSettings?.nonce || '',
					},
				} );

			if ( ! response.ok ) {
				throw new Error( `HTTP error! Status: ${ response.status }` );
			}

			const data = await response.json();

			return data;
		} catch ( error ) {
			return null;
		}
	},

	renderExifDetails( data ) {
		if ( ! data ) {
			return;
		}

		let exifDiv = '<div class="exif-details"><h4>EXIF Data Details</h4><ul>';

		Object.entries( data ).forEach( ( [ key, value ] ) => {
			exifDiv += `<li><strong>${ key }: </strong>${ value }</li>`;
		} );

		exifDiv += '</ul></div>';

		this.$el.find( '.details' ).append( DOMPurify.sanitize( exifDiv ) );
	},

} );
