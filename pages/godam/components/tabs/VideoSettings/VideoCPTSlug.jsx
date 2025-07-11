/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { TextControl, Panel, PanelBody } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

const VideoCPTSlug = ( { handleSettingChange } ) => {
	const videoSlug = useSelector( ( state ) => state.mediaSettings.video?.video_slug ) || 'videos';
	const [ inputValue, setInputValue ] = useState( videoSlug );
	const [ hasUserInput, setHasUserInput ] = useState( false );

	// Sync local state with Redux store when videoSlug changes (only if user hasn't been typing)
	useEffect( () => {
		if ( ! hasUserInput ) {
			setInputValue( videoSlug );
		}
	}, [ videoSlug, hasUserInput ] );

	const sanitizeSlug = ( value ) => {
		return value
			.toLowerCase()
			.replace( /[^a-z0-9-_]/g, '-' ) // Replace invalid characters with hyphens
			.replace( /-+/g, '-' ) // Replace multiple consecutive hyphens with single hyphen
			.replace( /^-|-$/g, '' ); // Remove leading/trailing hyphens
	};

	const handleInputChange = ( value ) => {
		setInputValue( value );
		setHasUserInput( true );
		const sanitizedValue = sanitizeSlug( value );
		handleSettingChange( 'video_slug', sanitizedValue || 'videos' );
	};

	const sanitizedSlug = sanitizeSlug( inputValue );
	const showSanitizedPreview = hasUserInput && inputValue !== sanitizedSlug && inputValue.trim().length > 0;

	return (
		<Panel
			heading={ __( 'Video Post Settings', 'godam' ) }
			className="godam-panel"
		>
			<PanelBody>
				<div className="godam-form-group">
					<TextControl
						className="godam-input"
						label={ __( 'Video Archive URL Slug', 'godam' ) }
						value={ inputValue }
						onChange={ handleInputChange }
						help={ __( 'This slug will be used in the URL for video archive and single video pages (e.g., yoursite.com/videos/). This setting enables theme-compatible video archive and single page templates. Only lowercase letters, numbers, hyphens, and underscores are allowed.', 'godam' ) }
						placeholder="videos"
					/>
					{ showSanitizedPreview && (
						<div className="help-text" style={ { color: '#007cba', marginTop: '8px' } }>
							{ __( 'URL slug will be: ', 'godam' ) }
							<strong>{ sanitizedSlug || 'videos' }</strong>
						</div>
					) }
				</div>
			</PanelBody>
		</Panel>
	);
};

export default VideoCPTSlug;
