/* global jQuery */
/**
 * External dependencies
 */
import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import Webcam from '@uppy/webcam';
import ScreenCapture from '@uppy/screen-capture';
import GoldenRetriever from '@uppy/golden-retriever';

/**
 * Class to handle Uppy video uploads within Gravity Forms.
 * Supports webcam, screen capture, and local file uploads with preview,
 * localStorage restoration, and integration with existing file input fields.
 */
class UppyVideoUploader {
	/**
	 * Initializes the uploader for a specific container.
	 *
	 * @param {HTMLElement} container - The container element with data-* attributes for config.
	 */
	constructor( container ) {
		this.container = container;
		this.containerId = container.id;
		this.inputId = container.getAttribute( 'data-input-id' );
		this.uploadButtonId = container.getAttribute(
			'data-video-upload-button-id',
		);
		this.maxFileSize = Number( container.getAttribute( 'data-max-size' ) );
		this.enabledSelectors =
			container.getAttribute( 'data-file-selectors' ) ||
			'webcam,screen_capture';
		this.selectorArray = this.enabledSelectors.split( ',' );

		this.fileInput = document.getElementById( this.inputId );
		this.uploadButton = container.querySelector( `#${ this.uploadButtonId }` );

		// If necessary DOM elements are missing, abort initialization.
		if ( ! this.fileInput || ! this.uploadButton ) {
			return;
		}

		// Initialize Uppy and setup event listeners.
		this.uppy = this.initializeUppy();
		this.setupUppyEvents();

		// Attach Gravity Forms AJAX rehydration handler.
		this.setupGravityFormsAjaxHandler();
	}

	/**
	 * Clears the persisted state on form submit confirmations.
	 */
	static clearUppyStateIfConfirmed() {
		setTimeout( () => {
			/**
			 * Get all forms confirmation container.
			 */
			const gravityForms = document.querySelector( 'div[id^=gform_confirmation_message_]' );
			const sureForms = document.querySelector( 'div.srfm-success-box' );
			const fluentForms = document.querySelector( 'div.ff-message-success' );

			/**
			 * If any of the forms have confirmation, remove uppy state.
			 */
			const removeUppyState = gravityForms || sureForms || fluentForms;

			if ( removeUppyState ) {
				Object.keys( localStorage )
					.filter( ( key ) => key.startsWith( 'uppyState:' ) )
					.forEach( ( key ) => localStorage.removeItem( key ) );
			}
		}, 500 );
	}

	/**
	 * Initializes Uppy with restrictions for video uploads.
	 *
	 * @return {Uppy} Configured Uppy instance.
	 */
	initializeUppy() {
		return new Uppy( {
			id: `uppy-${ this.inputId }-${ this.uploadButtonId }`,
			autoProceed: false,
			restrictions: {
				maxNumberOfFiles: 1,
				allowedFileTypes: [ 'video/*' ],
				maxFileSize: this.maxFileSize,
			},
		} );
	}

	/**
	 * Sets up Uppy plugins and event listeners for file management, restoration, and UI updates.
	 */
	setupUppyEvents() {
		const enabledPlugins = [];

		if ( this.selectorArray.includes( 'webcam' ) ) {
			enabledPlugins.push( 'Webcam' );
		}

		if ( this.selectorArray.includes( 'screen_capture' ) ) {
			enabledPlugins.push( 'ScreenCapture' );
		}

		const localFileInput = this.selectorArray.includes( 'file_input' );

		// Configure Uppy Dashboard with plugin support and GoldenRetriever for state restoration.
		this.uppy
			.use( Dashboard, {
				trigger: `#${ this.containerId } #${ this.uploadButtonId }`,
				inline: false,
				closeModalOnClickOutside: true,
				closeAfterFinish: true,
				proudlyDisplayPoweredByUppy: false,
				showProgressDetails: true,
				plugins: enabledPlugins,
				disableLocalFiles: ! localFileInput,
			} )
			.use( GoldenRetriever, { expires: 10 * 60 * 1000 } ); // 10 min persistence.

		// Optional Webcam support.
		if ( this.selectorArray.includes( 'webcam' ) ) {
			this.uppy.use( Webcam, {
				modes: [ 'video-audio' ],
				mirror: false,
				showRecordingLength: true,
				showVideoSourceDropdown: true,
			} );
		}

		// Optional ScreenCapture support.
		if ( this.selectorArray.includes( 'screen_capture' ) ) {
			this.uppy.use( ScreenCapture, { audio: true } );
		}

		// Restore previous upload on reload if persisted.
		this.uppy.on( 'restored', () => {
			const restoredFile = this.uppy.getFiles()?.[ 0 ];
			if ( restoredFile ) {
				this.processVideoUpload( restoredFile, 'restored' );
			} else {
				localStorage.removeItem( 'godam-ff-recorder-data' );
			}
		} );

		// Handle file addition: process video and close modal.
		this.uppy.on( 'file-added', ( file ) => {
			this.processVideoUpload( file, 'added' );
			this.uppy.getPlugin( 'Dashboard' ).closeModal();
		} );

		// Handle modal close without upload: clear UI preview.
		this.uppy.on( 'dashboard:modal-closed', () => {
			const selectedFiles = this.uppy.getFiles();
			if ( ! selectedFiles || selectedFiles.length === 0 ) {
				this.clearVideoUploadUI();
			}
		} );
	}

