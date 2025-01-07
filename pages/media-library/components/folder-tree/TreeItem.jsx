/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * WordPress dependencies
 */
import { Icon, file, chevronDown, chevronUp } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { toggleOpenClose, changeSelectedFolder } from '../../redux/slice/folders';
import { triggerFilterChange } from '../../data/media-grid';
import './css/tree-item.scss';

const indentPerLevel = 12;

const TreeItem = ( { item, index, depth } ) => {
	const { attributes, listeners, transform, transition, setNodeRef, isDragging } = useSortable( { id: item.id } );

	const dispatch = useDispatch();

	const selectedFolderID = useSelector( ( state ) => state.FolderReducer.selectedFolder?.id );

	const handleClick = () => {
		triggerFilterChange( item.id );

		dispatch( toggleOpenClose( { id: item.id } ) );
		dispatch( changeSelectedFolder( { item } ) );
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
			>
				<button
					style={ { paddingLeft: `${ depth * indentPerLevel }px` } }
					className={ `tree-item__button ${
						isDragging ? 'tree-item__button--dragging' : ''
					}` }
					data-index={ index }
					onClick={ () => handleClick() }
				>
					<div className="tree-item__content">
						<Icon icon={ file } />
						<span className="tree-item__text">{ item.name }</span>
					</div>

					{ item.children?.length > 0 &&
						<Icon icon={ item.isOpen ? chevronUp : chevronDown } />
					}
				</button>
			</div>
		</>
	);
};

export default TreeItem;
