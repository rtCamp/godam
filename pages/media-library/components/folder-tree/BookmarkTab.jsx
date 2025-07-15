/**
 * External dependencies
 */
import { useSelector } from 'react-redux';
import { useMemo } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Panel, PanelBody } from '@wordpress/components';
import { starFilled } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import TabItem from './TabItem.jsx';
import './css/foldertabs.scss';

const BookmarkTab = ( { handleContextMenu } ) => {
	const folders = useSelector( ( state ) => state.FolderReducer?.folders || [] );

	// Get all the bookmarks from folder where `meta.bookmark` is true
	// and sort them based on the currentSortOrder
	const bookmarks = useMemo( () => {
		return folders
			?.filter( ( folder ) => folder?.meta?.bookmark ) || [];
	}, [ folders ] );

	const bookmarkCount = bookmarks?.length || 0;

	if ( bookmarkCount === 0 ) {
		return (
			<div className="godam-folder-tab godam-folder-tab--empty">
				<Panel className="godam-folder-tab-panel">
					<PanelBody
						title={ <><span className="folder-tab__count">{ bookmarkCount }</span> { __( 'Bookmarks', 'godam' ) } </> }
						initialOpen={ true }
						icon={ starFilled }
					>
						<div className="godam-folder-tab__empty-state">
							<div className="godam-folder-tab__empty-icon">
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
		<div className="godam-folder-tab">
			<Panel className="godam-folder-tab-panel">
				<PanelBody
					title={ <><span className="folder-tab__count">{ bookmarkCount }</span> { __( 'Bookmarks', 'godam' ) } </> }
					initialOpen={ true }
					icon={ starFilled }
				>
					<div className="godam-folder-tab__list">
						{ bookmarks.map( ( bookmark, index ) => (
							<TabItem
								item={ bookmark }
								key={ bookmark?.id || index }
								index={ index }
								totalCount={ bookmarkCount }
								onContextMenu={ ( e, id ) => handleContextMenu( e, id, bookmark ) }
							/>
						) ) }
					</div>
				</PanelBody>
			</Panel>
		</div>
	);
};

export default BookmarkTab;
