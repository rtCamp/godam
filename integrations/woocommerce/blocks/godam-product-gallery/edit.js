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
import { useMemo, useRef, useEffect } from '@wordpress/element';
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
 * @param {string}   props.clientId      Unique block client ID.
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
				return '66.5';
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
					<TextControl
						label={ __( 'Products', 'rtgodam' ) }
						help={ __( 'Enter comma-separated product IDs or "random" as an argument which displays videos from random products.', 'rtgodam' ) }
						value={ product }
						onChange={ ( value ) => setAttributes( { product: value } ) }
					/>
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
								max={ 64 }
							/>

							<RangeControl
								label={ __( 'Column Gap', 'godam' ) }
								value={ gridColumnGap }
								onChange={ ( value ) => setAttributes( { gridColumnGap: value } ) }
								min={ 0 }
								max={ 64 }
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
								min={ 10 }
								max={ 30 }
							/>

							<p><strong>{ __( 'Name Color', 'godam' ) }</strong></p>
							<ColorPalette
								value={ ctaProductNameColor }
								onChange={ ( color ) => setAttributes( { ctaProductNameColor: color } ) }
							/>

							<RangeControl
								label={ __( 'Price Font Size', 'godam' ) }
								value={ ctaProductPriceFontSize }
								onChange={ ( value ) => setAttributes( { ctaProductPriceFontSize: value } ) }
								min={ 10 }
								max={ 30 }
							/>

							<p><strong>{ __( 'Price Color', 'godam' ) }</strong></p>
							<ColorPalette
								value={ ctaProductPriceColor }
								onChange={ ( color ) => setAttributes( { ctaProductPriceColor: color } ) }
							/>
						</PanelBody>

						<PanelBody
							title={ __( 'Add to Cart Button', 'godam' ) }
							initialOpen={ false }
						>
							<p><strong>{ __( 'Background', 'godam' ) }</strong></p>
							<ColorPalette
								enableAlpha
								value={ ctaButtonBgColor }
								onChange={ ( color ) => setAttributes( { ctaButtonBgColor: color } ) }
							/>

							<p><strong>{ __( 'Icon Color', 'godam' ) }</strong></p>
							<ColorPalette
								value={ ctaButtonIconColor }
								onChange={ ( color ) => setAttributes( { ctaButtonIconColor: color } ) }
							/>

							<RangeControl
								label={ __( 'Border Radius', 'godam' ) }
								value={ ctaButtonBorderRadius }
								onChange={ ( value ) => setAttributes( { ctaButtonBorderRadius: value } ) }
								min={ 0 }
								max={ 50 }
							/>

							<SelectControl
								label={ __( 'Post Add-to-Cart Behavior', 'godam' ) }
								value={ ctaCartAction }
								options={ [
									{ label: __( 'Open Mini Cart Drawer', 'godam' ), value: 'mini-cart' },
									{ label: __( 'Go to Cart Page', 'godam' ), value: 'redirect' },
								] }
								onChange={ ( value ) => setAttributes( { ctaCartAction: value } ) }
							/>
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
