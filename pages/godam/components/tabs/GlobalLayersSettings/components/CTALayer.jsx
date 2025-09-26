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
	SelectControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateMediaSetting } from '../../../../redux/slice/media-settings.js';
import TextCTA from './cta/TextCTA.jsx';
import ImageCTA from './cta/ImageCTA.jsx';
import HtmlCTA from './cta/HtmlCTA.jsx';

const CTALayer = () => {
	const dispatch = useDispatch();

	// Get media settings from Redux store
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );

	// Function to handle setting change
	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'global_layers', subcategory: 'cta', key, value } ) );
	};

	const ctaTypeOptions = [
		{ label: __( 'Text', 'godam' ), value: 'text' },
		{ label: __( 'HTML', 'godam' ), value: 'html' },
		{ label: __( 'Image', 'godam' ), value: 'image' },
	];

	const placementOptions = [
		{ label: __( 'Start of video', 'godam' ), value: 'start' },
		{ label: __( 'Middle of video', 'godam' ), value: 'middle' },
		{ label: __( 'End of video', 'godam' ), value: 'end' },
	];

	const renderSelectedCTAInputs = () => {
		switch ( mediaSettings?.global_layers?.cta?.cta_type ) {
			case 'text':
				return <TextCTA />;
			case 'image':
				return <ImageCTA />;
			case 'html':
				return <HtmlCTA />;
			default:
				return <TextCTA />;
		}
	};

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
						<div className="flex flex-col godam-form-group">
							<p className="mb-4 label-text">{ __( 'Call to Action', 'godam' ) }</p>
							<SelectControl
								className="godam-select mb-4 w-full md:w-1/3"
								label={ __( 'Select type', 'godam' ) }
								onChange={ ( value ) => handleSettingChange( 'cta_type', value ) }
								options={ ctaTypeOptions }
								value={ mediaSettings?.global_layers?.cta?.cta_type || 'text' }
							/>

							{ renderSelectedCTAInputs() }

							<SelectControl
								className="godam-select mb-4 w-full md:w-1/3"
								label={ __( 'CTA Placement', 'godam' ) }
								help={ __( 'Choose when the CTA should appear in the video timeline', 'godam' ) }
								value={ mediaSettings?.global_layers?.cta?.placement || 'end' }
								options={ placementOptions }
								onChange={ ( value ) => handleSettingChange( 'placement', value ) }
							/>
						</div>
					)
				}
			</PanelBody>
		</Panel>
	);
};

export default CTALayer;
