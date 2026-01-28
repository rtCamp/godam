/**
 * External dependencies
 */
import { Rnd } from 'react-rnd';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import {
	Button,
	TextControl,
	ToggleControl,
	DropdownMenu,
	MenuItem,
	ColorPalette,
	Notice,
	Tooltip,
} from '@wordpress/components';
import {
	trash,
	plus,
	chevronDown,
	chevronUp,
	moreVertical,
	check,
} from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';
import { useState, useRef, useEffect, useCallback, useMemo } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../../../pages/video-editor/redux/slice/videoSlice';
import { v4 as uuidv4 } from 'uuid';
import LayerControls from '../../../../pages/video-editor/components/LayerControls';
import ProductSelector from './ProductSelector';
import FontAwesomeIconPicker from './FontAwesomeIconPicker';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShoppingCart } from '@fortawesome/free-solid-svg-icons';
import LayersHeader from '../../../../pages/video-editor/components/layers/LayersHeader';
import { PRODUCT_HOTSPOT_CONSTANTS } from '../../../../assets/src/js/godam-player/utils/constants';
import { fetchProductData } from '../utils/productDataCache';

/**
 * WoocommerceLayer component for managing and rendering interactive product hotspots on a video layer.
 *
 * @param {Object}   props          - The component props.
 * @param {string}   props.layerID  - The unique identifier for the layer.
 * @param {Function} props.goBack   - Callback function to navigate back to the previous screen.
 * @param {number}   props.duration - The duration (in seconds) for which the layer is visible.
 *
 * @return {JSX.Element} The rendered WoocommerceLayer component.
 */

/**
 * ProductHotspotPanel - Sub-component for rendering a single product hotspot with on-demand data fetching.
 *
 * @param {Object}   root0 - Props object
 * @param {Object}   root0.productHotspot - Product hotspot data
 * @param {number}   root0.index - Index of the hotspot
 * @param {boolean}  root0.isExpanded - Whether panel is expanded
 * @param {Function} root0.onToggleExpand - Callback to toggle expand state
 * @param {Function} root0.onDelete - Callback to delete hotspot
 * @param {Array}    root0.productHotspots - All product hotspots
 * @param {Function} root0.updateField - Callback to update field
 * @param {boolean}  root0.isValidAPIKey - Whether API key is valid
 * @param {Function} root0.getProductHotspotDisplayName - Function to get display name
 * @param {Object}   root0.productCache - Cache of product data
 * @param {Function} root0.onCacheProduct - Callback to cache product
 * @param {Object}   root0.fetchingProductsRef - Ref to track fetching products
 * @return {JSX.Element} Rendered component
 */
