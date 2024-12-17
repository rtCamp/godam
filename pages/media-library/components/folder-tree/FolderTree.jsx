
/**
 * External dependencies
 */
import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { closestCenter, DndContext, DragOverlay, MouseSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

/**
 * Internal dependencies
 */
import TreeItem from './TreeItem.jsx';
import TreeItemPreview from './TreeItemPreview.jsx';

import { setTree } from '../../redux/slice/folders.js';
import { tree, newTree } from '../../data/utilities';

/** UTILITY FUNCTION START */

function getDragDepth( offset, indentationWidth ) {
	return Math.round( offset / indentationWidth );
}

function getProjection( items, activeId, overId, dragOffset, indentationWidth = 20 ) {
	const overItemIndex = items.findIndex( ( { id } ) => id === overId );
	const activeItemIndex = items.findIndex( ( { id } ) => id === activeId );
	const activeItem = items[ activeItemIndex ];
	const newItems = arrayMove( items, activeItemIndex, overItemIndex );
	const previousItem = newItems[ overItemIndex - 1 ];
	const nextItem = newItems[ overItemIndex + 1 ];
	const dragDepth = getDragDepth( dragOffset, indentationWidth );
	const projectedDepth = activeItem.depth + dragDepth;
	const maxDepth = getMaxDepth( { previousItem } );
	const minDepth = getMinDepth( { nextItem } );
	let depth = projectedDepth;

	if ( projectedDepth >= maxDepth ) {
		depth = maxDepth;
	} else if ( projectedDepth < minDepth ) {
		depth = minDepth;
	}

	return { depth, maxDepth, minDepth, parent: getParentId() };

	function getParentId() {
		if ( depth === 0 || ! previousItem ) {
			return null;
		}

		if ( depth === previousItem.depth ) {
			return previousItem.parent;
		}

		if ( depth > previousItem.depth ) {
			return previousItem.id;
		}

		const newParent = newItems
			.slice( 0, overItemIndex )
			.reverse()
			.find( ( item ) => item.depth === depth )?.parent;

		return newParent ?? null;
	}
}

function getMaxDepth( { previousItem } ) {
	if ( previousItem ) {
		return previousItem.depth + 1;
	}

	return 0;
}

function getMinDepth( { nextItem } ) {
	if ( nextItem ) {
		return nextItem.depth;
	}

	return 0;
}

function removeChildrenOf( items, ids ) {
	const excludeParentIds = [ ...ids ];

	return items.filter( ( item ) => {
		if ( item.parentId && excludeParentIds.includes( item.parentId ) ) {
			if ( item.children.length ) {
				excludeParentIds.push( item.id );
			}
			return false;
		}

		return true;
	} );
}

/** UTILITY FUNCTION END */

const FolderTree = () => {
	const data = useSelector( ( state ) => state.FolderReducer.folders );

	const [ activeId, setActiveId ] = useState( null );
	const [ overId, setOverId ] = useState( null );
	const [ offsetLeft, setOffsetLeft ] = useState( 0 );

	const dispatch = useDispatch();

	const flattenData = useMemo( () => {
		const flattenedTree = tree.flattenTree( newTree.buildTree( data ) );

		// get the children Id of the element where isOpen is false.
		const collapsedItems = flattenedTree.reduce( ( acc, item ) => {
			const { children, isOpen, id } = item;
			if ( ! isOpen && children.length ) {
				acc.push( id );
			}
			return acc;
		}, [] );

		return removeChildrenOf( flattenedTree, [ activeId, ...collapsedItems ] );
	}, [ data, activeId ] );

	const sortedIds = useMemo( () => flattenData.map( ( { id } ) => id ), [ flattenData ] );

	const projected = activeId && overId ? getProjection( flattenData, activeId, overId, offsetLeft ) : null;

	function handleDragStart( { active: { id: activeId } } ) {
		setActiveId( activeId );
		setOverId( activeId );
	}

	function handleDragOver( { over } ) {
		setOverId( over?.id ?? null );
	}

	function handleDragEnd( { active, over } ) {
		resetState();

		if ( projected && over ) {
			let { depth, parent } = projected;

			if ( ! parent ) {
				parent = 0;
			}

			const clonedItems = JSON.parse(
				JSON.stringify( tree.flattenTree( newTree.buildTree( data ) ) ),
			);

			const overIndex = clonedItems.findIndex( ( { id } ) => id === over.id );
			const activeIndex = clonedItems.findIndex( ( { id } ) => id === active.id );
			const activeTreeItem = clonedItems[ activeIndex ];

			clonedItems[ activeIndex ] = { ...activeTreeItem, depth, parent };

			const sortedItems = arrayMove( clonedItems, activeIndex, overIndex );

			dispatch( setTree( sortedItems ) );
		}
	}

	function resetState() {
		setActiveId( null );
		setOverId( null );
	}

	function handleDragMove( { delta: { x } } ) {
		setOffsetLeft( x );
	}

	const pointerSensor = useSensor( PointerSensor, {
		activationConstraint: {
			distance: 0.01,
		},
	} );

	const mouseSensor = useSensor( MouseSensor );

	const sensors = useSensors(
		mouseSensor,
		pointerSensor,
	);

	return (
		<DndContext
			collisionDetection={ closestCenter }
			onDragStart={ handleDragStart }
			onDragEnd={ handleDragEnd }
			onDragOver={ handleDragOver }
			onDragMove={ handleDragMove }
			sensors={ sensors }
		>
			<div className="flex justify-center w-full">
				<div className="w-full flex flex-col justify-end" id="tree">
					<SortableContext
						items={ sortedIds }
						strategy={ verticalListSortingStrategy }
					>
						{ flattenData.map( ( item ) => {
							return <TreeItem
								item={ item }
								key={ item.id }
								depth={ item.id === activeId && projected ? projected.depth : item.depth }
							/>;
						} ) }
					</SortableContext>
				</div>
			</div>

			<DragOverlay>
				{ activeId ? (
					<div>
						{ flattenData.map( ( item ) =>
							item.id === activeId ? (
								<TreeItemPreview item={ item } key={ item.id } />
							) : null,
						) }
					</div>
				) : null }
			</DragOverlay>
		</DndContext>
	);
};

export default FolderTree;
