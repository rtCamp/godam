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
	RangeControl,
	Spinner,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateMediaSetting } from '../../../../redux/slice/media-settings.js';

const FormsLayer = () => {
	const dispatch = useDispatch();

	// Get media settings from Redux store
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );
	
	const [ formPlugins, setFormPlugins ] = useState( [] );
	const [ availableForms, setAvailableForms ] = useState( [] );
	const [ isLoadingForms, setIsLoadingForms ] = useState( false );

	// Function to handle setting change
	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'global_layers', subcategory: 'forms', key, value } ) );
	};

	// Load available form plugins and forms
	useEffect( () => {
		loadFormPlugins();
	}, [] );

	// Load available forms when form plugin is selected
	useEffect( () => {
		if ( mediaSettings?.global_layers?.forms?.enabled && mediaSettings?.global_layers?.forms?.plugin ) {
			loadFormsForPlugin( mediaSettings.global_layers.forms.plugin );
		}
	}, [ mediaSettings?.global_layers?.forms?.plugin ] );

	const loadFormPlugins = async () => {
		setIsLoadingForms( true );
		try {
			const response = await fetch( 
				`${ window.godamSettings?.apiUrl }/godam/v1/settings/detect-form-plugins`,
				{
					headers: {
						'X-WP-Nonce': window.godamSettings?.nonce,
					},
				}
			);
			const data = await response.json();
			if ( data.success ) {
				const plugins = Object.entries( data.data ).map( ( [ key, plugin ] ) => ({
					value: key,
					label: plugin.name,
					forms: plugin.forms,
				}) );
				setFormPlugins( plugins );
			}
		} catch ( error ) {
			console.error( 'Error loading form plugins:', error );
		} finally {
			setIsLoadingForms( false );
		}
	};

	const loadFormsForPlugin = ( plugin ) => {
		const selectedPlugin = formPlugins.find( p => p.value === plugin );
		if ( selectedPlugin && selectedPlugin.forms ) {
			setAvailableForms( selectedPlugin.forms.map( form => ({
				value: form.id,
				label: form.title,
			}) ) );
		} else {
			setAvailableForms( [] );
		}
	};

	const placementOptions = [
		{ label: __( 'Start of video', 'godam' ), value: 'start' },
		{ label: __( 'Middle of video', 'godam' ), value: 'middle' },
		{ label: __( 'End of video', 'godam' ), value: 'end' },
	];

	const formPluginOptions = formPlugins.map( plugin => ({
		label: plugin.label,
		value: plugin.value,
	}) );

	// Don't show this component if no form plugins are available and not loading
	if ( formPlugins.length === 0 && !isLoadingForms ) {
		return (
			<Panel header={ __( 'Forms Layer', 'godam' ) } className="godam-panel">
				<PanelBody opened>
					<p className="text-gray-600">
						{ __( 'No supported form plugins are currently active. Please install and activate a supported form plugin (WPForms, Gravity Forms, Contact Form 7, etc.) to use this feature.', 'godam' ) }
					</p>
				</PanelBody>
			</Panel>
		);
	}

	return (
		<Panel header={ __( 'Forms Layer', 'godam' ) } className="godam-panel">
			<PanelBody opened>
				{ isLoadingForms && (
					<div className="flex items-center mb-4">
						<Spinner />
						<span className="ml-2">{ __( 'Loading form plugins...', 'godam' ) }</span>
					</div>
				) }

				<ToggleControl
					className="godam-toggle mb-4"
					label={ __( 'Enable Global Form Layer', 'godam' ) }
					help={ __( 'Enable or disable form overlay on all videos across the site', 'godam' ) }
					checked={ mediaSettings?.global_layers?.forms?.enabled || false }
					onChange={ ( value ) => handleSettingChange( 'enabled', value ) }
				/>

				{
					mediaSettings?.global_layers?.forms?.enabled && (
						<>
							<SelectControl
								className="godam-select mb-4"
								label={ __( 'Form Plugin', 'godam' ) }
								help={ __( 'Choose which form plugin to use', 'godam' ) }
								value={ mediaSettings?.global_layers?.forms?.plugin || '' }
								options={ [
									{ label: __( 'Select a form plugin...', 'godam' ), value: '' },
									...formPluginOptions
								] }
								onChange={ ( value ) => {
									handleSettingChange( 'plugin', value );
									handleSettingChange( 'form_id', '' ); // Reset form selection
								} }
							/>

							{ mediaSettings?.global_layers?.forms?.plugin && (
								<>
									<SelectControl
										className="godam-select mb-4"
										label={ __( 'Select Form', 'godam' ) }
										help={ __( 'Choose which form to display', 'godam' ) }
										value={ mediaSettings?.global_layers?.forms?.form_id || '' }
										options={ [
											{ label: __( 'Select a form...', 'godam' ), value: '' },
											...availableForms
										] }
										onChange={ ( value ) => handleSettingChange( 'form_id', value ) }
									/>

									<SelectControl
										className="godam-select mb-4"
										label={ __( 'Form Placement', 'godam' ) }
										help={ __( 'Choose when the form should appear in the video timeline', 'godam' ) }
										value={ mediaSettings?.global_layers?.forms?.placement || 'end' }
										options={ placementOptions }
										onChange={ ( value ) => handleSettingChange( 'placement', value ) }
									/>

									{ mediaSettings?.global_layers?.forms?.placement === 'middle' && (
										<RangeControl
											className="godam-range mb-4"
											label={ __( 'Form Position (seconds)', 'godam' ) }
											help={ __( 'Specify when the form should appear in the middle of the video', 'godam' ) }
											value={ mediaSettings?.global_layers?.forms?.position || 30 }
											onChange={ ( value ) => handleSettingChange( 'position', value ) }
											min={ 1 }
											max={ 300 }
										/>
									) }

									<RangeControl
										className="godam-range mb-4"
										label={ __( 'Form Display Duration (seconds)', 'godam' ) }
										help={ __( 'How long the form should be displayed (0 = until interaction)', 'godam' ) }
										value={ mediaSettings?.global_layers?.forms?.duration || 0 }
										onChange={ ( value ) => handleSettingChange( 'duration', value ) }
										min={ 0 }
										max={ 60 }
									/>
								</>
							) }
						</>
					)
				}
			</PanelBody>
		</Panel>
	);
};

export default FormsLayer;
