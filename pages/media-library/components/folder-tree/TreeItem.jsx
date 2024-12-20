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

	const selectedFolderID = useSelector( ( state ) => state.FolderReducer.selectedFolder?.id );

	const handleClick = () => {
		/**
		 * This function triggers the select box change outside of the react component.
		 *
		 * @param {number} itemId The ID of the folder to be selected
		 */
		function triggerFilterChange( itemId ) {
			// Find the select box for the media library folder filter.
			const selectBox = document.querySelector( '#media-attachment-taxonomy-filter' );

			if ( selectBox ) {
				selectBox.value = itemId;

				// Manually trigger the change event to update the media library.
				const changeEvent = new Event( 'change', { bubbles: true } );
				selectBox.dispatchEvent( changeEvent );
			}
		}

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
				className={ `w-full py-2 px-2 rounded-md relative hover:bg-gray-200 tree-item
					${ item.id === selectedFolderID ? 'bg-gray-200' : '' } 
					${ isDragging ? 'indicator-parent' : '' }

				` }
				data-id={ item.id }
				ref={ setNodeRef }
				style={ style }
				{ ...attributes }
				{ ...listeners }
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

					{ item.children?.length > 0 &&
						<Icon icon={ item.isOpen ? chevronUp : chevronDown } />
					}
				</button>
			</div>
		</>
	);
};

export default TreeItem;
