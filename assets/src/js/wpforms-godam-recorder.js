/**
 * External dependencies
 */
import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import Webcam from '@uppy/webcam';
import ScreenCapture from '@uppy/screen-capture';
import GoldenRetriever from '@uppy/golden-retriever';

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
 * Cleans up the UI state when the user closes the modal without selecting a video.
 *
 * @param {File[]} selectedFiles - The files selected by the user from Uppy dashboard.
 * @param {string} containerId   - The ID of the video upload container.
 */
const clearVideoUploadUIOnModalClose = ( selectedFiles, containerId ) => {
	const container = document.getElementById( containerId );
	const filenameElement = container.querySelector( '.upp-video-upload-filename' );
	const previewElement = container.querySelector( '.uppy-video-upload-preview' );
	const inputId = container.getAttribute( 'data-input-id' );
	const fileInput = document.getElementById( inputId );

	if ( ! selectedFiles || selectedFiles.length === 0 ) {
		if ( filenameElement ) {
			filenameElement.textContent = '';
		}
		if ( previewElement ) {
			previewElement.innerHTML = '';
		}
		if ( fileInput ) {
			fileInput.value = '';
		}
	}
};

document.addEventListener( 'DOMContentLoaded', () => {
	document.querySelectorAll( '.wpforms-form' ).forEach( ( wpForm ) => {
		/**
		 * Clear uppy state after successful submission.
		 */
		if ( wpForm.classList.contains( '.wpforms-ajax-form' ) ) {
			jQuery( document ).on( 'wpformsAjaxSubmitSuccess', function( event, json ) {
				if ( true === json?.success ) {
					const uppyKeys = Object.keys( localStorage ).filter( ( key ) => {
						return key.startsWith( 'uppyState:' );
					} );

					for ( const key of uppyKeys ) {
						localStorage.removeItem( key );
					}
				}
			} );
		} else {
			jQuery( window ).on( 'unload', function( event ) {
				const uppyKeys = Object.keys( localStorage ).filter( ( key ) => {
					return key.startsWith( 'uppyState:' );
				} );

				for ( const key of uppyKeys ) {
					localStorage.removeItem( key );
				}
			} );
		}

		const godamVideoFieldContainers = document.querySelectorAll( '.wpforms-field .uppy-video-upload' ) || [];

		/**
		 * Initialize all the WPForms video upload field type.
		 */
		godamVideoFieldContainers.forEach( ( container ) => {
			const containerId = container.id;
			const inputId = container.getAttribute( 'data-input-id' );
			const fileInput = document.getElementById( inputId );
			const uploadButtonId = container.getAttribute( 'data-video-upload-button-id' );
			const uploadButton = container.querySelector( `#${ uploadButtonId }` );

			if ( ! fileInput || ! uploadButton ) {
				return;
			}

			const maxFileSize = Number( container.getAttribute( 'data-max-file-size' ) );

			// Initialize Uppy.
			const uppy = new Uppy( {
				id: `uppy-${ inputId }-${ uploadButtonId }`,
				autoProceed: false,
				restrictions: {
					maxNumberOfFiles: 1,
					allowedFileTypes: [ 'video/*' ],
				},
				maxFileSize,
			} );

			// Get enabled selectors from data attributes.
			const enabledSelectors = container.getAttribute( 'data-file-selectors' ) || 'webcam,screen_capture';
			const selectorArray = enabledSelectors.split( ',' );

			// Define available plugins based on enabled selectors.
			const enabledPlugins = [];

			if ( selectorArray.includes( 'webcam' ) ) {
				enabledPlugins.push( 'Webcam' );
			}

			if ( selectorArray.includes( 'screen_capture' ) ) {
				enabledPlugins.push( 'ScreenCapture' );
			}

			const localFileInput = selectorArray.includes( 'file_input' ) ? true : false;
			const trigger = `#${ containerId } #${ uploadButtonId }`;

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
					showVideoSourceDropdown: true,
				} );
			}

			// Conditionally add ScreenCapture plugin.
			if ( selectorArray.includes( 'screen_capture' ) ) {
				uppy.use( ScreenCapture, {
					audio: true,
				} );
			}

			// Handle file restoration on reload.
			uppy.on( 'restored', () => {
				const restoredFile = uppy.getFiles()?.[ 0 ];
				if ( ! restoredFile ) {

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
} );
