/**
 * External dependencies
 */
import React, { useCallback, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, SelectControl } from '@wordpress/components';
const { __ } = wp.i18n;
/**
 * Internal dependencies
 */
import FolderTree from './components/folder-tree/FolderTree.jsx';
import ContextMenu from './components/context-menu/ContextMenu.jsx';

import {
	changeSelectedFolder,
	openModal,
	toggleMultiSelectMode,
	clearMultiSelectedFolders,
	setSortOrder,
	setCurrentContextMenuFolder,
} from './redux/slice/folders';
import { FolderCreationModal, RenameModal, DeleteModal } from './components/modal/index.jsx';
import { triggerFilterChange } from './data/media-grid.js';
import BookmarkTab from './components/folder-tree/BookmarkTab.jsx';
import LockedTab from './components/folder-tree/LockedTab.jsx';
import { useGetAllMediaCountQuery, useGetCategoryMediaCountQuery, useUpdateSidebarPreferenceMutation } from './redux/api/folders.js';
import SearchBar from './components/search-bar/SearchBar.jsx';

/**
 * Width below which the folder sidebar is a full-screen overlay rather than a column
 * (matches the `max-width: 900px` breakpoint in index.scss).
 */
const MOBILE_BREAKPOINT = 900;

/**
 * Whether the sidebar currently renders as a mobile overlay.
 *
 * An overlay covers the grid, so it always starts collapsed and expanding it is a
 * one-off action — the saved preference is neither read nor written at this width.
 *
 * @return {boolean} True on viewports narrower than the mobile breakpoint.
 */
const isMobileViewport = () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;

