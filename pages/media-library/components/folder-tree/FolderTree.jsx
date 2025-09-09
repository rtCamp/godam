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
import SnackbarComp from './SnackbarComp.jsx';

import { setTree, updatePage, updateSnackbar } from '../../redux/slice/folders.js';
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

const FolderTree = ( { handleContextMenu } ) => {
	const page = useSelector( ( state ) => state.FolderReducer.page );
	const currentPage = page.current;

	const { data: folders, error, isLoading, isFetching } = useGetFoldersQuery(
		{
			page: currentPage,
		},
	);

	const dispatch = useDispatch();
	const data = useSelector( ( state ) => state.FolderReducer.folders );
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );
	const isMultiSelecting = useSelector( ( state ) => state.FolderReducer.isMultiSelecting );

	const [ updateFolderMutation ] = useUpdateFolderMutation();

	useEffect( () => {
		if ( folders ) {
			dispatch( setTree( openLocalStorageItem( folders?.data ) ) );

			if ( Array.isArray( folders?.data ) && ! isFetching ) {
				// If no folders are returned, reset to the first page
				dispatch( updatePage( { totalPages: folders.totalPages } ) );
			}
		}
	}, [ dispatch, folders, currentPage, isFetching, page.perPage ] );

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
		const draggedFolder = data.find( ( folder ) => folder.id === draggedItemId );

		// If the dragged folder has a parent and that parent is locked, prevent dragging.
		if ( draggedFolder?.parent && draggedFolder.parent !== 0 ) {
			const parentFolder = data.find( ( folder ) => folder.id === draggedFolder.parent );
			if ( parentFolder?.meta?.locked ) {
				dispatch( updateSnackbar( {
					message: __( 'The parent folder is locked, so this folder cannot be moved.', 'godam' ),
					type: 'fail',
				} ) );
				return;
			}
		}

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

			// Do not allow reordering/move if the destination folder (new parent) is locked.
			if ( parent !== 0 ) {
				const destinationFolder = data.find( ( folder ) => folder.id === parent );
				if ( destinationFolder?.meta?.locked ) {
					dispatch( updateSnackbar( {
						message: __( 'The destination folder is locked and cannot be modified', 'godam' ),
						type: 'fail',
					} ) );
					return;
				}
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

	// Disable dragging on touch devices so tapping selects folders on mobile.
	// Desktop behavior remains unchanged.
	const isTouchDevice = typeof window !== 'undefined' && ( 'ontouchstart' in window || ( navigator && navigator.maxTouchPoints > 0 ) );

	const pointerSensor = useSensor( PointerSensor, {
		activationConstraint: {
			// Allow items to be clicked instead of activated by dragging
			distance: 10,
		},
	} );

	const mouseSensor = useSensor( MouseSensor );

	const sensorsList = isTouchDevice ? [] : [ mouseSensor, pointerSensor ];
	const sensors = useSensors( ...sensorsList );

	function handleLoadMore() {
		dispatch( updatePage( { current: page.current + 1 } ) );
	}

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
								message: __( 'Currently opened folder is locked and cannot be modified', 'godam' ),
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

		// Disable the Add Media Button and the Upload button for locked folders
		if ( selectedFolder?.meta?.locked ) {
		// Media Library Add media button
			jQuery( '#wp-media-grid .page-title-action' ).prop( 'disabled', true )
				.css( {
					'pointer-events': 'none',
					opacity: '0.5',
				} );

			// Edit Post add media button
			jQuery( '#__wp-uploader-id-1' ).prop( 'disabled', true )
				.css( 'pointer-events', 'none' );

			// Media Library Drag and Drop
			jQuery( '#wpwrap' ).on( 'dragover.lock drop.lock', function( e ) {
				e.preventDefault();
				e.stopPropagation();
			} );

			// Edit post Drag and Drop
			jQuery( '.media-modal-content' ).on( 'dragover.lock drop.lock', function( e ) {
				e.preventDefault();
				e.stopPropagation();
			} );

			// Tell WordPress uploader to ignore drop
			if ( wp?.media?.frames?.frame?.uploader?.dropzone ) {
				wp.media.frames.frame.uploader.dropzone.off( 'drop' );
			}
		} else {
			// Media Library Add media button
			jQuery( '#wp-media-grid .page-title-action' ).prop( 'disabled', false )
				.css( {
					'pointer-events': 'auto',
					opacity: '1',
				} );

			// Edit Post add media button
			jQuery( '#__wp-uploader-id-1' ).prop( 'disabled', false )
				.css( 'pointer-events', 'auto' );

			// Media Library Drag and Drop
			jQuery( '#wpwrap' ).off( 'dragover.lock drop.lock' );

			// Edit post Drag and Drop
			jQuery( '.media-modal-content' ).off( 'dragover.lock drop.lock' );

			// Restore default dropzone
			if ( wp?.media?.frames?.frame?.uploader?.dropzone ) {
				// eslint-disable-next-line no-unused-vars
				wp.media.frames.frame.uploader.dropzone.on( 'drop', function( e ) {
					// Normally handled by WP
				} );
			}
		}

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
									onContextMenu={ ( e, id ) => handleContextMenu( e, id, item ) }
									isMultiSelecting={ isMultiSelecting }
								/>
							);
						} ) }
					</SortableContext>
				</div>
				{ ( ( currentPage < page.totalPages ) || ( isFetching && currentPage === page.totalPages ) ) && ( <button
					className="tree-load-more"
					onClick={ () => {
						handleLoadMore();
					} }
					disabled={ isFetching }
				>
					{ isFetching ? __( 'Loading…', 'godam' ) : __( 'Load More', 'godam' ) }
				</button> ) }
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
