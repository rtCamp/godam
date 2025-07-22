/**
 * External dependencies
 */
import React, { useState, useRef } from 'react';

/**
 * WordPress dependencies
 */
import { SearchControl, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { changeSelectedFolder } from '../../redux/slice/folders';
import { useSearchFoldersQuery } from '../../redux/api/folders';
import { useDispatch } from 'react-redux';

const SearchBar = () => {
	const dispatch = useDispatch();
	const [ searchTerm, setSearchTerm ] = useState( '' );
	const [ currentPage, setCurrentPage ] = useState( 1 );
	const inputRef = useRef();

	const { data, isFetching, isError } = useSearchFoldersQuery(
		{ searchTerm, page: currentPage, perPage: 10 },
		{ skip: ! searchTerm.length > 0 },
	);

	const searchResults = data?.items || [];
	const totalPages = data?.totalPages || 0;

	const handleSearchChange = ( value ) => {
		setSearchTerm( value );
	};

	const handleFolderSelect = ( folderId ) => {
		dispatch( changeSelectedFolder( { item: { id: folderId } } ) );
		setSearchTerm( '' );
		setCurrentPage( 1 );
		if ( inputRef.current ) {
			inputRef.current.querySelector( 'input' ).value = ''; // Clear input field
		}
	};

	return (
		<div className="folder-search-bar-container" ref={ inputRef }>
			<SearchControl
				placeholder={ __( 'Search folders…', 'godam' ) }
				onChange={ handleSearchChange }
				className="search-input"
				value={ searchTerm }
				__nextHasNoMarginBottom
			/>
			{ isFetching && <div className="search-loading">{ __( 'Searching…', 'godam' ) }</div> }
			{ ! isFetching && isError && <div className="search-error">{ __( 'Error fetching results.', 'godam' ) }</div> }
			{ ! isFetching && ! isError && searchResults.length === 0 && searchTerm.length > 0 && (
				<div className="search-no-results">{ __( 'No folders found.', 'godam' ) }</div>
			) }
			{ ! isFetching && searchTerm.length > 0 && searchResults.length > 0 && (
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
					</ul>
				</div>
			) }
		</div>
	);
};

export default SearchBar;
