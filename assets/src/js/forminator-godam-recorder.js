/* global jQuery */

/**
 * TODO: Use common code, currently not available in develop PR is pending.
 */

/**
 * External dependencies
 */
import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import Webcam from '@uppy/webcam';
import ScreenCapture from '@uppy/screen-capture';
import GoldenRetriever from '@uppy/golden-retriever';

/**
 * Handles invalidating persistent uppy states on successful submission.
 */
const clearUppyStateIfConfirmed = () => {
	if (
		document.querySelector( '.forminator-response-message.forminator-success' )
	) {
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
 * @param {string} containerId  - The container ID.
 * @param {Uppy}   uppyInstance - The uppy instance
 * @return {void}
 */
const handleUppyUIOnAjaxRequest = ( containerId, uppyInstance ) => {
	const containerReference = document.getElementById( containerId );
	const uploadButtonId = containerReference.getAttribute(
		'data-video-upload-button-id',
	);

	const dashboardTrigger = document.getElementById( uploadButtonId );
	const uppyClickAttached = dashboardTrigger.getAttribute(
		'uppy-click-attached',
	);

	if ( ! uppyClickAttached ) {
		dashboardTrigger.addEventListener( 'click', () => {
			uppyInstance.getPlugin( 'Dashboard' ).openModal();
		} );
		dashboardTrigger.setAttribute( 'uppy-click-attached', 'true' );
	}

	const restoredFile = uppyInstance.getFiles()?.[ 0 ];
	if ( ! restoredFile ) {
		return;
	}

	/**
	 * Pass a new reference to the container, as after AJAX submission, previously
	 * cached references are invalidated.
	 */
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

jQuery( document ).ready( function() {
	// Check for successful form submission
	clearUppyStateIfConfirmed();

	// Listen for form submissions and validate them
	jQuery( '.forminator-custom-form' ).on(
		'forminator:form:submit:success',
		function() {
			clearUppyStateIfConfirmed();
		},
	);
} );

document.addEventListener( 'DOMContentLoaded', function() {
	document.querySelectorAll( '.uppy-video-upload' ).forEach( ( container ) => {
		const containerId = container.id;
		const inputId = container.getAttribute( 'data-input-id' );
		const fileInput = document.getElementById( inputId );
		const uploadButtonId = container.getAttribute(
			'data-video-upload-button-id',
		);
		const uploadButton = container.querySelector( `#${ uploadButtonId }` );

		if ( ! fileInput || ! uploadButton ) {
			return;
		}

		const maxFileSize = Number( container.getAttribute( 'data-max-size' ) );

		// Get enabled selectors from data attributes.
		const enabledSelectors =
			container.getAttribute( 'data-file-selectors' ) || 'webcam,screen_capture';
		const selectorArray = enabledSelectors.split( ',' );

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
			} );
		}

		// Conditionally add ScreenCapture plugin.
		if ( selectorArray.includes( 'screen_capture' ) ) {
			uppy.use( ScreenCapture, {
				audio: true,
			} );
		}

		// When Forminator submits the form via AJAX, we need to re-initialize the UI.
		jQuery( document ).on(
			'forminator:form:ajax:complete',
			function( ) {
				handleUppyUIOnAjaxRequest( containerId, uppy );
			},
		);

		// Handle file restoration on reload.
		uppy.on( 'restored', ( ) => {
			const restoredFile = uppy.getFiles( )?.[ 0 ];
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
		uppy.on( 'dashboard:modal-closed', ( ) => {
			const selectedFiles = uppy.getFiles( );
			clearVideoUploadUIOnModalClose( selectedFiles, containerId );
		} );
	} );
} );
