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
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Editor from '@monaco-editor/react';

const CustomVideoPlayerCSS = ( { handleSettingChange } ) => {
	const customCSS = useSelector(
		( state ) => state.mediaSettings.video_player?.custom_css,
	);

	return (
		<Panel heading={ __( 'Video Thumbnails', 'godam' ) } className="godam-panel">
			<PanelBody>
				<div className="godam-form-group">
					<Editor
						id="custom-css"
						className="code-editor"
						defaultLanguage="html"
						defaultValue={ customCSS }
						options={ {
							minimap: { enabled: false },
						} }
						onChange={ ( value ) => handleSettingChange( 'custom_css', value ) }
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
