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

const indentPerLevel = 12;

const TreeItem = ( { item, index } ) => {
	const { attributes, listeners, transform, transition, setNodeRef } = useSortable( { id: item.id } );

	const dispatch = useDispatch();

	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );

	const handleClick = () => {
		dispatch( toggleOpenClose( { id: item.id } ) );
		dispatch( changeSelectedFolder( { item } ) );
	};
	const style = {
		transform: CSS.Transform.toString( transform ),
		transition,
	};

	return (
		<>
			<div
				className={ `w-full py-2 px-2 hover:bg-gray-200 rounded-sm relative ${
					item.id === selectedFolder?.id ? 'border-2 border-blue-500' : ''
				}` }
				ref={ setNodeRef }
				{ ...attributes }
				{ ...listeners }
				style={ style }
			>
				<button
					style={ { paddingLeft: `${ item.depth * indentPerLevel }px` } }
					className="w-full text-left flex items-center justify-between"
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
