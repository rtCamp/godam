/**
 * External dependencies
 */
import { arrayMove } from '@dnd-kit/sortable';

const utilities = {

	/**
	 * Recursively counts the number of children for an item, including its nested children.
	 *
	 * @param {Object} item - The item whose children need to be counted.
	 * @return {number} The total count of the item and all of its nested children.
	 */
	countChildren: ( item ) => {
		if ( ! item || ! item.children || ! Array.isArray( item.children ) ) {
			return 1;
		}

		return item.children.reduce( ( acc, child ) => acc + utilities.countChildren( child ), 1 );
	},

	/**
	 * Builds a hierarchical tree structure from a flat list of items.
	 *
	 * @param {Array}  data   - The flat list of items with parent-child relationships.
	 * @param {number} parent - The ID of the parent item (default is 0, meaning root).
	 * @param {number} depth  - The depth level of the item in the tree (default is 0).
	 * @return {Array} A tree structure, where each item includes a `children` property with nested items.
	 */
	buildTree: ( data, parent = 0, depth = 0 ) => {
		const tree = [];

		const children = data.filter( ( item ) => item.parent === parent );

		if ( children.length > 0 ) {
			children.forEach( ( child ) => {
				const childWithChildren = {
					...child,
					depth,
					children: utilities.buildTree( data, child.id, depth + 1 ),
				};
				tree.push( childWithChildren );
			} );
		}

		return tree;
	},

	/**
	 * Flattens a hierarchical tree structure into a flat list of items.
	 *
	 * @param {Array}       items  - The hierarchical tree of items.
	 * @param {number|null} parent - The ID of the parent item (default is null for root items).
	 * @param {number}      depth  - The depth level of the item in the tree (default is 0).
	 * @return {Array} A flattened list of items, where each item includes its `parent` and `depth`.
	 */
	flattenTree: ( items, parent = 0, depth = 0 ) => {
		return items.reduce( ( acc, item ) => {
			acc.push( { ...item, parent, depth } );

			if ( item.children ) {
				acc.push( ...utilities.flattenTree( item.children, item.id, depth + 1 ) );
			}
			return acc;
		}, [] );
	},

	/**
	 * Gets the depth of a drag event based on offset and indentation width.
	 *
	 * @param {number} offset           - The offset of the drag event.
	 * @param {number} indentationWidth - The indentation width for each level.
	 * @return {number} The calculated depth.
	 */
	getDragDepth: ( offset, indentationWidth ) => {
		return Math.round( offset / indentationWidth );
	},

	/**
	 * Returns the projected depth and parent ID for an item being dragged over.
	 *
	 * @param {Array}  items            - The list of items.
	 * @param {string} activeId         - The ID of the active item being dragged.
	 * @param {string} overId           - The ID of the item being dragged over.
	 * @param {number} dragOffset       - The offset of the drag event.
	 * @param {number} indentationWidth - The width of each indentation level.
	 * @return {Object} The depth, maxDepth, minDepth, and parent ID of the item.
	 */
	getProjection: ( items, activeId, overId, dragOffset, indentationWidth = 12 ) => {
		const overItemIndex = items.findIndex( ( { id } ) => id === overId );
		const activeItemIndex = items.findIndex( ( { id } ) => id === activeId );
		const activeItem = items[ activeItemIndex ];
		const newItems = arrayMove( items, activeItemIndex, overItemIndex );
		const previousItem = newItems[ overItemIndex - 1 ];
		const nextItem = newItems[ overItemIndex + 1 ];
		const dragDepth = utilities.getDragDepth( dragOffset, indentationWidth );
		const projectedDepth = activeItem.depth + dragDepth;
		const maxDepth = utilities.getMaxDepth( { previousItem } );
		const minDepth = utilities.getMinDepth( { nextItem } );
		let depth = projectedDepth;

		if ( projectedDepth >= maxDepth ) {
			depth = maxDepth;
		} else if ( projectedDepth < minDepth ) {
			depth = minDepth;
		}

		return { depth, maxDepth, minDepth, parent: utilities.getParentId( { newItems, depth, previousItem, overItemIndex } ) };
	},

	/**
	 * Gets the parent ID based on the current depth and items.
	 *
	 * @param {Object} params               - Contains newItems, depth, previousItem, and overItemIndex.
	 * @param {Object} params.newItems      The newItem
	 * @param {number} params.depth         The depth of the item.
	 * @param {Object} params.previousItem  The previous item.
	 * @param {number} params.overItemIndex The index of the item being dragged over.
	 * @return {string|null} The parent ID or null if no parent exists.
	 */
	getParentId: ( { newItems, depth, previousItem, overItemIndex } ) => {
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
	},

	/**
	 * Gets the maximum depth allowed for an item based on the previous item.
	 *
	 * @param {Object} params              - Contains previousItem.
	 * @param {Object} params.previousItem The previous item.
	 * @return {number} The maximum depth.
	 */
	getMaxDepth: ( { previousItem } ) => {
		if ( previousItem ) {
			return previousItem.depth + 1;
		}

		return 0;
	},

	/**
	 * Gets the minimum depth allowed for an item based on the next item.
	 *
	 * @param {Object} params          - Contains nextItem.
	 * @param {Object} params.nextItem The next item
	 * @return {number} The minimum depth.
	 */
	getMinDepth: ( { nextItem } ) => {
		if ( nextItem ) {
			return nextItem.depth;
		}

		return 0;
	},

	/**
	 * Removes items and their children from the list of items based on a list of ids.
	 *
	 * @param {Array} items - The list of items.
	 * @param {Array} ids   - The ids of the items to exclude and their children.
	 * @return {Array} The filtered list of items.
	 */
	removeChildrenOf: ( items, ids ) => {
		const excludeParentIds = [ ...ids ];

		return items.filter( ( item ) => {
			if ( item.parent && excludeParentIds.includes( item.parent ) ) {
				if ( item.children.length ) {
					excludeParentIds.push( item.id );
				}
				return false;
			}

			return true;
		} );
	},

	/**
	 * Checks if any parent of the given folder is locked.
	 *
	 * @param {number} folderId   - The ID of the folder to check.
	 * @param {Array}  allFolders - The array of all folder objects.
	 * @return {boolean} True if any parent folder is locked, false otherwise.
	 */
	isAnyParentLocked: ( folderId, allFolders ) => {
		let current = allFolders.find( ( f ) => f.id === folderId );
		while ( current && current.parent !== 0 && current.parent !== -1 ) {
			const parent = allFolders.find( ( f ) => f.id === current.parent );
			if ( parent?.meta?.locked ) {
				return true;
			}
			current = parent;
		}
		return false;
	},
};

/**
 * Detects current media type filter from URL or media library state.
 *
 * @param {string} paramName
 *
 * @return {Object} The mime type filter parameter.
 */
const getCurrentMimeTypeFilter = ( paramName = 'post_mime_type' ) => {
	const urlParams = new URLSearchParams( window.location.search );
	const postMimeType = urlParams.get( 'post_mime_type' );

	if ( postMimeType ) {
		return { [ paramName ]: postMimeType };
	}

	if ( typeof wp !== 'undefined' && wp.media && wp.media.frame ) {
		const collection = wp.media.frame.state().get( 'library' );
		if ( collection && collection.props ) {
			const mimeType = collection.props.get( 'type' );
			if ( mimeType && mimeType !== 'all' ) {
				return { [ paramName ]: mimeType };
			}
		}
	}

	return {};
};

export { utilities, getCurrentMimeTypeFilter };
