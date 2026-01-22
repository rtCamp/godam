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

const isProduction = process.env.NODE_ENV === 'production';
const mode = isProduction ? 'production' : 'development';

// Extend the default config.
const sharedConfig = {
	mode,
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
	// Only generate source maps in development mode
	devtool: isProduction ? false : 'source-map',
};

// Generate a webpack config which includes setup for CSS extraction.
// Look for css/scss files and extract them into a build/css directory.
const styles = {
	mode,
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
	// Only generate source maps in development mode
	devtool: isProduction ? false : 'source-map',
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

const godamVideoEmbed = {
	...sharedConfig,
	entry: {
		'godam-video-embed': path.resolve( process.cwd(), 'assets', 'src', 'js', 'godam-video-embed.js' ),
	},
};

const gfGodamRecorderEditorJS = {
	...sharedConfig,
	entry: {
		'gf-godam-recorder-editor': path.resolve( process.cwd(), 'assets', 'src', 'js', 'gravity-form', 'gf-godam-recorder-editor.js' ),
	},
};

const wpFormsGodamRecorderEditorJS = {
	...sharedConfig,
	entry: {
		'wpforms-godam-recorder-editor': path.resolve( process.cwd(), 'assets', 'src', 'js', 'wpforms-godam-recorder-editor.js' ),
	},
};

const jetpackFormJS = {
	...sharedConfig,
	entry: {
		'jetpack-form': path.resolve( process.cwd(), 'assets', 'src', 'js', 'jetpack-form.js' ),
	},
};

const elementorWidgetJS = {
	...sharedConfig,
	entry: {
		'godam-elementor-frontend': path.resolve( process.cwd(), 'assets', 'src', 'js', 'elementor', 'frontend.js' ),
	},
};

const elementorEditorJS = {
	...sharedConfig,
	entry: {
		'godam-elementor-editor': path.resolve( process.cwd(), 'assets', 'src', 'js', 'elementor', 'editor.js' ),
	},
};

const godamRecorder = {
	...sharedConfig,
	entry: {
		'godam-recorder': path.resolve( process.cwd(), 'assets', 'src', 'js', 'godam-recorder', 'index.js' ),
	},
};

const fluentForms = {
	...sharedConfig,
	entry: {
		fluentforms: path.resolve( process.cwd(), 'assets', 'src', 'js', 'fluentforms', 'index.js' ),
		'godam-fluentforms-editor': path.resolve( process.cwd(), 'assets', 'src', 'js', 'fluentforms', 'editor.js' ),
	},
};

const everestForms = {
	...sharedConfig,
	entry: {
		everestforms: path.resolve( process.cwd(), 'assets', 'src', 'js', 'everestforms', 'index.js' ),
	},
};

const godamPlayerSDK = {
	...sharedConfig,
	entry: {
		godamPlayerSDK: path.resolve( process.cwd(), 'assets', 'src', 'js', 'godam-player', 'godam-player-sdk.js' ),
		'godam-player-sdk': path.resolve( process.cwd(), 'assets', 'src', 'js', 'godam-player', 'godam-player-sdk.js' ),
	},
};

const lifterLMSBlock = {
	...sharedConfig,
	entry: {
		lifterLMSBlock: path.resolve( process.cwd(), 'assets', 'src', 'js', 'lifterlms', 'block.js' ),
		'godam-lifterlms-block': path.resolve( process.cwd(), 'assets', 'src', 'js', 'lifterlms', 'block.js' ),
	},
};

const lifterLMSEmbed = {
	...sharedConfig,
	entry: {
		lifterLMSEmbed: path.resolve( process.cwd(), 'assets', 'src', 'js', 'lifterlms', 'embed.js' ),
		'godam-lifterlms-embed': path.resolve( process.cwd(), 'assets', 'src', 'js', 'lifterlms', 'embed.js' ),
	},
};

const ninjaForms = {
	...sharedConfig,
	entry: {
		'ninja-forms': path.resolve( process.cwd(), 'assets', 'src', 'js', 'ninja-forms', 'index.js' ),
	},
};

const ninjaFormsSubmissionsList = {
	...sharedConfig,
	entry: {
		'ninja-forms-submissions-list': path.resolve( process.cwd(), 'assets', 'src', 'js', 'ninja-forms', 'ninja-forms-submissions-list.js' ),
	},
};

const blockExtensions = {
	...sharedConfig,
	entry: {
		'block-extensions': path.resolve( process.cwd(), 'assets', 'src', 'block-extensions', 'index.js' ),
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
	mode,
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
				test: /\.(png|jpg|jpeg|gif|svg|webp)$/, // Handle image files
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
	// Only generate source maps in development mode
	devtool: isProduction ? false : 'source-map',
};

module.exports = [
	mainJS,
	adminJS,
	mediaLibrary,
	godamPlayerFrontend,
	godamPlayerAnalytics,
	deactivationJS,
	godamGallery,
	godamVideoEmbed,
	gfGodamRecorderEditorJS,
	wpFormsGodamRecorderEditorJS,
	jetpackFormJS,
	styles, // Do not remove this.
	pages,
	elementorWidgetJS,
	elementorEditorJS,
	godamRecorder,
	fluentForms,
	everestForms,
	godamPlayerSDK,
	lifterLMSBlock,
	lifterLMSEmbed,
	ninjaForms,
	ninjaFormsSubmissionsList,
	blockExtensions,
];