const ProductHotspotPanel = ( {
	productHotspot,
	index,
	isExpanded,
	onToggleExpand,
	onDelete,
	productHotspots,
	updateField,
	isValidAPIKey,
	getProductHotspotDisplayName,
	productCache,
	onCacheProduct,
	fetchingProductsRef,
} ) => {
	// Get product data from productCache only (no more productDetails from DB)
	const productData = productCache[ productHotspot.productId ] || null;

	useEffect( () => {
		// Only fetch if we have a productId
		if ( ! productHotspot.productId ) {
			return;
		}

		// If already in cache, don't fetch again
		if ( productCache[ productHotspot.productId ] ) {
			return;
		}

		// If already fetching this product, don't fetch again
		if ( fetchingProductsRef.current.has( productHotspot.productId ) ) {
			return;
		}

		// Mark as fetching to prevent duplicate requests
		fetchingProductsRef.current.add( productHotspot.productId );

		fetchProductData( productHotspot.productId )
			.then( ( data ) => {
				onCacheProduct( productHotspot.productId, data );
			} )
			.catch( ( error ) => {
				// eslint-disable-next-line no-console
				console.error( `Error loading product data for ID ${ productHotspot.productId }:`, error );
				onCacheProduct( productHotspot.productId, null );
			} );
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ productHotspot.productId ] );

	return (
		<div className="p-2 w-full border rounded">
			<div className="flex justify-between items-center">
				<Button
					icon={ isExpanded ? chevronUp : chevronDown }
					className="flex-1 text-left text-flex-left"
					onClick={ onToggleExpand }
				>
					{ getProductHotspotDisplayName( productHotspot, index, productData ) }
				</Button>
			{
				/* translators: %s is the product hotspot name */
			}
			<DropdownMenu
				icon={ moreVertical }
				label={ `${ getProductHotspotDisplayName( productHotspot, index, productData ) } ${ __( 'options', 'godam' ) }` }
					toggleProps={ { 'aria-label': sprintf( __( 'Options for %s', 'godam' ), getProductHotspotDisplayName( productHotspot, index, productData ) ) } }
				>
					{ () => (
						<>
							<MenuItem
								icon={ productHotspot.showStyle ? check : '' }
								onClick={ () => {
									updateField(
										'productHotspots',
										productHotspots.map( ( h2, j ) =>
											j === index
												? {
													...h2,
													showStyle: ! h2.showStyle,
													showIcon: ! h2.showStyle ? false : h2.showIcon,
													icon: ! h2.showStyle ? '' : h2.icon,
												}
												: h2,
										),
									);
								} }
							>
								{ __( 'Show Style', 'godam' ) }
							</MenuItem>
							<MenuItem
								icon={ productHotspot.showIcon ? check : '' }
								onClick={ () => {
									updateField(
										'productHotspots',
										productHotspots.map( ( h2, j ) =>
											j === index
												? {
													...h2,
													showIcon: ! h2.showIcon,
													showStyle: ! h2.showIcon ? false : h2.showStyle,
												}
												: h2,
										),
									);
								} }
							>
								{ __( 'Show Icon', 'godam' ) }
							</MenuItem>
							<MenuItem
								icon={ trash }
								onClick={ onDelete }
								className="text-red-500"
							>
								{ __( 'Delete Product Hotspot', 'godam' ) }
							</MenuItem>
						</>
					) }
				</DropdownMenu>
		</div>

			{ isExpanded && (
				<div className="mt-3">
					{ /* Product Hotspot Name */ }
					<TextControl
						className="godam-input"
						label={ __( 'Product Hotspot Name', 'godam' ) }
						value={ productHotspot.name ?? '' }
						/* translators: %d is the hotspot index */
						placeholder={ productData?.name
							? `${ index + 1 }. ${ productData.name }`
							: `Product Hotspot ${ index + 1 }` }
						maxLength={ 40 }
						onChange={ ( val ) => {
							const v = ( val || '' ).slice( 0, 40 );
							updateField(
								'productHotspots',
								productHotspots.map( ( h2, j ) =>
									j === index ? { ...h2, name: v } : h2,
								),
							);
						} }
						help={ __( 'Give this Product hotspot a descriptive title', 'godam' ) }
						disabled={ ! isValidAPIKey }
					/>
					<TextControl
						className="godam-input"
						label={ __( 'Shop Button', 'godam' ) }
						placeholder={ productHotspot.addToCart
							? __( 'View Product', 'godam' )
							: __( 'Buy Now', 'godam' ) }
						value={ productHotspot.shopText }
						onChange={ ( val ) =>
							updateField(
								'productHotspots',
								productHotspots.map( ( h2, j ) =>
									j === index ? { ...h2, shopText: val } : h2,
								),
							)
						}
						disabled={ ! isValidAPIKey }
						help={ __( 'Shop button color follows Product hotspot color.', 'godam' ) }
					/>
					<div className="mt-3">
						{ ( () => {
							if ( ! productData ) {
								return null;
							}

							const isGrouped = productData.type === 'grouped';
							const isExternal = productData.type === 'external';
							const isVariable = productData.type === 'variable';
							const isOutOfStock = productData.in_stock === false;
							const forceProductPage = isGrouped || isExternal || isVariable || isOutOfStock;
							const isDisabled = ! isValidAPIKey || isGrouped || isExternal || isVariable || isOutOfStock;

							if ( forceProductPage && ! productHotspot.addToCart ) {
								updateField(
									'productHotspots',
									productHotspots.map( ( h2, j ) =>
										j === index ? { ...h2, addToCart: true } : h2,
									),
								);
							}

							let help = '';

							if ( isGrouped ) {
								help = __( 'Grouped products cannot be added to the cart directly.', 'godam' );
							} else if ( isExternal ) {
								help = __( 'External/Affiliate products cannot be added to the cart directly.', 'godam' );
							} else if ( isVariable ) {
								help = __( 'Variable products cannot be added to the cart directly.', 'godam' );
							} else if ( isOutOfStock ) {
								help = __( 'Products Out of Stock cannot be added to the cart directly.', 'godam' );
							} else if ( productHotspot.addToCart ) {
								help = __( 'Users will be redirected to the product page.', 'godam' );
							} else {
								help = __( 'By default, this adds the product to the cart. Turn ON to go to the product page instead.', 'godam' );
							}

							return (
								<ToggleControl
									className="godam-toggle"
									label={ __( 'Link to Product Page', 'godam' ) }
									checked={ productHotspot.addToCart }
									help={ help }
									onChange={ ( isChecked ) => {
										updateField(
											'productHotspots',
											productHotspots.map( ( h2, j ) =>
												j === index ? { ...h2, addToCart: isChecked } : h2,
											),
										);
									} }
									disabled={ isDisabled }
								/>
							);
						} )() }
					</div>
					<ProductSelector
						index={ index }
						value={ productHotspot.productId }
						productHotspot={ productHotspot }
						productHotspots={ productHotspots }
						updateField={ updateField }
						isValidAPIKey={ isValidAPIKey }
					/>
					{ productHotspot.showIcon && (
						<div className="flex flex-col gap-2 mt-2">
							<FontAwesomeIconPicker
								productHotspot={ productHotspot }
								index={ index }
								updateField={ updateField }
								productHotspots={ productHotspots }
								disabled={ ! isValidAPIKey }
							/>
						</div>
					) }
					{ productHotspot.showStyle && (
						<div className="flex flex-col gap-2 mt-2">
							<label
								htmlFor={ `hotspot-color-${ index }` }
								className="text-xs text-gray-700"
							>
								{ __( 'BACKGROUND COLOR', 'godam' ) }
							</label>
							<ColorPalette
								id={ `hotspot-color-${ index }` }
								value={ productHotspot.backgroundColor || '#0c80dfa6' }
								className={ ! isValidAPIKey ? 'pointer-events-none opacity-50' : '' }
								onChange={ ( newColor ) => {
									updateField(
										'productHotspots',
										productHotspots.map( ( h2, j ) =>
											j === index
												? {
													...h2,
													backgroundColor: newColor,
												}
												: h2,
										),
									);
								} }
								enableAlpha
							/>
						</div>
					) }
				</div>
			) }
		</div>
	);
};

