/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: [ 'class' ],
	content: [
		'./pages/**/*.{html,js,jsx,ts,tsx}',
	],
	theme: {
		extend: {
			colors: {},
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
