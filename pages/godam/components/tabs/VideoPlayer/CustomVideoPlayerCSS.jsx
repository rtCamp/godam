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
				{
					token: 'variable',
					foreground: '007ACC', // Blue for SCSS variables
				},
				{
					token: 'keyword',
					foreground: 'AF00DB', // Purple keywords
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
		<Panel heading={ __( 'Custom CSS', 'godam' ) } className="rounded-xl">
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
							fontSize: 14,
							formatOnType: true,
							formatOnPaste: true,
						} }
						onMount={ handleEditorMount }
						onChange={ ( value ) => handleSettingChange( 'custom_css', value ) }
					/>
				</div>
			</PanelBody>
		</Panel>
	);
};

export default CustomVideoPlayerCSS;
