/* global jQuery */
/**
 * External dependencies
 */
import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import Webcam from '@uppy/webcam';
import ScreenCapture from '@uppy/screen-capture';
import Audio from '@uppy/audio';
import GoldenRetriever from '@uppy/golden-retriever';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

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
		this.maxDurationSeconds = Number( container.getAttribute( 'data-max-duration' ) ) || 0;
		this.enabledSelectors =
			container.getAttribute( 'data-file-selectors' ) ||
			'webcam,screen_capture';
		this.selectorArray = this.enabledSelectors.split( ',' );

		this.fileInput = document.getElementById( this.inputId );
		this.uploadButton = container.querySelector( `#${ this.uploadButtonId }` );

		// Uppy target for forms used inside godam video.
		this.uppyModalTarget = document.getElementById( 'uppy-godam-video-modal-container' );
		this.uppyModalTargetId = null !== this.uppyModalTarget ? this.uppyModalTarget.id ?? '' : '';

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
	 * Gets the duration of a media file in seconds.
	 * @param {File} file - The media file.
	 * @return {Promise<number>} A promise that resolves with the duration in seconds.
	 */
	async getMediaDurationSeconds( file ) {
		// Only for audio/video
		const isAudio = file?.type?.startsWith( 'audio/' );
		const isVideo = file?.type?.startsWith( 'video/' );
		if ( ! isAudio && ! isVideo ) {
			return 0;
		}

		const el = document.createElement( isAudio ? 'audio' : 'video' );
		el.preload = 'metadata';

		return await new Promise( ( resolve ) => {
			const cleanup = () => {
				try {
					URL.revokeObjectURL( el.src );
				} catch ( e ) {
					// ignore
				}
				el.remove();
			};

			el.onloadedmetadata = () => {
				let d = Number( el.duration );

				if ( d === Infinity ) {
					el.currentTime = 1e101; // force duration to resolve in some browsers
					el.ontimeupdate = () => {
						el.ontimeupdate = null;
						d = Number( el.duration );

						cleanup();
						resolve( Number.isFinite( d ) ? d : 0 );
					};
					return;
				}

				cleanup();
				resolve( Number.isFinite( d ) ? d : 0 );
			};

			el.onerror = () => {
				cleanup();
				resolve( 0 );
			};

			try {
				el.src = URL.createObjectURL( file.data );
			} catch ( e ) {
				cleanup();
				resolve( 0 );
			}
		} );
	}

	/**
	 * Shows a snackbar with a message and optional callback when the snackbar is removed.
	 * @param {string}             message          - The message to be displayed in the snackbar.
	 * @param {Function | boolean} [callback=false] - A callback function to be called when the snackbar is removed, or false to disable the callback.
	 */
	showGodamSnackbar( message, callback = false ) {
		let snackbar = document.getElementById( 'godam-snackbar' );
		if ( ! snackbar ) {
			snackbar = document.createElement( 'div' );
			snackbar.id = 'godam-snackbar';
			snackbar.style.cssText = `
                min-width: 250px;
                background: #cc1818;
                color: #fff;
                text-align: center;
                border-radius: 4px;
                padding: 16px;
                position: fixed;
                right: 40px;
                bottom: 35px;
                z-index: 999999;
                font-size: 14px;`;
			document.body.appendChild( snackbar );
		}
		snackbar.textContent = message;
		snackbar.className = 'show';
		setTimeout( () => {
			snackbar.remove();
			if ( callback && typeof callback === 'function' ) {
				callback();
			}
		}, 10000 );
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
			const wpForms = document.querySelector( 'div.wpforms-confirmation-container-full, div.wpforms-confirmation-container' );
			const everestForms = document.querySelector( 'div.everest-forms-notice.everest-forms-notice--success' );

			/**
			 * If any of the forms have confirmation, remove uppy state.
			 */
			const removeUppyState = gravityForms || sureForms || fluentForms || wpForms || everestForms;

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
		let allowedFileTypes = [ ];
		if ( this.selectorArray.includes( 'audio' ) && ( this.selectorArray.includes( 'webcam' ) || this.selectorArray.includes( 'screen_capture' ) ) ) {
			allowedFileTypes = [ 'video/*', 'audio/*' ];
		} else if ( this.selectorArray.includes( 'audio' ) ) {
			allowedFileTypes = [ 'audio/*' ];
		} else {
			allowedFileTypes = [ 'video/*' ];
		}

		return new Uppy( {
			id: `uppy-${ this.inputId }-${ this.uploadButtonId }`,
			autoProceed: false,
			restrictions: {
				maxNumberOfFiles: 1,
				allowedFileTypes,
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
				target: this.uppyModalTargetId ? `#${ this.uppyModalTargetId }` : 'body',
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

		// Optional Audio recording support.
		if ( this.selectorArray.includes( 'audio' ) ) {
			this.uppy.use( Audio, {
				showRecordingLength: true,
			} );
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
		this.uppy.on( 'file-added', async ( file ) => {
			if ( this.maxDurationSeconds > 0 ) {
				const duration = await this.getMediaDurationSeconds( file );

				// If we could read duration and it exceeds limit -> reject
				if ( duration > 0 && duration > this.maxDurationSeconds ) {
					/* translators: %d: Maximum allowed duration in seconds */
					const msg = __( 'Maximum allowed duration is %d seconds. Please upload or record a shorter file.', 'godam' ).replace( '%d', this.maxDurationSeconds );
					this.showGodamSnackbar( msg );

					// Remove from uppy and clear UI
					this.uppy.removeFile( file.id );
					this.clearVideoUploadUI();
					await this.uppy.getPlugin( 'Dashboard' ).closeModal();

					return;
				}
			}

			this.processVideoUpload( file, 'added' );
			await this.uppy.getPlugin( 'Dashboard' ).closeModal();
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

		// Create an audio preview.
		if ( previewElement && file.type.startsWith( 'audio/' ) ) {
			const audioPreview = document.createElement( 'audio' );
			audioPreview.controls = true;
			audioPreview.style.width = '100%';
			audioPreview.src = URL.createObjectURL( file.data );
			previewElement.innerHTML = '';
			previewElement.appendChild( audioPreview );
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
		} else if ( file.source === 'Audio' ) {
			// Convert blob data to a File object with correct type.
			const fileName = file.name || 'audio.webm';
			const fileType = file.type || 'audio/webm';
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
				'godamFormInputchange',
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
				'godamFormInputchange',
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

	// Timeout added to allow DOM updates to settle.
	setTimeout( () => {
		document.querySelectorAll( '.uppy-video-upload' ).forEach( ( container ) => {
			new UppyVideoUploader( container );
		} );
	}, 100 );
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

	/**
	 * WPForms confirmation.
	 */
	jQuery( document ).on( 'wpformsAjaxSubmitSuccess', function() {
		UppyVideoUploader.clearUppyStateIfConfirmed();
	} );

	/**
	 * Everest Forms confirmation.
	 */
	jQuery( document ).on( 'everest_forms_ajax_submission_success', function() {
		UppyVideoUploader.clearUppyStateIfConfirmed();

		// Clear the local storage data for Everest Forms.
		localStorage.removeItem( 'godam-evf-recorder-data' );
	} );
} );
