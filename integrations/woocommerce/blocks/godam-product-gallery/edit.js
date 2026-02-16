/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-nested-ternary */
/* eslint-disable react-hooks/exhaustive-deps */

/* global RTGoDAMProductGalleryBlockSettings */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import {
	Notice,
	PanelBody,
	SelectControl,
	ToggleControl,
	ColorPalette,
	RangeControl,
	BorderControl,
	FormTokenField,
	Button,
	CheckboxControl,
} from '@wordpress/components';
import { useMemo, useRef, useEffect, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import './editor.scss';

/**
 * The edit function describes the structure of your block in the context of the
 * editor. This represents what the editor will render when the block is used.
 *
 * @param {Object}   props               Block props.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Function to set block attributes.
 * @param {string}   props.clientId      Block client ID.
 * @return {JSX.Element} Element to render.
 */
export default function Edit( { attributes, setAttributes, clientId } ) {
	const {
		autoplay,
		products = [],
		categories = [],
		selectedVideos = [],
		orderBy,
		layout,
		view,
		playButtonEnabled,
		playButtonBgColor,
		playButtonIconColor,
		playButtonSize,
		playButtonBorderRadius,
		unmuteButtonBgColor,
		unmuteButtonIconColor,
		cardWidth = {},
		arrowBgColor,
		arrowIconColor,
		arrowSize,
		arrowBorderRadius,
		arrowVisibility,
		gridColumns = {},
		gridRowGap,
		gridColumnGap,
		ctaEnabled,
		ctaDisplayPosition,
		ctaBgColor,
		ctaProductNameFontSize,
		ctaProductPriceFontSize,
		ctaProductNameColor,
		ctaProductPriceColor = {},
		ctaCart = {},
		ctaDropdown = {},
	} = attributes;

	// State for fetched data from REST API.
	const [ allCategories, setAllCategories ] = useState( [] );
	const [ availableVideos, setAvailableVideos ] = useState( [] );
	const [ isLoadingCategories, setIsLoadingCategories ] = useState( false );
	const [ isLoadingVideos, setIsLoadingVideos ] = useState( false );
	const [ productSearchInput, setProductSearchInput ] = useState( '' );
	const [ searchedProducts, setSearchedProducts ] = useState( [] );
	const [ isSearchingProducts, setIsSearchingProducts ] = useState( false );
	const [ productOptionsById, setProductOptionsById ] = useState( {} );

	// Fetch product categories using getEntityRecords.
	const allWooCategories = useSelect( ( select ) => {
		return select( 'core' ).getEntityRecords( 'taxonomy', 'product_cat', {
			per_page: -1,
			hide_empty: false,
		} );
	}, [] );

	// Build hierarchical category labels based on parent_id.
	useEffect( () => {
		if ( ! allWooCategories ) {
			setIsLoadingCategories( true );
			return;
		}

		setIsLoadingCategories( false );

		// Build a map of categories by id for quick lookup.
		const categoryMap = {};
		allWooCategories.forEach( ( cat ) => {
			categoryMap[ cat.id ] = cat;
		} );

		// Function to get parent chain and build label with dashes.
		const buildCategoryLabel = ( category ) => {
			const parents = [];
			let current = category;

			while ( current && current.parent ) {
				const parentCat = categoryMap[ current.parent ];
				if ( ! parentCat ) {
					break;
				}
				parents.unshift( parentCat );
				current = parentCat;
			}

			const dashPrefix = parents.length > 0 ? '— '.repeat( parents.length ) : '';
			return dashPrefix + category.name;
		};

		// Format categories with hierarchical labels.
		const hierarchicalCategories = allWooCategories.map( ( cat ) => ( {
			id: cat.id,
			name: cat.name,
			value: cat.id,
			label: buildCategoryLabel( cat ),
			parent: cat.parent,
		} ) );

		setAllCategories( hierarchicalCategories );
	}, [ allWooCategories ] );

	const blockProps = useBlockProps();

	const [ activePriceTab, setActivePriceTab ] = useState( 'primary' );
	const [ activeCartTab, setActiveCartTab ] = useState( 'cart' );

	// Set the Block id of the Block as ClientId.
	useEffect( () => {
		if ( ! attributes.blockId ) {
			setAttributes( { blockId: clientId } );
		}
	}, [ clientId ] );

	useEffect( () => {
		const normalizedInput = productSearchInput.trim();

		if ( normalizedInput.length === 0 ) {
			setSearchedProducts( [] );
			return;
		}

		setIsSearchingProducts( true );
		const categoryQuery = categories.length > 0 ? `&categories=${ categories.join( ',' ) }` : '';
		apiFetch( {
			path: `/godam/v1/product-gallery/products?search=${ encodeURIComponent(
				normalizedInput,
			) }${ categoryQuery }`,
		} )
			.then( ( results ) => {
				setSearchedProducts( Array.isArray( results ) ? results : [] );
				setIsSearchingProducts( false );
			} )
			.catch( () => {
				setSearchedProducts( [] );
				setIsSearchingProducts( false );
			} );
	}, [ productSearchInput, categories ] );

	useEffect( () => {
		if ( searchedProducts.length === 0 ) {
			return;
		}

		setProductOptionsById( ( previous ) => {
			const next = { ...previous };

			searchedProducts.forEach( ( product ) => {
				next[ product.id ] = product;
			} );

			return next;
		} );
	}, [ searchedProducts ] );

	useEffect( () => {
		const missingProductIds = products.filter( ( productId ) => ! productOptionsById[ productId ] );

		if ( missingProductIds.length === 0 ) {
			return;
		}

		apiFetch( {
			path: `/godam/v1/product-gallery/products?include=${ missingProductIds.join( ',' ) }`,
		} ).then( ( fetchedProducts ) => {
			if ( ! Array.isArray( fetchedProducts ) || fetchedProducts.length === 0 ) {
				return;
			}

			setProductOptionsById( ( previous ) => {
				const next = { ...previous };

				fetchedProducts.forEach( ( product ) => {
					next[ product.id ] = product;
				} );

				return next;
			} );
		} );
	}, [ products, productOptionsById ] );

	// Fetch videos when products selection changes.
	useEffect( () => {
		if ( products.length === 0 ) {
			setAvailableVideos( [] );
			return;
		}

		setIsLoadingVideos( true );
		apiFetch( {
			path: `/godam/v1/product-gallery/videos?product_ids=${ products.join( ',' ) }`,
		} )
			.then( ( fetchedVideos ) => {
				setAvailableVideos( fetchedVideos || [] );
				setIsLoadingVideos( false );
			} )
			.catch( () => {
				setIsLoadingVideos( false );
			} );
	}, [ products ] );

	const deviceType = useSelect( ( select ) => {
		return select( 'core/editor' ).getDeviceType();
	}, [] );

	// Refrence to preview view value.
	const previousViewRef = useRef( view );

	// Constant for locing play button.
	const isPlayButtonLocked = ! autoplay;

	// Factory to generate toggle attribute function for autoplay.
	const toggleFactory = useMemo( () => {
		const toggleAttribute = ( attribute ) => {
			return ( newValue ) => {
				setAttributes( { [ attribute ]: newValue } );
			};
		};

		return {
			autoplay: toggleAttribute( 'autoplay' ),
		};
	}, [] );

	// Ensure play button is shown when autoplay is off.
	useEffect( () => {
		if ( ! autoplay && ! playButtonEnabled ) {
			setAttributes( { playButtonEnabled: true } );
		}
	}, [ autoplay ] );

	// Update card width on view change.
	useEffect( () => {
		// If view has changed, reset to default width, else do nothing.
		if ( previousViewRef.current !== view ) {
			setAttributes( {
				cardWidth: {
					desktop: parseFloat( getCardWidthForView( view, layout, 'desktop' ) ),
					tablet: parseFloat( getCardWidthForView( view, layout, 'tablet' ) ),
					mobile: parseFloat( getCardWidthForView( view, layout, 'mobile' ) ),
				},
			} );
			previousViewRef.current = view;
		}
	}, [ view ] );

	const scrollRef = useRef();

	// Scroll Carousel left.
	const scrollLeft = () => {
		if ( scrollRef.current ) {
			scrollRef.current.scrollBy( { left: -300, behavior: 'smooth' } );
		}
	};

	// Scroll Carousel right.
	const scrollRight = () => {
		if ( scrollRef.current ) {
			scrollRef.current.scrollBy( { left: 300, behavior: 'smooth' } );
		}
	};

	/**
	 * Returns default CTA width (in rem) based on selected view ratio and layout.
	 *
	 * @param {string} viewRatio  - View ratio (e.g., '16-9', '4-3', etc.).
	 * @param {string} layoutType - Layout (e.g., 'carousel', 'grid', etc.).
	 * @param {string} device     - Device (e.g., 'desktop', 'tablet', 'mobile', 'all').
	 * @return {string} CTA width in rem units as a string.
	 */
	const getCardWidthForView = ( viewRatio, layoutType, device ) => {
		if ( layoutType === 'carousel' ) {
			if ( device === 'tablet' ) {
				return '35.5';
			} else if ( device === 'mobile' ) {
				return '59.5';
			}

			switch ( viewRatio ) {
				case '16-9':
					return '42';
				case '4-3':
					return '21.5';
				case '9-16':
					return '16.5';
				case '3-4':
					return '18.5';
				case '1-1':
					return '19';
			}
		} else if ( layoutType === 'grid' ) {
			return '17';
		}

		return '0';
	};

	/* Get card width to show in Carousel */
	const currentCardWidth =
	deviceType === 'Mobile'
		? cardWidth?.mobile ?? parseFloat( getCardWidthForView( view, layout, 'mobile' ) )
		: deviceType === 'Tablet'
			? cardWidth?.tablet ?? parseFloat( getCardWidthForView( view, layout, 'tablet' ) )
			: cardWidth?.desktop ?? parseFloat( getCardWidthForView( view, layout, 'desktop' ) );

	/* Get number of columns to show in Grid */
	const currentGridColumns =
	deviceType === 'Mobile'
		? gridColumns?.mobile ?? 2
		: deviceType === 'Tablet'
			? gridColumns?.tablet ?? 3
			: gridColumns?.desktop ?? 4;

	/* Determine Product Position help text */
	const getProductLayoutHelp = () => {
		if ( ctaDisplayPosition === 'inside' ) {
			return __(
				'Products only appear as an overlay on the video. (sidebar on desktop & floating tile on mobile)',
				'godam',
			);
		}

		if ( ctaDisplayPosition === 'below' ) {
			return __(
				'Products are only displayed below each video in the layout.',
				'godam',
			);
		}

		if ( ctaDisplayPosition === 'below-inside' ) {
			return __(
				'Products appear both as an overlay (sidebar on desktop, floating tile on mobile) and below each video in the layout.',
				'godam',
			);
		}

		return '';
	};

	/**
	 * Generate sample videos for preview in editor.
	 */
	const GoDAMVideos = Array.from( { length: 10 }, ( _, i ) => {
		return (
			<div
				className={ `godam-editor-product-video-item view-${ view }` }
				key={ i }
				style={
					layout === 'carousel'
						? {
							minWidth: '10vw',
							width: `${ currentCardWidth }vw`,
						}
						: {}
				}
			>
				<div className="godam-editor-product-video-thumbnail">
					<span className="godam-editor-product-video-label">
						{ __( 'Product Video', 'godam' ) }
					</span>

					{ /* Play button overlay */ }
					{ playButtonEnabled && (
						<button
							className="godam-play-button"
							style={ {
								backgroundColor: playButtonBgColor,
								color: playButtonIconColor,
								width: playButtonSize,
								height: playButtonSize,
								fontSize: playButtonSize / 2,
								borderRadius: `${ playButtonBorderRadius }px`,
							} }
							aria-label={ __( 'Play video', 'godam' ) }
						>
							<svg
								viewBox="0 0 24 24"
								fill="currentColor"
								xmlns="http://www.w3.org/2000/svg"
								style={ {
									width: playButtonSize / 2,
									height: playButtonSize / 2,
								} }
							>
								<path d="M8 5v14l11-7z" />
							</svg>
						</button>
					) }

					{ /* Unmute button when autoplay is enabled and play button is hidden */ }
					{ autoplay && ! playButtonEnabled && (
						<button
							className="godam-unmute-button"
							style={ {
								backgroundColor: unmuteButtonBgColor,
								color: unmuteButtonIconColor,
								width: 30,
								height: 30,
								fontSize: 16,
								borderRadius: '50%',
							} }
							aria-label={ __( 'Unmute video', 'godam' ) }
						>
							<svg
								viewBox="0 0 24 24"
								fill="currentColor"
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
							>
								<path d="M5 9v6h4l5 5V4l-5 5H5z" />
								<g transform="translate(17, 9)">
									<line x1="0" y1="0" x2="6" y2="6" stroke="currentColor" strokeWidth="2" />
									<line x1="0" y1="6" x2="6" y2="0" stroke="currentColor" strokeWidth="2" />
								</g>
							</svg>

						</button>
					) }
				</div>

				{ /* CTA Display below video */ }
				{ ctaEnabled && ( ctaDisplayPosition === 'below' || ctaDisplayPosition === 'below-inside' ) && (
					<div
						className="godam-product-cta"
						style={ {
							width: layout === 'carousel' ? `${ currentCardWidth }vw` : '100%',
							backgroundColor: ctaBgColor,
						} }
					>
						<div className="cta-thumbnail" />
						<div className="cta-details">
							<div
								className="product-title"
								style={ {
									fontSize: `${ ctaProductNameFontSize }rem`,
									color: ctaProductNameColor,
								} }
							>
								{ __( 'Sample Product Name', 'godam' ) }
							</div>
							<p
								className="product-price"
								style={ {
									fontSize: `${ ctaProductPriceFontSize }rem`,
									color: ctaProductPriceColor,
								} }
							>
								{ __( '$99.99', 'your-text-domain' ) }
							</p>
						</div>
						<button
							className="cta-add-to-cart"
							style={ {
								backgroundColor: ctaCart?.bgColor,
								color: ctaCart?.iconColor,
								borderRadius: `${ ctaCart?.borderRadius }px`,
							} }
							aria-label={ __( 'Add to cart', 'godam' ) }
						>
							<span aria-hidden="true">+</span>
						</button>
					</div>
				) }
			</div>

		);
	} );

	/**
	 * Return if WooCommerce is not Active.
	 */
	if (
		typeof RTGoDAMProductGalleryBlockSettings !== 'undefined' &&
		RTGoDAMProductGalleryBlockSettings.isWooActive === false
	) {
		return (
			<Notice status="error" isDismissible={ false }>
				{ __( 'Activate WooCommerce to use this block.', 'godam' ) }
			</Notice>
		);
	}

	// Render block markup and controls.
	return (
		<>
			<InspectorControls>

				<PanelBody title={ __( 'Product Gallery Configuration', 'rtgodam' ) }>
					<ToggleControl
						__nextHasNoMarginBottom
						label={
							autoplay
								? __( 'Motion Preview Enabled', 'godam' )
								: __( 'Thumbnail Preview Enabled', 'godam' )
						}
						onChange={ toggleFactory.autoplay }
						checked={ !! autoplay }
						help={
							autoplay
								? __( 'Videos will auto-play a short preview in the gallery.', 'godam' )
								: __( 'Videos will display a static thumbnail image.', 'godam' )
						}
					/>
					<ToggleControl
						label={ __( 'Show Shoppable Products', 'godam' ) }
						checked={ !! ctaEnabled }
						onChange={ ( value ) => setAttributes( { ctaEnabled: value } ) }
					/>
					<SelectControl
						label={ __( 'Layout', 'godam' ) }
						value={ layout }
						options={ [
							{ label: __( 'Carousel', 'godam' ), value: 'carousel' },
							{ label: __( 'Grid', 'godam' ), value: 'grid' },
						] }
						onChange={ ( value ) => {
							setAttributes( {
								layout: value,
							} );
						} }
					/>
					<SelectControl
						label={ __( 'View Ratio', 'godam' ) }
						value={ view }
						options={ [
							{ label: __( '4:3 (Standard)', 'godam' ), value: '4-3' },
							{ label: __( '9:16 (Reels/TikTok)', 'godam' ), value: '9-16' },
							{ label: __( '3:4 (Portrait)', 'godam' ), value: '3-4' },
							{ label: __( '1:1 (Square)', 'godam' ), value: '1-1' },
							{ label: __( '16:9 (Widescreen)', 'godam' ), value: '16-9' },
						] }
						onChange={ ( value ) => {
							setAttributes( {
								view: value,
							} );
						} }
					/>
					<SelectControl
						label={ __( 'Order By', 'godam' ) }
						value={ orderBy }
						options={ [
							{ label: __( 'Date (Newest First)', 'godam' ), value: 'date_desc' },
							{ label: __( 'Date (Oldest First)', 'godam' ), value: 'date_asc' },
							{ label: __( 'Title (A-Z)', 'godam' ), value: 'title_asc' },
							{ label: __( 'Title (Z-A)', 'godam' ), value: 'title_desc' },
							{ label: __( 'Random', 'godam' ), value: 'random' },
						] }
						onChange={ ( value ) => setAttributes( { orderBy: value } ) }
					/>

					<hr />

					<h3>{ __( 'Category Selection', 'godam' ) }</h3>
					<p className="components-base-control__help">
						{ __( 'Select product categories. Leave empty to show all categories.', 'godam' ) }
					</p>
					{ isLoadingCategories ? (
						<p>{ __( 'Loading categories…', 'godam' ) }</p>
					) : (
						<FormTokenField
							label={ __( 'Select Categories', 'godam' ) }
							value={
								categories
									.map( ( categoryId ) => {
										const category = allCategories.find( ( c ) => c.id === categoryId );
										return category ? category.name : null;
									} )
									.filter( Boolean )
							}
							suggestions={ allCategories.map( ( c ) => c.label ) }
							onChange={ ( tokens ) => {
								const selectedIds = tokens
									.map( ( token ) => {
										const category = allCategories.find( ( c ) => c.label === token );
										return category ? category.id : null;
									} )
									.filter( Boolean );
								// Reset selectedVideos when switching to category filtering
								setAttributes( { categories: selectedIds, selectedVideos: [] } );
							} }
							__experimentalShowHowTo={ false }
							__next40pxDefaultSize={ true }
						/>
					) }

					<hr />

					<h3>{ __( 'Product Selection', 'godam' ) }</h3>
					<p className="components-base-control__help">
						{ __( 'Type to search products with GoDAM videos. Results filter by selected categories.', 'godam' ) }
					</p>
					<FormTokenField
						label={ __( 'Select Products', 'godam' ) }
						value={
							products
								.map( ( productId ) => {
									const product = productOptionsById[ productId ];
									return product ? product.title : null;
								} )
								.filter( Boolean )
						}
						suggestions={ searchedProducts.map( ( product ) => product.title ) }
						onInputChange={ ( inputValue ) => setProductSearchInput( inputValue ) }
						onChange={ ( tokens ) => {
							const labelToId = {};

							Object.values( productOptionsById ).forEach( ( product ) => {
								labelToId[ product.title ] = product.id;
							} );

							searchedProducts.forEach( ( product ) => {
								labelToId[ product.title ] = product.id;
							} );

							const selectedIds = tokens
								.map( ( token ) => labelToId[ token ] )
								.filter( Boolean );

							// Reset selectedVideos when switching to product filtering
							setAttributes( { products: selectedIds, selectedVideos: [] } );
						} }
						__experimentalShowHowTo={ false }
						__next40pxDefaultSize={ true }
					/>
					{ productSearchInput.trim().length === 0 ? (
						<p style={ { color: '#999', fontSize: '13px' } }>
							{ __( 'Start typing to search for products…', 'godam' ) }
						</p>
					) : isSearchingProducts ? (
						<p>{ __( 'Searching products…', 'godam' ) }</p>
					) : searchedProducts.length === 0 ? (
						<p style={ { color: '#999', fontSize: '13px' } }>
							{ __( 'No products found', 'godam' ) }
						</p>
					) : null }
					{ products.length > 0 && (
						<p style={ { marginTop: '8px', fontSize: '12px', color: '#666' } }>
							{ `${ products.length } product(s) selected` }
						</p>
					) }

					{ products.length > 0 && (
						<>
							<hr />
							<h3>{ __( 'Video Selection', 'godam' ) }</h3>
							<p className="components-base-control__help">
								{ __( 'Select specific videos to display. Leave empty to show all videos from selected products.', 'godam' ) }
							</p>

							{ isLoadingVideos ? (
								<p>{ __( 'Loading videos…', 'godam' ) }</p>
							) : availableVideos.length > 0 ? (
								<>
									<div style={ { marginBottom: '12px' } }>
										<Button
											isSecondary
											isSmall
											onClick={ () => {
												const allVideoIds = availableVideos.map( ( v ) => v.id );
												setAttributes( { selectedVideos: allVideoIds } );
											} }
										>
											{ __( 'Select All', 'godam' ) }
										</Button>
										{ ' ' }
										<Button
											isSecondary
											isSmall
											onClick={ () => setAttributes( { selectedVideos: [] } ) }
										>
											{ __( 'Deselect All', 'godam' ) }
										</Button>
									</div>
									<div style={ { maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', padding: '8px' } }>
										{ availableVideos.map( ( video ) => (
											<div
												key={ video.id }
												style={ {
													display: 'flex',
													alignItems: 'center',
													marginBottom: '8px',
													padding: '4px',
													border: '1px solid #e0e0e0',
													borderRadius: '4px',
												} }
											>
												<CheckboxControl
													checked={ selectedVideos.includes( video.id ) }
													onChange={ ( isChecked ) => {
														const newVideos = isChecked
															? [ ...selectedVideos, video.id ]
															: selectedVideos.filter( ( id ) => id !== video.id );
														setAttributes( { selectedVideos: newVideos } );
													} }
												/>
												<img
													src={ video.thumbnail }
													alt={ video.title }
													style={ {
														width: '50px',
														height: '50px',
														objectFit: 'cover',
														marginRight: '8px',
														borderRadius: '4px',
													} }
												/>
												<span>{ video.titleWithDuration }</span>
											</div>
										) ) }
									</div>
								</>
							) : (
								<p>{ __( 'No videos found for selected products.', 'godam' ) }</p>
							) }
						</>
					) }
				</PanelBody>

				{ layout === 'carousel' && (
					<PanelBody title={ __( 'Carousel Layout & Navigation', 'godam' ) } initialOpen={ false }>

						<PanelBody title={ __( 'Card Layout', 'godam' ) } initialOpen={ false }>
							<RangeControl
								label={ __( 'Desktop Card Width', 'godam' ) }
								value={ cardWidth?.desktop ?? parseFloat( getCardWidthForView( view, layout, 'desktop' ) ) }
								onChange={ ( value ) =>
									setAttributes( {
										cardWidth: {
											...cardWidth,
											desktop: value,
										},
									} )
								}
								min={ 10 }
								max={ 100 }
								step={ 0.5 }
							/>

							<RangeControl
								label={ __( 'Tablet Card Width', 'godam' ) }
								value={ cardWidth?.tablet ?? parseFloat( getCardWidthForView( view, layout, 'tablet' ) ) }
								onChange={ ( value ) =>
									setAttributes( {
										cardWidth: {
											...cardWidth,
											tablet: value,
										},
									} )
								}
								min={ 10 }
								max={ 100 }
								step={ 0.5 }
							/>

							<RangeControl
								label={ __( 'Mobile Card Width', 'godam' ) }
								value={ cardWidth?.mobile ?? parseFloat( getCardWidthForView( view, layout, 'mobile' ) ) }
								onChange={ ( value ) =>
									setAttributes( {
										cardWidth: {
											...cardWidth,
											mobile: value,
										},
									} )
								}
								min={ 10 }
								max={ 100 }
								step={ 0.5 }
							/>
						</PanelBody>

						<PanelBody title={ __( 'Navigation Arrows', 'godam' ) } initialOpen={ false }>
							<p><strong>{ __( 'Arrow Background Color', 'godam' ) }</strong></p>
							<ColorPalette
								enableAlpha
								value={ arrowBgColor }
								onChange={ ( color ) => setAttributes( { arrowBgColor: color } ) }
							/>

							<p><strong>{ __( 'Arrow Icon Color', 'godam' ) }</strong></p>
							<ColorPalette
								enableAlpha
								value={ arrowIconColor }
								onChange={ ( color ) => setAttributes( { arrowIconColor: color } ) }
							/>

							<RangeControl
								label={ __( 'Arrow Size', 'godam' ) }
								value={ arrowSize }
								onChange={ ( value ) => setAttributes( { arrowSize: value } ) }
								min={ 16 }
								max={ 64 }
							/>

							<RangeControl
								label={ __( 'Border Radius', 'godam' ) }
								value={ arrowBorderRadius }
								onChange={ ( value ) => setAttributes( { arrowBorderRadius: value } ) }
								min={ 0 }
								max={ 30 }
							/>

							<SelectControl
								label={ __( 'Arrow Visibility', 'godam' ) }
								value={ arrowVisibility }
								options={ [
									{ label: __( 'Always visible', 'godam' ), value: 'always' },
									{ label: __( 'Show on hover', 'godam' ), value: 'hover' },
								] }
								onChange={ ( value ) => setAttributes( { arrowVisibility: value } ) }
							/>
						</PanelBody>
					</PanelBody>
				) }

				{ layout === 'grid' && (
					<PanelBody title={ __( 'Grid Layout & Spacing', 'godam' ) } initialOpen={ false }>

						<PanelBody title={ __( 'Column Layout', 'godam' ) } initialOpen={ false }>
							<RangeControl
								label={ __( 'Desktop Columns', 'godam' ) }
								value={ gridColumns?.desktop ?? 4 }
								onChange={ ( value ) =>
									setAttributes( {
										gridColumns: {
											...gridColumns,
											desktop: value,
										},
									} )
								}
								min={ 1 }
								max={ 6 }
							/>

							<RangeControl
								label={ __( 'Tablet Columns', 'godam' ) }
								value={ gridColumns?.tablet ?? 3 }
								onChange={ ( value ) =>
									setAttributes( {
										gridColumns: {
											...gridColumns,
											tablet: value,
										},
									} )
								}
								min={ 1 }
								max={ 4 }
							/>

							<RangeControl
								label={ __( 'Mobile Columns', 'godam' ) }
								value={ gridColumns?.mobile ?? 2 }
								onChange={ ( value ) =>
									setAttributes( {
										gridColumns: {
											...gridColumns,
											mobile: value,
										},
									} )
								}
								min={ 1 }
								max={ 2 }
							/>
						</PanelBody>

						<PanelBody title={ __( 'Spacing', 'godam' ) } initialOpen={ false }>
							<RangeControl
								label={ __( 'Row Gap', 'godam' ) }
								value={ gridRowGap }
								onChange={ ( value ) => setAttributes( { gridRowGap: value } ) }
								min={ 0 }
								max={ 5 }
								step={ 0.1 }
							/>

							<RangeControl
								label={ __( 'Column Gap', 'godam' ) }
								value={ gridColumnGap }
								onChange={ ( value ) => setAttributes( { gridColumnGap: value } ) }
								min={ 0 }
								max={ 5 }
								step={ 0.1 }
							/>
						</PanelBody>
					</PanelBody>
				) }

				<PanelBody
					title={
						playButtonEnabled
							? __( 'Play Button Overlay', 'godam' )
							: __( 'Sound Button Overlay', 'godam' )
					}
					initialOpen={ false }
				>
					<ToggleControl
						label={
							playButtonEnabled
								? __( 'Show Play Button', 'godam' )
								: __( 'Show Sound Button', 'godam' )
						}
						checked={ !! playButtonEnabled }
						onChange={ ( value ) => setAttributes( { playButtonEnabled: value } ) }
						disabled={ isPlayButtonLocked }
						help={
							isPlayButtonLocked
								? __( 'Required when motion preview is disabled.', 'godam' )
								: playButtonEnabled
									? __( 'Displays a play icon overlay on videos.', 'godam' )
									: __( 'Displays a sound/mute icon overlay on videos.', 'godam' )
						}
					/>
					<PanelBody title={ __( 'Appearance', 'godam' ) } initialOpen={ false }>
						{ playButtonEnabled ? (
							<>
								<p><strong>{ __( 'Background Color', 'godam' ) }</strong></p>
								<ColorPalette
									enableAlpha
									value={ playButtonBgColor }
									onChange={ ( color ) => setAttributes( { playButtonBgColor: color } ) }
								/>

								<p><strong>{ __( 'Icon Color', 'godam' ) }</strong></p>
								<ColorPalette
									enableAlpha
									value={ playButtonIconColor }
									onChange={ ( color ) => setAttributes( { playButtonIconColor: color } ) }
								/>

								<RangeControl
									label={ __( 'Button Size', 'godam' ) }
									value={ playButtonSize }
									onChange={ ( value ) => setAttributes( { playButtonSize: value } ) }
									min={ 20 }
									max={ 100 }
								/>

								<RangeControl
									label={ __( 'Border Radius', 'godam' ) }
									value={ playButtonBorderRadius }
									onChange={ ( value ) => setAttributes( { playButtonBorderRadius: value } ) }
									min={ 0 }
									max={ 50 }
								/>
							</>
						) : (
							<>
								<p><strong>{ __( 'Background Color', 'godam' ) }</strong></p>
								<ColorPalette
									enableAlpha
									value={ unmuteButtonBgColor }
									onChange={ ( color ) => setAttributes( { unmuteButtonBgColor: color } ) }
								/>

								<p><strong>{ __( 'Icon Color', 'godam' ) }</strong></p>
								<ColorPalette
									enableAlpha
									value={ unmuteButtonIconColor }
									onChange={ ( color ) => setAttributes( { unmuteButtonIconColor: color } ) }
								/>
							</>
						) }
					</PanelBody>
				</PanelBody>

				{ ctaEnabled && (
					<PanelBody title={ __( 'Shoppable Products Settings', 'godam' ) } initialOpen={ false }>
						<SelectControl
							label={ __( 'Where should products appear?', 'godam' ) }
							value={ ctaDisplayPosition }
							options={ [
								{ label: __( 'Overlay + Below', 'godam' ), value: 'below-inside' },
								{ label: __( 'Only Overlay', 'godam' ), value: 'inside' },
								{ label: __( 'Only Below', 'godam' ), value: 'below' },
							] }
							help={ getProductLayoutHelp() }
							onChange={ ( value ) => setAttributes( { ctaDisplayPosition: value } ) }
						/>

						<PanelBody
							title={ __( 'Display', 'godam' ) }
							initialOpen={ false }
						>
							<p><strong>{ __( 'Product Section Background', 'godam' ) }</strong></p>
							<ColorPalette
								enableAlpha
								value={ ctaBgColor }
								onChange={ ( color ) => setAttributes( { ctaBgColor: color } ) }
							/>
						</PanelBody>

						<PanelBody
							title={ __( 'Product Info', 'godam' ) }
							initialOpen={ false }
						>
							<RangeControl
								label={ __( 'Name Font Size', 'godam' ) }
								value={ ctaProductNameFontSize }
								onChange={ ( value ) => setAttributes( { ctaProductNameFontSize: value } ) }
								min={ 0 }
								max={ 4 }
								step={ 0.01 }
							/>

							<p><strong>{ __( 'Name Color', 'godam' ) }</strong></p>
							<ColorPalette
								enableAlpha
								value={ ctaProductNameColor }
								onChange={ ( color ) => setAttributes( { ctaProductNameColor: color } ) }
							/>

							<RangeControl
								label={ __( 'Price Font Size', 'godam' ) }
								value={ ctaProductPriceFontSize }
								onChange={ ( value ) => setAttributes( { ctaProductPriceFontSize: value } ) }
								min={ 0 }
								max={ 4 }
								step={ 0.01 }
							/>

							<p><strong>{ __( 'Price Colors', 'godam' ) }</strong></p>
							<div className="godam-product-gallery-editor-tabs">

								{ [ 'primary', 'secondary', 'tertiary' ].map( ( key ) => (
									<button
										key={ key }
										className={ `godam-product-gallery-editor-tab ${ activePriceTab === key ? 'is-active' : '' }` }
										onClick={ () => setActivePriceTab( key ) }
										type="button"
									>
										<span
											className="godam-color-indicator"
											style={ {
												backgroundColor: ctaProductPriceColor?.[ key ],
											} }
										/>
										{ key.charAt( 0 ).toUpperCase() + key.slice( 1 ) }
									</button>
								) ) }

							</div>

							<ColorPalette
								enableAlpha
								value={ ctaProductPriceColor?.[ activePriceTab ] }
								onChange={ ( color ) =>
									setAttributes( {
										ctaProductPriceColor: {
											...ctaProductPriceColor,
											[ activePriceTab ]: color,
										},
									} )
								}
							/>
						</PanelBody>

						<PanelBody
							title={ __( 'Cart & Dropdown', 'godam' ) }
							initialOpen={ false }
						>

							{ /* Tabs */ }
							<div className="godam-product-gallery-editor-tabs">
								{ [ 'cart', 'dropdown' ].map( ( key ) => (
									<button
										key={ key }
										type="button"
										className={ `godam-product-gallery-editor-tab ${ activeCartTab === key ? 'is-active' : '' }` }
										onClick={ () => setActiveCartTab( key ) }
									>
										{ key.charAt( 0 ).toUpperCase() + key.slice( 1 ) }
									</button>
								) ) }
							</div>

							{ /* CART SETTINGS */ }
							{ activeCartTab === 'cart' && (
								<>
									<p><strong>{ __( 'Background Color', 'godam' ) }</strong></p>
									<ColorPalette
										enableAlpha
										value={ ctaCart?.bgColor }
										onChange={ ( color ) =>
											setAttributes( {
												ctaCart: { ...ctaCart, bgColor: color },
											} )
										}
									/>

									<p><strong>{ __( 'Icon Color', 'godam' ) }</strong></p>
									<ColorPalette
										enableAlpha
										value={ ctaCart?.iconColor }
										onChange={ ( color ) =>
											setAttributes( {
												ctaCart: { ...ctaCart, iconColor: color },
											} )
										}
									/>

									<BorderControl
										label={ __( 'Border', 'godam' ) }
										value={ ctaCart?.border }
										style={ {
											marginBottom: '3rem',
										} }
										onChange={ ( border ) =>
											setAttributes( {
												ctaCart: { ...ctaCart, border },
											} )
										}
									/>

									<RangeControl
										label={ __( 'Border Radius', 'godam' ) }
										value={ ctaCart?.borderRadius }
										onChange={ ( value ) =>
											setAttributes( {
												ctaCart: { ...ctaCart, borderRadius: value },
											} )
										}
										min={ 0 }
										max={ 50 }
									/>

									<SelectControl
										label={ __( 'Post Add-to-Cart Behavior', 'godam' ) }
										value={ ctaCart?.action }
										options={ [
											{ label: __( 'Open Mini Cart Drawer', 'godam' ), value: 'mini-cart' },
											{ label: __( 'Go to Cart Page', 'godam' ), value: 'redirect' },
										] }
										onChange={ ( value ) =>
											setAttributes( {
												ctaCart: { ...ctaCart, action: value },
											} )
										}
									/>
								</>
							) }

							{ /* DROPDOWN SETTINGS */ }
							{ activeCartTab === 'dropdown' && (
								<>
									<p><strong>{ __( 'Background Color', 'godam' ) }</strong></p>
									<ColorPalette
										enableAlpha
										value={ ctaDropdown?.bgColor }
										onChange={ ( color ) =>
											setAttributes( {
												ctaDropdown: { ...ctaDropdown, bgColor: color },
											} )
										}
									/>

									<p><strong>{ __( 'Icon Color', 'godam' ) }</strong></p>
									<ColorPalette
										enableAlpha
										value={ ctaDropdown?.iconColor }
										onChange={ ( color ) =>
											setAttributes( {
												ctaDropdown: { ...ctaDropdown, iconColor: color },
											} )
										}
									/>

									<BorderControl
										label={ __( 'Border', 'godam' ) }
										value={ ctaDropdown?.border }
										style={ {
											marginBottom: '3rem',
										} }
										onChange={ ( border ) =>
											setAttributes( {
												ctaDropdown: { ...ctaDropdown, border },
											} )
										}
									/>

									<RangeControl
										label={ __( 'Border Radius', 'godam' ) }
										value={ ctaDropdown?.borderRadius }
										onChange={ ( value ) =>
											setAttributes( {
												ctaDropdown: { ...ctaDropdown, borderRadius: value },
											} )
										}
										min={ 0 }
										max={ 50 }
									/>
								</>
							) }

						</PanelBody>
					</PanelBody>
				) }

			</InspectorControls>
			<div { ...blockProps }>
				<div className={ `godam-editor-product-gallery layout-${ layout }` }>
					{ layout === 'carousel' ? (
						<div className="godam-carousel-wrapper">
							<button
								className={ `carousel-arrow left ${ arrowVisibility === 'hover' ? 'hide-until-hover' : '' }` }
								onClick={ scrollLeft }
								style={ {
									backgroundColor: arrowBgColor,
									color: arrowIconColor,
									borderRadius: arrowBorderRadius,
									width: arrowSize,
									height: arrowSize,
									fontSize: arrowSize / 2,
								} }
								aria-label={ __( 'Scroll left', 'godam' ) }
							>
								&#10094;
							</button>
							<div className="carousel-track" ref={ scrollRef }>
								{ GoDAMVideos }
							</div>
							<button
								className={ `carousel-arrow right ${ arrowVisibility === 'hover' ? 'hide-until-hover' : '' }` }
								onClick={ scrollRight }
								style={ {
									backgroundColor: arrowBgColor,
									color: arrowIconColor,
									borderRadius: arrowBorderRadius,
									width: arrowSize,
									height: arrowSize,
									fontSize: arrowSize / 2,
								} }
								aria-label={ __( 'Scroll right', 'godam' ) }
							>
								&#10095;
							</button>
						</div>
					) : layout === 'grid' ? (
						<div className="godam-grid-wrapper">
							<div
								className="grid-container"
								style={ {
									display: 'grid',
									gridTemplateColumns: `repeat(${ currentGridColumns }, 1fr)`,
									rowGap: `${ gridRowGap }rem`,
									columnGap: `${ gridColumnGap }rem`,
								} }
							>
								{ GoDAMVideos }
							</div>
						</div>
					) : (
						<>{ GoDAMVideos }</>
					) }
				</div>
			</div>
		</>
	);
}
