/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

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
import { useGetFoldersQuery } from '../../redux/api/folders.js';
import { useEffect, useRef } from 'react';
import { initializeBookmarks } from '../../redux/slice/folders.js';

const BookmarkTab = ( { handleContextMenu } ) => {
	const { data: bookmarkData, isLoading: isBookmarkLoading } = useGetFoldersQuery( { bookmark: true } );
	const dispatch = useDispatch();
	const initializedRef = useRef( false );

	useEffect( () => {
		if ( ! isBookmarkLoading && bookmarkData && initializedRef.current === false ) {
			dispatch( initializeBookmarks( bookmarkData?.data || [] ) );
			initializedRef.current = true;
		}
	}, [ isBookmarkLoading, bookmarkData, dispatch ] );

	const bookmarks = useSelector( ( state ) => state.FolderReducer?.bookmarks || [] );

	const bookmarkCount = bookmarks?.length;

	if ( bookmarkCount === 0 ) {
		return (
			<div className="godam-folder-tab godam-folder-tab--empty no-drop">
				<Panel className="godam-folder-tab-panel">
					<PanelBody
						title={ <><span className="folder-tab__count">{ bookmarkCount }</span> { __( 'Bookmarks', 'godam' ) } </> }
						initialOpen={ false }
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
		<div className="godam-folder-tab no-drop">
			<Panel className="godam-folder-tab-panel">
				<PanelBody
					title={ <><span className="folder-tab__count">{ bookmarkCount }</span> { __( 'Bookmarks', 'godam' ) } </> }
					initialOpen={ false }
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
