/**
 * Jest config for plugin-side JS unit tests (run via `npm run test:unit`).
 *
 * Extends the @wordpress/scripts default (jsdom, babel-jest, CSS stub,
 * `*.test.js` discovery) and adds a stub for `*.svg` imports — those reach the
 * unit code transitively (layer-type icons in constants/layerTypes.js) but only
 * webpack knows how to load them.
 */
const defaultConfig = require( '@wordpress/scripts/config/jest-unit.config.js' );

module.exports = {
	...defaultConfig,
	// Keep the preset's globals setup, then add our `fetch` stub.
	setupFiles: [
		'<rootDir>/node_modules/@wordpress/jest-preset-default/scripts/setup-globals.js',
		'<rootDir>/bin/jest/setup.js',
	],
	moduleNameMapper: {
		...defaultConfig.moduleNameMapper,
		// Keep the preset's CSS/SCSS stub working alongside our asset stub.
		'\\.(scss|css)$':
			'<rootDir>/node_modules/@wordpress/jest-preset-default/scripts/style-mock.js',
		'\\.(svg|png|jpe?g|gif|webp)$': '<rootDir>/bin/jest/asset-mock.js',
	},
};
