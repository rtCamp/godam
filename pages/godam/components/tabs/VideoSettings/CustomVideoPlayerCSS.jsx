/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import {
	PanelBody,
	Panel,
	TextareaControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const CustomVideoPlayerCSS = ( { handleSettingChange } ) => {
	const customCSS = useSelector(
		( state ) => state.mediaSettings.video_player?.custom_css,
	);

	return (
		<Panel heading={ __( 'Video Thumbnails', 'godam' ) } className="godam-panel">
			<PanelBody>
				<div className="godam-form-group">
					<TextareaControl
						__nextHasNoMarginBottom
						label="Custom CSS"
						onChange={ ( value ) => handleSettingChange( 'custom_css', value ) }
						placeholder="Placeholder"
						value={ customCSS }
						rows={ 30 }
					/>
					<div className="help-text">
						{ __( 'Add custom css for GoDAM Video Block', 'godam' ) }
					</div>
				</div>
			</PanelBody>
		</Panel>
	);
};

export default CustomVideoPlayerCSS;
