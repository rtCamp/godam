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
	const handleEditorMount = ( editor, monaco ) => {
		monaco.editor.defineTheme( 'godam-theme', {
			base: 'vs',
			inherit: true,
			rules: [
				{
					token: 'comment',
					foreground: '999999', // Light gray
					fontStyle: 'italic',
				},
			],
			colors: {
				'editor.foreground': '#000000',
				'editor.background': '#ffffff',
			},
		} );

		monaco.editor.setTheme( 'godam-theme' );
	};

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
						defaultLanguage="css"
						defaultValue={ customCSS }
						theme="godam-theme"
						options={ {
							minimap: { enabled: false },
						} }
						onMount={ handleEditorMount }
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
