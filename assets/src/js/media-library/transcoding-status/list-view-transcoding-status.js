/* global transcoderSettings */

/**
 * Internal dependencies
 */
import TranscodingChecker from './transcoding-checker';

/**
 * Class for the list view transcoding status.
 */
class ListViewTranscodingStatus {
	constructor() {
		this.addEventListeners();
		this.updateCallback = this.updateCallback.bind( this );
		this.checker = new TranscodingChecker( transcoderSettings.restUrl, this.updateCallback );
	}

	addEventListeners() {
		const statusButtons = document.querySelectorAll( '[name="check_status_btn"]' );

		statusButtons.forEach( ( button ) => {
			button.addEventListener( 'click', () => {
				const postId = button.dataset.value;
				this.checker.fetchStatusOnce( [ postId ] );
			} );
		} );
	}

	updateCallback( data ) {
		Object.keys( data ).forEach( ( key ) => {
			const statusElement = document.querySelector( `#span_status${ key }` );
			const checkStatusElement = document.querySelector( `#btn_check_status${ key }` );

			if ( data[ key ].status === 'failed' ) {
				statusElement.textContent = 'Transcoding failed, please try again.';
				statusElement.style.display = 'block';
				checkStatusElement.style.display = 'none';

				return;
			}

			if ( data[ key ].progress === 100 ) {
				checkStatusElement.style.display = 'none';
			}

			statusElement.textContent = data[ key ].message;
			statusElement.style.display = 'block';
		} );
	}
}

export default ListViewTranscodingStatus;
