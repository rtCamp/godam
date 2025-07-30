/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import Attachments from './models/attachments';

/* global _ */

/**
 * Utility function to check if the user has a valid API key.
 *
 * @return {boolean} True if the user has a valid API Key, false otherwise.
 */
function isAPIKeyValid() {
	return window.MediaLibrary?.userData?.validApiKey ? true : false;
}

/**
 * Check the current view of the media library.
 *
 * @return {string} 'list' or 'grid'.
 */
function checkMediaLibraryView() {
	const anchorTag = document.querySelector( '.wp-filter .filter-items .view-switch a.current' );

	if ( anchorTag && anchorTag.id === 'view-switch-list' ) {
		return 'list';
	}

	return 'grid';
}

/**
 * Check if in the upload page.
 *
 * @return {boolean} True if in the upload page, false otherwise.
 */
function isUploadPage() {
	return document.querySelector( '.upload-php' ) ? true : false;
}

/**
 * Check if folder organization is disabled.
 *
 * @return {boolean} True if folder organization is disabled, false otherwise.
 */
function isFolderOrgDisabled() {
	return ! window.easydamMediaLibrary?.enableFolderOrganization || false;
}

function addHamburgerToggle() {
	const observer = new MutationObserver( () => {
		const referenceElement = document.querySelector( '.media-toolbar.wp-filter' );

		if ( referenceElement ) {
			// Create the container for the hamburger button
			const hamburgerContainer = document.createElement( 'div' );
			hamburgerContainer.className = 'godam-media-library-submenu-container';

			// Create the button itself
			const hamburgerButton = document.createElement( 'button' );
			hamburgerButton.className = 'godam-media-library-submenu-hamburger';
			hamburgerButton.title = 'Open Menu';
			hamburgerButton.setAttribute( 'aria-label', 'Open Menu' );
			hamburgerButton.innerHTML = `
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
					<line x1="3" y1="12" x2="21" y2="12"></line>
					<line x1="3" y1="6" x2="21" y2="6"></line>
					<line x1="3" y1="18" x2="17" y2="18"></line>
				</svg>
			`;

			// Append the button to the container
			hamburgerContainer.appendChild( hamburgerButton );

			// Insert the hamburger container before the reference element (the media toolbar)
			referenceElement.insertAdjacentElement( 'beforebegin', hamburgerContainer );

			// Set up the click event to toggle the sidebar
			hamburgerButton.addEventListener( 'click', () => {
				toggleSidebar();
			} );

			// Disconnect the observer after adding the button to prevent unnecessary checks
			observer.disconnect();
		}
	} );

	// Start observing the document body for changes (add nodes)
	observer.observe( document.body, { childList: true, subtree: true } );
}

function openMediaLibrarySidebar() {
	const root = document.getElementById( 'rt-transcoder-media-library-root' );
	if ( root && ! root.classList.contains( 'open' ) ) {
		root.classList.add( 'open' );

		let overlay = document.querySelector( '.godam-media-library-overlay' );
		if ( ! overlay ) {
			overlay = document.createElement( 'div' );
			overlay.className = 'godam-media-library-overlay';
			overlay.setAttribute( 'role', 'button' );
			overlay.setAttribute( 'tabindex', 0 );

			overlay.addEventListener( 'click', closeMediaLibrarySidebar );
			overlay.addEventListener( 'keydown', ( e ) => {
				if ( e.key === 'Enter' || e.key === ' ' ) {
					closeMediaLibrarySidebar();
				}
			} );

			document.body.appendChild( overlay );
		}
	}
}

function closeMediaLibrarySidebar() {
	const root = document.getElementById( 'rt-transcoder-media-library-root' );
	if ( root && root.classList.contains( 'open' ) ) {
		root.classList.remove( 'open' );

		const overlay = document.querySelector( '.godam-media-library-overlay' );
		if ( overlay ) {
			overlay.remove();
		}
	}
}

function toggleSidebar() {
	const root = document.getElementById( 'rt-transcoder-media-library-root' );
	const sidebarActuallyOpen = root?.classList.contains( 'open' );

	if ( sidebarActuallyOpen ) {
		closeMediaLibrarySidebar();
	} else {
		openMediaLibrarySidebar();
	}
}

function addManageMediaButton() {
	const referenceElement = document.querySelector( '.wrap .page-title-action' );

	const godamMediaLink = window.godamRestRoute?.apiBase + '/web/media-library';
	const page = window.easydamMediaLibrary?.page || '';

	// Insert the button after referenceElement
	if ( referenceElement && 'upload' === page ) {
		const button = document.createElement( 'a' );
		button.className = 'button godam-button';
		button.href = godamMediaLink ?? '#';
		button.target = '_blank';
		if ( ! isAPIKeyValid() ) {
			button.classList.add( 'disable' );
			button.title = __( 'Premium Feature', 'godam' );
			button.href = '#';
			button.target = '';
		}
		const icon = document.createElement( 'span' );
		icon.classList.add( 'godam-icon' );
		button.appendChild( icon );
		const text = document.createElement( 'span' );
		text.className = 'button-text';
		text.textContent = __( 'Manage Media', 'godam' );
		button.appendChild( text );
		referenceElement.insertAdjacentElement( 'afterend', button );
	}
}

/**
 * Get an instance of our wp.media.model.Attachments extension
 *
 * @param {Object} props
 */
const getQuery = ( props ) => {
	return new Attachments( null, {
		props: _.extend( _.defaults( props || {}, {} ), { query: true } ),
	} );
};

/**
 * Helper function to fetch media settings.
 *
 * @return {Promise<Object | undefined>} A promise that resolves with the JSON response from the API, or undefined if the request fails.
 */
async function getGodamSettings() {
	const restURL = window.godamRestRoute?.url || '';
	const baseUrl = `${ restURL }godam/v1/settings`;
	const url = `${ baseUrl }/godam-settings`;

	try {
		const response = await wp.apiFetch( {
			path: url,
			method: 'GET',
		} );

		return response;
	} catch ( error ) {
	}
}

export { isAPIKeyValid, checkMediaLibraryView, isUploadPage, isFolderOrgDisabled, addManageMediaButton, getQuery, getGodamSettings, addHamburgerToggle, closeMediaLibrarySidebar, openMediaLibrarySidebar };
