const defaultConfig = require( '@wordpress/jest-preset-default/jest-preset' );

module.exports = {
	...defaultConfig,
	testPathIgnorePatterns: [
		'/node_modules/',
		'/vendor/',
		'/assets/build/',
	],
	setupFilesAfterEnv: [
		...( defaultConfig.setupFilesAfterEnv || [] ),
		'<rootDir>/tests/js/setup.js',
	],
	collectCoverageFrom: [
		'assets/src/**/*.{js,jsx}',
		'!assets/src/**/*.test.{js,jsx}',
		'!assets/src/libs/**',
	],
	coverageDirectory: 'coverage/js',
};
