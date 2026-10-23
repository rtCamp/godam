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
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { forgetGravityFormsSavedFile, hasGravityFormsSavedFile } from './gravity-forms-saved-file';

/**
 * Finds the file input and trigger button that belong to a recorder container.
 *
 * The server builds the button id with wp_unique_id(), so a container rendered again carries
 * a different id. Read it from the container every time instead of keeping an earlier value.
 *
 * @param {HTMLElement} container - The recorder container.
 * @return {Object} The input id, button id, file input and button; an element is null when it is missing.
 */
const resolveRecorderMarkup = ( container ) => {
	const inputId = container.getAttribute( 'data-input-id' );
	const uploadButtonId = container.getAttribute( 'data-video-upload-button-id' );

	return {
		inputId,
		uploadButtonId,
		fileInput: document.getElementById( inputId ),
		uploadButton: container.querySelector( `#${ uploadButtonId }` ),
	};
};

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
		this.containerId = container.id;
		this.maxFileSize = Number( container.getAttribute( 'data-max-size' ) );
		this.maxDurationSeconds = Number( container.getAttribute( 'data-max-duration' ) ) || 0;
		this.enabledSelectors =
			container.getAttribute( 'data-file-selectors' ) ||
			'webcam,screen_capture';
		this.selectorArray = this.enabledSelectors.split( ',' );

		this.useMarkup( container, resolveRecorderMarkup( container ) );

		// Uppy target for forms used inside godam video.
		this.uppyModalTarget = document.getElementById( 'uppy-godam-video-modal-container' );
		this.uppyModalTargetId = null !== this.uppyModalTarget ? this.uppyModalTarget.id ?? '' : '';

		// Track the current preview blob URL to revoke it when replaced/cleared.
		this.previewBlobUrl = null;

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
	 * Points the uploader at a container's elements.
	 *
	 * @param {HTMLElement} container - The recorder container the uploader works in.
	 * @param {Object}      markup    - The ids and elements from resolveRecorderMarkup().
	 */
	useMarkup( container, markup ) {
		this.container = container;
		this.inputId = markup.inputId;
		this.uploadButtonId = markup.uploadButtonId;
		this.fileInput = markup.fileInput;
		this.uploadButton = markup.uploadButton;
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
					el.currentTime = Number.MAX_SAFE_INTEGER || 1e101; // force duration to resolve in some browsers
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
		let snackbar = document.getElementById( 'godam-snackbar-error' );
		if ( ! snackbar ) {
			snackbar = document.createElement( 'div' );
			snackbar.id = 'godam-snackbar-error';
			document.body.appendChild( snackbar );
		}
		snackbar.textContent = message;
		snackbar.className = 'godam-snackbar godam-snackbar-error';
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
					const msg = sprintf(
						/* translators: %d: Maximum allowed duration in seconds */
						__( 'Maximum allowed duration is %d seconds. Please upload or record a shorter file.', 'godam' ),
						this.maxDurationSeconds,
					);
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

		// A removed recording must not be submitted from the copy Gravity Forms saved earlier.
		this.uppy.on( 'file-removed', () => {
			forgetGravityFormsSavedFile( this.fileInput );
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
			// Revoke previous blob URL to prevent memory leaks.
			this.revokePreviewBlobUrl();

			const videoPreview = document.createElement( 'video' );
			videoPreview.controls = true;
			videoPreview.style.maxWidth = '400px';
			videoPreview.style.width = '100%';
			videoPreview.style.marginTop = '10px';
			this.previewBlobUrl = URL.createObjectURL( file.data );
			videoPreview.src = this.previewBlobUrl;
			previewElement.innerHTML = '';
			previewElement.appendChild( videoPreview );
		}

		// Create an audio preview.
		if ( previewElement && file.type.startsWith( 'audio/' ) ) {
			// Revoke previous blob URL to prevent memory leaks.
			this.revokePreviewBlobUrl();

			const audioPreview = document.createElement( 'audio' );
			audioPreview.controls = true;
			audioPreview.style.width = '100%';
			this.previewBlobUrl = URL.createObjectURL( file.data );
			audioPreview.src = this.previewBlobUrl;
			previewElement.innerHTML = '';
			previewElement.appendChild( audioPreview );

			// Calculate and set duration for audio files.
			audioPreview.addEventListener( 'loadedmetadata', () => {
				try {
					// Setting currentTime to a large value forces the browser to calculate the actual duration.
					audioPreview.currentTime = Number.MAX_SAFE_INTEGER || 1e101;
					audioPreview.ontimeupdate = () => {
						audioPreview.ontimeupdate = null;
						try {
							audioPreview.currentTime = 0; // reset
						} catch ( e ) {
							// Ignore errors when resetting currentTime.
						}
					};
				} catch ( e ) {
					// Ignore errors - some browsers or audio formats may not support seeking.
				}
			} );
		}

		// Add a remove button for audio and video files.
		if ( previewElement && ( file.type.startsWith( 'audio/' ) || file.type.startsWith( 'video/' ) ) ) {
			const removeRecordingButton = document.createElement( 'div' );
			removeRecordingButton.className = 'uppy-remove-recording-button';
			removeRecordingButton.textContent = '✕'; // Cross mark (X) symbol.
			removeRecordingButton.title = __( 'Remove recording', 'godam' );
			removeRecordingButton.setAttribute( 'role', 'button' );
			removeRecordingButton.setAttribute( 'tabindex', '0' );
			removeRecordingButton.setAttribute( 'aria-label', __( 'Remove recording', 'godam' ) );
			previewElement.appendChild( removeRecordingButton );

			const handleRemove = () => {
				this.clearVideoUploadUI();
				this.uppy.removeFile( file.id );
			};

			removeRecordingButton.addEventListener( 'click', handleRemove );
			removeRecordingButton.addEventListener( 'keydown', ( event ) => {
				if ( event.key === 'Enter' || event.key === ' ' ) {
					event.preventDefault();
					handleRemove();
				}
			} );
		}

		// Gravity Forms already saved this recording on a page change or a failed submit.
		// Sending it again makes Gravity Forms count it twice and reject the form.
		if ( 'restored' === action && hasGravityFormsSavedFile( this.fileInput ) ) {
			return;
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
	 * Revokes the current preview blob URL to free memory.
	 */
	revokePreviewBlobUrl() {
		if ( this.previewBlobUrl ) {
			try {
				URL.revokeObjectURL( this.previewBlobUrl );
			} catch ( e ) {
				// Ignore errors when revoking.
			}
			this.previewBlobUrl = null;
		}
	}

	/**
	 * Clears the UI state if the user closes the Uppy modal without selecting a file.
	 * Resets the file input, filename, and preview display.
	 */
	clearVideoUploadUI() {
		// Revoke blob URL to prevent memory leaks.
		this.revokePreviewBlobUrl();

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
	 * Opens the Uppy dashboard from the uploader's current trigger button.
	 *
	 * Uppy binds the dashboard trigger once, when the plugin is installed. A button that
	 * Gravity Forms renders later is a different element, so it needs a listener of its own.
	 */
	bindUploadButton() {
		// Prevent duplicate listeners by checking marker attribute.
		if ( this.uploadButton.getAttribute( 'uppy-click-attached' ) ) {
			return;
		}

		this.uploadButton.addEventListener( 'click', () => {
			this.uppy.getPlugin( 'Dashboard' ).openModal();
		} );
		this.uploadButton.setAttribute( 'uppy-click-attached', 'true' );
	}

	/**
	 * Sets up the Gravity Forms `gform_post_render` hook to move the uploader onto markup that
	 * Gravity Forms rendered again, after a page change or a failed submit over AJAX.
	 */
	setupGravityFormsAjaxHandler() {
		jQuery( document ).on( 'gform_post_render', () => {
			this.handleUppyUIOnAjaxRequest();
		} );
	}

	/**
	 * Moves the uploader onto its field's new markup and shows the recording it holds again.
	 *
	 * Gravity Forms replaces a page's markup on every AJAX page change, so the container, file
	 * input and button the uploader was bound to leave the page. Their ids are the same in the
	 * new markup, except the button's, which is read from the new container.
	 */
	handleUppyUIOnAjaxRequest() {
		// The markup is still on the page: first render, a postback, or a page the response did not replace.
		if ( this.container.isConnected ) {
			return;
		}

		const container = document.getElementById( this.containerId );
		if ( ! container ) {
			return;
		}

		const markup = resolveRecorderMarkup( container );
		if ( ! markup.fileInput || ! markup.uploadButton ) {
			return;
		}

		this.useMarkup( container, markup );
		this.bindUploadButton();

		const restoredFile = this.uppy.getFiles()?.[ 0 ];
		if ( restoredFile ) {
			// Draw the recording's preview again on the new markup.
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
