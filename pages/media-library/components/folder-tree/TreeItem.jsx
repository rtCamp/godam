/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Icon, file, chevronDown, chevronUp } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { toggleOpenClose, changeSelectedFolder } from '../../redux/slice/folders';

const indentPerLevel = 12;

const TreeItem = ( { item, mode, level, index } ) => {
	const dispatch = useDispatch();

	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );

	const handleClick = () => {
		dispatch( toggleOpenClose( { id: item.id } ) );
		dispatch( changeSelectedFolder( { item } ) );
	};

	return (
		<>
			<div className={ `w-full py-2 px-2 hover:bg-gray-200 rounded-sm relative ${
				item.id === selectedFolder?.id ? 'border-2 border-blue-500' : ''
			}` }>
				<button
					style={ { paddingLeft: level * indentPerLevel } }
					className="w-full text-left flex items-center justify-between"
					data-index={ index }
					onClick={ () => handleClick() }
				>

					<div className="flex items-center gap-2">
						<Icon icon={ file } />
						<span className="text-sm text-gray-700">{ item.name }</span>
					</div>

					{ item.children.length > 0 &&
						<Icon icon={ item.isOpen ? chevronUp : chevronDown } />
					}
				</button>
			</div>

			{ item.children.length > 0 && item.isOpen ? (
				<div>
					{ item.children.map( ( child, childIndex ) => (
						<TreeItem key={ child.id } item={ child } level={ level + 1 } mode={ mode } index={ childIndex } />
					) ) }
				</div>
			) : null }
		</>
	);
};

export default TreeItem;
