/**
 * DOM helpers + stable selectors for the Media Library guided tour.
 *
 * The tour ships as its own bundle and never imports the Media Library app, so
 * it talks to the page through DOM hooks that already exist on the folder
 * sidebar / wp.media grid, plus two document events the sidebar broadcasts
 * (`godam-media-library:folder-created`, `godam-media-library:attachments-moved`).
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

export const SELECTORS = {
	sidebar: '#rt-transcoder-media-library-root',
	sidebarToggle: '#media-folder-toggle-button',
	folderControls: '#rt-transcoder-media-library-root .control-buttons',
	newFolderButton: '#rt-transcoder-media-library-root .new-folder-button',
	folderList: '#rt-transcoder-media-library-root .folder-list',
	allMedia: '#rt-transcoder-media-library-root .folder-list__item.all-media',
	noMedia: '#wp-media-grid .attachments-browser .no-media',
	gridSpinner: '#wp-media-grid .media-toolbar .spinner.is-active',
	folderTabs: '#rt-transcoder-media-library-root .folder-tabs',
	folderTree: '#rt-transcoder-media-library-root .tree-container',
	contextMenu: '.folder-context-menu',
	folderModal: '.components-modal__frame.folder-creation-modal',
	moveModal: '.components-modal__frame.move-to-folder',
	modalOverlay: '.components-modal__screen-overlay',
	grid: '#wp-media-grid',
	firstAttachment: '#wp-media-grid .attachments-browser li.attachment',
	attachmentsBrowser: '#wp-media-grid .attachments-browser .attachments',
	bulkSelect: '#wp-media-grid .media-toolbar .select-mode-toggle-button',
	moveToFolder: '#wp-media-grid .media-toolbar .godam-move-to-folder-button',
	selectedAttachment: '#wp-media-grid .attachments-browser li.attachment.selected',
	mediaToolbar: '#wp-media-grid .media-toolbar.wp-filter',
	addMediaButton: '.wrap .page-title-action',
	manageMedia: '.wrap .godam-button:not(.disable)',
	anyManageMedia: '.wrap .godam-button',
	bulb: '.godam-ml-tour-bulb',
	snackbar: '.components-snackbar',
};

export const EVENTS = {
	FOLDER_CREATED: 'godam-media-library:folder-created',
	ATTACHMENTS_MOVED: 'godam-media-library:attachments-moved',
};

/**
 * Selector for a folder row in the sidebar tree.
 *
 * @param {number} id Folder term id.
 * @return {string} CSS selector.
 */
export const folderRow = ( id ) => ( 0 === Number( id )
	// "Uncategorized" (term 0) lives in the fixed list above the tree.
	? `${ SELECTORS.folderList } .tree-item[data-id="0"]`
	: `${ SELECTORS.folderTree } .tree-item[data-id="${ Number( id ) }"]` );

/**
 * Whether an element is rendered and visible (not display:none / zero-size).
 *
 * @param {Element|null} el Element.
 * @return {boolean} True when visible.
 */
export const isVisible = ( el ) => {
	if ( ! el || ! el.isConnected ) {
		return false;
	}
	const rect = el.getBoundingClientRect();
	return rect.width > 0 && rect.height > 0;
};

/**
 * Query a visible element.
 *
 * @param {string} selector CSS selector.
 * @return {Element|null} The first visible match.
 */
export const $visible = ( selector ) => {
	const matches = document.querySelectorAll( selector );
	for ( const el of matches ) {
		if ( isVisible( el ) ) {
			return el;
		}
	}
	return null;
};

/**
 * Poll until `predicate` returns a truthy value, or time out.
 *
 * @param {Function} predicate Returns a value; truthy resolves.
 * @param {number}   timeout   Max wait in ms.
 * @param {number}   interval  Poll interval in ms.
 * @return {Promise<*>} The truthy value, or null on timeout.
 */
