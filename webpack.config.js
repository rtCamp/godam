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
		filename: '[name].min.js',
		chunkFilename: '[name].min.js',
	},
	plugins: [
		...defaultConfig.plugins
			/**
			 * Remove the RTL CSS plugin from the default configuration.
			 *
			 * RTL CSS is not currently in use, and its output was being incorrectly placed in the JS build directory.
			 * This plugin can be re-enabled in the future if RTL support is needed.
			 */
			.filter( ( plugin ) => plugin.constructor.name !== 'RtlCssPlugin' )
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

		const CSS_DIR = path.resolve( process.cwd(), 'assets', 'src', 'css' );

		fs.readdirSync( CSS_DIR ).forEach( ( fileName ) => {
			const fullPath = `${ CSS_DIR }/${ fileName }`;
			// Skip directories and files starting with _
			if ( ! fs.lstatSync( fullPath ).isDirectory() && ! fileName.startsWith( '_' ) ) {
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

const mediaLibrary = {
	...sharedConfig,
	entry: {
		'media-library': path.resolve( process.cwd(), 'assets', 'src', 'js', 'media-library', 'index.js' ),
	},
};

const godamPlayerFrontend = {
	...sharedConfig,
	entry: {
		'godam-player-frontend': path.resolve( process.cwd(), 'assets', 'src', 'js', 'godam-player', 'frontend.js' ),
	},
};

const godamPlayerAnalytics = {
	...sharedConfig,
	entry: {
		'godam-player-analytics': path.resolve( process.cwd(), 'assets', 'src', 'js', 'godam-player', 'analytics.js' ),
	},
};

const deactivationJS = {
	...sharedConfig,
	entry: {
		'deactivation-feedback': path.resolve( process.cwd(), 'assets', 'src', 'js', 'deactivation-feedback.js' ),
	},
};

const godamGallery = {
	...sharedConfig,
	entry: {
		'godam-gallery': path.resolve( process.cwd(), 'assets', 'src', 'js', 'godam-gallery.js' ),
	},
};

const gfGodamRecorderJS = {
	...sharedConfig,
	entry: {
		'gf-godam-recorder': path.resolve( process.cwd(), 'assets', 'src', 'js', 'gf-godam-recorder.js' ),
	},
};

const gfGodamRecorderEditorJS = {
	...sharedConfig,
	entry: {
		'gf-godam-recorder-editor': path.resolve( process.cwd(), 'assets', 'src', 'js', 'gf-godam-recorder-editor.js' ),
	},
};

const gfEntryDetailJS = {
	...sharedConfig,
	entry: {
		'gf-entry-detail': path.resolve( process.cwd(), 'assets', 'src', 'js', 'gf-entry-detail.js' ),
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

entryPoints[ 'page-css' ] = path.resolve( process.cwd(), 'pages', 'index.js' );

const pages = {
	entry: entryPoints, // Dynamic entry points for each page
	output: {
		path: path.resolve( __dirname, './assets/build/pages' ), // Output directory
		filename: '[name].min.js', // Each entry gets its own output file
		chunkFilename: '[name].min.js',
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
		'@wordpress/i18n': [ 'wp', 'i18n' ],
	},
	resolve: {
		extensions: [ '.js', '.jsx' ], // Automatically resolve these extensions
	},
};

module.exports = [
	mainJS,
	adminJS,
	mediaLibrary,
	godamPlayerFrontend,
	godamPlayerAnalytics,
	deactivationJS,
	godamGallery,
	gfGodamRecorderJS,
	gfGodamRecorderEditorJS,
	gfEntryDetailJS,
	styles, // Do not remove this.
	pages,
];
