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

	/**
	 * Validate the file with FluentForms.
	 *
	 * @param {*} event File change event.
	 */
	validateFile( event ) {
		const file = event.target.files[ 0 ];
		const formInstance = event.target.dataset.formInstance;
		const name = event.target.name;
		const fileSize = file.size;
		const fileName = file.name;
		const fluentFormInstance = window[ formInstance ];

		if ( ! fluentFormInstance ) {
			return false;
		}

		const validationErrors = [];

		const allowedFileType = fluentFormInstance.rules[ name ].allowed_file_types;
		const maxFileSize = fluentFormInstance.rules[ name ].max_file_size;

		if ( maxFileSize.value < fileSize ) {
			validationErrors.push( maxFileSize.message );
		}

		if ( allowedFileType ) {
			const acceptFileTypes = new RegExp(
				'(' + allowedFileType.value.join( '|' ) + ')',
				'i',
			);
			let fileExt = fileName.split( '.' ).pop();
			fileExt = fileExt.toLowerCase();
			if ( ! acceptFileTypes.test( fileExt ) ) {
				validationErrors.push( allowedFileType.message );
			}
		}

		return validationErrors;
	}

	/**
	 * Show the validation error.
	 *
	 * @param {*} uploadedDivList
	 * @param {*} validationError
	 */
	showValidationError( uploadedDivList, validationError ) {
		const parentElement = uploadedDivList.parentElement;

		if ( parentElement ) {
			parentElement.classList.add( 'ff-el-is-error' );

			validationError.forEach( ( item, index ) => {
				const div = document.createElement( 'div' );
				div.classList.add( 'error', 'text-danger' );
				div.style.marginBottom = '8px';
				div.innerText = item;

				setTimeout( () => {
					parentElement.appendChild( div );
				}, 10 * index );
			} );
		}
	}

	handleFileUpload( event, uploadedList ) {
		const file = event.target.files[ 0 ];
		if ( ! file ) {
			return;
		}

		const validatedFileData = this.validateFile( event );

		if ( ! validatedFileData || 0 !== validatedFileData.length ) {
			this.showValidationError( uploadedList, validatedFileData );
			return validatedFileData;
		}

		const formId = event.target.dataset.formId;

		if ( ! formId ) {
			return;
		}

		const formData = new FormData();

		// Add the file.
		formData.append( 'ff-godam-input-recorder', file );
		formData.append( 'ff-form-id', formId );

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
				} else if ( responseData.error ) {
					this.showValidationError( uploadedList, responseData.error );
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
