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
 * Handles invalidating persistent uppy states on successful submission
 * to match the behavior of Gravity Forms.
 */
const clearUppyStateIfConfirmed = () => {
	if ( document.querySelector( 'div[id^=gform_confirmation_message_]' ) ) {
		const uppyKeys = Object.keys( localStorage ).filter( ( key ) => {
			return key.startsWith( 'uppyState:' );
		} );

		for ( const key of uppyKeys ) {
			localStorage.removeItem( key );
		}
	}
};

/**
 * Updates the video preview UI and syncs the selected file with the
 * corresponding input field.
 *
 * @param {File}        file      - The file to attach to the file input.
 * @param {HTMLElement} container - The container element that holds the upload UI.
 */
const processVideoUpload = ( file, container ) => {
	const inputId = container.getAttribute( 'data-input-id' );
	const fileInput = document.getElementById( inputId );
	const filenameElement = container.querySelector( '.upp-video-upload-filename' );
	const previewElement = container.querySelector( '.uppy-video-upload-preview' );

	// Set filename display.
	if ( filenameElement ) {
		filenameElement.textContent = file.name;
	}

	// Check file size.

	// Create video preview.
	if ( previewElement && file.type.startsWith( 'video/' ) ) {
		const videoPreview = document.createElement( 'video' );
		videoPreview.controls = true;
		videoPreview.style.maxWidth = '400px';
		videoPreview.style.width = '100%';
		videoPreview.style.marginTop = '10px';

		// Create a blob URL for the preview.
		const objectUrl = URL.createObjectURL( file.data );
		videoPreview.src = objectUrl;

		// Clear previous previews.
		previewElement.innerHTML = '';
		previewElement.appendChild( videoPreview );
	}

	// Prepare the file for form submission.
	if ( file.source === 'Webcam' || file.source === 'ScreenCapture' ) {
		// Convert blob to file.
		const fileName = file.name || 'video.webm';
		const fileType = file.type || 'video/webm';
		const fileBlob = new Blob( [ file.data ], { type: fileType } );
		// Attach the file name and type, and video duration.
		const fileObject = new File( [ fileBlob ], fileName, {
			...file,
			type: fileType,
			lastModified: Date.now(),
		} );

		// Create a DataTransfer object to hold the file.
		const dataTransfer = new DataTransfer();
		dataTransfer.items.add( fileObject );
		fileInput.files = dataTransfer.files;
	} else {
		const dataTransfer = new DataTransfer();
		dataTransfer.items.add( file.data );
		fileInput.files = dataTransfer.files;
	}
};

/**
 * Handles updates to Video UI on AJAX submissions.
 *
 * @param {string} formId       - The form ID.
 * @param {string} containerId  - The container ID.
 * @param {string} trigger      - The trigger to open Uppy Dashboard.
 * @param {Uppy}   uppyInstance - The uppy instance
 * @return {void}
 */
const handleUppyUIOnAjaxRequest = ( formId, containerId, trigger, uppyInstance ) => {
	const form = document.getElementById( `gform_${ formId }` );
	const gformWrapper = form.closest( 'div[id^=gform_wrapper_]' );

	/**
	 * Do not run this on initial load, let the data be populated using uppy's restored
	 * event as the hook `gform_post_render` executes too early, before the file data
	 * is asynchronously restored.
	 */
	if ( ! gformWrapper.classList.contains( 'gform_validation_error' ) ) {
		return;
	}

	/**
	 * On subsequent AJAX requests, the reference to Uppy's trigger gets invalidated and
	 * therefore must be replaced with custom click handler in order for it to work.
	 */
	const dashboardTrigger = document.querySelector( trigger );
	dashboardTrigger.addEventListener( 'click', () => {
		uppyInstance.getPlugin( 'Dashboard' ).openModal();
	} );

	const restoredFile = uppyInstance.getFiles()?.[ 0 ];
	if ( ! restoredFile ) {
		return;
	}

	/**
	 * Pass a new reference to the container, as after AJAX submission, previously
	 * cached references are invalidated.
	 */
	const containerReference = document.getElementById( containerId );
	processVideoUpload( restoredFile, containerReference );
};

/**
 * Cleans up the UI state when the user closes the modal without selecting a video.
 *
 * @param {File[]} selectedFiles - The files selected by the user from Uppy dashboard.
 * @param {string} containerId   - The ID of the video upload container.
 */
