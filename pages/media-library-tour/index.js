/**
 * Media Library guided tour — entry point.
 *
 * Enqueued by PHP only on the Media Library screen (upload.php), only for users
 * who can upload files, and only while GoDAM's "Enable folder organization in
 * media library" setting is on (see Pages::enqueue_media_library_tour()). It is a
 * standalone bundle so it adds nothing to the shared media-library bundle.
 *
 * Responsibilities:
 * - Insert the "Take a tour" bulb button right after Manage Media.
 * - Auto-show the welcome once per user (state kept in user meta).
 * - Drive the hands-on walkthrough (see controller.js / steps.js).
 */

/**
 * WordPress dependencies
 */
import { createRoot } from '@wordpress/element';

/**
 * Internal dependencies
 */
import TourApp from './components/TourApp.jsx';
import { SELECTORS, waitFor } from './dom';
import './style.scss';

const BULB_CONTAINER_CLASS = 'godam-ml-tour-bulb-container';

/**
 * Create (or reuse) the inline container the bulb button renders into, placed
 * right after the Manage Media button. Manage Media is injected asynchronously by
 * the media-library bundle, so wait briefly for it; if it never shows up, fall
 * back to sitting after "Add Media File" (Manage Media, if it appears later, is
 * inserted directly after that button — i.e. still before the bulb).
 *
 * @return {Promise<Element|null>} The container.
 */
const createBulbContainer = async () => {
	const existing = document.querySelector( `.${ BULB_CONTAINER_CLASS }` );
	if ( existing ) {
		return existing;
	}

	const anchor = ( await waitFor( () => document.querySelector( SELECTORS.anyManageMedia ), 3000 ) ) ||
		document.querySelector( SELECTORS.addMediaButton );

	if ( ! anchor ) {
		return null;
	}

	const container = document.createElement( 'span' );
	container.className = BULB_CONTAINER_CLASS;
	anchor.insertAdjacentElement( 'afterend', container );
	return container;
};

const init = async () => {
	// Belt and braces: PHP already gates on this, but the localized flag is the
	// same one the media-library bundle uses to suppress its folder UI.
	if ( ! window.easydamMediaLibrary?.enableFolderOrganization || ! window.godamMediaLibraryTour ) {
		return;
	}

	const bulbContainer = await createBulbContainer();

	const rootElement = document.createElement( 'div' );
	rootElement.id = 'godam-media-library-tour-root';
	document.body.appendChild( rootElement );

	createRoot( rootElement ).render( <TourApp bulbContainer={ bulbContainer } /> );
};

if ( 'loading' === document.readyState ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
