/**
 * Guards the build contract that lets a page load the analytics library once.
 *
 * The library is built as its own script (global `_analytics`, WordPress handle
 * `analytics-library`), and the video-player and layer-analytics bundles read that
 * global instead of bundling a copy. If this mapping drifts, the bundles quietly go
 * back to bundling their own copy, or their .asset.php stops listing the handle and
 * WordPress prints them without the library.
 */

/**
 * External dependencies
 */
const path = require( 'path' );

const configs = require( path.resolve( __dirname, '../../../../webpack.config.js' ) );

const compilationWithEntry = ( name ) =>
	configs.find( ( config ) => config.entry && typeof config.entry === 'object' && name in config.entry );

const extractionPlugin = ( config ) =>
	config.plugins.find( ( plugin ) => plugin.constructor.name === 'DependencyExtractionWebpackPlugin' );

describe( 'analytics library build', () => {
	it.each( [ 'godam-player-analytics', 'godam-layer-analytics' ] )(
		'%s reads the library from the global instead of bundling it',
		( entry ) => {
			const plugin = extractionPlugin( compilationWithEntry( entry ) );
			const externals = [];
			plugin.externalizeWpDeps( { request: 'analytics' }, ( err, external ) => externals.push( [ err, external ] ) );

			expect( externals ).toEqual( [ [ null, '_analytics' ] ] );
		},
	);

	it.each( [ 'godam-player-analytics', 'godam-layer-analytics' ] )(
		'%s lists the analytics-library script as a dependency',
		( entry ) => {
			const plugin = extractionPlugin( compilationWithEntry( entry ) );

			expect( plugin.mapRequestToDependency( 'analytics' ) ).toBe( 'analytics-library' );
		},
	);

	it( 'keeps the WordPress externals the other bundles use', () => {
		const plugin = extractionPlugin( compilationWithEntry( 'godam-player-analytics' ) );

		expect( plugin.mapRequestToDependency( '@wordpress/i18n' ) ).toBe( 'wp-i18n' );
	} );

	it( 'builds the library once, as the global _analytics', () => {
		const config = compilationWithEntry( 'godam-analytics-library' );

		expect( config.output.library ).toEqual( { name: '_analytics', type: 'var' } );
		expect( config.output.filename ).toBe( '[name].min.js' );
	} );

	it( 'does not externalize the library in its own build', () => {
		const plugin = extractionPlugin( compilationWithEntry( 'godam-analytics-library' ) );
		const externals = [];
		plugin.externalizeWpDeps( { request: 'analytics' }, ( err, external ) => externals.push( [ err, external ] ) );

		expect( externals ).toEqual( [ [ undefined, undefined ] ] );
	} );
} );