export const waitFor = ( predicate, timeout = 8000, interval = 120 ) =>
	new Promise( ( resolve ) => {
		const first = predicate();
		if ( first ) {
			resolve( first );
			return;
		}
		let waited = 0;
		const timer = setInterval( () => {
			const value = predicate();
			waited += interval;
			if ( value || waited >= timeout ) {
				clearInterval( timer );
				resolve( value || null );
			}
		}, interval );
	} );

/**
 * Whether the page is the Media Library in grid mode (the tour's home).
 *
 * @return {boolean} True in grid mode.
 */
export const isGridMode = () => Boolean( document.querySelector( SELECTORS.grid ) );

/**
 * Whether the GoDAM "Create a new folder" modal is open.
 *
 * @return {boolean} True while it is open.
 */
export const isFolderModalOpen = () =>
	// Detect the modal element itself: it mounts in the same commit that removes
	// the context menu, whereas the `folder-creation-modal-open` body class is
	// added a frame later (post-paint effect). Checking only the body class left
	// a gap where both "menu open" and "modal open" read false, which made the
	// folder-menu step rewind while the sub-folder modal was actually open.
	Boolean( document.querySelector( SELECTORS.folderModal ) ) || document.body.classList.contains( 'folder-creation-modal-open' );

/**
 * Show "All Media" in the grid. Creating a folder switches the grid's filter to
 * that (empty) folder, so steps that need media tiles reset the view first.
 */
export const showAllMedia = () => {
	const allMedia = document.querySelector( SELECTORS.allMedia );
	if ( allMedia && ! allMedia.classList.contains( 'folder-list__item--active' ) ) {
		allMedia.click();
		return;
	}
	// The sidebar can still say "All Media" while the grid's own folder filter
	// points at the new folder — reset the filter directly in that case.
	const filter = document.querySelector( '#wp-media-grid #media-folder-filter' );
	if ( filter && filter.value && ! [ 'all', '-1', '' ].includes( String( filter.value ) ) ) {
		allMedia?.click();
	}
};

/**
 * Whether the media grid has finished loading and has no items to show.
 *
 * @return {boolean} True when the current view is empty.
 */
export const isGridEmpty = () => Boolean( $visible( SELECTORS.noMedia ) ) && ! document.querySelector( SELECTORS.gridSpinner );

/**
 * Whether the media grid is in Bulk select mode.
 *
 * @return {boolean} True in select mode.
 */
export const isSelectMode = () => Boolean( document.querySelector( '#wp-media-grid .media-frame.mode-select' ) );

/**
 * Whether the "Move to folder" picker is open.
 *
 * @return {boolean} True while it is open.
 */
export const isMoveModalOpen = () => Boolean( document.querySelector( SELECTORS.moveModal ) );

/**
 * Whether a folder context menu is open.
 *
 * @return {boolean} True while it is open.
 */
export const isContextMenuOpen = () => Boolean( document.querySelector( SELECTORS.contextMenu ) );

/**
 * Make sure the folder sidebar is expanded (the tour points at it constantly).
 */
export const ensureSidebarOpen = () => {
	const sidebar = document.querySelector( SELECTORS.sidebar );
	if ( sidebar?.classList.contains( 'hide-sidebar' ) ) {
		document.querySelector( SELECTORS.sidebarToggle )?.click();
	}
};

/**
 * Expand a folder in the tree so its children render (sub-folders are hidden
 * under a collapsed parent).
 *
 * @param {number} id Parent folder id.
 * @return {boolean} True when a click was sent to expand the folder.
 */
export const expandFolder = ( id ) => {
	const row = document.querySelector( folderRow( id ) );
	const chevron = row?.querySelector( '.tree-item__chevron' );
	if ( chevron && ! chevron.querySelector( '.tree-item__chevron_open' ) ) {
		chevron.click();
		return true;
	}
	return false;
};

/**
 * Read a folder's display name from its tree row.
 *
 * @param {number} id Folder id.
 * @return {string} Folder name, or ''.
 */
export const folderName = ( id ) => ( 0 === Number( id ) ? __( 'Uncategorized', 'godam' ) : document.querySelector( `${ folderRow( id ) } .tree-item__text` )?.textContent?.trim() || '' );
