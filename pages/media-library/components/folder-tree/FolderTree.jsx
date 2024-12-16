
/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * Internal dependencies
 */
import TreeItem from './TreeItem.jsx';

const FolderTree = () => {
	const data = useSelector( ( state ) => state.FolderReducer.folders );

	return (
		<div className="flex justify-center w-full">
			<div className="w-full" id="tree">
				{ data.map( ( item, index, array ) => {
					const type = ( () => {
						if ( item.children.length && item.isOpen ) {
							return 'expanded';
						}

						if ( index === array.length - 1 ) {
							return 'last-in-group';
						}

						return 'standard';
					} )();

					return <TreeItem item={ item } level={ 0 } key={ item.id } mode={ type } index={ index } />;
				} ) }
			</div>
		</div>
	);
};

export default FolderTree;