	/**
	 * Processes the uploaded video, updating preview UI and syncing with file input for submission.
	 *
	 * @param {File}   file   - The uploaded or recorded file from Uppy.
	 * @param {string} action - Restored or file added.
	 */
	processVideoUpload( file, action = 'added' ) {
		const filenameElement = this.container.querySelector(
			'.upp-video-upload-filename',
		);
		const previewElement = this.container.querySelector(
			'.uppy-video-upload-preview',
		);

		// Display the file name.
		if ( filenameElement ) {
			filenameElement.textContent = file.name;
		}

		// Create a video preview.
		if ( previewElement && file.type.startsWith( 'video/' ) ) {
			const videoPreview = document.createElement( 'video' );
			videoPreview.controls = true;
			videoPreview.style.maxWidth = '400px';
			videoPreview.style.width = '100%';
			videoPreview.style.marginTop = '10px';
			videoPreview.src = URL.createObjectURL( file.data );
			previewElement.innerHTML = '';
			previewElement.appendChild( videoPreview );
		}

		// Prepare file for the Gravity Forms file input for submission.
		const dataTransfer = new DataTransfer();

		if ( file.source === 'Webcam' || file.source === 'ScreenCapture' ) {
			// Convert blob data to a File object with correct type.
			const fileName = file.name || 'video.webm';
			const fileType = file.type || 'video/webm';
			const fileBlob = new Blob( [ file.data ], { type: fileType } );
			const fileObject = new File( [ fileBlob ], fileName, {
				...file,
				type: fileType,
				lastModified: Date.now(),
			} );
			dataTransfer.items.add( fileObject );
		} else {
			// For direct uploads, use the provided file data.
			dataTransfer.items.add( file.data );
		}

		this.fileInput.files = dataTransfer.files;
		this.fileInput.dispatchEvent(
			new CustomEvent(
				'godamffchange',
				{
					bubbles: true,
					detail: {
						action,
					},
				},
			),
		);
	}

	/**
	 * Clears the UI state if the user closes the Uppy modal without selecting a file.
	 * Resets the file input, filename, and preview display.
	 */
	clearVideoUploadUI() {
		const filenameElement = this.container.querySelector(
			'.upp-video-upload-filename',
		);
		const previewElement = this.container.querySelector(
			'.uppy-video-upload-preview',
		);
		if ( filenameElement ) {
			filenameElement.textContent = '';
		}
		if ( previewElement ) {
			previewElement.innerHTML = '';
		}
		if ( this.fileInput ) {
			this.fileInput.value = '';
		}

		this.fileInput.dispatchEvent(
			new CustomEvent(
				'godamffchange',
				{
					bubbles: true,
					detail: {
						action: 'clear',
					},
				},
			),
		);
	}

	/**
	 * Sets up the Gravity Forms `gform_post_render` hook to reattach triggers and restore files after AJAX submission.
	 */
	setupGravityFormsAjaxHandler() {
		jQuery( document ).on( 'gform_post_render', ( _, formId ) => {
			const submission = window?.gform?.submission;
			if ( ! submission ) {
				return;
			}

			const form = document.getElementById( `gform_${ formId }` );
			if ( ! form ) {
				return;
			}

			// Skip if submission is POSTBACK (non-AJAX).
			if ( submission.getSubmissionMethod( form ) === submission.SUBMISSION_METHOD_POSTBACK ) {
				return;
			}

			// Skip on initial load, run only after AJAX validation errors.
			const gformWrapper = form.closest( 'div[id^=gform_wrapper_]' );
			if ( ! gformWrapper.classList.contains( 'gform_validation_error' ) ) {
				return;
			}

			this.handleUppyUIOnAjaxRequest();
		} );
	}

	/**
	 * Reattaches Uppy modal open handlers and restores file previews after Gravity Forms AJAX submission.
	 */
	handleUppyUIOnAjaxRequest() {
		const dashboardTrigger = document.getElementById( this.uploadButtonId );

		// Prevent duplicate listeners by checking marker attribute.
		if ( ! dashboardTrigger.getAttribute( 'uppy-click-attached' ) ) {
			dashboardTrigger.addEventListener( 'click', () => {
				this.uppy.getPlugin( 'Dashboard' ).openModal();
			} );
			dashboardTrigger.setAttribute( 'uppy-click-attached', 'true' );
		}

		const restoredFile = this.uppy.getFiles()?.[ 0 ];
		if ( restoredFile ) {
			// Re-render preview on AJAX validation errors.
			this.processVideoUpload( restoredFile, 'restored' );
		}
	}
}

/**
 * Initialize all video uploaders on DOM ready,
 * clearing persisted states if form submission were confirmed.
 */
document.addEventListener( 'DOMContentLoaded', () => {
	UppyVideoUploader.clearUppyStateIfConfirmed();

	document.querySelectorAll( '.uppy-video-upload' ).forEach( ( container ) => {
		new UppyVideoUploader( container );
	} );
} );

/**
 * Clear the uppy state for gform_confirmation_loaded.
 */
jQuery( document ).ready( function() {
	/**
	 * Gravity form confirmation.
	 */
	jQuery( document ).on( 'gform_confirmation_loaded', function() {
		UppyVideoUploader.clearUppyStateIfConfirmed();
	} );

	/**
	 * Sureforms confirmation.
	 */
	jQuery( document ).on( 'srfm_on_show_success_message', function() {
		UppyVideoUploader.clearUppyStateIfConfirmed();
	} );

	jQuery( document ).on( 'fluentform_submission_success', function() {
		UppyVideoUploader.clearUppyStateIfConfirmed();

		/**
		 * Remove the fileURL stored in local storage.
		 */
		localStorage.removeItem( 'godam-ff-recorder-data' );
	} );
} );
