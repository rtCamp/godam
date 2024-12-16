const data = [
	{
		id: 1,
		name: 'Mammalia',
		isOpen: true,
		children: [
			{
				id: 2,
				isOpen: true,
				name: 'Carnivora',
				children: [
					{
						id: 3,
						name: 'Panthera',
						children: [ { id: 4, name: 'Panthera leo', children: [] } ],
					},
				],
			},
		],
	},
	{
		id: 5,
		name: 'Aves',
		isOpen: true,
		children: [
			{
				id: 6,
				isOpen: true,
				name: 'Passeriformes',
				children: [
					{
						id: 7,
						name: 'Corvidae',
						children: [ { id: 8, name: 'Corvus corax', children: [] } ],
					},
				],
			},
		],
	},
];

export default data;
