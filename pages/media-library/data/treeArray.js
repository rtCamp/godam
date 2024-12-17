/**
 * This is hardcoded data for the tree, need to update this to get data from the backend.
 */

let data = [
	{ id: 7, name: 'Ave', parent: 0 },
	{ id: 4, name: 'Carnivora', parent: 3 },
	{ id: 3, name: 'Mammalia', parent: 0 },
	{ id: 5, name: 'Panthera', parent: 4 },
	{ id: 6, name: 'Panthera Leo', parent: 5 },
	{ id: 8, name: 'Passeriformes', parent: 7 },
	{ id: 1, name: 'Reptilia', parent: 0 },
];

/**
 * This is temp data for the tree and it's initial state, need to update this to get data from the backend.
 */
data = data.map( ( item ) => {
	return { ...item, isOpen: true };
} );

export default data;
