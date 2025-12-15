/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * WordPress dependencies
 */
import { Icon, file, lock, starFilled } from '@wordpress/icons';
import { CheckboxControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { toggleOpenClose, changeSelectedFolder, toggleMultiSelectedFolder } from '../../redux/slice/folders';
import { triggerFilterChange } from '../../data/media-grid';
import './css/tree-item.scss';
import { FolderTreeChevron } from '../icons';
import { utilities } from '../../data/utilities';

const indentPerLevel = 12;

const TreeItem = ( { item, index, depth, onContextMenu, isMultiSelecting } ) => {
	const { attributes, listeners, transform, transition, setNodeRef, isDragging } = useSortable( { id: item.id } );

	const dispatch = useDispatch();

	const selectedFolderID = useSelector( ( state ) => state.FolderReducer.selectedFolder?.id );

	const multiSelectedFolderIds = useSelector( ( state ) => state.FolderReducer.multiSelectedFolderIds );
	const isChecked = multiSelectedFolderIds.includes( item.id );

	const allFolders = useSelector( ( state ) => state.FolderReducer.folders );

	const isLockedOrParentLocked = utilities.isAnyParentLocked( item.id, allFolders );

	/**
	 * Handle click on the tree item to change the selected folder
	 * and trigger the filter change in the media grid.
	 */
	const handleClick = () => {
		triggerFilterChange( item.id );

		dispatch( changeSelectedFolder( { item } ) );
	};

	const handleCheckboxChange = () => {
		dispatch( toggleMultiSelectedFolder( { id: item.id } ) );
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
				} ${ isDragging ? 'tree-item--dragging' : '' } ${ item.meta?.locked ? 'no-drop' : '' }` }
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
						} } role="button" tabIndex={ 0 } aria-label={ item.isOpen ? __( 'Collapse folder', 'godam' ) : __( 'Expand folder', 'godam' ) } >
							<FolderTreeChevron className={ item.isOpen ? 'tree-item__chevron_open' : '' } />
						</span>
						: <span className="tree-item__spacer" />
					}
					{ isMultiSelecting && (
						<CheckboxControl
							className="tree-item__checkbox"
							checked={ isChecked }
							onChange={ handleCheckboxChange }
							onClick={ ( e ) => e.stopPropagation() }
							__nextHasNoMarginBottom
							disabled={ isLockedOrParentLocked }
						/>
					) }
					<div className="tree-item__content">
						<Icon icon={ file } />
						<span className="tree-item__text">{ item.name }</span>
						<span className="tree-item__status">
							{ item.meta?.locked && <Icon icon={ lock } /> }
							{ item.meta?.bookmark && <Icon icon={ starFilled } className="bookmark-star" /> }
							<span className="tree-item__count">
								{ item.attachmentCount ?? 0 }
							</span>
						</span>
					</div>
				</button>
			</div>
		</>
	);
};

export default TreeItem;
