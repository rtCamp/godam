/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * WordPress dependencies
 */
import { Icon, file } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { toggleOpenClose, changeSelectedFolder } from '../../redux/slice/folders';
import { triggerFilterChange } from '../../data/media-grid';
import './css/tree-item.scss';
import { FolderTreeChevron } from '../icons';

const indentPerLevel = 12;

const TreeItem = ( { item, index, depth, onContextMenu } ) => {
	const { attributes, listeners, transform, transition, setNodeRef, isDragging } = useSortable( { id: item.id } );

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

	/**
	 * Handle click on the chevron to toggle the open/close state of the folder.
	 *
	 * @param {Event} e - The event object.
	 */
	const handleChevronClick = ( e ) => {
		e.stopPropagation();
		dispatch( toggleOpenClose( { id: item.id } ) );
	};

	const style = {
		transform: CSS.Transform.toString( transform ),
		transition,
		'--spacing': `${ indentPerLevel * depth }px`,
	};

	return (
		<>
			<div
				className={ `tree-item ${
					item.id === selectedFolderID ? 'tree-item--active' : ''
				} ${ isDragging ? 'tree-item--dragging' : '' }` }
				data-id={ item.id }
				ref={ setNodeRef }
				style={ style }
				{ ...attributes }
				{ ...listeners }
				onContextMenu={ ( e ) => onContextMenu( e, item.id ) }
			>
				<button
					style={ { paddingLeft: `${ depth * indentPerLevel }px` } }
					className={ `tree-item__button ${
						isDragging ? 'tree-item__button--dragging' : ''
					}` }
					data-index={ index }
					onClick={ () => handleClick() }
				>
					{ item.children?.length > 0
						? <span className="tree-item__chevron" onClick={ ( event ) => handleChevronClick( event ) } onKeyDown={ ( e ) => {
							if ( e.key === 'Enter' || e.key === ' ' ) {
								e.preventDefault(); handleChevronClick( e );
							}
						} } role="button" tabIndex={ 0 } aria-label={ item.isOpen ? 'Collapse folder' : 'Expand folder' } >
							<FolderTreeChevron className={ item.isOpen ? 'tree-item__chevron_open' : '' } />
						</span>
						: <span className="tree-item__spacer" />
					}
					<div className="tree-item__content">
						<Icon icon={ file } />
						<span className="tree-item__text">{ item.name }</span>
					</div>
				</button>
			</div>
		</>
	);
};

export default TreeItem;
