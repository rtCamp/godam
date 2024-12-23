
/**
 * External dependencies
 */
import { useMemo, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { closestCenter, DndContext, DragOverlay, MouseSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

/**
 * Internal dependencies
 */
import TreeItem from './TreeItem.jsx';
import TreeItemPreview from './TreeItemPreview.jsx';

import { setTree } from '../../redux/slice/folders.js';
import { utilities } from '../../data/utilities';

import { useGetFoldersQuery, useUpdateFolderMutation } from '../../redux/api/folders.js';
import SnackbarComp from './SnackbarComp.jsx';

import './css/tree.scss';

const openLocalStorageItem = ( folders ) => {
	const localStorageOpenItem = JSON.parse( localStorage.getItem( 'easyDam' ) ) || {};

	if ( localStorageOpenItem.openItems ) {
		const openItems = localStorageOpenItem.openItems;

		folders = folders.map( ( folder ) => {
			const folderCopy = { ...folder };

			if ( openItems.includes( folderCopy.id ) ) {
				folderCopy.isOpen = true;
			} else {
				folderCopy.isOpen = false;
			}

			return folderCopy;
		} );
	}

	return folders;
};

const FolderTree = () => {
	const { data: folders, error, isLoading } = useGetFoldersQuery();

	const dispatch = useDispatch();
	const data = useSelector( ( state ) => state.FolderReducer.folders );

	const [ updateFolderMutation ] = useUpdateFolderMutation();

	useEffect( () => {
		if ( folders ) {
			dispatch( setTree( openLocalStorageItem( folders ) ) );
		}
	}, [ dispatch, folders ] );

	const [ activeId, setActiveId ] = useState( null );
	const [ overId, setOverId ] = useState( null );
	const [ offsetLeft, setOffsetLeft ] = useState( 0 );

	const flattenData = useMemo( () => utilities.flattenTree( utilities.buildTree( data ) ), [ data ] );

	const filteredData = useMemo( () => {
		const collapsedItems = flattenData.reduce( ( acc, item ) => {
			const { children, isOpen, id } = item;
			if ( ! isOpen && children.length ) {
				acc.push( id );
			}
			return acc;
		}, [] );

		return utilities.removeChildrenOf( flattenData, [ activeId, ...collapsedItems ] );
	}, [ activeId, flattenData ] );

	const sortedIds = useMemo( () => filteredData.map( ( { id } ) => id ), [ filteredData ] );

	const projected = activeId && overId ? utilities.getProjection( filteredData, activeId, overId, offsetLeft ) : null;

	function handleDragStart( { active: { id: activeId } } ) {
		setActiveId( activeId );
		setOverId( activeId );
	}

	function handleDragOver( { over } ) {
		setOverId( over?.id ?? null );
	}

	async function handleDragEnd( { active, over } ) {
		resetState();

		if ( projected && over ) {
			let { depth, parent } = projected;

			if ( ! parent ) {
				parent = 0;
			}

			const clonedItems = JSON.parse(
				JSON.stringify( utilities.flattenTree( utilities.buildTree( data ) ) ),
			);

			const overIndex = clonedItems.findIndex( ( { id } ) => id === over.id );
			const activeIndex = clonedItems.findIndex( ( { id } ) => id === active.id );
			const activeTreeItem = clonedItems[ activeIndex ];

			await updateFolderMutation( { ...activeTreeItem, parent } );

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
			// Allow items to be clicked instead of activated by dragging
			distance: 10,
		},
	} );

	const mouseSensor = useSensor( MouseSensor );

	const sensors = useSensors(
		mouseSensor,
		pointerSensor,
	);

	if ( isLoading ) {
		return <div>Loading...</div>;
	}

	if ( error ) {
		return <div>Error: { error.message }</div>;
	}

	return (
		<DndContext
			collisionDetection={ closestCenter }
			onDragStart={ handleDragStart }
			onDragEnd={ handleDragEnd }
			onDragOver={ handleDragOver }
			onDragMove={ handleDragMove }
			sensors={ sensors }
		>
			<div className="tree-container">
				<div className="tree" id="tree">
					<SortableContext
						items={ sortedIds }
						strategy={ verticalListSortingStrategy }
					>
						{ filteredData.map( ( item ) => {
							return (
								<TreeItem
									item={ item }
									key={ item.id }
									depth={ item.id === activeId && projected ? projected.depth : item.depth }
								/>
							);
						} ) }
					</SortableContext>
				</div>
			</div>

			<DragOverlay>
				{ activeId ? (
					<div>
						{ filteredData.map( ( item ) =>
							item.id === activeId ? (
								<TreeItemPreview item={ item } key={ item.id } />
							) : null,
						) }
					</div>
				) : null }
			</DragOverlay>

			<SnackbarComp />

		</DndContext>
	);
};

export default FolderTree;
