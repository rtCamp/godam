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

	displayNotice( noticeHTML ) {
		// Check if the notice element exists.
		const noticeElement = document.querySelector( '#godam-transcoding-notice' );

		if ( noticeElement ) {
			return;
		}

		const container = document.querySelector( '#wpbody-content .wrap .wp-header-end' );

		// Prepend the notice to the container.
		if ( container ) {
			container.insertAdjacentHTML( 'afterend', noticeHTML );
		}

		// Make the notice dismissible.
		const dismissButton = document.querySelector( '#godam-transcoding-notice .notice-dismiss' );
		if ( dismissButton ) {
			dismissButton.addEventListener( 'click', () => {
				const notice = document.querySelector( '#godam-transcoding-notice' );
				if ( notice ) {
					notice.remove();
				}
			} );
		}
	}

	updateCallback( data ) {
		Object.keys( data ).forEach( ( key ) => {
			const statusElement = document.querySelector( `#span_status${ key }` );
			const checkStatusElement = document.querySelector( `#btn_check_status${ key }` );

			if ( data[ key ].status === 'failed' ) {
				statusElement.textContent = 'Transcoding failed, please try again.';
				statusElement.style.display = 'block';
				checkStatusElement.style.display = 'none';

				const errorMessage = 'Looks like you are using CDN services that offload media from your WordPress server to CDN or cloud storage. <a href="" target="_blank">Click here</a> to troubleshoot this issue.';

				const noticeHTML = `
					<div id="godam-transcoding-notice" class="notice notice-error is-dismissible">
						<p>${ errorMessage }</p>
						<button type="button" class="notice-dismiss">
							<span class="screen-reader-text">Dismiss this notice.</span>
						</button>
					</div>
				`;

				this.displayNotice( noticeHTML );

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
