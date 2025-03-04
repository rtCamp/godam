/**
 * External dependencies
 */
const fs = require( 'fs' );
const path = require( 'path' );
const CssMinimizerPlugin = require( 'css-minimizer-webpack-plugin' );
const RemoveEmptyScriptsPlugin = require( 'webpack-remove-empty-scripts' );

/**
 * WordPress dependencies
 */
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

// Extend the default config.
const sharedConfig = {
	...defaultConfig,
	output: {
		path: path.resolve( process.cwd(), 'assets', 'build', 'js' ),
		filename: '[name].js',
		chunkFilename: '[name].js',
	},
	plugins: [
		...defaultConfig.plugins
			.map(
				( plugin ) => {
					if ( plugin.constructor.name === 'MiniCssExtractPlugin' ) {
						plugin.options.filename = '../css/[name].css';
					}
					return plugin;
				},
			),
		new RemoveEmptyScriptsPlugin(),
	],
	optimization: {
		...defaultConfig.optimization,
		splitChunks: {
			...defaultConfig.optimization.splitChunks,
		},
		minimizer: defaultConfig.optimization.minimizer.concat( [ new CssMinimizerPlugin() ] ),
	},
};

// Generate a webpack config which includes setup for CSS extraction.
// Look for css/scss files and extract them into a build/css directory.
const styles = {
	...sharedConfig,
	entry: () => {
		const entries = {};

		const dir = './assets/src/css';
		fs.readdirSync( dir ).forEach( ( fileName ) => {
			const fullPath = `${ dir }/${ fileName }`;
			if ( ! fs.lstatSync( fullPath ).isDirectory() ) {
				entries[ fileName.replace( /\.[^/.]+$/, '' ) ] = fullPath;
			}
		} );

		return entries;
	},
	module: {
		...sharedConfig.module,
	},
	plugins: [
		...sharedConfig.plugins.filter(
			( plugin ) => plugin.constructor.name !== 'DependencyExtractionWebpackPlugin',
		),
	],

};

// Example of how to add a new entry point for JS file.
const mainJS = {
	...sharedConfig,
	entry: {
		main: path.resolve( process.cwd(), 'assets', 'src', 'js', 'main.js' ),
	},
};

const adminJS = {
	...sharedConfig,
	entry: {
		admin: path.resolve( process.cwd(), 'assets', 'src', 'js', 'admin.js' ),
	},
};

const videoAnalyticsJS = {
	...sharedConfig,
	entry: {
		'video-analytics': path.resolve( process.cwd(), 'assets', 'src', 'js', 'video-analytics.js' ),
	},
};

const mediaLibrary = {
	...sharedConfig,
	entry: {
		'media-library': path.resolve( process.cwd(), 'assets', 'src', 'js', 'media-library', 'index.js' ),
	},
};

const deactivationJS = {
	...sharedConfig,
	entry: {
		'deactivation-feedback': path.resolve( process.cwd(), 'assets', 'src', 'js', 'deactivation-feedback.js' ),
	},
};

// Example of how to add a new entry point for JS file.
const easyDAM = {
	...sharedConfig,
	entry: {
		main: path.resolve( process.cwd(), 'assets', 'src', 'js', 'easydam', 'index.js' ),
	},
};

// Define the `pages` directory
const pagesDir = path.resolve( __dirname, './pages' );

// Create an entry object, mapping each subdirectory to its `index.js`
const entryPoints = {};
fs.readdirSync( pagesDir ).forEach( ( folder ) => {
	const folderPath = path.join( pagesDir, folder );
	const entryFile = path.join( folderPath, 'index.js' );
	if ( fs.statSync( folderPath ).isDirectory() && fs.existsSync( entryFile ) ) {
		entryPoints[ folder ] = entryFile; // Use the folder name as the key
	}
} );

const pages = {
	mode: 'development',
	entry: entryPoints, // Dynamic entry points for each page
	output: {
		path: path.resolve( __dirname, './pages/build' ), // Output directory
		filename: '[name].js', // Each entry gets its own output file
	},
	module: {
		rules: [
			{
				test: /\.(js|jsx)$/, // Handle JS/JSX files
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [ '@babel/preset-env', '@babel/preset-react' ],
					},
				},
			},
			{
				test: /\.(css|scss)$/, // Handle CSS files
				use: [ 'style-loader', 'css-loader', 'postcss-loader', 'sass-loader' ],
			},
			{
				test: /\.(png|jpg|jpeg|gif|svg)$/, // Handle image files
				use: [
					{
						loader: 'file-loader',
						options: {
							name: '[name].[hash].[ext]',
							outputPath: 'images',
						},
					},
				],
			},
		],
	},
	externals: {
		react: 'React',
		'react-dom': 'ReactDOM',
		'@wordpress/element': [ 'wp', 'element' ], // For WordPress compatibility
	},
	resolve: {
		extensions: [ '.js', '.jsx' ], // Automatically resolve these extensions
	},
};

module.exports = [
	mainJS,
	adminJS,
	videoAnalyticsJS,
	mediaLibrary,
	deactivationJS,
	easyDAM,
	styles, // Do not remove this.
	pages,
];
