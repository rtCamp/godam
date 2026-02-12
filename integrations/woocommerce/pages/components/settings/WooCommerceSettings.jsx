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
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { desktop, mobile } from '@wordpress/icons';

const WooCommerceSettings = ( { settings = {}, onSettingChange } ) => {
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
	} ) => {
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

					</div>
				</div>
			</>
		);
	};

	return (
		<>
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
								/>
							) }

							{ activeModalTab === 'mobile' && (
								<ModalSettings
									title="Mobile Floating Tile Settings"
									bgKey="mobileModalBgColor"
									textKey="mobileModalTextColor"
								/>
							) }

						</div>
					</div>

				</PanelBody>

				<PanelBody
					title={ __( 'Additional Components', 'godam' ) }
					initialOpen={ false }
				>
					<div className="godam-control-group" style={ {
						display: 'flex',
						gap: '16px',
					} }>
						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<p><strong>{ __( 'Additional Products Font Color', 'godam' ) }</strong></p>
							<ColorPalette
								enableAlpha
								value={ settings.additionalComponentsColor }
								onChange={ ( value ) => updateSetting( 'additionalComponentsColor', value ) }
							/>
						</div>
					</div>
				</PanelBody>
			</PanelBody>
		</>
	);
};

export default WooCommerceSettings;
