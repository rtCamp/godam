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

const SearchBar = () => {
	const dispatch = useDispatch();
	const [ searchTerm, setSearchTerm ] = useState( '' );
	const [ debouncedSearchTerm, setDebouncedSearchTerm ] = useState( '' );
	const [ currentPage, setCurrentPage ] = useState( 1 );
	const [ showPopover, setShowPopover ] = useState( null );
	const [ searchResults, setSearchResults ] = useState( [] );
	const inputRef = useRef();
	const popoverRef = useRef();
	const lastFetchedPage = useRef( 1 );

	useEffect( () => {
		const handler = setTimeout( () => {
			setDebouncedSearchTerm( searchTerm );
			setCurrentPage( 1 );
			setSearchResults( [] );
		}, 500 );

		return () => {
			clearTimeout( handler );
		};
	}, [ searchTerm ] );

	useEffect( () => {
		lastFetchedPage.current = currentPage;
	}, [ currentPage ] );

	const { data, isFetching, isError } = useSearchFoldersQuery(
		{ searchTerm: debouncedSearchTerm, page: currentPage, perPage: 10 },
		{ skip: debouncedSearchTerm.trim().length === 0 },
	);

	const totalPages = data?.totalPages || 0;

	useEffect( () => {
		if ( ! data?.items ) {
			return;
		}

		if ( lastFetchedPage.current === 1 ) {
			setSearchResults( data.items );
		} else {
			setSearchResults( ( prev ) => [ ...prev, ...data.items ] );
		}
	}, [ data ] );

	const handleSearchChange = ( value ) => {
		setSearchTerm( value );
		if ( value.length > 0 && inputRef.current ) {
			setShowPopover( inputRef.current );
		} else {
			setShowPopover( null );
		}
	};

	const handleFolderSelect = ( folderId ) => {
		triggerFilterChange( folderId );
		dispatch( changeSelectedFolder( { item: { id: folderId } } ) );
		dispatch( expandParents( { id: folderId } ) );

		setSearchTerm( '' );
		setCurrentPage( 1 );
		setShowPopover( null );
		setSearchResults( [] );
	};

	const handleLoadMore = () => {
		if ( currentPage < totalPages && ! isFetching ) {
			setCurrentPage( ( prev ) => prev + 1 );
		}
	};

	const handleClosePopover = useCallback( () => {
		if ( ! isFetching ) {
			setShowPopover( null );
		}
	}, [ isFetching ] );

	useEffect( () => {
		const handleClickOutside = ( event ) => {
			if (
				popoverRef.current &&
					! popoverRef.current.contains( event.target ) &&
					! inputRef.current.contains( event.target )
			) {
				handleClosePopover();
			}
		};

		if ( showPopover ) {
			document.addEventListener( 'mousedown', handleClickOutside );
		}

		return () => {
			document.removeEventListener( 'mousedown', handleClickOutside );
		};
	}, [ showPopover, isFetching, handleClosePopover ] );

	return (
		<div className="folder-search-bar-container" ref={ inputRef }>
			<SearchControl
				placeholder={ __( 'Search folders…', 'godam' ) }
				onChange={ handleSearchChange }
				className="search-input"
				value={ searchTerm }
				__nextHasNoMarginBottom
			/>
			{ showPopover && (
				<Popover
					anchorRef={ showPopover }
					onClose={ handleClosePopover }
					className="search-results-popover"
					focusOnMount={ false }
					placement="bottom-start"
					offset={ 8 }
				>
					<div className="search-results-popover-content" ref={ popoverRef }>
						{ ! isFetching && ! isError && searchResults.length === 0 && searchTerm.length > 0 && (
							<div className="search-no-results">{ __( 'No folders found.', 'godam' ) }</div>
						) }
						{ debouncedSearchTerm.length > 0 && searchResults.length > 0 && (
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
