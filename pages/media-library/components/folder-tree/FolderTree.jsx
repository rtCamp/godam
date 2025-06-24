/* global jQuery -- from WordPress context */

/**
 * External dependencies
 */
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { closestCenter, DndContext, DragOverlay, MouseSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import TreeItem from './TreeItem.jsx';
import TreeItemPreview from './TreeItemPreview.jsx';
import ContextMenu from './ContextMenu.jsx';
import SnackbarComp from './SnackbarComp.jsx';

import { setTree, updateSnackbar } from '../../redux/slice/folders.js';
import { utilities } from '../../data/utilities';

import { useAssignFolderMutation, useGetFoldersQuery, useUpdateFolderMutation } from '../../redux/api/folders.js';

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
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );

	const [ updateFolderMutation ] = useUpdateFolderMutation();

	useEffect( () => {
		if ( folders ) {
			dispatch( setTree( openLocalStorageItem( folders ) ) );
		}
	}, [ dispatch, folders ] );

	const [ activeId, setActiveId ] = useState( null );
	const [ overId, setOverId ] = useState( null );
	const [ offsetLeft, setOffsetLeft ] = useState( 0 );

	const [ assignFolderMutation ] = useAssignFolderMutation();

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

	function handleDragStart( { active: { id: draggedItemId } } ) {
		setActiveId( draggedItemId );
		setOverId( draggedItemId );
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

	/**
	 * Update the attachment count of folders when items are moved between folders.
	 *
	 * @param {number} selectedFolderId    - The ID of the folder from which items are being moved.
	 * @param {number} destinationFolderId - The ID of the folder to which items are being moved.
	 * @param {number} count               - The number of items being moved.
	 */
	const updateAttachmentCountOfFolders = useCallback( ( selectedFolderId, destinationFolderId, count ) => {
		const updatedFolders = data.map( ( folder ) => {
			if ( folder.id === selectedFolderId ) {
				const currentCount = Number( folder.attachmentCount ) || 0;
				return { ...folder, attachmentCount: currentCount - count };
			}
			if ( folder.id === destinationFolderId ) {
				const currentCount = Number( folder.attachmentCount ) || 0;
				return { ...folder, attachmentCount: currentCount + count };
			}
			return folder;
		} );

		dispatch( setTree( updatedFolders ) );
	}, [ data, dispatch ] );

	useEffect( () => {
		/**
		 * Initialize and manage droppable functionality for tree items.
		 *
		 * This setup uses jQuery UI's `draggable` and `droppable` to enable drag-and-drop interactions.
		 * It includes error handling and safe cleanup.
		 */
		const setupDroppable = () => {
			jQuery( '.tree-item' ).droppable( {
				accept: 'li.attachment, tr',
				hoverClass: 'droppable-hover',
				tolerance: 'pointer',
				drop: async ( event, ui ) => {
					const draggedItems = ui.draggable.data( 'draggedItems' );

					if ( draggedItems ) {
						const targetFolderId = jQuery( event.target ).data( 'id' );

						/**
						 * Prevent assigning items to the same folder they are already in.
						 */
						if ( selectedFolder?.id === targetFolderId ) {
							return;
						}

						// do not allow assigning item to other folder from the locked folder.
						if ( selectedFolder?.meta?.locked ) {
							dispatch( updateSnackbar( {
								message: __( 'This folder is locked and cannot be modified', 'godam' ),
								type: 'fail',
							} ) );
							return;
						}

						const targetFolder = data.find( ( folder ) => folder.id === targetFolderId );

						// do not allow assigning items to a locked folder.
						if ( targetFolder?.meta?.locked ) {
							dispatch( updateSnackbar( {
								message: __( 'This folder is locked and cannot be modified', 'godam' ),
								type: 'fail',
							} ) );
							return;
						}

						try {
							const response = await assignFolderMutation( {
								attachmentIds: draggedItems,
								folderTermId: targetFolderId,
							} ).unwrap();

							if ( response ) {
								dispatch( updateSnackbar( {
									message: __( 'Items assigned successfully', 'godam' ),
									type: 'success',
								},
								) );
							}

							// Update the folder tree count that reflects the new state.
							updateAttachmentCountOfFolders( selectedFolder?.id, targetFolderId, draggedItems.length );

							/**
							 * Remove the dragged items from the attachment view if they are meant to be removed.
							 */
							if ( selectedFolder?.id !== -1 ) {
								draggedItems.forEach( ( attachmentId ) => {
									jQuery( `li.attachment[data-id="${ attachmentId }"]` ).remove(); // for attachment grid view.
									jQuery( `tr#post-${ attachmentId }` ).remove(); // for attachment list view.
								} );
							}
						} catch {
							dispatch( updateSnackbar( {
								message: __( 'Failed to assign items', 'godam' ),
								type: 'fail',
							},
							) );
						}
					}
				},
			} );
		};

		setupDroppable();

		// Cleanup to avoid multiple event bindings
		return () => {
			if ( jQuery.fn.droppable ) {
				jQuery( '.tree-item' ).each( function() {
					const $this = jQuery( this );
					if ( $this.data( 'ui-droppable' ) ) {
						$this.droppable( 'destroy' );
					}
				} );
			}
		};
	}, [ data, assignFolderMutation, dispatch, selectedFolder, updateAttachmentCountOfFolders ] );

	if ( isLoading ) {
		return <div>{ __( 'Loading…', 'godam' ) }</div>;
	}

	if ( error ) {
		/* translators: %s is the error message */
		return <div>{ sprintf( __( 'Error: %s', 'godam' ), error.message ) }</div>;
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
			<ContextMenu />

		</DndContext>
	);
};

export default FolderTree;
