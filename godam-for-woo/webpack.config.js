/**
 * External dependencies
 */
const path = require( 'path' );
const CssMinimizerPlugin = require( 'css-minimizer-webpack-plugin' );
const RemoveEmptyScriptsPlugin = require( 'webpack-remove-empty-scripts' );

/**
 * WordPress dependencies
 */
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

const isProduction = process.env.NODE_ENV === 'production';
const mode = isProduction ? 'production' : 'development';
const pluginRoot = __dirname;

// Shared config extending @wordpress/scripts defaults.
const sharedConfig = {
	mode,
	...defaultConfig,
	output: {
		path: path.resolve( pluginRoot, 'assets', 'build', 'js' ),
		filename: '[name].min.js',
		chunkFilename: '[name].min.js',
		publicPath: 'auto',
	},
	plugins: [
		...defaultConfig.plugins
			.filter( ( plugin ) => plugin.constructor.name !== 'RtlCssPlugin' )
			.map( ( plugin ) => {
				if ( plugin.constructor.name === 'MiniCssExtractPlugin' ) {
					plugin.options.filename = '../css/[name].css';
				}
				return plugin;
			} ),
		new RemoveEmptyScriptsPlugin(),
	],
	optimization: {
		...defaultConfig.optimization,
		splitChunks: {
			...defaultConfig.optimization.splitChunks,
		},
		minimizer: defaultConfig.optimization.minimizer.concat( [ new CssMinimizerPlugin() ] ),
	},
	devtool: isProduction ? false : 'source-map',
};

// WooCommerce integration JS + CSS build.
const wooJS = {
	...sharedConfig,
	entry: {
		// Admin scripts.
		'admin/wc-product-video-gallery': path.resolve( pluginRoot, 'assets', 'src', 'js', 'admin', 'wc-product-video-gallery.js' ),
		'admin/wc-admin-featured-video-gallery': path.resolve( pluginRoot, 'assets', 'src', 'js', 'admin', 'wc-admin-featured-video-gallery.js' ),

		// Frontend scripts — WooCommerce layer manager (registers into main GoDAM player).
		'woo-layer-frontend': path.resolve( pluginRoot, 'assets', 'src', 'js', 'godam-player', 'woo-layer-frontend.js' ),

		// Frontend scripts.
		'wc-featured-video-gallery': path.resolve( pluginRoot, 'assets', 'src', 'js', 'featured-video', 'wc-featured-video-gallery.js' ),
		'product-reels-carousel': path.resolve( pluginRoot, 'assets', 'src', 'js', 'single-product-story', 'product-reels-carousel.js' ),

		// CSS files (extracted via MiniCssExtractPlugin).
		'godam-featured-video': path.resolve( pluginRoot, 'assets', 'src', 'css', 'godam-featured-video.scss' ),
		'godam-product-reels': path.resolve( pluginRoot, 'assets', 'src', 'css', 'godam-product-reels.scss' ),
		'godam-reels-skin': path.resolve( pluginRoot, 'assets', 'src', 'css', 'godam-reels-skin.scss' ),
		'godam-woo-sidebar': path.resolve( pluginRoot, 'assets', 'src', 'css', 'godam-woo-sidebar.scss' ),
		'godam-woo-player': path.resolve( pluginRoot, 'assets', 'src', 'css', 'godam-woo-player.scss' ),
		'godam-woo-admin': path.resolve( pluginRoot, 'assets', 'src', 'css', 'godam-woo-admin.scss' ),
	},
};

// WooCommerce layer component for the video editor (loaded dynamically).
const wooLayerComponent = {
	mode,
	entry: {
		'woo-layer-component': path.resolve( pluginRoot, 'pages', 'register-layer.js' ),
		'woo-settings-component': path.resolve( pluginRoot, 'pages', 'register-settings.js' ),
	},
	output: {
		path: path.resolve( pluginRoot, 'assets', 'build', 'pages' ),
		filename: '[name].min.js',
		chunkFilename: '[name].min.js',
		publicPath: 'auto',
	},
	module: {
		rules: [
			{
				test: /\.(js|jsx)$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [ '@babel/preset-env', '@babel/preset-react' ],
					},
				},
			},
			{
				test: /\.(css|scss)$/,
				use: [ 'style-loader', 'css-loader', 'postcss-loader', 'sass-loader' ],
			},
			{
				test: /\.(png|jpg|jpeg|gif|svg|webp)$/,
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
		'@wordpress/element': [ 'wp', 'element' ],
		'@wordpress/i18n': [ 'wp', 'i18n' ],
		'@wordpress/components': [ 'wp', 'components' ],
		'@wordpress/primitives': [ 'wp', 'primitives' ],
		'@wordpress/api-fetch': [ 'wp', 'apiFetch' ],
	},
	resolve: {
		extensions: [ '.js', '.jsx' ],
		modules: [ 'node_modules' ],
	},
	resolveLoader: {
		modules: [ 'node_modules' ],
	},
	devtool: isProduction ? false : 'source-map',
};

module.exports = [
	wooJS,
	wooLayerComponent,
];
