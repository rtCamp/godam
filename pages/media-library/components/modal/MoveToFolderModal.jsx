/**
 * External dependencies
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Modal, SearchControl, Spinner } from '@wordpress/components';
import { Icon, lock } from '@wordpress/icons';
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { closeMoveToFolder, updatePage } from '../../redux/slice/folders';
import { useSearchFoldersQuery } from '../../redux/api/folders';
import { utilities } from '../../data/utilities';
import useMoveAttachments, { UNCATEGORIZED_ID } from '../../hooks/useMoveAttachments';
import { useIsPrimarySidebar } from '../../context/sidebar-root.jsx';
import './scss/modal.scss';
import './scss/move-to-folder-modal.scss';

/**
 * "Nothing chosen yet". Cannot be a falsy sentinel because Uncategorized is
 * folder id 0 and is a perfectly valid destination.
 */
const NO_TARGET = null;

/**
 * Number of search results fetched per page.
 */
const SEARCH_PER_PAGE = 20;

/**
 * DOM id prefix for the destination radios. Deliberately distinct from the details
 * field's `godam-move-to-folder-<attachmentId>` control: both are on the page at once,
 * so sharing a prefix let a folder whose term id matched the open attachment's id
 * collide, and a label click then activated the wrong element.
 */
const OPTION_ID_PREFIX = 'godam-move-to-folder-option-';

/**
 * Destination picker for the "Move to folder" flow.
 *
 * Opened from the grid toolbar button, the list-view bulk action, the attachment
 * details field and the folder context menu — every surface that exists because
 * drag-and-drop cannot work on touch devices.
 *
 * @return {JSX.Element|null} The modal, or null while closed.
 */
