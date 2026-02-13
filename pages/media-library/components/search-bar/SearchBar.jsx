/**
 * External dependencies
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * WordPress dependencies
 */
import { SearchControl, Button, Popover } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { changeSelectedFolder, expandParents } from '../../redux/slice/folders';
import { useSearchFoldersQuery } from '../../redux/api/folders';
import { triggerFilterChange } from '../../data/media-grid';
import { useDispatch } from 'react-redux';
import './css/searchbar.scss';

/**
 * SearchBar component for searching media folders in the sidebar.
 *
 * @return {JSX.Element} The SearchBar component.
 */
const SearchBar = () => {
	const dispatch = useDispatch();

	const [ searchTerm, setSearchTerm ] = useState( '' );
	const [ debouncedSearchTerm, setDebouncedSearchTerm ] = useState( '' );

	const [ currentPage, setCurrentPage ] = useState( 1 );
	const [ searchResults, setSearchResults ] = useState( [] );
	const [ showPopover, setShowPopover ] = useState( null );

	const inputRef = useRef();
	const popoverRef = useRef();
	const lastFetchedPage = useRef( 1 );

	/**
	 * Fetch search results.
	 * Skips the query if the debounced search term is empty.
	 */
	const { data, isFetching, isError } = useSearchFoldersQuery(
		{ searchTerm: debouncedSearchTerm, page: currentPage, perPage: 10 },
		{ skip: debouncedSearchTerm.trim().length === 0 },
	);

	const isDebouncing = searchTerm.length > 0 && searchTerm !== debouncedSearchTerm;

	const totalPages = data?.totalPages || 0;

	/**
	 * Debounce the search term and reset pagination/results.
	 */
	useEffect( () => {
		const handler = setTimeout( () => {
			setDebouncedSearchTerm( searchTerm );
			setCurrentPage( 1 );
		}, 500 );

		return () => {
			clearTimeout( handler );
		};
	}, [ searchTerm ] );

	/**
	 * Update lastFetchedPage whenever currentPage changes.
	 */
	useEffect( () => {
		lastFetchedPage.current = currentPage;
	}, [ currentPage ] );

	/**
	 * Update search results based on fetched data.
	 * Appends new results when loading more pages, or replaces them when it's the first page.
	 */
	useEffect( () => {
		if ( isFetching || ! data?.items ) {
			return;
		}

		if ( lastFetchedPage.current === 1 ) {
			setSearchResults( data.items );
		} else {
			setSearchResults( ( prev ) => [ ...prev, ...data.items ] );
		}
	}, [ data, searchTerm, debouncedSearchTerm, isFetching ] );

	/**
	 * Handles closing the popover.
	 */
	const handleClosePopover = useCallback( () => {
		if ( ! isFetching ) {
			setShowPopover( null );
		}
	}, [ isFetching ] );

	/**
	 * Event handler for mousedown events to detect clicks outside the popover.
	 *
	 * @param {MouseEvent} event The mousedown event.
	 */
	const handleClickOutside = useCallback( ( event ) => {
		if (
			popoverRef.current &&
			! popoverRef.current.contains( event.target ) &&
			! inputRef.current.contains( event.target )
		) {
			handleClosePopover();
		}
	}, [ handleClosePopover ] );

	/**
	 * Handle clicks outside the popover and search input to close the popover.
	 */
	useEffect( () => {
		if ( showPopover ) {
			document.addEventListener( 'mousedown', handleClickOutside );
		}

		return () => {
			document.removeEventListener( 'mousedown', handleClickOutside );
		};
	}, [ showPopover, isFetching, handleClickOutside ] );

	/**
	 * Handle changes in the search input.
	 * Updates the searchTerm state and toggles the popover visibility.
	 *
	 * @param {string} value The new value of the search input.
	 */
	const handleSearchChange = ( value ) => {
		setSearchTerm( value );
		if ( value.length > 0 && inputRef.current ) {
			setShowPopover( inputRef.current );
		} else {
			setShowPopover( null );
		}
	};

	/**
	 * Handle folder selection from the search results.
	 * Triggers filter changes, updates selected folder, expands parent folders,
	 * and resets the search UI.
	 *
	 * @param {string} folderId The ID of the selected folder.
	 */
	const handleFolderSelect = ( folderId ) => {
		triggerFilterChange( folderId );
		dispatch( changeSelectedFolder( { item: { id: folderId } } ) );
		dispatch( expandParents( { id: folderId } ) );

		setSearchTerm( '' );
		setCurrentPage( 1 );
		setShowPopover( null );
		setSearchResults( [] );
	};

	/**
	 * Handles the "Load More" button click.
	 * Increments the currentPage if there are more pages to load and not currently fetching.
	 */
	const handleLoadMore = () => {
		if ( currentPage < totalPages && ! isFetching ) {
			setCurrentPage( ( prev ) => prev + 1 );
		}
	};

	return (
		<div className="folder-search-bar-container" ref={ inputRef }>
			<SearchControl
				placeholder={ __( 'Search folder', 'godam' ) }
				onChange={ handleSearchChange }
				className="search-input"
				value={ searchTerm }
				__nextHasNoMarginBottom
			/>
			{ showPopover && (
				<Popover
					anchor={ showPopover }
					onClose={ handleClosePopover }
					className="search-results-popover"
					focusOnMount={ false }
					placement="bottom-start"
					offset={ 8 }
				>
					<div className="search-results-popover-content" ref={ popoverRef }>
						{ ! isFetching && ! isError && searchResults.length === 0 && debouncedSearchTerm.length > 0 && (
							<div className="search-no-results">{ __( 'No folders found.', 'godam' ) }</div>
						) }
						{ ! isFetching && debouncedSearchTerm.length > 0 && searchResults.length > 0 && ! isDebouncing && (
							<div className="search-results-list">
								<ul>
									{ searchResults.map( ( folder ) => (
										<li key={ folder.id }>
											<Button
												className="search-result-item"
												onClick={ () => handleFolderSelect( folder.id ) }
											>
												{ folder.name }
											</Button>
										</li>
									) ) }
									{ currentPage < totalPages && (
										<div className="search-load-more">
											<Button
												onClick={ handleLoadMore }
												isBusy={ isFetching && currentPage > 1 }
												disabled={ isFetching }
												variant="secondary"
											>
												{ __( 'Load More', 'godam' ) }
											</Button>
										</div>
									) }
								</ul>
							</div>
						) }
						{ isFetching && <div className="search-loading">{ currentPage <= 1 ? __( 'Searching…', 'godam' ) : __( 'Loading more results…', 'godam' ) }</div> }
						{ ! isFetching && isError && <div className="search-error">{ __( 'Error fetching results.', 'godam' ) }</div> }
					</div>
				</Popover>
			) }
		</div>
	);
};

export default SearchBar;
