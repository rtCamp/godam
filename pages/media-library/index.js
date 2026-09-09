/**
 * External dependencies
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { PostHogProvider } from '@posthog/react';

/**
 * Internal dependencies
 */
import store from './redux/store';
import { resetUIState } from './redux/slice/folders';
import { triggerFilterChange } from './data/media-grid.js';
import App from './App';
import posthog from '../utils/posthog';
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
		<PostHogProvider client={ posthog }>
			<Provider store={ store }>
				<App />
			</Provider>
		</PostHogProvider>
	);
};

document.addEventListener( 'DOMContentLoaded', initializeMediaLibrary );
document.addEventListener( 'media-frame-opened', initializeMediaLibrary );

// Set up media modal close detection
setupMediaModalCloseDetection();

/**
 * Whether any WordPress media modal is currently visible.
 *
 * @return {boolean} True if at least one `.media-modal` is displayed.
 */
function isAnyMediaModalOpen() {
	return Array.from( document.querySelectorAll( '.media-modal' ) )
		.some( ( modal ) => getComputedStyle( modal ).display !== 'none' );
}

/**
 * Reset the folder sidebar's UI state and resync the WP media query — but ONLY
 * when no media modal remains open. Closing a nested modal (e.g. an attachment
 * details overlay) while the picker the user is working in is still open must not
 * wipe the active folder selection, which the previous unconditional reset did.
 */
function resetSidebarIfAllModalsClosed() {
	if ( isAnyMediaModalOpen() ) {
		return;
	}

	store.dispatch( resetUIState() );

	// Resync the WordPress media query back to "all".
	triggerFilterChange( 'all' );
}

/**
 * Set up detection for when WordPress media modals are closed
 * and reset the React state to ensure fresh UI state for new modal instances
 */
function setupMediaModalCloseDetection() {
	// The authoritative "modal closed" signal is wp.media's own Modal.close(). The
	// previous implementation ALSO ran a document.body subtree MutationObserver and a
	// 500ms setInterval for the entire page lifetime — neither was ever disconnected/
	// cleared — purely as fallbacks. That is needlessly chatty (especially in the block
	// editor, where document.body mutates constantly). Rely on the single frame event.
	if ( typeof wp === 'undefined' || ! wp.media || ! wp.media.view || ! wp.media.view.Modal ) {
		return;
	}

	// Guard against double-wrapping if this bundle is evaluated more than once.
	if ( wp.media.view.Modal.prototype._godamClosePatched ) {
		return;
	}
	wp.media.view.Modal.prototype._godamClosePatched = true;

	const originalClose = wp.media.view.Modal.prototype.close;
	wp.media.view.Modal.prototype.close = function( ...args ) {
		// Capture the closing modal's element before the async cleanup runs.
		const modalEl = this.el;

		// Call original close method
		const result = originalClose.apply( this, args );

		// Clean up the React root in THIS closing modal before it is hidden/removed.
		// Scoped to the closing modal so closing one frame never tears down a sibling
		// frame's still-visible sidebar.
		setTimeout( () => {
			// Skip cleanup if the modal was reopened within this delay (still visible) —
			// otherwise we would unmount a freshly-mounted sidebar.
			const modalHidden = ! modalEl || ! modalEl.isConnected || getComputedStyle( modalEl ).display === 'none';

			if ( modalHidden && modalEl ) {
				modalEl.querySelectorAll( '#rt-transcoder-media-library-root' ).forEach( ( element ) => {
					if ( element._reactRoot ) {
						try {
							element._reactRoot.unmount();
						} catch ( e ) {
							// Ignore unmounting errors
						}
						element._reactRoot = null;
					}
				} );
			}

			// Reset React state only once the last media modal has closed.
			resetSidebarIfAllModalsClosed();
		}, 100 ); // Small delay to ensure modal is fully closed

		return result;
	};
}

/**
 * Mount (or remount) the media-library sidebar React app into a root element.
 * Idempotent: skips when a live React root is already rendered into it.
 *
 * @param {HTMLElement} rootElement The #rt-transcoder-media-library-root node.
 */
function renderSidebarInto( rootElement ) {
	if ( ! rootElement ) {
		return;
	}

	// Consider the root "live" using plugin-owned signals only — never React's
	// private internals (e.g. `_internalRoot`), which change between versions.
	// A live root is one we created (`_reactRoot`) that still carries our own
	// `data-godam-mounted` flag and rendered DOM. If the node was emptied or its
	// root torn down (see modal-close cleanup), fall through and remount.
	const hasLiveRoot = rootElement._reactRoot &&
		rootElement.dataset.godamMounted === 'true' &&
		rootElement.hasChildNodes();

	if ( hasLiveRoot ) {
		return;
	}

	// Unmount an existing but stale root before recreating.
	if ( rootElement._reactRoot ) {
		try {
			rootElement._reactRoot.unmount();
		} catch ( e ) {
			// Ignore unmounting errors for stale roots
		}
		rootElement._reactRoot = null;
		delete rootElement.dataset.godamMounted;
	}

	const root = ReactDOM.createRoot( rootElement );
	rootElement._reactRoot = root;
	rootElement.dataset.godamMounted = 'true';
	root.render( <Index /> );
}

function initializeMediaLibrary( event ) {
	// Preferred path: the frame that just opened passes the exact root it created
	// (Elementor create step). Rendering into that node avoids guessing which
	// frame/container is active — the previous "last visible" heuristic was racy
	// in the Elementor editor and the sidebar often never mounted.
	const passedRoot = event && event.detail && event.detail.root;
	if ( passedRoot ) {
		renderSidebarInto( passedRoot );
		return;
	}

	if ( window.elementor ) {
		const visibleContainers = Array.from( document.querySelectorAll( '.supports-drag-drop' ) )
			.filter( ( container ) => getComputedStyle( container ).display !== 'none' );

		const activeContainer = visibleContainers[ visibleContainers.length - 1 ]; // Most recent visible container

		if ( activeContainer ) {
			renderSidebarInto( activeContainer.querySelector( '#rt-transcoder-media-library-root' ) );
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

	renderSidebarInto( rootElement );
}
