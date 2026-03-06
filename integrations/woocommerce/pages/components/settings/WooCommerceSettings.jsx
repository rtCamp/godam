/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @wordpress/i18n-no-variables */
/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import {
	PanelBody,
	RangeControl,
	ColorPalette,
	BorderControl,
	FontSizePicker,
	Icon,
	TextControl,
	Notice,
	ExternalLink,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { desktop, mobile } from '@wordpress/icons';

const WooCommerceSettings = ( { settings = {}, onSettingChange, hasValidAPIKey, getPricingUrl } ) => {
	const updateSetting = ( key, value ) => {
		onSettingChange( key, value );
	};

	const [ activeButtonTab, setActiveButtonTab ] = useState( 'close' );
	const [ activeModalTab, setActiveModalTab ] = useState( 'desktop' );

	const ButtonSettings = ( {
		title,
		bgKey,
		iconKey,
		borderKey,
		radiusKey,
		fontSizeKey = null,
	} ) => {
		return (
			<>
				<p className="godam-settings-section-title"><strong>{ __( title, 'godam' ) }</strong></p>
				<div className="godam-button-settings-group">

					<div className="godam-control-group" style={ {
						display: 'flex',
						gap: '16px',
						alignItems: 'center',
					} }>
						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<p><strong>{ __( 'Background Color', 'godam' ) }</strong></p>
							<ColorPalette
								enableAlpha
								value={ settings[ bgKey ] }
								onChange={ ( value ) => updateSetting( bgKey, value ) }
							/>
						</div>

						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<p><strong>{ __( 'Icon / Font Color', 'godam' ) }</strong></p>
							<ColorPalette
								enableAlpha
								value={ settings[ iconKey ] }
								onChange={ ( value ) => updateSetting( iconKey, value ) }
							/>
						</div>

						<div style={ { display: 'flex', flexDirection: 'column' } }>
							{ fontSizeKey && (
								<FontSizePicker
									value={ settings[ fontSizeKey ] }
									onChange={ ( value ) =>
										updateSetting( fontSizeKey, value )
									}
								/>
							) }
						</div>
					</div>

					<div className="godam-control-group" style={ {
						display: 'flex',
						gap: '16px',
					} }>

						<BorderControl
							label={ __( 'Border', 'godam' ) }
							value={ settings[ borderKey ] }
							onChange={ ( value ) =>
								updateSetting( borderKey, value )
							}
						/>

						<div style={ { width: '260px' } }>
							<RangeControl
								label={ __( 'Border Radius', 'godam' ) }
								value={ settings[ radiusKey ] }
								onChange={ ( value ) =>
									updateSetting( radiusKey, value )
								}
								min={ 0 }
								max={ 50 }
							/>
						</div>
					</div>
				</div>
			</>
		);
	};

	const ModalSettings = ( {
		title,
		bgKey,
		textKey,
		priceKeys,
	} ) => {
		const [ activePriceTab, setActivePriceTab ] = useState( 'primary' );

		return (
			<>
				<p className="godam-settings-section-title">
					<strong>{ __( title, 'godam' ) }</strong>
				</p>

				<div className="godam-button-settings-group">

					<div className="godam-control-group" style={ {
						display: 'flex',
						gap: '24px',
					} }>

						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<p><strong>{ __( 'Background Color', 'godam' ) }</strong></p>
							<ColorPalette
								enableAlpha
								value={ settings[ bgKey ] }
								onChange={ ( value ) =>
									updateSetting( bgKey, value )
								}
							/>
						</div>

						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<p><strong>{ __( 'Text Color', 'godam' ) }</strong></p>
							<ColorPalette
								enableAlpha
								value={ settings[ textKey ] }
								onChange={ ( value ) =>
									updateSetting( textKey, value )
								}
							/>
						</div>

						{ /* Price Settings */ }
						<div>
							<p>
								<strong>{ __( 'Price Colors', 'godam' ) }</strong>
							</p>

							{ /* Tabs */ }
							<div className="godam-settings-tabs">
								{ [
									{ key: 'primary', label: 'Primary' },
									{ key: 'secondary', label: 'Secondary' },
									{ key: 'tertiary', label: 'Tertiary' },
								].map( ( tab ) => (
									<button
										key={ tab.key }
										type="button"
										className={ `godam-settings-tab ${
											activePriceTab === tab.key ? 'is-active' : ''
										}` }
										onClick={ () => setActivePriceTab( tab.key ) }
									>
										{ __( tab.label, 'godam' ) }
									</button>
								) ) }
							</div>

							{ /* Tab Content */ }
							<div className="godam-tab-content">
								{ activePriceTab === 'primary' && (
									<ColorPalette
										enableAlpha
										value={ settings[ priceKeys.primary ] }
										onChange={ ( value ) =>
											updateSetting( priceKeys.primary, value )
										}
									/>
								) }

								{ activePriceTab === 'secondary' && (
									<ColorPalette
										enableAlpha
										value={ settings[ priceKeys.secondary ] }
										onChange={ ( value ) =>
											updateSetting( priceKeys.secondary, value )
										}
									/>
								) }

								{ activePriceTab === 'tertiary' && (
									<ColorPalette
										enableAlpha
										value={ settings[ priceKeys.tertiary ] }
										onChange={ ( value ) =>
											updateSetting( priceKeys.tertiary, value )
										}
									/>
								) }
							</div>
						</div>

					</div>
				</div>
			</>
		);
	};

	return (
		<>
			{ ! hasValidAPIKey && (
				<Notice
					status="warning"
					isDismissible={ false }
				>
					{ __( 'WooCommerce settings is a Pro feature.', 'godam' ) }{ ' ' }
					<ExternalLink href={ getPricingUrl( 'woocommerce-settings' ) }>
						{ __( 'Upgrade your plan to unlock it.', 'godam' ) }
					</ExternalLink>
				</Notice>
			) }

			<div className={ ! hasValidAPIKey ? 'opacity-50 pointer-events-none' : '' }>
				<PanelBody
					title={ __( 'Product gallery & carousel play button settings', 'godam' ) }
					initialOpen={ false }
				>
					<div className="godam-button-settings-group">
						<div className="godam-control-group" style={ {
							display: 'flex',
							gap: '16px',
							flexWrap: 'wrap',
						} }>
							<div style={ { minWidth: '250px' } }>
								<TextControl
									label={ __( 'Width for Gallery video', 'godam' ) }
									value={ settings.galleryVideoPlayBtnWidth || '2.375rem' }
									onChange={ ( value ) => updateSetting( 'galleryVideoPlayBtnWidth', value ) }
									help={ __( 'Example: 2.375rem or 38px', 'godam' ) }
								/>
							</div>

							<div style={ { minWidth: '250px' } }>
								<TextControl
									label={ __( 'Width for Carousel video', 'godam' ) }
									value={ settings.carouselVideoPlayBtnWidth || '3.375rem' }
									onChange={ ( value ) => updateSetting( 'carouselVideoPlayBtnWidth', value ) }
									help={ __( 'Example: 3.375rem or 54px', 'godam' ) }
								/>
							</div>
						</div>

						<div className="godam-control-group" style={ {
							display: 'flex',
							gap: '24px',
							marginTop: '12px',
							flexWrap: 'wrap',
						} }>
							<div style={ { display: 'flex', flexDirection: 'column' } }>
								<p><strong>{ __( 'Background color', 'godam' ) }</strong></p>
								<ColorPalette
									enableAlpha
									value={ settings.playButtonBackgroundColor || '#000000C2' }
									onChange={ ( value ) => updateSetting( 'playButtonBackgroundColor', value ) }
								/>
							</div>

							<div style={ { display: 'flex', flexDirection: 'column' } }>
								<p><strong>{ __( 'Play btn color', 'godam' ) }</strong></p>
								<ColorPalette
									enableAlpha
									value={ settings.playButtonColor || '#ffffff' }
									onChange={ ( value ) => updateSetting( 'playButtonColor', value ) }
								/>
							</div>

							<div style={ { width: '260px' } }>
								<RangeControl
									label={ __( 'Border radius', 'godam' ) }
									value={ parseInt( settings.playButtonBorderRadius || '50%', 10 ) }
									onChange={ ( value ) => updateSetting( 'playButtonBorderRadius', `${ value }%` ) }
									min={ 0 }
									max={ 100 }
									help={ __( 'Default: 50%', 'godam' ) }
								/>
							</div>
						</div>
					</div>
				</PanelBody>

				<PanelBody><strong>{ __( 'Video Popoup settings', 'godam' ) }</strong>

					<PanelBody
						title={ __( 'Buttons', 'godam' ) }
						initialOpen={ false }
					>
						{ /* Tabs */ }
						<div className="godam-settings-tabs">
							{ [
								{ key: 'close', label: 'Close Button' },
								{ key: 'minicart', label: 'MiniCart Button' },
								{ key: 'cart', label: 'Cart Button' },
								{ key: 'toggle', label: 'Toggle Button' },
							].map( ( tab ) => (
								<button
									key={ tab.key }
									type="button"
									className={ `godam-settings-tab ${
										activeButtonTab === tab.key ? 'is-active' : ''
									}` }
									onClick={ () => setActiveButtonTab( tab.key ) }
								>
									{ __( tab.label, 'godam' ) }
								</button>
							) ) }
						</div>

						<div className="godam-tab-content">
							<div
								key={ activeButtonTab }
								className="godam-tab-panel"
							>
								{ activeButtonTab === 'close' && (
									<ButtonSettings
										title="Popup Close Button"
										bgKey="videoCloseBg"
										iconKey="videoCloseIcon"
										borderKey="videoCloseBorder"
										radiusKey="videoCloseRadius"
									/>
								) }

								{ activeButtonTab === 'minicart' && (
									<ButtonSettings
										title="Popup MiniCart Button"
										bgKey="miniCartBg"
										iconKey="miniCartIcon"
										borderKey="miniCartBorder"
										radiusKey="miniCartRadius"
									/>
								) }

								{ activeButtonTab === 'cart' && (
									<ButtonSettings
										title="Popup Add to Cart Button"
										bgKey="addToCartBgColor"
										iconKey="addToCartFontColor"
										borderKey="addToCartBorder"
										radiusKey="addToCartRadius"
										fontSizeKey="addToCartFontSize"
									/>
								) }

								{ activeButtonTab === 'toggle' && (
									<ButtonSettings
										title="Popup Toggle Button"
										bgKey="toggleBgColor"
										iconKey="toggleFontColor"
										borderKey="toggleBorder"
										radiusKey="toggleRadius"
										fontSizeKey="toggleFontSize"
									/>
								) }
							</div>
						</div>

					</PanelBody>

					<PanelBody
						title={ __( 'Popup Modal', 'godam' ) }
						initialOpen={ false }
					>

						{ /* Icon Tabs */ }
						<div className="godam-settings-tabs godam-device-tabs">
							{ [
								{ key: 'desktop', icon: desktop },
								{ key: 'mobile', icon: mobile },
							].map( ( tab ) => (
								<button
									key={ tab.key }
									type="button"
									className={ `godam-settings-tab ${
										activeModalTab === tab.key ? 'is-active' : ''
									}` }
									onClick={ () => setActiveModalTab( tab.key ) }
								>
									<Icon icon={ tab.icon } size={ 16 } />
									<span>{ __( tab.label, 'godam' ) }</span>
								</button>
							) ) }
						</div>

						<div className="godam-tab-content">
							<div key={ activeModalTab } className="godam-tab-panel">

								{ activeModalTab === 'desktop' && (
									<ModalSettings
										title="Desktop Sidebar Settings"
										bgKey="desktopModalBgColor"
										textKey="desktopModalTextColor"
										priceKeys={ {
											primary: 'desktopPricePrimaryColor',
											secondary: 'desktopPriceSecondaryColor',
											tertiary: 'desktopPriceTertiaryColor',
										} }
									/>
								) }

								{ activeModalTab === 'mobile' && (
									<ModalSettings
										title="Mobile Floating Tile Settings"
										bgKey="mobileModalBgColor"
										textKey="mobileModalTextColor"
										priceKeys={ {
											primary: 'mobilePricePrimaryColor',
											secondary: 'mobilePriceSecondaryColor',
											tertiary: 'mobilePriceTertiaryColor',
										} }
									/>
								) }

							</div>
						</div>

					</PanelBody>

					<PanelBody
						title={ __( 'Other Visual Enhancements', 'godam' ) }
						initialOpen={ false }
					>
						<div className="godam-button-settings-group">
							<div className="godam-control-group" style={ {
								display: 'flex',
								gap: '16px',
							} }>
								<div style={ { display: 'flex', flexDirection: 'column' } }>
									<p><strong>{ __( 'Modal Tertiary Font Color', 'godam' ) }</strong></p>
									<ColorPalette
										enableAlpha
										value={ settings.additionalComponentsColor }
										onChange={ ( value ) => updateSetting( 'additionalComponentsColor', value ) }
									/>
								</div>
							</div>
						</div>
					</PanelBody>
				</PanelBody>
			</div>
		</>
	);
};

export default WooCommerceSettings;
