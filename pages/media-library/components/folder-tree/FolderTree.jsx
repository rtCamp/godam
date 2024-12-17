
/**
 * External dependencies
 */
import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { closestCenter, DndContext, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

/**
 * Internal dependencies
 */
import TreeItem from './TreeItem.jsx';
import { handleDrop, setTree } from '../../redux/slice/folders.js';

import { tree } from '../../data/utilities';

const FolderTree = () => {
	const data = useSelector( ( state ) => state.FolderReducer.folders );

	const [ activeId, setActiveId ] = useState( null );

	const dispatch = useDispatch();

	const flattenData = useMemo( () => tree.flattenTree( data ), [ data ] );

	function handleDragStart( event ) {
		setActiveId( event.active.id );
	}

	function handleDragOver() {
		// Optional: Logic for when item hovers over a different drop area.
	}

	function handleDragEnd( event ) {
		const { active, over } = event;
		if ( active.id !== over?.id ) {
			const activeIndex = flattenData.findIndex( ( { id } ) => id === active.id );
			const overIndex = flattenData.findIndex( ( { id } ) => id === over.id );
			const updatedItems = tree.arrayMove( flattenData, activeIndex, overIndex );

			dispatch( setTree( tree.buildTree( updatedItems ) ) );
		}
		setActiveId( null );
	}

	return (
		<DndContext
			collisionDetection={ closestCenter }
			onDragStart={ handleDragStart }
			onDragEnd={ handleDragEnd }
			onDragOver={ handleDragOver }
		>
			<div className="flex justify-center w-full">
				<div className="w-full" id="tree">
					<SortableContext items={ data } strategy={ verticalListSortingStrategy }>
						{ flattenData.map( ( item, index ) => {
							const type = ( () => {
								return 'standard';
							} )();
							return <TreeItem item={ item } key={ item.id }/>;
						} ) }
					</SortableContext>
				</div>
			</div>

			<DragOverlay>
				{ activeId ? (
					<div>
						{ flattenData.map( ( item ) =>
							item.id === activeId ? (
								<div key={ item.id }>{ `Dragging: ${ item.id }` }</div>
							) : null,
						) }
					</div>
				) : null }
			</DragOverlay>
		</DndContext>
	);
};

export default FolderTree;
