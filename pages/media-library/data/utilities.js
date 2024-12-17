const tree = {
	findAndUpdate( item, conditionFunction, updateFunction ) {
		if ( conditionFunction( item ) ) {
			return updateFunction( item );
		}

		if ( item.children && item.children.length > 0 ) {
			item.children = item.children.map( ( childItem ) =>
				tree.findAndUpdate( childItem, conditionFunction, updateFunction ),
			);
		}

		return item;
	},
	delete( item, ID ) {
		if ( item.id === ID ) {
			return null;
		}

		if ( item.children && item.children.length > 0 ) {
			item.children = item.children.filter( ( childItem ) =>
				tree.delete( childItem, ID ),
			);
		}

		return item;
	},
	flattenTree( items, parentId = null, depth = 0 ) {
		return items.reduce( ( acc, item ) => {
			acc.push( { ...item, parentId, depth } );
			if ( item.children ) {
				acc.push( ...tree.flattenTree( item.children, item.id, depth + 1 ) );
			}
			return acc;
		}, [] );
	},

	buildTree( flattenedItems ) {
		const root = [];
		const childrenMap = {};

		for ( const item of flattenedItems ) {
			const { parentId, ...rest } = item;
			const newItem = { ...rest, children: [] };
			if ( parentId === null ) {
				root.push( newItem );
			} else {
				childrenMap[ parentId ] = childrenMap[ parentId ] || [];
				childrenMap[ parentId ].push( newItem );
			}
			newItem.children = childrenMap[ item.id ] || [];
		}

		return root;
	},

	arrayMove( array, from, to ) {
		const newArray = array.slice();
		const [ moved ] = newArray.splice( from, 1 );
		newArray.splice( to, 0, moved );
		return newArray;
	},
};

export { tree };
