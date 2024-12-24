/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: [ 'class' ],
	content: [
		'./pages/**/*.{html,js}',
		'./node_modules/@shadcn/ui/dist/**/*.{js,ts,jsx,tsx}',
	],
	theme: {
		extend: {
			colors: {},
		},
	},
	plugins: [ require( 'tailwindcss-animate' ) ],
};
