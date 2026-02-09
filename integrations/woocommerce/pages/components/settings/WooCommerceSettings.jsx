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
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const WooCommerceSettings = ( { settings = {}, onSettingChange } ) => {
	const updateSetting = ( key, value ) => {
		onSettingChange( key, value );
	};

	return (
		<>
			<PanelBody><strong>{ __( 'Video Popoup settings', 'godam' ) }</strong>
				<PanelBody
					title={ __( 'Popup Close Button', 'godam' ) }
					initialOpen={ false }
				>
					<div className="godam-control-group" style={ {
						display: 'flex',
						gap: '16px',
					} }>
						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<p><strong>{ __( 'Background Color', 'godam' ) }</strong></p>
							<ColorPalette
								enabledAlpha
								value={ settings.videoCloseBg }
								onChange={ ( value ) => updateSetting( 'videoCloseBg', value ) }
							/>
						</div>

						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<p><strong>{ __( 'Icon Color', 'godam' ) }</strong></p>
							<ColorPalette
								enableAlpha
								value={ settings.videoCloseIcon }
								onChange={ ( value ) => updateSetting( 'videoCloseIcon', value ) }
							/>
						</div>
					</div>

					<div className="godam-control-group" style={ {
						display: 'flex',
						gap: '16px',
					} }>
						<BorderControl
							label={ __( 'Border', 'godam' ) }
							value={ settings.videoCloseBorder }
							onChange={ ( value ) => updateSetting( 'videoCloseBorder', value ) }
						/>

						<div style={ { width: '260px' } }>
							<RangeControl
								label={ __( 'Border Radius', 'godam' ) }
								value={ settings.videoCloseRadius }
								onChange={ ( value ) => updateSetting( 'videoCloseRadius', value ) }
								min={ 0 }
								max={ 50 }
							/>
						</div>
					</div>

				</PanelBody>

				<PanelBody
					title={ __( 'Popup MiniCart Button', 'godam' ) }
					initialOpen={ false }
				>
					<div className="godam-control-group" style={ {
						display: 'flex',
						gap: '16px',
					} }>
						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<p><strong>{ __( 'Background Color', 'godam' ) }</strong></p>
							<ColorPalette
								enabledAlpha
								value={ settings.miniCartBg }
								onChange={ ( value ) => updateSetting( 'miniCartBg', value ) }
							/>
						</div>

						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<p><strong>{ __( 'Icon Color', 'godam' ) }</strong></p>
							<ColorPalette
								enableAlpha
								value={ settings.miniCartIcon }
								onChange={ ( value ) => updateSetting( 'miniCartIcon', value ) }
							/>
						</div>
					</div>

					<div className="godam-control-group" style={ {
						display: 'flex',
						gap: '16px',
					} }>
						<BorderControl
							label={ __( 'Border', 'godam' ) }
							value={ settings.miniCartBorder }
							onChange={ ( value ) => updateSetting( 'miniCartBorder', value ) }
						/>

						<div style={ { width: '260px' } }>
							<RangeControl
								label={ __( 'Border Radius', 'godam' ) }
								value={ settings.miniCartRadius }
								onChange={ ( value ) => updateSetting( 'miniCartRadius', value ) }
								min={ 0 }
								max={ 50 }
							/>
						</div>
					</div>

				</PanelBody>

				<PanelBody
					title={ __( 'Popup Add to Cart Button', 'godam' ) }
					initialOpen={ false }
				>
					<div className="godam-control-group" style={ {
						display: 'flex',
						gap: '16px',
					} }>
						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<p><strong>{ __( 'Background Color', 'godam' ) }</strong></p>
							<ColorPalette
								enabledAlpha
								value={ settings.addToCartBg }
								onChange={ ( value ) => updateSetting( 'addToCartBg', value ) }
							/>
						</div>

						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<p><strong>{ __( 'Font/Icon Color', 'godam' ) }</strong></p>
							<ColorPalette
								enableAlpha
								value={ settings.addToCartIcon }
								onChange={ ( value ) => updateSetting( 'addToCartIcon', value ) }
							/>
						</div>

						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<FontSizePicker
								value={ settings.addToCartFontSize }
								onChange={ ( value ) => updateSetting( 'addToCartFontSize', value ) }
							/>
						</div>
					</div>

					<div className="godam-control-group" style={ {
						display: 'flex',
						gap: '16px',
					} }>
						<BorderControl
							label={ __( 'Border', 'godam' ) }
							value={ settings.addToCartBorder }
							onChange={ ( value ) => updateSetting( 'addToCartBorder', value ) }
						/>

						<div style={ { width: '260px' } }>
							<RangeControl
								label={ __( 'Border Radius', 'godam' ) }
								value={ settings.addToCartRadius }
								onChange={ ( value ) => updateSetting( 'addToCartRadius', value ) }
								min={ 0 }
								max={ 50 }
							/>
						</div>
					</div>
				</PanelBody>

				<PanelBody
					title={ __( 'Popup Toggle Button', 'godam' ) }
					initialOpen={ false }
				>
					<div className="godam-control-group" style={ {
						display: 'flex',
						gap: '16px',
					} }>
						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<p><strong>{ __( 'Background Color', 'godam' ) }</strong></p>
							<ColorPalette
								enabledAlpha
								value={ settings.toggleBg }
								onChange={ ( value ) => updateSetting( 'toggleBg', value ) }
							/>
						</div>

						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<p><strong>{ __( 'Font/Icon Color', 'godam' ) }</strong></p>
							<ColorPalette
								enableAlpha
								value={ settings.toggleIcon }
								onChange={ ( value ) => updateSetting( 'toggleIcon', value ) }
							/>
						</div>

						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<FontSizePicker
								value={ settings.toggleFontSize }
								onChange={ ( value ) => updateSetting( 'toggleFontSize', value ) }
							/>
						</div>
					</div>

					<div className="godam-control-group" style={ {
						display: 'flex',
						gap: '16px',
					} }>
						<BorderControl
							label={ __( 'Border', 'godam' ) }
							value={ settings.toggleBorder }
							onChange={ ( value ) => updateSetting( 'toggleBorder', value ) }
						/>

						<div style={ { width: '260px' } }>
							<RangeControl
								label={ __( 'Border Radius', 'godam' ) }
								value={ settings.toggleRadius }
								onChange={ ( value ) => updateSetting( 'toggleRadius', value ) }
								min={ 0 }
								max={ 50 }
							/>
						</div>
					</div>
				</PanelBody>

				<PanelBody
					title={ __( 'Additional Popup Components', 'godam' ) }
					initialOpen={ false }
				>
					<div className="godam-control-group" style={ {
						display: 'flex',
						gap: '16px',
					} }>
						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<p><strong>{ __( 'Popup Background Color', 'godam' ) }</strong></p>
							<ColorPalette
								enabledAlpha
								value={ settings.popupBackgroundColor }
								onChange={ ( value ) => updateSetting( 'popupBackgroundColor', value ) }
							/>
						</div>

						<div style={ { display: 'flex', flexDirection: 'column' } }>
							<p><strong>{ __( 'Additional Products Font Color', 'godam' ) }</strong></p>
							<ColorPalette
								enabledAlpha
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
