/**
 * External dependencies
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

/**
 * Internal dependencies
 */
import store from './redux/store';
import App from './App';
import './index.scss';

const Index = () => {
	return (
		<Provider store={ store }>
			<App />
		</Provider>
	);
};

document.addEventListener( 'DOMContentLoaded', initializeMediaLibrary );
document.addEventListener( 'media-frame-opened', initializeMediaLibrary );

// Clean up React when media modal is closed - important to ensure clean state on modal reopen
document.addEventListener( 'click', ( event ) => {
	if ( event.target.closest( '.media-modal-close, .media-modal-backdrop' ) ) {
		setTimeout( () => {
			const rootElements = document.querySelectorAll( '#rt-transcoder-media-library-root' );
			rootElements.forEach( ( rootElement ) => {
				if ( rootElement._reactRoot ) {
					rootElement._reactRoot.unmount();
					delete rootElement._reactRoot;
				}
			} );
		}, 100 );
	}
} );

function initializeMediaLibrary() {
	if ( window.elementor ) {
		const visibleContainers = Array.from( document.querySelectorAll( '.supports-drag-drop' ) )
			.filter( ( container ) => getComputedStyle( container ).display !== 'none' );

		const activeContainer = visibleContainers.at( -1 ); // Most recent visible container

		if ( activeContainer ) {
			const rootElement = activeContainer.querySelector( '#rt-transcoder-media-library-root' );

			if ( rootElement ) {
			// Check if React is already mounted to avoid reinitializing
				if ( ! rootElement._reactRoot ) {
					const root = ReactDOM.createRoot( rootElement );
					rootElement._reactRoot = root; // Store the root in a custom property
					root.render( <Index /> );
				}
			}
		}

		return;
	}

	// Find all visible media frames (same logic as attachment-browser.js)
	const visibleFrames = Array.from( document.querySelectorAll( '.media-frame' ) )
		.filter( ( frame ) => getComputedStyle( frame ).display !== 'none' );

	const activeFrame = visibleFrames.at( -1 ); // Most recently opened visible frame

	let rootElement = null;

	// If we have an active media frame, look for root element inside it
	if ( activeFrame ) {
		rootElement = activeFrame.querySelector( '#rt-transcoder-media-library-root' );
	}

	// Fallback: Check if root element exists outside media-frame (e.g., upload page)
	if ( ! rootElement ) {
		rootElement = document.getElementById( 'rt-transcoder-media-library-root' );
	}

	if ( rootElement ) {
		// Check if React is already mounted to avoid reinitializing
		if ( ! rootElement._reactRoot ) {
			const root = ReactDOM.createRoot( rootElement );
			rootElement._reactRoot = root; // Store the root in a custom property
			root.render( <Index /> );
		}
	}
}
