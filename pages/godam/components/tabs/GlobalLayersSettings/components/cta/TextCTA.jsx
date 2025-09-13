/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { TextareaControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateMediaSetting } from '../../../../../redux/slice/media-settings.js';

const TextCTA = () => {
	const dispatch = useDispatch();

	// Get media settings from Redux store
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );

	// Function to handle setting change
	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'global_layers', subcategory: 'cta', key, value } ) );
	};

	return (
		<div className="mb-4">
			<TextareaControl
				className="godam-textarea"
				label={ __( 'Content', 'godam' ) }
				help={ __( 'Enter the text content for your call-to-action', 'godam' ) }
				value={ mediaSettings?.global_layers?.cta?.text || '' }
				onChange={ ( value ) => handleSettingChange( 'text', value ) }
				placeholder={ __( 'Enter your CTA text here…', 'godam' ) }
				rows={ 6 }
			/>
		</div>
	);
};

export default TextCTA;