const MoveToFolderModal = () => {
	const dispatch = useDispatch();

	const isOpen = useSelector( ( state ) => state.FolderReducer.modals.moveToFolder );
	const { attachmentIds } = useSelector( ( state ) => state.FolderReducer.moveToFolderRequest );
	const folders = useSelector( ( state ) => state.FolderReducer.folders );
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );
	const page = useSelector( ( state ) => state.FolderReducer.page );

	const { moveAttachments, isMoving } = useMoveAttachments();

	// The picker is a page-level singleton fed by the shared store; only the owning app
	// renders it, so two live sidebars don't stack two dialogs (with two focus traps).
	const isPrimarySidebar = useIsPrimarySidebar();

	const [ searchTerm, setSearchTerm ] = useState( '' );
	const [ debouncedSearchTerm, setDebouncedSearchTerm ] = useState( '' );
	const [ targetFolderId, setTargetFolderId ] = useState( NO_TARGET );

	// Search paging: `searchPage` is the page being fetched, `searchResults` accumulates
	// every page fetched for the current term so a match past the first page is reachable.
	const [ searchPage, setSearchPage ] = useState( 1 );
	const [ searchResults, setSearchResults ] = useState( [] );

	const searchRef = useRef( null );

	const isSearching = debouncedSearchTerm.trim().length > 0;

	const { data: searchData, isFetching: isFetchingSearch } = useSearchFoldersQuery(
		{ searchTerm: debouncedSearchTerm, page: searchPage, perPage: SEARCH_PER_PAGE },
		{ skip: ! isSearching },
	);

	// Same 500ms as SearchBar, so typing in either field feels identical.
	useEffect( () => {
		const handler = setTimeout( () => setDebouncedSearchTerm( searchTerm ), 500 );

		return () => clearTimeout( handler );
	}, [ searchTerm ] );

	// A new search term starts paging over: page 1, and no carried-over results.
	useEffect( () => {
		setSearchPage( 1 );
		setSearchResults( [] );
	}, [ debouncedSearchTerm ] );

	// Accumulate fetched pages. Page 1 replaces (fresh term); later pages append, skipping
	// any id already held so an overlap at a page boundary can't list a folder twice.
	useEffect( () => {
		if ( ! searchData ) {
			return;
		}

		setSearchResults( ( previous ) => {
			if ( searchData.currentPage <= 1 ) {
				return searchData.items;
			}

			const seen = new Set( previous.map( ( folder ) => folder.id ) );

			return [ ...previous, ...searchData.items.filter( ( folder ) => ! seen.has( folder.id ) ) ];
		} );
	}, [ searchData ] );

	// Start every open from a clean slate — a destination left over from a previous
	// move would otherwise be pre-selected for a different set of attachments.
	useEffect( () => {
		if ( ! isOpen ) {
			return;
		}

		setSearchTerm( '' );
		setDebouncedSearchTerm( '' );
		setTargetFolderId( NO_TARGET );

		const focusTimer = setTimeout( () => searchRef.current?.focus(), 0 );

		return () => clearTimeout( focusTimer );
	}, [ isOpen ] );

	const rows = useMemo( () => {
		// Search results are a flat list whose ancestors may not be loaded, so they
		// carry no meaningful depth to indent by.
		const base = isSearching
			? searchResults.map( ( folder ) => ( { ...folder, depth: 0 } ) )
			: utilities.flattenTree( utilities.buildTree( folders ) );

		const destinations = [
			{
				id: UNCATEGORIZED_ID,
				name: __( 'Uncategorized', 'godam' ),
				depth: 0,
			},
			...base,
		];

		return destinations.map( ( folder ) => {
			// Uncategorized is not a term, so it can never be locked.
			const isLocked = folder.id !== UNCATEGORIZED_ID && (
				Boolean( folder.meta?.locked ) || utilities.isAnyParentLocked( folder.id, folders )
			);
			const isCurrent = folder.id === selectedFolder?.id;

			return {
				...folder,
				isLocked,
				isCurrent,
				isDisabled: isLocked || isCurrent,
			};
		} );
	}, [ isSearching, searchResults, folders, selectedFolder ] );

	const selectedFolderName = useMemo(
		() => rows.find( ( folder ) => folder.id === targetFolderId )?.name || '',
		[ rows, targetFolderId ],
	);

	// A folder picked from search results disappears from the list once the search is
	// cleared (the tree may not contain it), which would strand targetFolderId on a row
	// that is no longer shown — an invisible selection that still enables Move. Drop it so
	// the pending target and the visible list never disagree. Guarded on isFetchingSearch
	// so the momentary empty list mid-fetch doesn't clear a valid choice.
	useEffect( () => {
		if ( isFetchingSearch || targetFolderId === NO_TARGET ) {
			return;
		}

		const stillSelectable = rows.some(
			( folder ) => folder.id === targetFolderId && ! folder.isDisabled,
		);

		if ( ! stillSelectable ) {
			setTargetFolderId( NO_TARGET );
		}
	}, [ rows, targetFolderId, isFetchingSearch ] );

	// The folder tree is paginated and buildTree drops folders whose parent page hasn't
	// loaded, so deep trees need more pages to be reachable; search results page the same
	// way, so a match past the first page can be loaded rather than silently truncated.
	const canLoadMore = isSearching
		? ( !! searchData && searchData.currentPage < searchData.totalPages )
		: page.current < page.totalPages;

	const handleClose = () => {
		if ( ! isMoving ) {
			dispatch( closeMoveToFolder() );
		}
	};

	const handleSubmit = async () => {
		if ( targetFolderId === NO_TARGET || isMoving ) {
			return;
		}

		const { success } = await moveAttachments( {
			attachmentIds,
			targetFolderId,
			sourceFolderId: selectedFolder?.id,
		} );

		// Keep the modal open on failure so a different destination can be chosen
		// without starting over.
		if ( success ) {
			dispatch( closeMoveToFolder() );
		}
	};

	if ( ! isOpen || ! isPrimarySidebar ) {
		return null;
	}

	return (
		<Modal
			title={ __( 'Move to folder', 'godam' ) }
			className="modal__container move-to-folder"
			size="medium"
			onRequestClose={ handleClose }
			shouldCloseOnClickOutside={ ! isMoving }
			shouldCloseOnEsc={ ! isMoving }
		>
			{ /* Header / Search / Body / Footer. Modal offers no slots for these —
			     `headerActions` renders inside its own fixed 72px header row, too
			     small for a search field — so they are plain blocks that the SCSS
			     lays out as a flex column: only the body scrolls, and the count,
			     search field and actions all hold their place. */ }
			<div className="move-to-folder__header">
				<p className="modal__description">
					{ sprintf(
						/* translators: %d: number of media items being moved. */
						_n( 'Moving %d item to:', 'Moving %d items to:', attachmentIds.length, 'godam' ),
						attachmentIds.length,
					) }
				</p>
			</div>

			<div className="move-to-folder__search">
				<SearchControl
					ref={ searchRef }
					label={ __( 'Search folders', 'godam' ) }
					placeholder={ __( 'Search folders', 'godam' ) }
					value={ searchTerm }
					onChange={ setSearchTerm }
					__nextHasNoMarginBottom
				/>
			</div>

			<div className="move-to-folder__body">
				<div
					className="move-to-folder__list"
					role="radiogroup"
					aria-label={ __( 'Destination folder', 'godam' ) }
					data-test-id="move-to-folder-picker"
				>
					{ rows.map( ( folder ) => (
						<label
							key={ folder.id }
							htmlFor={ `${ OPTION_ID_PREFIX }${ folder.id }` }
							className={ `move-to-folder__option${ folder.isDisabled ? ' is-disabled' : '' }` }
							// Only the depth travels in the style attribute; the SCSS turns it
							// into padding, so the modal's spacing values stay in one place.
							style={ { '--godam-depth': folder.depth } }
						>
							<input
								type="radio"
								id={ `${ OPTION_ID_PREFIX }${ folder.id }` }
								name="godam-move-to-folder-target"
								value={ folder.id }
								checked={ targetFolderId === folder.id }
								disabled={ folder.isDisabled }
								onChange={ () => setTargetFolderId( folder.id ) }
							/>
							<span className="move-to-folder__option-name">{ folder.name }</span>
							{ folder.isLocked && (
								<Icon icon={ lock } size={ 16 } aria-label={ __( 'Locked folder', 'godam' ) } />
							) }
							{ folder.isCurrent && (
								<span className="move-to-folder__option-badge">{ __( 'Current', 'godam' ) }</span>
							) }
						</label>
					) ) }
				</div>

				{ isFetchingSearch && (
					<p className="move-to-folder__status"><Spinner /> { __( 'Searching…', 'godam' ) }</p>
				) }

				{ /* One row is always present (Uncategorized), so that alone means "no matches". */ }
				{ ! isFetchingSearch && isSearching && rows.length === 1 && (
					<p className="move-to-folder__status">{ __( 'No folders found.', 'godam' ) }</p>
				) }

				{ canLoadMore && ! isFetchingSearch && (
					<div className="move-to-folder__load-more">
						<Button
							variant="tertiary"
							onClick={ () => {
								if ( isSearching ) {
									setSearchPage( ( current ) => current + 1 );
								} else {
									dispatch( updatePage( { current: page.current + 1 } ) );
								}
							} }
						>
							{ __( 'Load more folders', 'godam' ) }
						</Button>
					</div>
				) }
			</div>

			<div className="modal__button-group move-to-folder__footer">
				<Button
					variant="primary"
					isBusy={ isMoving }
					disabled={ targetFolderId === NO_TARGET || isMoving || ! attachmentIds.length }
					onClick={ handleSubmit }
					text={ __( 'Move', 'godam' ) }
					data-test-id="move-to-folder-submit"
				/>
				<Button
					variant="secondary"
					disabled={ isMoving }
					onClick={ handleClose }
					text={ __( 'Cancel', 'godam' ) }
				/>

				{ selectedFolderName && (
					<span className="move-to-folder__selected">
						{ sprintf(
							/* translators: %s: name of the chosen destination folder. */
							__( 'Selected: %s', 'godam' ),
							selectedFolderName,
						) }
					</span>
				) }
			</div>
		</Modal>
	);
};

export default MoveToFolderModal;
