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
import { resetUIState } from './redux/slice/folders';
import { triggerFilterChange } from './data/media-grid.js';
import App from './App';
import './index.scss';

/**
 * SOLUTION FOR MULTIPLE MEDIA MODAL STATE SYNC ISSUE:
 *
 * Problem: When multiple WordPress Media Modal instances are opened and closed:
 * - The WordPress Media Modal instance is fresh every time
 * - But the React Redux state persists between modal instances
 * - This results in inconsistent syncing between UI + attachment selection
 *
 * Solution:
 * 1. Added `resetUIState` action in folders slice to selectively reset UI state
 * 2. Implemented multiple detection methods for modal close events:
 * - MutationObserver to detect DOM removal of modal elements
 * - Periodic check for modal visibility changes (fallback)
 * - Hook into wp.media.view.Modal.prototype.close method
 * 3. Reset only UI-related state (selected folder, modals, multi-selection, etc.)
 * while preserving folders data, bookmarks, and sort order for performance
 *
 * Performance Impact: Minimal - only resets UI state, preserves expensive data
 */

const Index = () => {
	return (
		<Provider store={ store }>
			<App />
		</Provider>
	);
};

document.addEventListener( 'DOMContentLoaded', initializeMediaLibrary );
document.addEventListener( 'media-frame-opened', initializeMediaLibrary );

// Set up media modal close detection
setupMediaModalCloseDetection();

/**
 * Set up detection for when WordPress media modals are closed
 * and reset the React state to ensure fresh UI state for new modal instances
 */
function setupMediaModalCloseDetection() {
	// Track active media modal instances to detect when they close
	let lastModalCount = 0;

	// Use MutationObserver to detect when modal elements are removed from DOM
	const observer = new MutationObserver( ( mutations ) => {
		mutations.forEach( ( mutation ) => {
			if ( mutation.type === 'childList' ) {
				// Check if any media modal elements were removed
				mutation.removedNodes.forEach( ( node ) => {
					if ( node.nodeType === Node.ELEMENT_NODE ) {
						// Check if this is a media modal that was removed
						if ( node.classList && node.classList.contains( 'media-modal' ) ) {
							// Clean up React roots before resetting state
							const rootElements = node.querySelectorAll( '#rt-transcoder-media-library-root' );
							rootElements.forEach( ( element ) => {
								if ( element._reactRoot ) {
									try {
										element._reactRoot.unmount();
									} catch ( e ) {
										// Ignore unmounting errors
									}
									element._reactRoot = null;
								}
							} );

							// Media modal was closed, reset React state
							store.dispatch( resetUIState() );

							// Also trigger WordPress media filter change to sync
							triggerFilterChange( 'all' );
						// Also check if it contains media modal children
						} else if ( node.querySelector && node.querySelector( '.media-modal' ) ) {
							// Clean up any React roots in child modals
							const rootElements = node.querySelectorAll( '#rt-transcoder-media-library-root' );
							rootElements.forEach( ( element ) => {
								if ( element._reactRoot ) {
									try {
										element._reactRoot.unmount();
									} catch ( e ) {
										// Ignore unmounting errors
									}
									element._reactRoot = null;
								}
							} );

							store.dispatch( resetUIState() );

							// Also trigger WordPress media filter change to sync
							triggerFilterChange( 'all' );
						}
					}
				} );
			}
		} );
	} );

	// Observe changes to the document body
	observer.observe( document.body, {
		childList: true,
		subtree: true,
	} );

	// Also detect modal state changes by checking visibility periodically
	// This is a fallback for cases where DOM removal isn't detected
	setInterval( () => {
		const currentModalCount = document.querySelectorAll( '.media-modal:not([style*="display: none"])' ).length;

		// If modal count decreased, a modal was closed
		if ( currentModalCount < lastModalCount ) {
			store.dispatch( resetUIState() );

			// Also trigger WordPress media filter change to sync
			triggerFilterChange( 'all' );
		}

		lastModalCount = currentModalCount;
	}, 500 ); // Check every 500ms

	// Listen for WordPress media frame close events if available
	if ( typeof wp !== 'undefined' && wp.media ) {
		// Hook into wp.media to detect when frames are closed
		const originalClose = wp.media.view.Modal.prototype.close;
		wp.media.view.Modal.prototype.close = function( ...args ) {
			// Call original close method
			const result = originalClose.apply( this, args );

			// Clean up React roots in modal elements before they're removed
			setTimeout( () => {
				// Find all React root elements in closing modals and clean them up
				const modalElements = document.querySelectorAll( '.media-modal #rt-transcoder-media-library-root' );
				modalElements.forEach( ( element ) => {
					if ( element._reactRoot ) {
						try {
							element._reactRoot.unmount();
						} catch ( e ) {
							// Ignore unmounting errors
						}
						element._reactRoot = null;
					}
				} );

				// Reset React state after modal closes
				store.dispatch( resetUIState() );

				// Also trigger WordPress media filter change to sync
				triggerFilterChange( 'all' );
			}, 100 ); // Small delay to ensure modal is fully closed

			return result;
		};
	}
}

function initializeMediaLibrary() {
	if ( window.elementor ) {
		const visibleContainers = Array.from( document.querySelectorAll( '.supports-drag-drop' ) )
			.filter( ( container ) => getComputedStyle( container ).display !== 'none' );

		const activeContainer = visibleContainers[ visibleContainers.length - 1 ]; // Most recent visible container

		if ( activeContainer ) {
			const rootElement = activeContainer.querySelector( '#rt-transcoder-media-library-root' );

			if ( rootElement ) {
				// Check if React root needs to be created/recreated
				const needsNewRoot = ! rootElement._reactRoot ||
					! rootElement._reactRoot._internalRoot ||
					! rootElement.hasChildNodes();

				if ( needsNewRoot ) {
					// Unmount existing root if it exists but is stale
					if ( rootElement._reactRoot ) {
						try {
							rootElement._reactRoot.unmount();
						} catch ( e ) {
							// Ignore unmounting errors for stale roots
						}
					}

					const root = ReactDOM.createRoot( rootElement );
					rootElement._reactRoot = root;
					root.render( <Index /> );
				}
			}
		}

		return;
	}

	// Find all visible media frames (same logic as attachment-browser.js)
	const visibleFrames = Array.from( document.querySelectorAll( '.media-frame' ) )
		.filter( ( frame ) => getComputedStyle( frame ).display !== 'none' );

	const activeFrame = visibleFrames[ visibleFrames.length - 1 ]; // Most recently opened visible frame

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
		// Check if React root needs to be created/recreated
		const needsNewRoot = ! rootElement._reactRoot ||
			! rootElement._reactRoot._internalRoot ||
			! rootElement.hasChildNodes();

		if ( needsNewRoot ) {
			// Unmount existing root if it exists but is stale
			if ( rootElement._reactRoot ) {
				try {
					rootElement._reactRoot.unmount();
				} catch ( e ) {
					// Ignore unmounting errors for stale roots
				}
			}

			const root = ReactDOM.createRoot( rootElement );
			rootElement._reactRoot = root;
			root.render( <Index /> );
		}
	}
}
