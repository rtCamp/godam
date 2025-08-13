/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import {
	ToggleControl,
	Panel,
	PanelBody,
	TextControl,
	TextareaControl,
	SelectControl,
	RangeControl,
	ColorPicker,
	FontSizePicker,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateMediaSetting } from '../../../../redux/slice/media-settings.js';

const CTALayer = () => {
	const dispatch = useDispatch();

	// Get media settings from Redux store
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );

	// Function to handle setting change
	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'global_layers', subcategory: 'cta', key, value } ) );
	};

	const placementOptions = [
		{ label: __( 'Start of video', 'godam' ), value: 'start' },
		{ label: __( 'Middle of video', 'godam' ), value: 'middle' },
		{ label: __( 'End of video', 'godam' ), value: 'end' },
	];

	const positionOptions = [
		{ label: __( 'Top Left', 'godam' ), value: 'top-left' },
		{ label: __( 'Top Center', 'godam' ), value: 'top-center' },
		{ label: __( 'Top Right', 'godam' ), value: 'top-right' },
		{ label: __( 'Center Left', 'godam' ), value: 'center-left' },
		{ label: __( 'Center', 'godam' ), value: 'center' },
		{ label: __( 'Center Right', 'godam' ), value: 'center-right' },
		{ label: __( 'Bottom Left', 'godam' ), value: 'bottom-left' },
		{ label: __( 'Bottom Center', 'godam' ), value: 'bottom-center' },
		{ label: __( 'Bottom Right', 'godam' ), value: 'bottom-right' },
	];

	const fontSizeOptions = [
		{ name: __( 'Small', 'godam' ), size: 14, slug: 'small' },
		{ name: __( 'Medium', 'godam' ), size: 16, slug: 'medium' },
		{ name: __( 'Large', 'godam' ), size: 18, slug: 'large' },
		{ name: __( 'Extra Large', 'godam' ), size: 22, slug: 'extra-large' },
	];

	return (
		<Panel header={ __( 'Call to Action Layer', 'godam' ) } className="godam-panel">
			<PanelBody opened>
				<ToggleControl
					className="godam-toggle mb-4"
					label={ __( 'Enable Global CTA Layer', 'godam' ) }
					help={ __( 'Enable or disable call-to-action overlay on all videos across the site', 'godam' ) }
					checked={ mediaSettings?.global_layers?.cta?.enabled || false }
					onChange={ ( value ) => handleSettingChange( 'enabled', value ) }
				/>

				{
					mediaSettings?.global_layers?.cta?.enabled && (
						<>
							<TextControl
								className="godam-input mb-4"
								label={ __( 'CTA Text', 'godam' ) }
								help={ __( 'The text to display in the call-to-action button', 'godam' ) }
								value={ mediaSettings?.global_layers?.cta?.text || '' }
								onChange={ ( value ) => handleSettingChange( 'text', value ) }
								placeholder={ __( 'Learn More', 'godam' ) }
							/>

							<TextControl
								className="godam-input mb-4"
								label={ __( 'CTA Link URL', 'godam' ) }
								help={ __( 'The URL where users will be redirected when they click the CTA', 'godam' ) }
								value={ mediaSettings?.global_layers?.cta?.url || '' }
								onChange={ ( value ) => handleSettingChange( 'url', value ) }
								placeholder={ __( 'https://example.com', 'godam' ) }
								type="url"
							/>

							<ToggleControl
								className="godam-toggle mb-4"
								label={ __( 'Open in New Tab', 'godam' ) }
								help={ __( 'Open the CTA link in a new browser tab', 'godam' ) }
								checked={ mediaSettings?.global_layers?.cta?.new_tab || false }
								onChange={ ( value ) => handleSettingChange( 'new_tab', value ) }
							/>

							<SelectControl
								className="godam-select mb-4"
								label={ __( 'CTA Placement', 'godam' ) }
								help={ __( 'Choose when the CTA should appear in the video timeline', 'godam' ) }
								value={ mediaSettings?.global_layers?.cta?.placement || 'end' }
								options={ placementOptions }
								onChange={ ( value ) => handleSettingChange( 'placement', value ) }
							/>

							{ mediaSettings?.global_layers?.cta?.placement === 'middle' && (
								<RangeControl
									className="godam-range mb-4"
									label={ __( 'CTA Position (seconds)', 'godam' ) }
									help={ __( 'Specify when the CTA should appear in the middle of the video', 'godam' ) }
									value={ mediaSettings?.global_layers?.cta?.position || 30 }
									onChange={ ( value ) => handleSettingChange( 'position', value ) }
									min={ 1 }
									max={ 300 }
								/>
							) }

							<SelectControl
								className="godam-select mb-4"
								label={ __( 'CTA Position on Screen', 'godam' ) }
								help={ __( 'Choose where the CTA should appear on the video', 'godam' ) }
								value={ mediaSettings?.global_layers?.cta?.screen_position || 'bottom-center' }
								options={ positionOptions }
								onChange={ ( value ) => handleSettingChange( 'screen_position', value ) }
							/>

							<RangeControl
								className="godam-range mb-4"
								label={ __( 'CTA Display Duration (seconds)', 'godam' ) }
								help={ __( 'How long the CTA should be displayed (0 = until end of video)', 'godam' ) }
								value={ mediaSettings?.global_layers?.cta?.duration || 10 }
								onChange={ ( value ) => handleSettingChange( 'duration', value ) }
								min={ 0 }
								max={ 60 }
							/>

							<div className="mb-4">
								<label className="components-base-control__label">{ __( 'Background Color', 'godam' ) }</label>
								<ColorPicker
									color={ mediaSettings?.global_layers?.cta?.background_color || '#0073aa' }
									onChange={ ( value ) => handleSettingChange( 'background_color', value ) }
								/>
							</div>

							<div className="mb-4">
								<label className="components-base-control__label">{ __( 'Text Color', 'godam' ) }</label>
								<ColorPicker
									color={ mediaSettings?.global_layers?.cta?.text_color || '#ffffff' }
									onChange={ ( value ) => handleSettingChange( 'text_color', value ) }
								/>
							</div>

							<div className="mb-4">
								<label className="components-base-control__label">{ __( 'Font Size', 'godam' ) }</label>
								<FontSizePicker
									fontSizes={ fontSizeOptions }
									value={ mediaSettings?.global_layers?.cta?.font_size || 16 }
									onChange={ ( value ) => handleSettingChange( 'font_size', value ) }
								/>
							</div>

							<RangeControl
								className="godam-range mb-4"
								label={ __( 'Border Radius', 'godam' ) }
								help={ __( 'Roundness of the CTA button corners', 'godam' ) }
								value={ mediaSettings?.global_layers?.cta?.border_radius || 4 }
								onChange={ ( value ) => handleSettingChange( 'border_radius', value ) }
								min={ 0 }
								max={ 20 }
							/>

							<TextareaControl
								className="godam-textarea mb-4"
								label={ __( 'Additional CSS Classes', 'godam' ) }
								help={ __( 'Optional CSS classes to apply to the CTA for custom styling', 'godam' ) }
								value={ mediaSettings?.global_layers?.cta?.css_classes || '' }
								onChange={ ( value ) => handleSettingChange( 'css_classes', value ) }
								placeholder={ __( 'custom-cta-class another-class', 'godam' ) }
							/>
						</>
					)
				}
			</PanelBody>
		</Panel>
	);
};

export default CTALayer;
