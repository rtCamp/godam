/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import Editor from '@monaco-editor/react';

/**
 * WordPress dependencies
 */
import { ToggleControl, Panel, PanelBody, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';

import GravityForm from '../forms/GravityForm';
import WPForm from '../forms/WPForm';
import CF7 from '../forms/CF7';
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';
import LayersHeader from './LayersHeader.js';

const FormLayer = ( { layerID, goBack, duration } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );

	// If we want to disable the premium layers the we can use this code
	// const isValidAPIKey = window?.videoData?.valid_api_key;
	// For now we are enabling all the features
	const isValidAPIKey = true;

	const isPluginActive = ( formType ) => {
		switch ( formType ) {
			case 'gravity':
				return Boolean( window?.videoData?.gf_active );
			case 'wpforms':
				return Boolean( window?.videoData?.wpforms_active );
			case 'cf7':
				return Boolean( window?.videoData?.cf7_active );
			default:
				return false;
		}
	};

	return (
		<>
			<LayersHeader layer={ layer } goBack={ goBack } duration={ duration } />

			{
				! isValidAPIKey &&
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'This features is available in premium version', 'godam' ) }
				</Notice>
			}

			{
				layer.form_type === 'gravity' &&
				<GravityForm layerID={ layer.id } />
			}

			{
				layer.form_type === 'cf7' &&
				<CF7 layerID={ layer.id } />
			}

			{
				layer.form_type === 'wpforms' &&
				<WPForm layerID={ layer.id } />
			}

			<ToggleControl
				className="mb-4 godam-toggle"
				label={ __( 'Allow user to skip', 'godam' ) }
				checked={ layer.allow_skip }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'allow_skip', value } ) )
				}
				help={ __( 'If enabled, the user will be able to skip the form submission.', 'godam' ) }
				disabled={ ! isValidAPIKey || ! isPluginActive( layer.form_type ) }
			/>

			<Panel className="-mx-4 border-x-0">
				<PanelBody
					title={ __( 'Advance', 'godam' ) }
					initialOpen={ false }
				>

					{ /* Layer background color */ }
					<label htmlFor="color" className="easydam-label">{ __( 'Color', 'godam' ) }</label>
					<ColorPickerButton
						className="mb-4"
						value={ layer?.bg_color ?? '#FFFFFFB3' }
						label={ __( 'Layer background color', 'godam' ) }
						enableAlpha={ true }
						onChange={ ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'bg_color', value } ) ) }
						disabled={ ! isValidAPIKey || ! isPluginActive( layer.form_type ) }
					/>

					<label htmlFor="custom-css" className="easydam-label">{ __( 'Custom CSS', 'godam' ) }</label>

					<div className={ ( ! isValidAPIKey || ! isPluginActive( layer.form_type ) ) ? 'pointer-events-none opacity-50' : '' }>
						<Editor
							id="custom-css"
							className="code-editor"
							defaultLanguage="css"
							options={ {
								minimap: { enabled: false },
							} }
							defaultValue={ layer.custom_css }
							onChange={ ( value ) =>
								dispatch( updateLayerField( { id: layer.id, field: 'custom_css', value } ) )
							}
						/>
					</div>
				</PanelBody>
			</Panel>
		</>
	);
};

export default FormLayer;