/**
 * ProductHotspotPreview - Preview rendering of product hotspot in editor
 *
 * @param {Object} root0 - Props object
 * @param {Object} root0.productHotspot - Product hotspot data
 * @param {number} root0.index - Index of the hotspot
 * @param {Object} root0.productCache - Cache of product data
 * @return {JSX.Element} Rendered component
 */
const ProductHotspotPreview = ( { productHotspot, index, productCache } ) => {
	// Get product data from productCache only (fresh data from API)
	const productData = productCache[ productHotspot.productId ] || null;

	return (
		<div className={ `hotspot-content flex items-center justify-center ${ ! productHotspot.icon ? 'no-icon' : '' }` }>
			{ productHotspot.icon ? (
				<FontAwesomeIcon
					icon={ [ 'fas', productHotspot.icon ] }
					className="pointer-events-none"
					style={ {
						width: '50%',
						height: '50%',
						color: '#000',
					} }
				/>
			) : null }

			<span className="index">{ index + 1 }</span>

			<div className="product-hotspot-box">
				{ productData ? (
					<div className="product-hotspot-woo-display">
						<div className="product-hotspot-woo-image-wrapper">
							<img
								className="product-hotspot-woo-image"
								src={ productData.image }
								alt={ productData.name }
							/>
						</div>
						<div className="product-hotspot-woo-details">
							<div className="product-hotspot-woo-name">
								{ productData.name }
							</div>
							<div
								className="product-hotspot-woo-price"
								dangerouslySetInnerHTML={ {
									__html: `${ productData.price }`,
								} }
							/>
							<a
								className="product-hotspot-woo-link"
								href={
									productHotspot.addToCart
										? productData.link
										: `${ window.easydamMediaLibrary.wooCartURL }?add-to-cart=${ productHotspot.productId }&source=productHotspot`
								}
								target="_blank"
								rel="noopener noreferrer"
								style={ { background: productHotspot.backgroundColor } }
							>
								{ ( () => {
									const defaultLabel = productHotspot.addToCart
										? __( 'View Product', 'godam' )
										: __( 'Buy Now', 'godam' );

									const shopText = productHotspot.shopText?.trim();

									return shopText ? shopText : defaultLabel;
								} )() }
							</a>
						</div>
					</div>
				) : (
					<div>{ __( 'No product selected', 'godam' ) }</div>
				) }
			</div>

		</div>
	);
};

