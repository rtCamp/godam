/**
 * External dependencies
 */
import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import Webcam from '@uppy/webcam';
import ScreenCapture from '@uppy/screen-capture';

document.addEventListener( 'DOMContentLoaded', function() {
	document.querySelectorAll( '.uppy-video-upload' ).forEach( ( container ) => {
		const inputId = container.getAttribute( 'data-input-id' );
		const fileInput = document.getElementById( inputId );
		const uploadButton = container.querySelector( '.uppy-video-upload-button' );

		if ( ! fileInput || ! uploadButton ) {
			return;
		}

		const filenameElement = container.querySelector( '.upp-video-upload-filename' );
		const previewElement = container.querySelector( '.uppy-video-upload-preview' );
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
		uppy.use( Dashboard, {
			trigger,
			inline: false,
			closeModalOnClickOutside: true,
			closeAfterFinish: true,
			proudlyDisplayPoweredByUppy: false,
			showProgressDetails: true,
			plugins: enabledPlugins,
			disableLocalFiles: ! localFileInput,
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

		// Handle file selection.
		uppy.on( 'file-added', ( file ) => {
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

			// Close the modal.
			uppy.getPlugin( 'Dashboard' ).closeModal();
		} );

		// Handle dashboard close.
		uppy.on( 'dashboard:modal-closed', () => {
			// Check if no file was selected.
			if ( ! fileInput.files || fileInput.files.length === 0 ) {
				if ( filenameElement ) {
					filenameElement.textContent = '';
				}
				if ( previewElement ) {
					previewElement.innerHTML = '';
				}
			}
		} );
	} );
} );
