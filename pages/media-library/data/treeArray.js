// const data = [
// 	{
// 		id: 1,
// 		name: 'Mammalia',
// 		isOpen: true,
// 		children: [
// 			{
// 				id: 2,
// 				isOpen: true,
// 				name: 'Carnivora',
// 				children: [
// 					{
// 						id: 3,
// 						name: 'Panthera',
// 						children: [ { id: 4, name: 'Panthera leo', children: [] } ],
// 					},
// 				],
// 			},
// 		],
// 	},
// 	{
// 		id: 5,
// 		name: 'Aves',
// 		isOpen: true,
// 		children: [
// 			{
// 				id: 6,
// 				isOpen: true,
// 				name: 'Passeriformes',
// 				children: [
// 					{
// 						id: 7,
// 						name: 'Corvidae',
// 						children: [ { id: 8, name: 'Corvus corax', children: [] } ],
// 					},
// 				],
// 			},
// 		],
// 	},
// ];

// const data = [
// 	{ id: 1, name: 'Luke Skywalker', isOpen: true },
// 	{ id: 2, name: 'Han Solo', isOpen: true },
// 	{ id: 3, name: 'Princess Leia', isOpen: true },
// 	{ id: 4, name: 'Darth Vader', isOpen: true },
// 	{ id: 5, name: 'Yoda', isOpen: true },
// 	{ id: 6, name: 'Obi-Wan Kenobi', isOpen: true },
// 	{ id: 7, name: 'Chewbacca', isOpen: true },
// 	{ id: 8, name: 'R2-D2', isOpen: true },
// 	{ id: 9, name: 'C-3PO', isOpen: true },
// 	{ id: 10, name: 'Boba Fett', isOpen: true },
// 	{ id: 11, name: 'Lando Calrissian', isOpen: true },
// 	{ id: 12, name: 'Darth Maul', isOpen: true },
// 	{ id: 13, name: 'Qui-Gon Jinn', isOpen: true },
// 	{ id: 14, name: 'Padmé Amidala', isOpen: true },
// 	{ id: 15, name: 'Anakin Skywalker', isOpen: true },
// ];

/**
 * Internal dependencies
 */
import { newTree } from './utilities';

let data = [
	{ id: 7, name: 'Ave', parent: 0 },
	{ id: 4, name: 'Carnivota', parent: 3 },
	{ id: 3, name: 'Mammalia', parent: 0 },
	{ id: 5, name: 'Panthera', parent: 4 },
	{ id: 6, name: 'Panthera Leo', parent: 5 },
	{ id: 8, name: 'Passeriformes', parent: 7 },
	{ id: 1, name: 'Uncategorized', parent: 0 },
];

data = data.map( ( item ) => {
	return { ...item, isOpen: true };
} );

export default data;