const WoocommerceLayer = ( { layerID, goBack, duration } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);

	const allLayers = useSelector( ( state ) =>
		state.videoReducer.layers,
	);

	const firstWoocommerceLayer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layer.firstWooLayerId ),
	);

	const productHotspots = useMemo(
		() => layer?.productHotspots || [],
		[ layer?.productHotspots ],
	);

	// Track expanded Product hotspot
	const [ expandedProductHotspotIndex, setExpandedProductHotspotIndex ] = useState( null );

	const containerRef = useRef( null );
	const videoRef = useRef( null );

	const [ contentRect, setContentRect ] = useState( null );

	// Product cache: key is productId, value is product data
	const [ productCache, setProductCache ] = useState( {} );

	// Track which products are currently being fetched to prevent duplicates
	const fetchingProductsRef = useRef( new Set() );

	// Helper to update product cache
	const handleCacheProduct = useCallback( ( productId, data ) => {
		setProductCache( ( prev ) => ( {
			...prev,
			[ productId ]: data,
		} ) );
		// Remove from fetching set when done
		fetchingProductsRef.current.delete( productId );
	}, [] );

	// Helper to dispatch updates
	const updateField = useCallback( ( field, value ) => {
		dispatch( updateLayerField( { id: layer.id, field, value } ) );
	}, [ dispatch, layer?.id ] );

	const percentToPx = useCallback( ( percent, dimension ) => {
		if ( ! contentRect ) {
			return 0;
		}
		const size = dimension === 'x' ? contentRect.width : contentRect.height;
		return ( percent / 100 ) * size;
	}, [ contentRect ] );

	const pxToPercent = useCallback( ( px, dimension ) => {
		if ( ! contentRect ) {
			return 0;
		}
		const size = dimension === 'x' ? contentRect.width : contentRect.height;
		return ( px / size ) * 100;
	}, [ contentRect ] );

	const getDefaultDiameter = useCallback( ( unit ) => {
		if ( unit !== 'percent' ) {
			return PRODUCT_HOTSPOT_CONSTANTS.DEFAULT_DIAMETER_PX;
		}

		return contentRect?.width
			? pxToPercent( PRODUCT_HOTSPOT_CONSTANTS.DEFAULT_DIAMETER_PX, 'x' )
			: PRODUCT_HOTSPOT_CONSTANTS.DEFAULT_DIAMETER_PERCENT;
	}, [ contentRect?.width, pxToPercent ] );

	// Add a new Product hotspot
	const handleAddProductHotspot = useCallback( () => {
		// Calculate percentage dynamically to maintain a consistent physical size (approx 48px)
		const diameterPercent = getDefaultDiameter( 'percent' );

		const newProductHotspot = {
			id: uuidv4(),
			productId: '',
			// REMOVED: productDetails - will be fetched on-demand
			addToCart: false,
			shopText: __( 'Shop Me', 'godam' ),
			position: { x: 50, y: 50 },
			size: { diameter: diameterPercent },
			oSize: { diameter: diameterPercent },
			oPosition: { x: 50, y: 50 },
			backgroundColor: '#0c80dfa6',
			miniCart: true,
			icon: '',
			unit: 'percent',
		};
		updateField( 'productHotspots', [ ...productHotspots, newProductHotspot ] );
	}, [ getDefaultDiameter, productHotspots, updateField ] );

	// Auto-add the first hotspot if none exist and it's a new layer
	useEffect( () => {
		if ( layer?.isNew && productHotspots.length === 0 && contentRect?.width ) {
			handleAddProductHotspot();
			updateField( 'isNew', false ); // Mark as not new anymore
		}
	}, [ layer?.isNew, productHotspots.length, contentRect?.width, handleAddProductHotspot, updateField ] );

	const handleDeleteProductHotspot = ( index ) => {
		updateField(
			'productHotspots',
			productHotspots.filter( ( _, i ) => i !== index ),
		);
	};

	// Expand/hide a Product hotspot’s panel
	const toggleProductHotspotExpansion = ( index ) => {
		setExpandedProductHotspotIndex( expandedProductHotspotIndex === index ? null : index );
	};

	const computeContentRect = () => {
		const videoEl = document.querySelector( 'video' );
		const containerEl = document.getElementById( 'easydam-video-player' );

		if ( ! videoEl || ! containerEl ) {
			setContentRect( null );
			return;
		}

		const nativeW = videoEl.videoWidth || 0;
		const nativeH = videoEl.videoHeight || 0;

		const elW = containerEl.offsetWidth;
		const elH = containerEl.offsetHeight;

		// If video dimensions aren't loaded yet, use full container
		if ( ! nativeW || ! nativeH ) {
			setContentRect( {
				left: 0,
				top: 0,
				width: elW,
				height: elH,
			} );
			return;
		}

		const videoAspectRatio = nativeW / nativeH;
		const containerAspectRatio = elW / elH;

		let contentW, contentH, offsetX, offsetY;

		if ( containerAspectRatio > videoAspectRatio ) {
			// Pillarboxed (black bars on left/right)
			contentH = elH;
			contentW = elH * videoAspectRatio;
			offsetX = ( elW - contentW ) / 2;
			offsetY = 0;
		} else {
			// Letterboxed (black bars on top/bottom)
			contentW = elW;
			contentH = elW / videoAspectRatio;
			offsetX = 0;
			offsetY = ( elH - contentH ) / 2;
		}

		const newRect = {
			left: Math.round( offsetX ),
			top: Math.round( offsetY ),
			width: Math.round( contentW ),
			height: Math.round( contentH ),
		};

		setContentRect( newRect );
	};

	useEffect( () => {
		computeContentRect();
		window.addEventListener( 'resize', computeContentRect );
		document.addEventListener( 'fullscreenchange', computeContentRect );

		// Also listen for video metadata loaded
		const videoEl = document.querySelector( 'video' );
		videoRef.current = videoEl;

		if ( videoEl ) {
			videoEl.addEventListener( 'loadedmetadata', computeContentRect );
		}

		return () => {
			window.removeEventListener( 'resize', computeContentRect );
			document.removeEventListener( 'fullscreenchange', computeContentRect );
			if ( videoRef.current ) {
				videoRef.current.removeEventListener( 'loadedmetadata', computeContentRect );
			}
		};
	}, [] );

	const updateAllWooLayersMiniCart = ( isChecked ) => {
		allLayers
			.filter( ( l ) => l.type === 'woo' )
			.forEach( ( l ) => {
				dispatch( updateLayerField( { id: l.id, field: 'miniCart', value: isChecked } ) );
			} );
	};

	// If we want to disable the premium layers the we can use this code
	// const isValidAPIKey = window?.videoData?.valid_api_key;

	// For now we are enabling all the features
	const isValidAPIKey = true;

	/**
	 * Generates a display name for a Product hotspot.
	 *
	 * If the Product hotspot has a custom name, it trims and uses that name.
	 * Otherwise, it falls back to a default name in the format "Product Hotspot {index}".
	 *
	 * @param {Object} productHotspot        - The hotspot object containing its properties.
	 * @param {string} [productHotspot.name] - The custom name of the product hotspot (optional).
	 * @param {number} index                 - The index of the product hotspot in the list.
	 * @param {Object} productData           - The fetched product data (optional).
	 * @return {string} The display name for the product hotspot.
	 */
	const getProductHotspotDisplayName = ( productHotspot, index, productData = null ) => {
		const custom = productHotspot?.name && String( productHotspot.name ).trim();
		return custom ||
		( productData?.name
			? `${ index + 1 }. ${ productData.name }`
			: `Product Hotspot ${ index + 1 }` );
	};

	return (
		<>
			<LayersHeader layer={ layer } goBack={ goBack } duration={ duration } />

			{
				! isValidAPIKey &&
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'This features is available in premium version', 'godam' ) }
				</Notice>
			}

			{ /* Duration */ }
			<div className="mb-4">
				<TextControl
					label={ __( 'Layer Duration (seconds)', 'godam' ) }
					className="godam-input"
					type="number"
					min="1"
					value={ layer?.duration || '' }
					onChange={ ( val ) => {
						const newVal = parseInt( val, 10 ) || 0;
						updateField( 'duration', newVal );
					} }
					help={ __( 'Duration (in seconds) this layer will stay visible', 'godam' ) }
					disabled={ ! isValidAPIKey }
				/>
			</div>

			{ /* Pause on hover */ }
			<div className="mb-4">
				<ToggleControl
					className="godam-toggle"
					label={ __( 'Pause video on hover', 'godam' ) }
					checked={ layer?.pauseOnHover || false }
					onChange={ ( isChecked ) => updateField( 'pauseOnHover', isChecked ) }
					disabled={ ! isValidAPIKey }
				/>
				<p className="text-xs text-gray-500 mt-1">
					{ __(
						'Player will pause the video while the layer is displayed and users hover over the product hotspots.',
						'godam',
					) }
				</p>
			</div>

			{ /* Mini Cart Icon */ }
			<div className="mb-4">
				<ToggleControl
					className="godam-toggle"
					label={ __( 'Enable/Disable Mini Cart', 'godam' ) }
					checked={
						layer?.previousDisplayTime
							? firstWoocommerceLayer?.miniCart
							: layer?.miniCart || false
					}
					onChange={ ( isChecked ) => {
						updateAllWooLayersMiniCart( isChecked ); // Updates all layers.
						updateField( 'miniCart', isChecked ); // Updates current layer.
					} }
					disabled={ ! isValidAPIKey || !! layer?.previousDisplayTime }
				/>
				<p className="text-xs text-gray-500 mt-1">
					{ !! layer?.previousDisplayTime
						? __(
							'Mini Cart toggle is disabled. Edit it from the first WooCommerce layer you added in this video.',
							'godam',
						)
						: __(
							'Display the WooCommerce Mini Cart throughout the video.',
							'godam',
						)
					}
				</p>
			</div>

			{ /* Product Hotspots list */ }
			<div className="flex items-center flex-col gap-4 pb-4">
				{ productHotspots.map( ( productHotspot, index ) => (
					<ProductHotspotPanel
						key={ productHotspot.id }
						productHotspot={ productHotspot }
						index={ index }
						isExpanded={ expandedProductHotspotIndex === index }
						onToggleExpand={ () => toggleProductHotspotExpansion( index ) }
						onDelete={ () => handleDeleteProductHotspot( index ) }
						productHotspots={ productHotspots }
						updateField={ updateField }
						isValidAPIKey={ isValidAPIKey }
						getProductHotspotDisplayName={ getProductHotspotDisplayName }
						productCache={ productCache }
						onCacheProduct={ handleCacheProduct }
						fetchingProductsRef={ fetchingProductsRef }
					/>
				) ) }

				<Button
					variant="primary"
					id="add-hotspot-btn"
					icon={ plus }
					iconPosition="left"
					className="godam-button"
					onClick={ handleAddProductHotspot }
					disabled={ ! isValidAPIKey }
				>
					{ __( 'Add Product Hotspot', 'godam' ) }
				</Button>
			</div>

			{ /* The actual layer content */ }
			<LayerControls>
				{ layer?.miniCart && (
					<div
						className="absolute inset-0 woo-mini-cart-button"
						style={ {
							zIndex: '11',
							right: '100%',
							top: '4%',
						} }
					>
						<Tooltip
							text={ __( 'This is just a preview for Mini Cart. It will change styles according to your theme.', 'godam' ) }
							placement="top-start"
						>
							<div
								className="
								block
								transform
								scale-50
								sm:scale-75
								md:scale-90
								lg:scale-110
								xl:scale-125
								2xl:scale-150
								transition-transform duration-200 ease-in-out
							"
							>
								<Button
									variant="primary"
									className="cursor-pointer rounded-full !p-2 ml-2"
									label={ __( 'Mini Cart', 'godam' ) }
									icon={ <FontAwesomeIcon icon={ faShoppingCart } /> }
								/>
							</div>
						</Tooltip>
					</div>
				) }
				<div
					ref={ containerRef }
					className="easydam-layer hotspot-layer"
					style={ {
						backgroundColor: layer.bg_color || 'transparent',
						position: 'absolute',
						left: contentRect?.left || 0,
						top: contentRect?.top || 0,
						width: contentRect?.width || '100%',
						height: contentRect?.height || '100%',
						zIndex: 5,
					} }
				>
					<div
						className="absolute inset-0 bg-transparent z-10 pointer-events-auto"
					></div>
					{ productHotspots.map( ( productHotspot, index ) => {
						const posX = productHotspot.oPosition?.x ?? productHotspot.position?.x ?? 50;
						const posY = productHotspot.oPosition?.y ?? productHotspot.position?.y ?? 50;
						const diameter = productHotspot.oSize?.diameter ?? productHotspot.size?.diameter ?? getDefaultDiameter( productHotspot.unit );

						let pixelX, pixelY, pixelDiameter;

						if ( productHotspot.unit === 'percent' ) {
							// Calculate pixel values for rendering
							pixelX = percentToPx( posX, 'x' );
							pixelY = percentToPx( posY, 'y' );
							pixelDiameter = percentToPx( diameter, 'x' );
						} else {
							// Legacy handling in editor (relative to base dimensions)
							const baseWidth = PRODUCT_HOTSPOT_CONSTANTS.BASE_WIDTH;
							const baseHeight = PRODUCT_HOTSPOT_CONSTANTS.BASE_HEIGHT;
							pixelX = ( posX / baseWidth ) * ( contentRect?.width || PRODUCT_HOTSPOT_CONSTANTS.BASE_WIDTH );
							pixelY = ( posY / baseHeight ) * ( contentRect?.height || PRODUCT_HOTSPOT_CONSTANTS.BASE_HEIGHT );
							pixelDiameter = ( diameter / baseWidth ) * ( contentRect?.width || PRODUCT_HOTSPOT_CONSTANTS.BASE_WIDTH );
						}

						return (
							<Rnd
								key={ productHotspot.id }
								position={ {
									x: pixelX,
									y: pixelY,
								} }
								size={ {
									width: pixelDiameter,
									height: pixelDiameter,
								} }
								bounds="parent"
								maxWidth={ contentRect?.width || '100%' }
								maxHeight={ contentRect?.height || '100%' }
								minWidth={ PRODUCT_HOTSPOT_CONSTANTS.MIN_PX }
								minHeight={ PRODUCT_HOTSPOT_CONSTANTS.MIN_PX }
								lockAspectRatio
								onDragStop={ ( e, d ) => {
									if ( ! contentRect ) {
										return;
									}

									// d.x and d.y are relative to the parent (contentRect div)
									const relativeX = d.x;
									const relativeY = d.y;

									const newProductHotspots = productHotspots.map( ( h2, j ) => {
										if ( j === index ) {
											const newX = pxToPercent( relativeX, 'x' );
											const newY = pxToPercent( relativeY, 'y' );

											// If converting from legacy, also convert diameter to percentage
											let newDiameter = h2.oSize?.diameter ?? h2.size?.diameter ?? getDefaultDiameter( h2.unit );
											if ( h2.unit !== 'percent' ) {
												// Ensure it's at least 10px equivalent in percentage
												const minPercent = contentRect ? ( PRODUCT_HOTSPOT_CONSTANTS.MIN_PX / contentRect.width ) * 100 : PRODUCT_HOTSPOT_CONSTANTS.MIN_PERCENT_FALLBACK;
												newDiameter = Math.max( minPercent, ( newDiameter / PRODUCT_HOTSPOT_CONSTANTS.BASE_WIDTH ) * 100 );
											}
											return {
												...h2,
												unit: 'percent',
												size: { diameter: newDiameter },
												oSize: { diameter: newDiameter },
												oPosition: {
													x: newX,
													y: newY,
												},
												position: {
													x: newX,
													y: newY,
												},
											};
										}
										return h2;
									} );
									updateField( 'productHotspots', newProductHotspots );
								} }
								onResizeStop={ ( e, direction, ref, delta, position ) => {
									if ( ! contentRect ) {
										return;
									}

									let newDiameterPx = ref.offsetWidth;
									let relativeX = position.x;
									let relativeY = position.y;

									// Clamp position to ensure it stays within contentRect
									relativeX = Math.max( 0, Math.min( relativeX, contentRect.width - newDiameterPx ) );
									relativeY = Math.max( 0, Math.min( relativeY, contentRect.height - newDiameterPx ) );

									// Clamp diameter to ensure it doesn't exceed the remaining space from the current position
									const maxAllowedDiameter = Math.min( contentRect.width - relativeX, contentRect.height - relativeY );
									newDiameterPx = Math.min( newDiameterPx, maxAllowedDiameter );

									const newDiameterPercent = pxToPercent( newDiameterPx, 'x' );
									const newX = pxToPercent( relativeX, 'x' );
									const newY = pxToPercent( relativeY, 'y' );

									const newProductHotspots = productHotspots.map( ( h2, j ) => {
										if ( j === index ) {
											return {
												...h2,
												unit: 'percent',
												oSize: {
													diameter: newDiameterPercent,
												},
												size: {
													diameter: newDiameterPercent,
												},
												oPosition: {
													x: newX,
													y: newY,
												},
												position: {
													x: newX,
													y: newY,
												},
											};
										}
										return h2;
									} );
									updateField( 'productHotspots', newProductHotspots );
								} }
								onClick={ () => setExpandedProductHotspotIndex( index ) }
								className="hotspot circle"
								style={ {
									backgroundColor: productHotspot.icon ? 'white' : productHotspot.backgroundColor || '#0c80dfa6',
									zIndex: 20,
								} }
							>
								<ProductHotspotPreview
									productHotspot={ productHotspot }
									index={ index }
									productCache={ productCache }
								/>
							</Rnd>
						);
					} ) }
				</div>
			</LayerControls>
		</>
	);
};

export default WoocommerceLayer;
