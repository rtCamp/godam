/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: [ 'class' ],
	content: [
		'./pages/**/*.{html,js}',
		'./node_modules/@shadcn/ui/dist/**/*.{js,ts,jsx,tsx}',
	],
	theme: {
		extend: {
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
			colors: {},
		},
	},
	plugins: [
		require( 'tailwindcss-animate' ),
		require( '@tailwindcss/typography' ),
	],
};
