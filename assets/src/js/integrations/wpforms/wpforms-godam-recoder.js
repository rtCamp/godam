/**
 * External dependencies
 */
import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import Webcam from '@uppy/webcam';
import ScreenCapture from '@uppy/screen-capture';
import GoldenRetriever from '@uppy/golden-retriever';

document.addEventListener( 'DOMContentLoaded', () => {
	document.querySelectorAll( '.wpforms-field .uppy-video-upload' ).forEach( ( container ) => {
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
			} );
		}

		// Conditionally add ScreenCapture plugin.
		if ( selectorArray.includes( 'screen_capture' ) ) {
			uppy.use( ScreenCapture, {
				audio: true,
			} );
		}
	} );
} );