const clearVideoUploadUIOnModalClose = ( selectedFiles, containerId ) => {
	const container = document.getElementById( containerId );
	const filenameElement = container.querySelector( '.upp-video-upload-filename' );
	const previewElement = container.querySelector( '.uppy-video-upload-preview' );

	if ( ! selectedFiles || selectedFiles.length === 0 ) {
		if ( filenameElement ) {
			filenameElement.textContent = '';
		}
		if ( previewElement ) {
			previewElement.innerHTML = '';
		}
	}
};

document.addEventListener( 'DOMContentLoaded', function() {
	clearUppyStateIfConfirmed();

	document.querySelectorAll( '.uppy-video-upload' ).forEach( ( container ) => {
		const containerId = container.id;
		const inputId = container.getAttribute( 'data-input-id' );
		const fileInput = document.getElementById( inputId );
		const uploadButton = container.querySelector( '.uppy-video-upload-button' );

		if ( ! fileInput || ! uploadButton ) {
			return;
		}

		const maxFileSize = Number( container.getAttribute( 'data-max-file-size' ) );

		// Get enabled selectors from data attributes.
		const enabledSelectors = container.getAttribute( 'data-file-selectors' ) || 'webcam,screen_capture';
		const selectorArray = enabledSelectors.split( ',' );

		// Initialize Uppy.
		const uppy = new Uppy( {
			id: `uppy-${ inputId }`,
			autoProceed: false,
			restrictions: {
				maxNumberOfFiles: 1,
				allowedFileTypes: [ 'video/*' ],
			},
			maxFileSize,
		} );

		// Define available plugins based on enabled selectors.
		const enabledPlugins = [];

		if ( selectorArray.includes( 'webcam' ) ) {
			enabledPlugins.push( 'Webcam' );
		}

		if ( selectorArray.includes( 'screen_capture' ) ) {
			enabledPlugins.push( 'ScreenCapture' );
		}

		const localFileInput = selectorArray.includes( 'file_input' ) ? true : false;

		const trigger = `#${ container.id } .uppy-video-upload-button`;

		// Add Dashboard with webcam and screen capture.
		uppy
			.use( Dashboard, {
				trigger,
				inline: false,
				closeModalOnClickOutside: true,
				closeAfterFinish: true,
				proudlyDisplayPoweredByUppy: false,
				showProgressDetails: true,
				plugins: enabledPlugins,
				disableLocalFiles: ! localFileInput,
			} )
			.use( GoldenRetriever, {
				expires: 10 * 60 * 1000, // 10 minutes.
			} );

		// Conditionally add Webcam plugin.
		if ( selectorArray.includes( 'webcam' ) ) {
			uppy.use( Webcam, {
				modes: [ 'video-audio' ],
				mirror: false,
				showRecordingLength: true,
			} );
		}

		// Conditionally add ScreenCapture plugin.
		if ( selectorArray.includes( 'screen_capture' ) ) {
			uppy.use( ScreenCapture, {
				audio: true,
			} );
		}

		/**
		 * The `gform_post_render` hook fires on every post render including the AJAX re-renders.
		 * This is used to re-attach click handler on previously invalidated Uppy triggers and syncs
		 * files on AJAX submissions stored locally.
		 *
		 * @see https://docs.gravityforms.com/gform_post_render/
		 */
		jQuery( document ).on( 'gform_post_render', function( _, formId ) {
			handleUppyUIOnAjaxRequest(
				formId,
				containerId,
				trigger,
				uppy,
			);
		} );

		// Handle file restoration on reload.
		uppy.on( 'restored', () => {
			const restoredFile = uppy.getFiles()?.[ 0 ];
			if ( ! restoredFile ) {
				return;
			}

			processVideoUpload( restoredFile, container );
		} );

		// Handle file selection.
		uppy.on( 'file-added', ( file ) => {
			const containerRef = document.getElementById( containerId );
			processVideoUpload( file, containerRef );
			uppy.getPlugin( 'Dashboard' ).closeModal();
		} );

		// Handle dashboard close.
		uppy.on( 'dashboard:modal-closed', () => {
			const selectedFiles = uppy.getFiles();
			clearVideoUploadUIOnModalClose( selectedFiles, containerId );
		} );
	} );
} );
