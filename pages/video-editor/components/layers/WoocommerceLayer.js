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
	Modal,
	TextControl,
	ToggleControl,
	DropdownMenu,
	MenuItem,
	ColorPalette,
	Notice,
} from '@wordpress/components';
import {
	arrowLeft,
	trash,
	plus,
	chevronDown,
	chevronUp,
	moreVertical,
	check,
} from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useRef, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField, removeLayer } from '../../redux/slice/videoSlice';
import { v4 as uuidv4 } from 'uuid';
import LayerControls from '../LayerControls';
import ProductSelector from '../woocommerce/ProductSelector';
import FontAwesomeIconPicker from '../woocommerce/FontAwesomeIconPicker';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const WoocommerceLayer = ( { layerID, goBack } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);

	const productHotspots = layer?.productHotspots || [];

	// Delete modal
	const [ isDeleteModalOpen, setDeleteModalOpen ] = useState( false );
	// Track expanded Product hotspot
	const [ expandedProductHotspotIndex, setExpandedProductHotspotIndex ] = useState( null );

	const containerRef = useRef( null );

	// ratio { x, y } for px <-> ratio
	const [ ratio, setRatio ] = useState( { x: 1, y: 1 } );

	// Helper to dispatch updates
	const updateField = ( field, value ) => {
		dispatch( updateLayerField( { id: layer.id, field, value } ) );
	};

	const pxToRatio = ( px, dimension ) => px * ratio[ dimension ];
	const ratioToPx = ( val, dimension ) => val / ratio[ dimension ];

	// Add a new Product hotspot
	const handleAddProductHotspot = () => {
		const newProductHotspot = {
			id: uuidv4(),
			productId: '',
			productDetails: '',
			addToCart: false,
			shopText: __( 'Shop Me', 'godam' ),
			position: { x: 50, y: 50 },
			size: { diameter: 48 },
			oSize: { diameter: 48 },
			oPosition: { x: 50, y: 50 },
			backgroundColor: '#0c80dfa6',
			icon: '',
		};
		updateField( 'productHotspots', [ ...productHotspots, newProductHotspot ] );
	};

	const handleDeleteProductHotspot = ( index ) => {
		updateField(
			'productHotspots',
			productHotspots.filter( ( _, i ) => i !== index ),
		);
	};

	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

	// Expand/hide a Product hotspot’s panel
	const toggleProductHotspotExpansion = ( index ) => {
		setExpandedProductHotspotIndex( expandedProductHotspotIndex === index ? null : index );
	};

	const recalcRatio = () => {
		if ( containerRef.current ) {
			const { offsetWidth, offsetHeight } = containerRef.current;
			const baseWidth = 800;
			const baseHeight = 600;

			setRatio( {
				x: baseWidth / offsetWidth,
				y: baseHeight / offsetHeight,
			} );
		}
	};

	useEffect( () => {
		recalcRatio();
		window.addEventListener( 'resize', recalcRatio );
		return () => window.removeEventListener( 'resize', recalcRatio );
	}, [] );

	// If we want to disable the premium layers the we can use this code
	// const isValidAPIKey = window?.videoData?.valid_api_key;

	// For now we are enabling all the features
	const isValidAPIKey = true;

	return (
		<>
			<div className="flex justify-between items-center pb-3 border-b mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<p className="font-semibold">
					{ __( 'WooCommerce Layer at', 'godam' ) } { layer.displayTime }s
				</p>
				<Button
					icon={ trash }
					isDestructive
					onClick={ () => setDeleteModalOpen( true ) }
				/>
				{ isDeleteModalOpen && (
					<Modal
						title={ __( 'Delete WooCommerce Layer', 'godam' ) }
						onRequestClose={ () => setDeleteModalOpen( false ) }
					>
						<div className="flex justify-between items-center gap-3">
							<Button
								className="w-full justify-center godam-button"
								isTertiary
								onClick={ () => setDeleteModalOpen( false ) }
							>
								{ __( 'Cancel', 'godam' ) }
							</Button>
							<Button
								className="w-full justify-center godam-button"
								isDestructive
								onClick={ () => {
									handleDeleteLayer();
									setDeleteModalOpen( false );
								} }
							>
								{ __( 'Delete Layer', 'godam' ) }
							</Button>
						</div>
					</Modal>
				) }
			</div>

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

			{ /* Product Hotspots list */ }
			<div className="flex flex-col gap-4">
				{ productHotspots.map( ( productHotspot, index ) => (
					<div key={ productHotspot.id } className="p-2 border rounded">
						<div className="flex justify-between items-center">
							<Button
								icon={ expandedProductHotspotIndex === index ? chevronUp : chevronDown }
								className="flex-1 text-left text-flex-left"
								onClick={ () => toggleProductHotspotExpansion( index ) }
							>
								{ productHotspot?.productDetails?.name
									? `${ index + 1 }. ${ productHotspot.productDetails.name }`
									: `Product Hotspot ${ index + 1 }` }
							</Button>
							<DropdownMenu
								icon={ moreVertical }
								label={ `Product Hotspot ${ index + 1 } options` }
								toggleProps={ { 'aria-label': `Options for Product Hotspot ${ index + 1 }` } }
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
																showIcon: ! h2.showIcon, // Enable icon
																showStyle: ! h2.showIcon ? false : h2.showStyle, // Disable style
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
											onClick={ () => handleDeleteProductHotspot( index ) }
											className="text-red-500"
										>
											{ __( 'Delete Product Hotspot', 'godam' ) }
										</MenuItem>
									</>
								) }
							</DropdownMenu>
						</div>

						{ expandedProductHotspotIndex === index && (
							<div className="mt-3">
								<TextControl
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
								/>
								<div className="mt-3">
									{ ( () => {
										const isGrouped = productHotspot.productDetails.type === 'grouped';
										const isExternal = productHotspot.productDetails.type === 'external';
										const forceProductPage = isGrouped || isExternal;
										const isDisabled = ! isValidAPIKey || isGrouped || isExternal;

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
										} else if ( productHotspot.addToCart ) {
											help = __( 'Users will be redirected to the product page.', 'godam' );
										} else {
											help = __( 'By default, this adds the product to the cart. Turn ON to go to the product page instead.', 'godam' );
										}

										return (
											<ToggleControl
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
				) ) }

				<Button
					isPrimary
					id="add-hotspot-btn"
					icon={ plus }
					iconPosition="left"
					onClick={ handleAddProductHotspot }
					disabled={ ! isValidAPIKey }
				>
					{ __( 'Add Product Hotspot', 'godam' ) }
				</Button>
			</div>

			{ /* The actual layer content */ }
			<LayerControls>
				<div
					ref={ containerRef }
					className="easydam-layer hotspot-layer"
					style={ { backgroundColor: layer.bg_color || 'transparent' } }
				>
					<div
						className="absolute inset-0 bg-transparent z-10 pointer-events-auto"
					></div>
					{ productHotspots.map( ( productHotspot, index ) => {
						const fallbackPosX = productHotspot.oPosition?.x ?? productHotspot.position.x;
						const fallbackPosY = productHotspot.oPosition?.y ?? productHotspot.position.y;

						return (
							<Rnd
								key={ productHotspot.id }
								position={ {
									x: ratioToPx( fallbackPosX, 'x' ),
									y: ratioToPx( fallbackPosY, 'y' ),
								} }
								size={ {
									width: ratioToPx(
										productHotspot.oSize?.diameter ?? productHotspot.size?.diameter ?? 48,
										'x',
									),
									height: ratioToPx(
										productHotspot.oSize?.diameter ?? productHotspot.size?.diameter ?? 48,
										'x',
									),
								} }
								bounds="parent"
								maxWidth={ 100 }
								maxHeight={ 100 }
								minWidth={ 20 }
								minHeight={ 20 }
								lockAspectRatio
								onDragStop={ ( e, d ) => {
									const newProductHotspots = productHotspots.map( ( h2, j ) => {
										if ( j === index ) {
											return {
												...h2,
												oPosition: {
													x: pxToRatio( d.x, 'x' ),
													y: pxToRatio( d.y, 'y' ),
												},
											};
										}
										return h2;
									} );
									updateField( 'productHotspots', newProductHotspots );
								} }
								onResizeStop={ ( e, direction, ref ) => {
									const newDiameterPx = ref.offsetWidth;
									const newProductHotspots = productHotspots.map( ( h2, j ) => {
										if ( j === index ) {
											return {
												...h2,
												oSize: {
													diameter: pxToRatio( newDiameterPx, 'x' ),
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
								} }
							>
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
										{ productHotspot?.productDetails ? (
											<div className="product-hotspot-woo-display">
												<div className="product-hotspot-woo-image-wrapper">
													<img
														className="product-hotspot-woo-image"
														src={ productHotspot.productDetails.image }
														alt={ productHotspot.productDetails.name }
													/>
												</div>
												<div className="product-hotspot-woo-details">
													<div className="product-hotspot-woo-name">
														{ productHotspot.productDetails.name }
													</div>
													<div
														className="product-hotspot-woo-price"
														dangerouslySetInnerHTML={ {
															__html: `${ productHotspot.productDetails.price }`,
														} }
													/>
													<a
														className="product-hotspot-woo-link"
														href={
															productHotspot.addToCart
																? productHotspot.productDetails.link
																: `/cart/?add-to-cart=${ productHotspot.productId }`
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
							</Rnd>
						);
					} ) }
				</div>
			</LayerControls>
		</>
	);
};

export default WoocommerceLayer;
