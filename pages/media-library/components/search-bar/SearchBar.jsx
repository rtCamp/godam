/**
 * External dependencies
 */
import React from 'react';

/**
 * WordPress dependencies
 */
import { TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { changeSelectedFolder } from '../../redux/slice/folders';
import { useSearchFoldersQuery } from '../../redux/api/folders';

const SearchBar = () => {
	return (
		<div className="folder-search-bar-container">
			<TextControl
				placeholder={ __( 'Search folders…', 'godam' ) }
				className="search-input"
			/>
		</div>
	);
};

export default SearchBar;
