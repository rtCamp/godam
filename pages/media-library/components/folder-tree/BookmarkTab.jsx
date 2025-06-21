
/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Panel, PanelBody, Notice } from '@wordpress/components';
import { lock as bookmarkIcon, starFilled } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import BookmarkItem from './BookmarkItem.jsx';
import './css/bookmark.scss';

const BookmarkTab = () => {
	const folders = useSelector( ( state ) => state.FolderReducer.folders );

	// Get all the bookmarks from folder where `meta.bookmark` is true
	// and sort them by name (case-insensitive)
	const bookmarks = folders
		?.filter( ( folder ) => folder.meta?.bookmark )
		?.sort( ( a, b ) => a.name.toLowerCase().localeCompare( b.name.toLowerCase() ) ) || [];

	// Empty state with better messaging and action
	if ( ! bookmarks || bookmarks.length === 0 ) {
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

	// Success state with bookmarks
	return (
		<div className="godam-bookmark-tab">
			<Panel className="godam-bookmark-panel">
				<PanelBody
					title={
						sprintf(
							/* translators: %d: number of bookmarks */
							__( 'Bookmarks (%d)', 'godam' ),
							bookmarks.length,
						)
					}
					icon={ bookmarkIcon }
					initialOpen={ true }
				>
					{ bookmarks.length > 5 && (
						<Notice
							status="info"
							isDismissible={ false }
							className="godam-bookmark-tab__notice"
						>
							{ sprintf(
								/* translators: %d: number of bookmarks */
								__( 'You have %d bookmarks. Consider organizing them into categories.', 'godam' ),
								bookmarks.length,
							) }
						</Notice>
					) }

					<div className="godam-bookmark-tab__list">
						{ bookmarks.map( ( bookmark, index ) => (
							<BookmarkItem
								item={ bookmark }
								key={ bookmark.id }
								index={ index }
								totalCount={ bookmarks.length }
							/>
						) ) }
					</div>
				</PanelBody>
			</Panel>
		</div>
	);
};

export default BookmarkTab;
