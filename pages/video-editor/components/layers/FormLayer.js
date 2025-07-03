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
import EverestForm from '../forms/EverestForm';
import CF7 from '../forms/CF7';
import JetpackForm from '../forms/JetpackForm';
import SureForm from '../forms/Sureform.js';
import FluentForm from '../forms/FluentForm.js';
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';
import LayersHeader from './LayersHeader.js';
import ForminatorForm from '../forms/forminatorForms.js';

/**
 * FormLayer Components Object mapping.
 */
const FormLayerComponentType = {
	gravity: {
		isActive: Boolean( window?.videoData?.gfActive ) ?? false,
		component: GravityForm,
	},
	cf7: {
		isActive: Boolean( window?.videoData?.cf7Active ) ?? false,
		component: CF7,
	},
	jetpack: {
		isActive: Boolean( window?.videoData?.jetpackActive ) ?? false,
		component: JetpackForm,
	},
	wpforms: {
		isActive: Boolean( window?.videoData?.wpformsActive ) ?? false,
		component: WPForm,
	},
	sureforms: {
		isActive: Boolean( window?.videoData?.sureformsActive ) ?? false,
		component: SureForm,
	},
	forminator: {
		isActive: Boolean( window?.videoData?.forminatorActive ) ?? false,
		component: ForminatorForm,
	},
	fluentforms: {
		isActive: Boolean( window?.videoData?.fluentformsActive ) ?? false,
		component: FluentForm,
	},
	everestforms: {
		isActive: Boolean( window?.videoData?.everestFormsActive ) ?? false,
		component: EverestForm,
	},
};

/**
 * Component to render and manage a form layer within the video editor.
 *
 * @param {Object}   param0          - Props passed to the FormLayer component.
 * @param {string}   param0.layerID  - Unique identifier for the form layer.
 * @param {Function} param0.goBack   - Callback function to navigate back to the previous view.
 * @param {number}   param0.duration - Total duration of the video (in seconds or milliseconds).
 *
 * @return {JSX.Element} The rendered FormLayer component.
 */
const FormLayer = ( { layerID, goBack, duration } ) => {
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );

	// If we want to disable the premium layers the we can use this code
	// const isValidAPIKey = window?.videoData?.validApiKey;
	// For now we are enabling all the features
	const isValidAPIKey = true;

	const FormLayerData = FormLayerComponentType[ layer?.form_type ?? 'gravity' ];
	const FormLayerComponent = FormLayerData?.component;
	const isPluginActive = FormLayerData?.isActive;

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

			<FormLayerComponent layerID={ layer.id } />

			<ToggleControl
				__nextHasNoMarginBottom
				className="mb-4 godam-toggle"
				label={ __( 'Allow user to skip', 'godam' ) }
				checked={ layer.allow_skip }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'allow_skip', value } ) )
				}
				help={ __( 'If enabled, the user will be able to skip the form submission.', 'godam' ) }
				disabled={ ! isValidAPIKey || ! isPluginActive }
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
						disabled={ ! isValidAPIKey || ! isPluginActive }
					/>

					<label htmlFor="custom-css" className="easydam-label">{ __( 'Custom CSS', 'godam' ) }</label>

					<div className={ ( ! isValidAPIKey || ! isPluginActive ) ? 'pointer-events-none opacity-50' : '' }>
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
