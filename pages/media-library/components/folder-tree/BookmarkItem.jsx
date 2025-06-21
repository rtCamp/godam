/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Icon, file, lock } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { changeSelectedFolder } from '../../redux/slice/folders';
import { triggerFilterChange } from '../../data/media-grid';
import './css/tree-item.scss';

const BookmarkItem = ( { item, index } ) => {
	const dispatch = useDispatch();

	const selectedFolderID = useSelector( ( state ) => state.FolderReducer.selectedFolder?.id );

	/**
	 * Handle click on the tree item to change the selected folder
	 * and trigger the filter change in the media grid.
	 */
	const handleClick = () => {
		triggerFilterChange( item.id );

		dispatch( changeSelectedFolder( { item } ) );
	};

	return (
		<>
			<div
				className={ `tree-item ${ item.id === selectedFolderID ? 'tree-item--active' : '' }` }
				data-id={ item.id }
			>
				<button
					className={ 'tree-item__button' }
					data-index={ index }
					onClick={ () => handleClick() }
				>
					<div className="tree-item__content">
						<Icon icon={ item.meta?.locked ? lock : file } />
						<span className="tree-item__text">{ item.name }</span>

						<span className="tree-item__count">
							{ item.attachmentCount ?? 0 }
						</span>
					</div>
				</button>
			</div>
		</>
	);
};

export default BookmarkItem;
