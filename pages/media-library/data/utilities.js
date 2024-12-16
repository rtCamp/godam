
function find( data, ID ) {
	for ( let i = 0; i < data.length; i++ ) {
		if ( data[ i ].id === ID ) {
			return data[ i ];
		}
		if ( data[ i ].children.length > 0 ) {
			const found = find( data[ i ].children, ID );
			if ( found ) {
				return found;
			}
		}
	}
}

function hasChildren( item ) {
	return item.children.length > 0;
}

function toggle( item, action ) {
	if ( ! hasChildren( item ) ) {
		return item;
	}

	if ( item.id === action.payload.id ) {
		return { ...item, isOpen: ! item.isOpen };
	}

	return { ...item, children: item.children.map( ( childItem ) => toggle( childItem, action ) ) };
}

function create( item, newItem, parentId ) {
	if ( item.id === parentId ) {
		item.children.push( newItem );
	}

	if ( item.children.length > 0 ) {
		item.children = item.children.map( ( childItem ) => create( childItem, newItem, parentId ) );
	}

	return item;
}

const tree = {

	findAndUpdate( item, conditionFunction, updateFunction ) {
		if ( conditionFunction( item ) ) {
			return updateFunction( item );
		}

		if ( item.children && item.children.length > 0 ) {
			item.children = item.children.map( ( childItem ) => tree.findAndUpdate( childItem, conditionFunction, updateFunction ) );
		}

		return item;
	},
	delete( item, ID ) {
		if ( item.id === ID ) {
			return null;
		}

		if ( item.children && item.children.length > 0 ) {
			item.children = item.children.filter( ( childItem ) => tree.delete( childItem, ID ) );
		}

		return item;
	},
};

export { tree };
