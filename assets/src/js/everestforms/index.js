/**
 * File to add upload src URL for Everest forms handling.
 */

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * class EverestForms.
 */
class EverestForms {
	constructor( wrapperSelector = '.evf-field-godam_record' ) {
		this.wrappers = document.querySelectorAll( wrapperSelector );
		if ( ! this.wrappers.length ) {
			return;
		}

		this.recorderEverestForms = window?.RecorderEverestForms ?? {};
		this.ajaxUrl = this.recorderEverestForms?.ajaxUrl ?? '';
		this.uploadAction = this.recorderEverestForms?.uploadAction;

		this.init();
	}

	init() {
		this.wrappers.forEach( ( wrapper ) => {
			const fileInput = wrapper.querySelector( 'input[type="file"]' );

			if ( ! fileInput ) {
				return;
			}

			const uploadedInput = wrapper.querySelector(
				'.evf-uploaded-list.godam-recorder',
			);

			fileInput.addEventListener( 'godamFormInputchange', ( e ) =>
				this.handleFileUpload( e, uploadedInput ),
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
		const maxSize = event.target.dataset.maxSize;
		const fileSize = file.size / ( 1024 * 1024 ); // Convert bytes to MB.

		const validationErrors = [];

		if ( maxSize < fileSize ) {
			validationErrors.push(
				sprintf(
					// translators: %d: Maximum allowed file size in MB.
					__(
						'File size exceeds the maximum limit of %d MB.',
						'godam',
					),
					maxSize,
				),
			);
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
			validationError.forEach( ( item, index ) => {
				const label = document.createElement( 'label' );
				label.classList.add( 'evf-error' );
				label.style.marginBottom = '8px';
				label.innerText = item;

				setTimeout( () => {
					parentElement.appendChild( label );
				}, 10 * index );
			} );
		}
	}

	handleFileUpload( event, uploadedInput ) {
		const file = event.target.files[ 0 ];

		/**
		 * If we have clear action, remove from local storage as well.
		 */
		if ( 'clear' === event?.detail?.action ) {
			localStorage.removeItem( 'godam-evf-recorder-data' );
		}

		if ( ! file ) {
			return;
		}

		const validatedFileData = this.validateFile( event );

		if ( ! validatedFileData || 0 !== validatedFileData.length ) {
			this.showValidationError( uploadedInput, validatedFileData );
			return validatedFileData;
		}

		this.showFileProgress( uploadedInput );

		/**
		 * If restored use local storage data.
		 */
		if ( 'restored' === event?.detail?.action ) {
			const localStorageItem = localStorage.getItem( 'godam-evf-recorder-data' );
			if ( localStorageItem ) {
				const parsedData = JSON.parse( localStorageItem ?? {} );

				if ( parsedData?.data !== '' && Date.now() < parsedData?.expiresAt ) {
					this.updateUploadedList( parsedData?.data ?? '', uploadedInput );
					this.removeFileProgress();
					return;
				}

				// Remove local storage if not used from restored or expired.
				localStorage.removeItem( 'godam-evf-recorder-data' );
			}
		}

		const formId = event.target.dataset.formId;
		const fieldId = event.target.dataset.fieldId;

		if ( ! formId ) {
			return;
		}

		const formData = new FormData();

		// Add the file.
		formData.append( 'file', file );
		formData.append( 'form_id', formId );
		formData.append( 'field_id', fieldId );

		// Add nonce or action if needed for WordPress
		formData.append( 'action', this.uploadAction );

		this.sendAjax( formData, uploadedInput );
	}

	/**
	 * Send the Ajax request to upload the file to temp folder.
	 *
	 * @param {*} formData      Form Data.
	 * @param {*} uploadedInput Uploaded input.
	 */
	sendAjax( formData, uploadedInput ) {
		fetch( this.ajaxUrl, {
			method: 'POST',
			body: formData,
		} )
			.then( ( response ) => response.json() )
			.then( ( responseData ) => {
				if ( responseData.success && responseData.data ) {
					const stringifyData = JSON.stringify( [ responseData.data ] );
					this.updateUploadedList( stringifyData, uploadedInput );

					/**
					 * Store the file URL in local storage for reload same as uppy.
					 */
					this.storeInLocalStorage( stringifyData );
					this.removeFileProgress( uploadedInput );
				} else {
					this.showValidationError( uploadedInput, [ responseData.data ] );
					this.removeFileProgress( uploadedInput );
				}
			} )
			.catch( () => {
				this.removeFileProgress( uploadedInput );
			} );
	}

	/**
	 * Update the uploaded input with the data.
	 *
	 * @param {*} data          Data.
	 * @param {*} uploadedInput Uploaded input.
	 */
	updateUploadedList( data, uploadedInput ) {
		if ( ! uploadedInput ) {
			return;
		}

		const input = uploadedInput.querySelector( 'input[type="text"]' );
		if ( ! input ) {
			return;
		}

		input.value = data;
	}

	/**
	 * Store the data in local storage for 10 min.
	 *
	 * @param {string} dataToStore Data to store.
	 */
	storeInLocalStorage( dataToStore ) {
		const key = 'godam-evf-recorder-data';
		const data = {
			data: dataToStore,
			expiresAt: Date.now() + ( 10 * 60 * 1000 ),
		};
		localStorage.setItem( key, JSON.stringify( data ) );
	}

	/**
	 * Show file progress div.
	 *
	 * @param {*} uploadedList
	 */
	showFileProgress( uploadedList ) {
		const progressDiv = document.createElement( 'div' );
		progressDiv.classList = 'godam-rec-progress';
		progressDiv.style.fontSize = '11px';
		progressDiv.innerText = __( 'File upload in progress…', 'godam' );

		uploadedList.parentElement.append( progressDiv );
	}

	/**
	 * Remove the progress div on success.
	 */
	removeFileProgress() {
		const progressDiv = document.querySelector( '.godam-rec-progress' );

		if ( progressDiv ) {
			progressDiv.remove();
		}
	}
}

// Initialize after DOM is ready
document.addEventListener( 'DOMContentLoaded', () => {
	new EverestForms();
} );
