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
	TextControl,
	ColorPalette,
	RangeControl,
} from '@wordpress/components';
import { useMemo, useRef, useEffect, useCallback, Platform } from '@wordpress/element';
import { useSelect } from '@wordpress/data';

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
 * @param            props.clientId
 * @return {JSX.Element} Element to render.
 */
export default function Edit( { attributes, setAttributes, clientId } ) {
	const {
		autoplay,
		product,
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
		ctaButtonBgColor,
		ctaButtonIconColor,
		ctaButtonBorderRadius,
		ctaProductNameFontSize,
		ctaProductPriceFontSize,
		ctaProductNameColor,
		ctaProductPriceColor,
		ctaCartAction,
	} = attributes;

	const blockProps = useBlockProps();

	// Set the Block id of the Block as ClientId.
	useEffect( () => {
		if ( ! attributes.blockId ) {
			setAttributes( { blockId: clientId } );
		}
	}, [ clientId ] );

	const deviceType = useSelect( ( select ) => {
		return select( 'core/editor' ).getDeviceType();
	}, [] );

	// Refrence to preview view value.
	const previousViewRef = useRef( view );

	// Help text warning for autoplay usage and callback for Autoplay settings.
	const autoPlayHelpText = __( 'Autoplay may cause usability issues for some users.', 'godam' );
	const getAutoplayHelp = Platform.select( {
		web: useCallback( ( checked ) => {
			return checked ? autoPlayHelpText : null;
		}, [] ),
		native: autoPlayHelpText,
	} );

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
				return '41.5';
			} else if ( device === 'mobile' ) {
				return '66.5';
			}

			switch ( viewRatio ) {
				case '16-9':
					return '42';
				case '4-3':
					return '21.5';
				case '9-16':
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
								borderRadius: `${ playButtonBorderRadius }%`,
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
									fontSize: `${ ctaProductNameFontSize }px`,
									color: ctaProductNameColor,
								} }
							>
								{ __( 'Sample Product Name', 'godam' ) }
							</div>
							<p
								className="product-price"
								style={ {
									fontSize: `${ ctaProductPriceFontSize }px`,
									color: ctaProductPriceColor,
								} }
							>
								{ __( '$99.99', 'your-text-domain' ) }
							</p>
						</div>
						<button
							className="cta-add-to-cart"
							style={ {
								backgroundColor: ctaButtonBgColor,
								color: ctaButtonIconColor,
								borderRadius: `${ ctaButtonBorderRadius }%`,
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

				<PanelBody title={ __( 'Gallery Settings', 'rtgodam' ) }>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Autoplay videos', 'godam' ) }
						onChange={ toggleFactory.autoplay }
						checked={ !! autoplay }
						help={ getAutoplayHelp }
					/>
					<ToggleControl
						label={ __( 'Enable CTA', 'godam' ) }
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
					<TextControl
						label={ __( 'Products', 'rtgodam' ) }
						help={ __( 'Enter comma-separated product IDs or "random" as an argument which displays videos from random products.', 'rtgodam' ) }
						value={ product }
						onChange={ ( value ) => setAttributes( { product: value } ) }
					/>
				</PanelBody>

				{ layout === 'carousel' && (
					<PanelBody title={ __( 'Carousel Settings', 'godam' ) } initialOpen={ false }>

						<RangeControl
							label={ __( 'Desktop Card Size (vw)', 'godam' ) }
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
							label={ __( 'Tablet Card Size (vw)', 'godam' ) }
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
							label={ __( 'Mobile Card Size (vw)', 'godam' ) }
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

						<p><strong>{ __( 'Arrow Background Color', 'godam' ) }</strong></p>
						<ColorPalette
							enableAlpha
							value={ arrowBgColor }
							onChange={ ( color ) => setAttributes( { arrowBgColor: color } ) }
						/>

						<p><strong>{ __( 'Arrow Icon Color', 'godam' ) }</strong></p>
						<ColorPalette
							value={ arrowIconColor }
							onChange={ ( color ) => setAttributes( { arrowIconColor: color } ) }
						/>

						<RangeControl
							label={ __( 'Arrow Size (px)', 'godam' ) }
							value={ arrowSize }
							onChange={ ( value ) => setAttributes( { arrowSize: value } ) }
							min={ 16 }
							max={ 64 }
						/>

						<RangeControl
							label={ __( 'Border Radius (px)', 'godam' ) }
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
				) }

				{ layout === 'grid' && (
					<PanelBody title={ __( 'Grid Settings', 'godam' ) } initialOpen={ false }>
						<RangeControl
							label={ __( 'Columns in Desktop', 'godam' ) }
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
							label={ __( 'Columns in Tablet', 'godam' ) }
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
							label={ __( 'Columns in Mobile', 'godam' ) }
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

						<RangeControl
							label={ __( 'Row Gap (px)', 'godam' ) }
							value={ gridRowGap }
							onChange={ ( value ) => setAttributes( { gridRowGap: value } ) }
							min={ 0 }
							max={ 64 }
						/>

						<RangeControl
							label={ __( 'Column Gap (px)', 'godam' ) }
							value={ gridColumnGap }
							onChange={ ( value ) => setAttributes( { gridColumnGap: value } ) }
							min={ 0 }
							max={ 64 }
						/>
					</PanelBody>
				) }

				<PanelBody title={ __( 'Play Button Settings', 'godam' ) } initialOpen={ false }>
					<ToggleControl
						label={ __( 'Enable Play Button', 'godam' ) }
						checked={ !! playButtonEnabled }
						onChange={ ( value ) => setAttributes( { playButtonEnabled: value } ) }
						disabled={ ! autoplay }
						help={
							! autoplay
								? __( 'Play button is required when autoplay is off.', 'godam' )
								: null
						}
					/>
					{ playButtonEnabled && (
						<>
							<p><strong>{ __( 'Icon Background Color', 'godam' ) }</strong></p>
							<ColorPalette
								enableAlpha
								value={ playButtonBgColor }
								onChange={ ( color ) => setAttributes( { playButtonBgColor: color } ) }
							/>

							<p><strong>{ __( 'Icon Color', 'godam' ) }</strong></p>
							<ColorPalette
								value={ playButtonIconColor }
								onChange={ ( color ) => setAttributes( { playButtonIconColor: color } ) }
							/>

							<RangeControl
								label={ __( 'Button Size (px)', 'godam' ) }
								value={ playButtonSize }
								onChange={ ( value ) => setAttributes( { playButtonSize: value } ) }
								min={ 20 }
								max={ 100 }
							/>

							<RangeControl
								label={ __( 'Border Radius (%)', 'godam' ) }
								value={ playButtonBorderRadius }
								onChange={ ( value ) => setAttributes( { playButtonBorderRadius: value } ) }
								min={ 0 }
								max={ 50 }
							/>
						</>
					) }
				</PanelBody>

				{ ! playButtonEnabled && (
					<PanelBody title={ __( 'Unmute Button Settings', 'godam' ) } initialOpen={ false }>
						<p><strong>{ __( 'Icon Background Color', 'godam' ) }</strong></p>
						<ColorPalette
							enableAlpha
							value={ unmuteButtonBgColor }
							onChange={ ( color ) => setAttributes( { unmuteButtonBgColor: color } ) }
						/>

						<p><strong>{ __( 'Icon Color', 'godam' ) }</strong></p>
						<ColorPalette
							value={ unmuteButtonIconColor }
							onChange={ ( color ) => setAttributes( { unmuteButtonIconColor: color } ) }
						/>
					</PanelBody>
				) }

				{ ctaEnabled && (
					<PanelBody title={ __( 'CTA Settings', 'godam' ) } initialOpen={ false }>
						<SelectControl
							label={ __( 'CTA Display Position', 'godam' ) }
							value={ ctaDisplayPosition }
							options={ [
								{ label: __( 'Below & Inside the Video', 'godam' ), value: 'below-inside' },
								{ label: __( 'Only Below the Video', 'godam' ), value: 'below' },
								{ label: __( 'Only Inside the Video', 'godam' ), value: 'inside' },
							] }
							onChange={ ( value ) => setAttributes( { ctaDisplayPosition: value } ) }
						/>

						<p><strong>{ __( 'CTA Background Color', 'godam' ) }</strong></p>
						<ColorPalette
							value={ ctaBgColor }
							onChange={ ( color ) => setAttributes( { ctaBgColor: color } ) }
						/>

						<RangeControl
							label={ __( 'Product Name Font Size (px)', 'godam' ) }
							value={ ctaProductNameFontSize }
							onChange={ ( value ) => setAttributes( { ctaProductNameFontSize: value } ) }
							min={ 10 }
							max={ 30 }
						/>

						<p><strong>{ __( 'Product Name Color', 'godam' ) }</strong></p>
						<ColorPalette
							value={ ctaProductNameColor }
							onChange={ ( color ) => setAttributes( { ctaProductNameColor: color } ) }
						/>

						<RangeControl
							label={ __( 'Product Price Font Size (px)', 'godam' ) }
							value={ ctaProductPriceFontSize }
							onChange={ ( value ) => setAttributes( { ctaProductPriceFontSize: value } ) }
							min={ 10 }
							max={ 30 }
						/>

						<p><strong>{ __( 'Product Price Color', 'godam' ) }</strong></p>
						<ColorPalette
							value={ ctaProductPriceColor }
							onChange={ ( color ) => setAttributes( { ctaProductPriceColor: color } ) }
						/>

						<p><strong>{ __( 'CTA Cart Button Background', 'godam' ) }</strong></p>
						<ColorPalette
							enableAlpha
							value={ ctaButtonBgColor }
							onChange={ ( color ) => setAttributes( { ctaButtonBgColor: color } ) }
						/>

						<p><strong>{ __( 'CTA Cart Button Icon Color', 'godam' ) }</strong></p>
						<ColorPalette
							value={ ctaButtonIconColor }
							onChange={ ( color ) => setAttributes( { ctaButtonIconColor: color } ) }
						/>

						<RangeControl
							label={ __( 'CTA Cart Button Border Radius (%)', 'godam' ) }
							value={ ctaButtonBorderRadius }
							onChange={ ( value ) => setAttributes( { ctaButtonBorderRadius: value } ) }
							min={ 0 }
							max={ 50 }
						/>

						<SelectControl
							label={ __( 'After Add to Cart Action', 'godam' ) }
							value={ ctaCartAction }
							options={ [
								{ label: __( 'Open Mini Cart', 'godam' ), value: 'mini-cart' },
								{ label: __( 'Redirect to Cart Page', 'godam' ), value: 'redirect' },
							] }
							onChange={ ( value ) => setAttributes( { ctaCartAction: value } ) }
						/>
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
									rowGap: `${ gridRowGap }px`,
									columnGap: `${ gridColumnGap }px`,
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