const App = () => {
	const dispatch = useDispatch();
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );
	const isMultiSelecting = useSelector( ( state ) => state.FolderReducer.isMultiSelecting );
	const currentSortOrder = useSelector( ( state ) => state.FolderReducer.sortOrder );
	const { data: allMediaCount, refetch: refetchAllMediaCount } = useGetAllMediaCountQuery();
	const { data: uncategorizedCount, refetch: refetchUncategorizedCount } = useGetCategoryMediaCountQuery( { folderId: 0 } );
	const [ updateSidebarPreference ] = useUpdateSidebarPreferenceMutation();

	const [ contextMenu, setContextMenu ] = useState( {
		visible: false,
		x: 0,
		y: 0,
		folderId: null,
	} );
	// The collapsed state is saved per user in user meta and sent back with the page, so
	// the sidebar opens the way this user last left it — except on mobile, which always
	// starts collapsed. wp_localize_script stringifies scalars, so the saved flag arrives
	// as '1' or ''.
	const [ isSidebarHidden, setIsSidebarHidden ] = useState(
		() => isMobileViewport() || Boolean( window.easydamMediaLibrary?.sidebarHidden ),
	);

	const handleClick = useCallback( ( id ) => {
		if ( isMultiSelecting ) {
			dispatch( clearMultiSelectedFolders() );
		}

		if ( id === -1 ) {
			triggerFilterChange( 'all' );
			dispatch( setCurrentContextMenuFolder( null ) );
		} else if ( id === 0 ) {
			triggerFilterChange( 'uncategorized' );
			dispatch( setCurrentContextMenuFolder( null ) );
		} else {
			triggerFilterChange( id );
		}

		dispatch( changeSelectedFolder( { item: { id } } ) );
	}, [ dispatch, isMultiSelecting ] );

	const closeFolderMenu = () => {
		const sidebar = document.getElementById( 'rt-transcoder-media-library-root' );
		if ( sidebar ) {
			sidebar.classList.add( 'hide-sidebar' );
		}
		const mediaModal = document.querySelector( '.media-modal-content' );
		if ( mediaModal ) {
			mediaModal.classList.add( 'hide-sidebar' );
		}
		setIsSidebarHidden( true );
	};

	// Sync the DOM with the collapsed state resolved above (saved preference, or always
	// collapsed on mobile).
	useEffect( () => {
		if ( isSidebarHidden ) {
			closeFolderMenu();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	// Listen for media type filter changes and refetch media count queries
	useEffect( () => {
		const handleMediaTypeChange = () => {
			refetchAllMediaCount();
			refetchUncategorizedCount();
		};

		document.addEventListener( 'godam-attachment-browser:changed', handleMediaTypeChange );

		return () => {
			document.removeEventListener( 'godam-attachment-browser:changed', handleMediaTypeChange );
		};
	}, [ refetchAllMediaCount, refetchUncategorizedCount ] );

	const toggleSidebar = ( e ) => {
		const target = e.target;

		const sidebar = target.closest( '#rt-transcoder-media-library-root' );

		const mediaModal = target.closest( '.media-modal-content' );
		const newHidden = ! isSidebarHidden;

		if ( sidebar ) {
			sidebar.classList.toggle( 'hide-sidebar', newHidden );
		}

		if ( mediaModal ) {
			mediaModal.classList.toggle( 'hide-sidebar', newHidden );
		}

		setIsSidebarHidden( newHidden );

		// Fire-and-forget, and desktop-only: on mobile the sidebar is a transient overlay,
		// so expanding it must not overwrite the choice the user made on a wide screen. A
		// failed save just means the next page load falls back to the stored state.
		if ( ! isMobileViewport() ) {
			updateSidebarPreference( newHidden );
		}
	};

	/**
	 * Open the folder menu, from either a right-click or a row's three-dot button.
	 *
	 * `anchor` is passed only by the three-dot button, which has no pointer position.
	 *
	 * @param {Event}       e        The originating contextmenu or click event.
	 * @param {number}      folderId Folder term ID the menu acts on.
	 * @param {Object}      folder   The folder object backing the row.
	 * @param {Object|null} anchor   Optional coordinates to open the menu at.
	 */
	const handleContextMenu = ( e, folderId, folder, anchor = null ) => {
		e.preventDefault(); // Prevent default browser context menu

		// The three-dot button (the only caller passing an anchor) toggles: pressing it
		// again on the folder whose menu is already open dismisses it.
		if ( anchor && contextMenu.visible && contextMenu.folderId === folderId ) {
			handleCloseContextMenu();
			return;
		}

		setContextMenu( {
			visible: true,
			// Right-click opens at the pointer; the button opens under itself, because a
			// button press carries no useful pointer position (keyboard activation reports
			// 0,0). ContextMenu clamps either one into the viewport.
			x: anchor ? anchor.x : e.clientX,
			y: anchor ? anchor.y : e.clientY,
			folderId,
		} );

		dispatch( setCurrentContextMenuFolder( folder ) );
	};

	const handleCloseContextMenu = () => {
		setContextMenu( ( prev ) => ( { ...prev, visible: false } ) );
	};

	return (
		<>
			<Button
				icon="plus-alt2"
				__next40pxDefaultSize
				variant="secondary"
				className="button--full close-folder-menu-mobile"
				onClick={ () => closeFolderMenu() }
			/>
			<Button
				id="media-folder-toggle-button"
				__next40pxDefaultSize
				variant="secondary"
				className="button--full toggle-folder-button"
				onClick={ toggleSidebar }
				icon={ isSidebarHidden ? 'arrow-right-alt2' : 'arrow-left-alt2' }
			/>
			<div className="control-buttons">
				<div className="button-group mb-spacing">
					<SearchBar />
					<Button
						icon="plus-alt2"
						__next40pxDefaultSize
						variant="primary"
						text={ __( 'New Folder', 'godam' ) }
						className="button--full mb-spacing new-folder-button"
						onClick={ () => {
							// Create at the ROOT from the top-level button. FolderCreationModal
							// derives the new folder's parent from currentContextMenuFolder, which
							// a prior right-click leaves set — without this clear, the top button
							// would nest the folder under the last right-clicked folder.
							dispatch( setCurrentContextMenuFolder( null ) );
							dispatch( openModal( 'folderCreation' ) );
						} }
					/>
				</div>
				<div className="button-group mb-spacing">
					<Button
						__next40pxDefaultSize
						className="multiselect-button"
						variant="secondary"
						text={ ! isMultiSelecting ? __( 'Bulk Select', 'godam' ) : __( 'Cancel', 'godam' ) }
						onClick={ () => dispatch( toggleMultiSelectMode() ) }
					/>
					<SelectControl
						value={ currentSortOrder }
						className="folder-sort-select"
						__next40pxDefaultSize
						options={ [
							{ label: __( 'By Name (A-Z)', 'godam' ), value: 'name-asc' },
							{ label: __( 'By Name (Z-A)', 'godam' ), value: 'name-desc' },
						] }
						onChange={ ( newOrder ) => dispatch( setSortOrder( newOrder ) ) }
					/>
				</div>
			</div>

			<div className="folder-container">
				<div className="folder-list">
					<button
						className={ `folder-list__item all-media ${
							selectedFolder.id === -1 ? 'folder-list__item--active' : ''
						}` }
						onClick={ () => handleClick( -1 ) }
					>
						<p className="folder-list__text">{ __( 'All Media', 'godam' ) }
							<span className="folder-list__count">{ allMediaCount ?? 0 }</span>
						</p>
					</button>

					<button
						className={ `folder-list__item tree-item ${
							selectedFolder.id === 0 ? 'folder-list__item--active' : ''
						}` }
						onClick={ () => handleClick( 0 ) }
						data-id={ 0 }
					>
						<p className="folder-list__text">{ __( 'Uncategorized', 'godam' ) }
							<span className="folder-list__count">{ uncategorizedCount?.count ?? 0 }</span>
						</p>
					</button>
				</div>

				<div className="folder-tabs">
					<BookmarkTab handleContextMenu={ handleContextMenu } />
					<LockedTab handleContextMenu={ handleContextMenu } />
				</div>

				<FolderTree handleContextMenu={ handleContextMenu } />
			</div>

			{ contextMenu.visible && (
				<ContextMenu
					x={ contextMenu.x }
					y={ contextMenu.y }
					folderId={ contextMenu.folderId }
					onClose={ handleCloseContextMenu }
				/>
			) }

			<FolderCreationModal />
			<RenameModal />
			<DeleteModal />
		</>
	);
};

export default App;
