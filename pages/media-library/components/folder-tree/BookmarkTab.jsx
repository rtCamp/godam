/**
 * External dependencies
 */
import { useSelector } from 'react-redux';
import { useMemo } from 'react';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Panel, PanelBody } from '@wordpress/components';
import { lock as bookmarkIcon, starFilled } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import BookmarkItem from './BookmarkItem.jsx';
import './css/bookmark.scss';

const BookmarkTab = () => {
	const folders = useSelector( ( state ) => state.FolderReducer?.folders || [] );

	// Get all the bookmarks from folder where `meta.bookmark` is true
	// and sort them by name (case-insensitive)
	const bookmarks = useMemo( () => {
		return folders
			?.filter( ( folder ) => folder?.meta?.bookmark )
			?.sort( ( a, b ) => a?.name?.toLowerCase().localeCompare( b?.name?.toLowerCase() ) ) || [];
	}, [ folders ] );

	const bookmarkCount = bookmarks?.length || 0;

	const panelTitle = useMemo( () => {
		return sprintf(
			/* translators: %d: number of bookmarks */
			__( 'Bookmarks (%d)', 'godam' ),
			bookmarkCount,
		);
	}, [ bookmarkCount ] );

	if ( bookmarkCount === 0 ) {
		return (
			<div className="godam-bookmark-tab godam-bookmark-tab--empty">
				<Panel className="godam-bookmark-panel">
					<PanelBody
						title={ __( 'Bookmarks', 'godam' ) }
						icon={ bookmarkIcon }
						initialOpen={ true }
					>
						<div className="godam-bookmark-tab__empty-state">
							<div className="godam-bookmark-tab__empty-icon">
								{ starFilled }
							</div>
							<h4>{ __( 'No bookmarks yet', 'godam' ) }</h4>
						</div>
					</PanelBody>
				</Panel>
			</div>
		);
	}

	return (
		<div className="godam-bookmark-tab">
			<Panel className="godam-bookmark-panel">
				<PanelBody
					title={ panelTitle }
					icon={ bookmarkIcon }
					initialOpen={ true }
				>
					<div className="godam-bookmark-tab__list">
						{ bookmarks.map( ( bookmark, index ) => (
							<BookmarkItem
								item={ bookmark }
								key={ bookmark?.id || index }
								index={ index }
								totalCount={ bookmarkCount }
							/>
						) ) }
					</div>
				</PanelBody>
			</Panel>
		</div>
	);
};

export default BookmarkTab;
