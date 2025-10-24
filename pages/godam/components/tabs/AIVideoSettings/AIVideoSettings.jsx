/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import {
	TextControl,
	SelectControl,
	Notice,
	Panel,
	PanelBody,
	Button,
	Spinner,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { scrollToTop } from '../../../utils/index.js';
import { useSaveMediaSettingsMutation } from '../../../redux/api/media-settings.js';
import { updateMediaSetting, resetChangeFlag } from '../../../redux/slice/media-settings.js';

const AIVideoSettings = () => {
	const dispatch = useDispatch();

	// Selectors to get media settings
	const { mediaSettings } = useSelector( ( state ) => ( {
		mediaSettings: state.mediaSettings,
	} ) );

	// Save settings mutation
	const [ saveMediaSettings, { isLoading: isSaving } ] = useSaveMediaSettingsMutation();

	// Local state for notices
	const [ notice, setNotice ] = useState( null );

	// Local state for form inputs (don't update Redux on every keystroke)
	const aiVideoSettings = mediaSettings?.ai_video || {};
	const [ localSettings, setLocalSettings ] = useState( {
		api_key: aiVideoSettings.api_key || '',
		model: aiVideoSettings.model || 'kling-1.5',
	} );

	// Track if there are unsaved changes
	const [ hasChanges, setHasChanges ] = useState( false );

	// Sync local state with Redux state when it changes (initial load)
	useEffect( () => {
		const currentAiSettings = mediaSettings?.ai_video || {};
		setLocalSettings( {
			api_key: currentAiSettings.api_key || '',
			model: currentAiSettings.model || 'kling-1.5',
		} );
		setHasChanges( false );
	}, [ mediaSettings?.ai_video ] );

	const handleInputChange = ( key, value ) => {
		setLocalSettings( prev => ( {
			...prev,
			[ key ]: value,
		} ) );
		
		// Mark as changed if different from saved values
		const currentValue = aiVideoSettings[ key ] || '';
		if ( value !== currentValue ) {
			setHasChanges( true );
		} else {
			// Check if any field is different
			const newSettings = { ...localSettings, [ key ]: value };
			const isDifferent = Object.keys( newSettings ).some( 
				fieldKey => newSettings[ fieldKey ] !== ( aiVideoSettings[ fieldKey ] || '' )
			);
			setHasChanges( isDifferent );
		}
	};

	const handleSaveSettings = async () => {
		try {
			// Update Redux state with local changes before saving
			Object.keys( localSettings ).forEach( key => {
				dispatch( updateMediaSetting( { category: 'ai_video', key, value: localSettings[ key ] } ) );
			} );

			// Create updated settings object
			const updatedSettings = {
				...mediaSettings,
				ai_video: {
					...aiVideoSettings,
					...localSettings,
				},
			};

			const response = await saveMediaSettings( { settings: updatedSettings } );

			if ( response?.data?.status === 'success' ) {
				setNotice( { type: 'success', message: __( 'AI Video settings saved successfully!', 'godam' ) } );
				setHasChanges( false );
				scrollToTop();
			} else {
				throw new Error( response?.data?.message || __( 'Failed to save settings', 'godam' ) );
			}
		} catch ( error ) {
			setNotice( { type: 'error', message: error.message || __( 'An error occurred while saving settings', 'godam' ) } );
			scrollToTop();
		}

		// Auto-hide notice after 5 seconds
		setTimeout( () => setNotice( null ), 5000 );
	};

	const modelOptions = [
		{ label: __( 'Kling 1.5 (Recommended)', 'godam' ), value: 'kling-1.5' },
		{ label: __( 'Kling 1.0 Pro', 'godam' ), value: 'kling-1.0-pro' },
	];

	return (
		<div className="godam-settings-content">
			{ notice && (
				<Notice
					status={ notice.type }
					onRemove={ () => setNotice( null ) }
					isDismissible={ true }
				>
					{ notice.message }
				</Notice>
			) }

			<div>
				<h1>{ __( 'AI Video Generation', 'godam' ) }</h1>
				<p>{ __( 'Configure your Vyro AI settings for generating videos from product images.', 'godam' ) }</p>
			</div>

			<Panel>
				<PanelBody title={ __( 'API Configuration', 'godam' ) } initialOpen={ true }>
					<TextControl
						label={ __( 'Vyro AI API Key', 'godam' ) }
						value={ localSettings.api_key }
						onChange={ ( value ) => handleInputChange( 'api_key', value ) }
						placeholder={ __( 'Enter your Vyro AI API key', 'godam' ) }
						help={ __( 'You can get your API key from your Vyro AI dashboard at https://vyro.ai', 'godam' ) }
						type="password"
					/>

					<SelectControl
						label={ __( 'AI Model', 'godam' ) }
						value={ localSettings.model }
						options={ modelOptions }
						onChange={ ( value ) => handleInputChange( 'model', value ) }
						help={ __( 'Select the AI model for video generation. Kling 1.5 provides better quality and faster processing.', 'godam' ) }
					/>
				</PanelBody>

				<PanelBody title={ __( 'How to Use', 'godam' ) } initialOpen={ false }>
					<div className="godam-ai-video-instructions">
						<h4>{ __( 'Generate AI Videos from Product Images:', 'godam' ) }</h4>
						<ol>
							<li>{ __( 'Configure your API key and model above and save settings', 'godam' ) }</li>
							<li>{ __( 'Go to any WooCommerce product edit page', 'godam' ) }</li>
							<li>{ __( 'Find the "AI Video Generation" meta box', 'godam' ) }</li>
							<li>{ __( 'Select images from the product gallery', 'godam' ) }</li>
							<li>{ __( 'Enter a prompt describing the video you want', 'godam' ) }</li>
							<li>{ __( 'Click "Generate Video" to create your AI-powered product video', 'godam' ) }</li>
						</ol>
						<p><strong>{ __( 'Note:', 'godam' ) }</strong> { __( 'Video generation requires an active Vyro AI subscription. Processing typically takes 2-5 minutes depending on the model and complexity.', 'godam' ) }</p>
					</div>
				</PanelBody>
			</Panel>

			<div className="godam-settings-save">
				<Button
					variant="primary"
					onClick={ handleSaveSettings }
					disabled={ ! hasChanges || isSaving }
				>
					{ isSaving && <Spinner /> }
					{ isSaving ? __( 'Saving...', 'godam' ) : __( 'Save Settings', 'godam' ) }
				</Button>
			</div>
		</div>
	);
};

export default AIVideoSettings;
