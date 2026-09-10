/* global jQuery -- from WordPress context */

/**
 * External dependencies
 */
import { useMemo, useState, useEffect } from 'react';
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

import { setTree, updatePage, updateSnackbar } from '../../redux/slice/folders.js';
import { utilities } from '../../data/utilities';
import useMoveAttachments from '../../hooks/useMoveAttachments.js';

import { useGetFoldersQuery, useUpdateFolderMutation } from '../../redux/api/folders.js';

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

	const { data: folders, error, isLoading, isFetching, refetch } = useGetFoldersQuery(
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
		// Only sync once the query has settled — syncing an in-flight (stale) response
		// could momentarily re-introduce a just-deleted folder. On the first page we
		// REPLACE the list so server-side removals (deletes) are reflected; on load-more
		// pages we append, preserving the already-loaded pages.
		if ( folders && ! isFetching ) {
			dispatch( setTree( {
				folders: openLocalStorageItem( folders?.data ),
				replace: currentPage === 1,
			} ) );

			if ( Array.isArray( folders?.data ) ) {
				// If no folders are returned, reset to the first page
				dispatch( updatePage( { totalPages: folders.totalPages } ) );
			}
		}
	}, [ dispatch, folders, currentPage, isFetching, page.perPage ] );

	// Listen for media type filter changes and refetch folder data
	useEffect( () => {
		const handleMediaTypeChange = () => {
			refetch();
		};

		document.addEventListener( 'godam-attachment-browser:changed', handleMediaTypeChange );

		return () => {
			document.removeEventListener( 'godam-attachment-browser:changed', handleMediaTypeChange );
		};
	}, [ refetch ] );

	const [ activeId, setActiveId ] = useState( null );
	const [ overId, setOverId ] = useState( null );
	const [ offsetLeft, setOffsetLeft ] = useState( 0 );

	// Shared with the "Move to folder" picker so dropping an item and choosing a
	// destination from a button run exactly the same guards, recount and refresh.
	const { moveAttachments } = useMoveAttachments();

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

			// Persist the move first and only commit it to the local tree on success.
			// Without .unwrap() a server rejection (e.g. locked destination, permission)
			// resolved silently and the tree kept the optimistic move even though the
			// server never applied it.
			try {
				await updateFolderMutation( { ...activeTreeItem, parent } ).unwrap();
			} catch ( moveError ) {
				dispatch( updateSnackbar( {
					message: moveError?.data?.message || __( 'Failed to move folder', 'godam' ),
					type: 'fail',
				} ) );
				return;
			}

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

					if ( ! draggedItems ) {
						return;
					}

					// Guards, the request, the snackbar, the folder recount and the view
					// refresh all live in useMoveAttachments — see that hook rather than
					// re-implementing any of it here.
					await moveAttachments( {
						attachmentIds: draggedItems,
						targetFolderId: jQuery( event.target ).data( 'id' ),
						sourceFolderId: selectedFolder?.id,
					} );
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
	}, [ dispatch, selectedFolder, moveAttachments ] );

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
									onContextMenu={ ( e, id, anchor ) => handleContextMenu( e, id, item, anchor ) }
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

		</DndContext>
	);
};

export default FolderTree;
