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
import './css/indicator.css';

const indentPerLevel = 12;

const TreeItem = ( { item, index, depth } ) => {
	const { attributes, listeners, transform, transition, setNodeRef, isDragging } = useSortable( { id: item.id } );

	const dispatch = useDispatch();

	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );

	const handleClick = () => {
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
				className={ `w-full py-2 px-2 rounded-md relative hover:bg-gray-200 
					${ item.id === selectedFolder?.id ? 'bg-gray-200' : '' } 
					${ isDragging ? 'indicator-parent' : '' }

				` }
				ref={ setNodeRef }
				{ ...attributes }
				{ ...listeners }
				style={ style }
			>
				<button
					style={ { paddingLeft: `${ depth * indentPerLevel }px` } }
					className={ `w-full text-left flex items-center justify-between
							${ isDragging ? 'indicator' : '' }
						` }
					data-index={ index }
					onClick={ () => handleClick() }
				>

					<div className="flex items-center gap-2">
						<Icon icon={ file } />
						<span className="text-sm text-gray-700">{ item.name }</span>
					</div>

					{ item.children && item.children.length > 0 &&
						<Icon icon={ item.isOpen ? chevronUp : chevronDown } />
					}
				</button>
			</div>
		</>
	);
};

export default TreeItem;
