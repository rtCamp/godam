/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @wordpress/no-unsafe-wp-apis */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	InspectorControls,
	InnerBlocks,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import {
	FormTokenField,
	Notice,
	PanelBody,
	RangeControl,
	ToggleControl,
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
	__experimentalToggleGroupControlOptionIcon as ToggleGroupControlOptionIcon,
} from '@wordpress/components';
import { useEffect, useMemo, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { columns, grid, video as videoIcon } from '@wordpress/icons';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import './editor.scss';

/**
 * The edit function for GoDAM Video Product Gallery block.
 *
 * @param {Object}   props               Block props.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Function to set block attributes.
 * @param {string}   props.clientId      Block client ID.
 * @return {JSX.Element} Element to render.
 */
export default function Edit( { attributes, setAttributes, clientId } ) {
	const {
		blockId,
		mode,
		layout,
		viewRatio,
		itemWidth,
		count = 12,
		autoplay,
		showPlayButton,
		categories = [],
		products = [],
		showAddToCart,
	} = attributes;
	const [ allCategories, setAllCategories ] = useState( [] );
	const [ queryPreviewItems, setQueryPreviewItems ] = useState( [] );
	const [ productSearchInput, setProductSearchInput ] = useState( '' );
	const [ searchedProducts, setSearchedProducts ] = useState( [] );
	const [ productOptionsById, setProductOptionsById ] = useState( {} );
	const [ isSearchingProducts, setIsSearchingProducts ] = useState( false );
	const [ isLoadingPreview, setIsLoadingPreview ] = useState( false );

	// Read blockGap from native spacing support and convert preset values to CSS.
	const rawGap = attributes.style?.spacing?.blockGap;
	const gapCss = ( () => {
		if ( ! rawGap ) {
			return '16px';
		}
		if ( typeof rawGap === 'string' && rawGap.startsWith( 'var:preset|spacing|' ) ) {
			return rawGap.replace( 'var:preset|spacing|', 'var(--wp--preset--spacing--' ) + ')';
		}
		return rawGap;
	} )();

	// Set the Block id of the Block as ClientId.
	useEffect( () => {
		if ( ! blockId ) {
			setAttributes( { blockId: clientId } );
		}
	}, [ clientId, blockId, setAttributes ] );

	// Get inner blocks count
	const { hasInnerBlocks, allWooCategories } = useSelect(
		( select ) => {
			const { getBlock } = select( blockEditorStore );
			const block = getBlock( clientId );
			return {
				hasInnerBlocks: !! ( block && block.innerBlocks.length ),
				allWooCategories: select( 'core' ).getEntityRecords( 'taxonomy', 'product_cat', {
					per_page: -1,
					hide_empty: false,
				} ),
			};
		},
		[ clientId ],
	);

	useEffect( () => {
		if ( ! allWooCategories ) {
			return;
		}

		const categoryMap = {};
		allWooCategories.forEach( ( category ) => {
			categoryMap[ category.id ] = category;
		} );

		const buildLabel = ( category ) => {
			const parents = [];
			let current = category;

			while ( current && current.parent ) {
				const parent = categoryMap[ current.parent ];
				if ( ! parent ) {
					break;
				}
				parents.unshift( parent );
				current = parent;
			}

			const dashPrefix = parents.length > 0 ? '— '.repeat( parents.length ) : '';
			return dashPrefix + category.name;
		};

		setAllCategories(
			allWooCategories.map( ( category ) => ( {
				id: category.id,
				name: category.name,
				label: buildLabel( category ),
			} ) ),
		);
	}, [ allWooCategories ] );

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
			} )
			.catch( () => {
				setSearchedProducts( [] );
			} )
			.finally( () => {
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

	useEffect( () => {
		if ( mode !== 'query' ) {
			setQueryPreviewItems( [] );
			return;
		}

		setIsLoadingPreview( true );

		const params = new URLSearchParams();

		if ( products.length > 0 ) {
			params.set( 'product_ids', products.join( ',' ) );
		}

		if ( categories.length > 0 ) {
			params.set( 'categories', categories.join( ',' ) );
		}

		params.set( 'count', String( count ) );

		apiFetch( {
			path: `/godam/v1/product-gallery/videos?${ params.toString() }`,
		} )
			.then( ( items ) => {
				setQueryPreviewItems( Array.isArray( items ) ? items : [] );
			} )
			.catch( () => {
				setQueryPreviewItems( [] );
			} )
			.finally( () => {
				setIsLoadingPreview( false );
			} );
	}, [ mode, products, categories, count ] );

	const selectedCategoryTokens = useMemo(
		() =>
			categories
				.map( ( categoryId ) => allCategories.find( ( category ) => category.id === categoryId )?.name )
				.filter( Boolean ),
		[ allCategories, categories ],
	);

	const selectedProductTokens = useMemo(
		() =>
			products
				.map( ( productId ) => productOptionsById[ productId ]?.title )
				.filter( Boolean ),
		[ productOptionsById, products ],
	);

	const itemWidthMap = { S: 220, M: 260, L: 300 };
	const itemWidthPx = itemWidthMap[ itemWidth ] || itemWidthMap.M;

	const blockProps = useBlockProps( {
		className: `godam-video-product-gallery godam-video-product-gallery--${ layout } godam-video-product-gallery--${ mode }`,
		style: {
			'--godam-gallery-item-width': `${ itemWidthPx }px`,
			'--godam-gallery-gap': gapCss,
		},
	} );

	// Template for InnerBlocks - starts with one item
	const TEMPLATE = [ [ 'godam/video-product-gallery-item', {} ] ];

	// Allowed blocks - only gallery items
	const ALLOWED_BLOCKS = [ 'godam/video-product-gallery-item' ];

	const renderQueryPreview = () => {
		if ( isLoadingPreview ) {
			return (
				<div className="godam-video-product-gallery__state">
					<p>{ __( 'Loading video products…', 'godam' ) }</p>
				</div>
			);
		}

		if ( queryPreviewItems.length === 0 ) {
			return (
				<div className="godam-video-product-gallery__state">
					<p>{ __( 'No video products found.', 'godam' ) }</p>
				</div>
			);
		}

		return (
			<div className="godam-video-product-gallery__container godam-video-product-gallery__container--editor">
				{ queryPreviewItems.map( ( item, index ) => {
					const product = item.productData || {};

					return (
						<div
							key={ `${ item.id }-${ index }` }
							className={ `godam-video-product-gallery-item godam-video-product-gallery-item--ratio-${ viewRatio.replace( ':', '-' ) }` }
						>
							<div className="godam-gallery-item__video-preview">
								{ item.thumbnail ? (
									<img
										src={ item.thumbnail }
										alt={ item.title || __( 'Video thumbnail', 'godam' ) }
										className="godam-gallery-item__thumbnail"
									/>
								) : (
									<div className="godam-gallery-item__placeholder">
										{ videoIcon }
										<span>{ __( 'Product Video', 'godam' ) }</span>
									</div>
								) }
								<div className="godam-gallery-item__play-icon">
									<svg viewBox="0 0 24 24" fill="currentColor">
										<path d="M8 5v14l11-7z" />
									</svg>
								</div>
							</div>
							<div className="godam-gallery-item__product">
								<a href="#" className="godam-gallery-item__product-link" onClick={ ( event ) => event.preventDefault() }>
									{ product.image ? (
										<img
											src={ product.image }
											alt={ product.name || '' }
											className="godam-gallery-item__product-image"
										/>
									) : null }
									<div className="godam-gallery-item__product-details">
										<p className="godam-gallery-item__product-name">
											{ product.name || __( 'Product title', 'godam' ) }
										</p>
										<p
											className="godam-gallery-item__product-price"
											dangerouslySetInnerHTML={ {
												__html: product.price || __( 'Product price', 'godam' ),
											} }
										/>
									</div>
								</a>
								{ showAddToCart && product.id ? (
									<span
										className="godam-gallery-item__add-to-cart-preview wp-element-button"
										aria-label={ __( 'Add to Cart (preview)', 'godam' ) }
									>
										<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
											<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
										</svg>
									</span>
								) : null }
							</div>
						</div>
					);
				} ) }
			</div>
		);
	};

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Source', 'godam' ) } initialOpen={ true }>
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'Gallery Source', 'godam' ) }
						value={ mode }
						onChange={ ( value ) => value && setAttributes( { mode: value } ) }
					>
						<ToggleGroupControlOption label={ __( 'Handpicked', 'godam' ) } value="handpicked" />
						<ToggleGroupControlOption label={ __( 'Query', 'godam' ) } value="query" />
					</ToggleGroupControl>
				</PanelBody>

				{ mode === 'query' && (
					<PanelBody title={ __( 'Query Settings', 'godam' ) } initialOpen={ true }>
						<RangeControl
							label={ __( 'Number of Videos', 'godam' ) }
							value={ count }
							onChange={ ( value ) => setAttributes( { count: value } ) }
							min={ 1 }
							max={ 100 }
						/>
						<FormTokenField
							label={ __( 'Product Categories', 'godam' ) }
							value={ selectedCategoryTokens }
							suggestions={ allCategories.map( ( category ) => category.label ) }
							onChange={ ( tokens ) => {
								const selectedIds = tokens
									.map( ( token ) => allCategories.find( ( category ) => category.label === token || category.name === token )?.id )
									.filter( Boolean );

								setAttributes( {
									categories: selectedIds,
									products: [],
								} );
							} }
							placeholder={ __( 'Search and select product categories', 'godam' ) }
							__experimentalShowHowTo={ false }
							__next40pxDefaultSize={ true }
						/>

						<FormTokenField
							label={ __( 'Products', 'godam' ) }
							value={ selectedProductTokens }
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

								setAttributes( {
									products: tokens.map( ( token ) => labelToId[ token ] ).filter( Boolean ),
								} );
							} }
							placeholder={ __( 'Search and select products', 'godam' ) }
							__experimentalShowHowTo={ false }
							__next40pxDefaultSize={ true }
						/>

						{ productSearchInput.trim().length > 0 && isSearchingProducts && (
							<p className="components-base-control__help">
								{ __( 'Searching products…', 'godam' ) }
							</p>
						) }

						{ ! isSearchingProducts && productSearchInput.trim().length > 0 && searchedProducts.length === 0 && (
							<Notice status="info" isDismissible={ false }>
								{ __( 'No products found for the current search.', 'godam' ) }
							</Notice>
						) }
					</PanelBody>
				) }

				<PanelBody title={ __( 'Layout', 'godam' ) } initialOpen={ true }>
					{ /* Layout Selector with Icons */ }
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'Layout', 'godam' ) }
						value={ layout }
						onChange={ ( value ) => setAttributes( { layout: value } ) }
					>
						<ToggleGroupControlOptionIcon
							icon={ columns }
							label={ __( 'Carousel', 'godam' ) }
							value="carousel"
						/>
						<ToggleGroupControlOptionIcon
							icon={ grid }
							label={ __( 'Grid', 'godam' ) }
							value="grid"
						/>
					</ToggleGroupControl>

					{ /* View Ratio Selector */ }
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'View Ratio', 'godam' ) }
						value={ viewRatio }
						onChange={ ( value ) => setAttributes( { viewRatio: value } ) }
					>
						<ToggleGroupControlOption label="4:3" value="4:3" />
						<ToggleGroupControlOption label="9:16" value="9:16" />
						<ToggleGroupControlOption label="3:4" value="3:4" />
						<ToggleGroupControlOption label="1:1" value="1:1" />
						<ToggleGroupControlOption label="16:9" value="16:9" />
					</ToggleGroupControl>

					{ /* Item Width Selector */ }
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'Item Size', 'godam' ) }
						value={ itemWidth }
						onChange={ ( value ) => setAttributes( { itemWidth: value } ) }
						help={ __( 'Size of each gallery item.', 'godam' ) }
					>
						<ToggleGroupControlOption label={ __( 'S', 'godam' ) } value="S" />
						<ToggleGroupControlOption label={ __( 'M', 'godam' ) } value="M" />
						<ToggleGroupControlOption label={ __( 'L', 'godam' ) } value="L" />
					</ToggleGroupControl>
				</PanelBody>

				<PanelBody title={ __( 'Playback & Interaction', 'godam' ) } initialOpen={ true }>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Autoplay', 'godam' ) }
						help={
							autoplay
								? __( 'Visible videos autoplay one at a time and continue through the full video.', 'godam' )
								: __( 'Videos only play when hovered.', 'godam' )
						}
						checked={ !! autoplay }
						onChange={ ( value ) => setAttributes( { autoplay: value } ) }
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show Play Button', 'godam' ) }
						help={ __( 'Shows an overlay play button whenever a video is not playing. On mobile, this still appears when autoplay is off.', 'godam' ) }
						checked={ !! showPlayButton }
						onChange={ ( value ) => setAttributes( { showPlayButton: value } ) }
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show Add to Cart Button', 'godam' ) }
						help={
							showAddToCart
								? __( 'Displays an Add to Cart button on each product.', 'godam' )
								: __( 'Add to Cart button is hidden. Clicking the product title opens the product page.', 'godam' )
						}
						checked={ !! showAddToCart }
						onChange={ ( value ) => setAttributes( { showAddToCart: value } ) }
					/>
				</PanelBody>
			</InspectorControls>

			<div { ...blockProps }>
				{ mode === 'handpicked' ? (
					<InnerBlocks
						allowedBlocks={ ALLOWED_BLOCKS }
						template={ hasInnerBlocks ? undefined : TEMPLATE }
						orientation={ layout === 'carousel' ? 'horizontal' : 'vertical' }
						renderAppender={ InnerBlocks.ButtonBlockAppender }
					/>
				) : (
					renderQueryPreview()
				) }
			</div>
		</>
	);
}
