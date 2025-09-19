/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';
import Editor from '@monaco-editor/react';

/**
 * Internal dependencies
 */
import { updateMediaSetting } from '../../../../../redux/slice/media-settings.js';

const HtmlCTA = () => {
	const dispatch = useDispatch();

	// Get media settings from Redux store
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );

	// Function to handle setting change
	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'global_layers', subcategory: 'cta', key, value } ) );
	};

	return (
		<div className="mb-4">
			<Editor
				id="custom-css"
				className="code-editor"
				defaultLanguage="html"
				defaultValue={ mediaSettings?.global_layers?.cta?.html || '' }
				options={ {
					minimap: { enabled: false },
				} }
				onChange={ ( value ) => handleSettingChange( 'html', value ) }
			/>
		</div>
	);
};

export default HtmlCTA;
