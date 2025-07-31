/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import { useCallback } from 'react';

/**
 * WordPress dependencies
 */
import { Icon, file } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { closeMediaLibrarySidebar } from '../../../../assets/src/js/media-library/utility';
import { changeSelectedFolder } from '../../redux/slice/folders';
import { triggerFilterChange } from '../../data/media-grid';
import './css/tree-item.scss';

const TabItem = ( { item, index, onContextMenu } ) => {
	const dispatch = useDispatch();
	const selectedFolderID = useSelector( ( state ) => state.FolderReducer?.selectedFolder?.id );

	const isActive = item?.id === selectedFolderID;
	const attachmentCount = item?.attachmentCount ?? 0;

	/**
	 * Handle click on the tree item to change the selected folder
	 * and trigger the filter change in the media grid.
	 */
	const handleClick = useCallback( () => {
		if ( item?.id ) {
			triggerFilterChange( item.id );
			dispatch( changeSelectedFolder( { item } ) );
			closeMediaLibrarySidebar();
		}
	}, [ dispatch, item ] );

	if ( ! item?.id ) {
		return null;
	}

	return (
		<div
			className={ `tree-item ${ isActive ? 'tree-item--active' : '' }` }
			data-id={ item.id }
			onContextMenu={ ( e ) => onContextMenu( e, item.id ) }
		>
			<button
				className="tree-item__button"
				data-index={ index }
				onClick={ handleClick }
			>
				<div className="tree-item__content">
					<Icon icon={ file } />
					<span className="tree-item__text">{ item?.name || '' }</span>
					<span className="tree-item__count">
						{ attachmentCount }
					</span>
				</div>
			</button>
		</div>
	);
};

export default TabItem;
