/**
 * File to add upload src URL for fluent forms handling.
 */
/**
 * class FluentForms.
 */
class FluentForms {
	constructor( wrapperSelector = '.ff-godam-recorder-wrapper' ) {
		this.wrappers = document.querySelectorAll( wrapperSelector );
		if ( ! this.wrappers.length ) {
			return;
		}

		this.recorderFluentForms = window?.RecorderFluentForms ?? {};
		this.ajaxUrl = this.recorderFluentForms?.ajaxUrl ?? '';
		this.nonce = this.recorderFluentForms?.nonce ?? '';
		this.uploadAction = this.recorderFluentForms?.uploadAction;

		this.init();
	}

	init() {
		this.wrappers.forEach( ( wrapper ) => {
			const fileInput = wrapper.querySelector( 'input[type="file"]' );

			if ( ! fileInput ) {
				return;
			}

			const uploadedList = wrapper.querySelector(
				'.ff-uploaded-list.godam-recorder',
			);

			fileInput.addEventListener( 'change', ( e ) =>
				this.handleFileUpload( e, uploadedList ),
			);
		} );
	}

	handleFileUpload( event, uploadedList ) {
		const file = event.target.files[ 0 ];
		if ( ! file ) {
			return;
		}

		const formData = new FormData();

		// Add the file.
		formData.append( 'ff-godam-input-recorder', file );

		// Add nonce or action if needed for WordPress
		formData.append( 'action', this.uploadAction );
		formData.append( 'nonce', this.nonce );

		this.sendAjax( formData, uploadedList );
	}

	/**
	 * Send the Ajax request to upload the file to temp folder.
	 *
	 * @param {*} formData     Form Data.
	 * @param {*} uploadedList Uploaded list.
	 */
	sendAjax( formData, uploadedList ) {
		fetch( this.ajaxUrl, {
			method: 'POST',
			body: formData,
		} )
			.then( ( response ) => response.json() )
			.then( ( responseData ) => {
				if ( responseData.success && responseData.data && responseData.data[ 0 ].url ) {
					this.updateUploadedList( responseData.data[ 0 ].url, uploadedList );
				}
			} )
			.catch( () => {
				// Catch error.
			} );
	}

	/**
	 * Update the uploaded list with src URL.
	 *
	 * @param {*} fileUrl      Uploaded file URL.
	 * @param {*} uploadedList Uploaded list.
	 */
	updateUploadedList( fileUrl, uploadedList ) {
		if ( ! uploadedList ) {
			return;
		}

		const previewElement = uploadedList.querySelector( '.ff-upload-preview' );
		if ( previewElement ) {
			previewElement.setAttribute( 'data-src', fileUrl );
		}
	}
}

// Initialize after DOM is ready
document.addEventListener( 'DOMContentLoaded', () => {
	new FluentForms();
} );
