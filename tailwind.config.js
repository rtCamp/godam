/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: [ 'class' ],
	content: [
		'./pages/**/*.{css,scss,js,jsx}',
		'./assets/src/blocks/**/*.{js,jsx}',
	],
	theme: {
		extend: {
			colors: {
				'brand-neutral': {
					900: '#1C1C1C',
				},
			},
		},
	},
	plugins: [
		require( 'tailwindcss-animate' ),
		require( '@tailwindcss/typography' ),
		function( { addBase } ) {
			addBase( {
				'.notailwind': {
					all: 'unset', // Resets all styles in this section
				},
			} );
		},
	],
	corePlugins: {
		preflight: false,
	},
};
