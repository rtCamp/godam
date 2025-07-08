/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import {
	PanelBody,
	SelectControl,
	ToggleControl,
	TextControl,
	ColorPalette,
	RangeControl,
} from '@wordpress/components';
import { useMemo, useRef, useEffect, useCallback, Platform } from '@wordpress/element';

/**
 * Internal dependencies
 */
import './editor.scss';

export default function Edit( { attributes, setAttributes } ) {
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
		unmuteButtonEnabled,
		unmuteButtonBgColor,
		unmuteButtonIconColor,
		arrowBgColor,
		arrowIconColor,
		arrowSize,
		arrowBorderRadius,
		arrowVisibility,
		ctaEnabled,
		ctaDisplayPosition,
		ctaButtonBgColor,
		ctaButtonIconColor,
		ctaButtonBorderRadius,
		ctaProductNameFontSize,
		ctaProductPriceFontSize,
		ctaProductNameColor,
		ctaProductPriceColor,
	} = attributes;

	const blockProps = useBlockProps();

	const autoPlayHelpText = __( 'Autoplay may cause usability issues for some users.', 'godam' );
	const getAutoplayHelp = Platform.select( {
		web: useCallback( ( checked ) => {
			return checked ? autoPlayHelpText : null;
		}, [] ),
		native: autoPlayHelpText,
	} );

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

	useEffect( () => {
		if ( ! autoplay && ! playButtonEnabled ) {
			setAttributes( { playButtonEnabled: true } );
		}
	}, [ autoplay ] );

	const scrollRef = useRef();

	const scrollLeft = () => {
		if ( scrollRef.current ) {
			scrollRef.current.scrollBy( { left: -300, behavior: 'smooth' } );
		}
	};

	const scrollRight = () => {
		if ( scrollRef.current ) {
			scrollRef.current.scrollBy( { left: 300, behavior: 'smooth' } );
		}
	};

	const getCTAWidthForView = ( v ) => {
		switch ( v ) {
			case '16-9':
				return '40rem';
			case '4-3':
				return '19.5rem';
			case '9-16':
			case '3-4':
				return '16.5rem';
			case '1-1':
				return '17rem';
			default:
				return '100%';
		}
	};

	const GoDAMVideos = Array.from( { length: 10 }, ( _, i ) => {
		return (
			<div className={ `godam-editor-product-video-item view-${ view }` } key={ i }>
				<div className="godam-editor-product-video-thumbnail">
					<span className="godam-editor-product-video-label">
						{ __( 'Product Video', 'godam' ) }
					</span>
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
				{ ctaEnabled && ctaDisplayPosition === 'below' && (
					<div
						className="godam-product-cta"
						style={ {
							width: getCTAWidthForView( view ),
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
								Sample Product Name That Is Too Long
							</div>
							<p
								className="product-price"
								style={ {
									fontSize: `${ ctaProductPriceFontSize }px`,
									color: ctaProductPriceColor,
								} }
							>
								$99.99
							</p>
						</div>
						<button
							className="cta-add-to-cart"
							style={ {
								backgroundColor: ctaButtonBgColor,
								color: ctaButtonIconColor,
								borderRadius: `${ ctaButtonBorderRadius }%`,
							} }
							aria-label="Add to cart"
						>
							+
						</button>
					</div>
				) }
			</div>

		);
	} );

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
								{ label: __( 'Below Video', 'godam' ), value: 'below' },
								{ label: __( 'Inside Video', 'godam' ), value: 'inside' },
							] }
							onChange={ ( value ) => setAttributes( { ctaDisplayPosition: value } ) }
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

						<p><strong>{ __( 'CTA Cart Background', 'godam' ) }</strong></p>
						<ColorPalette
							enableAlpha
							value={ ctaButtonBgColor }
							onChange={ ( color ) => setAttributes( { ctaButtonBgColor: color } ) }
						/>

						<p><strong>{ __( 'CTA Cart Icon Color', 'godam' ) }</strong></p>
						<ColorPalette
							value={ ctaButtonIconColor }
							onChange={ ( color ) => setAttributes( { ctaButtonIconColor: color } ) }
						/>

						<RangeControl
							label={ __( 'CTA Cart Border Radius (%)', 'godam' ) }
							value={ ctaButtonBorderRadius }
							onChange={ ( value ) => setAttributes( { ctaButtonBorderRadius: value } ) }
							min={ 0 }
							max={ 50 }
						/>
					</PanelBody>
				) }

			</InspectorControls>
			<div { ...blockProps }>
				<div className={ `godam-editor-product-gallery layout-${ layout }` }>
					{ /* { GoDAMVideos } */ }
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
							>
								&#10095;
							</button>
						</div>
					) : (
						<>{ GoDAMVideos }</>
					) }
				</div>
			</div>
		</>
	);
}
