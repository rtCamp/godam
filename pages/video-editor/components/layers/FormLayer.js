/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import Editor from '@monaco-editor/react';

/**
 * WordPress dependencies
 */
import { Button, ToggleControl, Modal, Panel, PanelBody, Notice, CustomSelectControl } from '@wordpress/components';
import { arrowLeft, trash } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField, removeLayer } from '../../redux/slice/videoSlice';

import GravityForm from '../forms/GravityForm';
import NinjaForm from '../forms/NinjaForm';
import CF7 from '../forms/CF7';
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';

const SUPPORTED_FORM_TYPES = [
	{
		key: 'gravity',
		name: __( 'Gravity Forms', 'godam' ),
	},
	{
		key: 'cf7',
		name: __( 'Contact Form 7', 'godam' ),
	},
	{
		key: 'ninjaforms',
		name: __( 'Ninja Forms', 'godam' ),
	},
	{
		key: 'wpforms',
		name: __( 'WPForms', 'godam' ),
	},
];

const FormLayer = ( { layerID, goBack } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );

	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

	// If we want to disable the premium layers the we can use this code
	// const isValidAPIKey = window?.videoData?.valid_api_key;

	// For now we are enabling all the features
	const isValidAPIKey = true;

	return (
		<>
			<div className="flex justify-between items-center border-b mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<p className="text-base">{ __( 'Form layer at', 'godam' ) } { layer.displayTime }s</p>
				<Button icon={ trash } isDestructive onClick={ () => setOpen( true ) } />
				{ isOpen && (
					<Modal title={ __( 'Delete layer', 'godam' ) } onRequestClose={ () => setOpen( false ) }>
						<div className="flex justify-between items-center gap-3">
							<Button className="w-full justify-center" isDestructive variant="primary" onClick={ handleDeleteLayer }>
								{ __( 'Delete layer', 'godam' ) }
							</Button>
							<Button className="w-full justify-center" variant="secondary" onClick={ () => setOpen( false ) }>
								{ __( 'Cancel', 'godam' ) }
							</Button>
						</div>
					</Modal>
				) }
			</div>

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

			{ /* Form type */ }
			<CustomSelectControl
				className="mb-4"
				label={ __( 'Form type', 'godam' ) }
				value={ SUPPORTED_FORM_TYPES.find( ( option ) => option.key === layer.formType ) }
				onChange={ ( value ) => {
					const formType = value?.selectedItem?.key;
					dispatch( updateLayerField( { id: layer.id, field: 'formType', value: formType } ) );

					if ( formType === 'gravity' ) {
						dispatch( updateLayerField( { id: layer.id, field: 'gf_id', value: '' } ) );
					} else if ( formType === 'cf7' ) {
						dispatch( updateLayerField( { id: layer.id, field: 'cf7_id', value: '' } ) );
					} else if ( formType === 'ninjaforms' ) {
						dispatch( updateLayerField( { id: layer.id, field: 'ninjaform_id', value: '' } ) );
					} else if ( formType === 'wpforms' ) {
						dispatch( updateLayerField( { id: layer.id, field: 'wpform_id', value: '' } ) );
					}
				} }
				options={ SUPPORTED_FORM_TYPES }
				disabled={ ! isValidAPIKey }
			/>

			{
				layer.formType === 'gravity' &&
				<GravityForm layerID={ layer.id } />
			}

			{
				layer.formType === 'cf7' &&
				<CF7 layerID={ layer.id } />
			}

			{
				layer.formType === 'ninjaforms' &&
				<NinjaForm layerID={ layer.id } />
			}

			<ToggleControl
				className="mb-4 godam-toggle"
				label={ __( 'Allow user to skip', 'godam' ) }
				checked={ layer.allow_skip }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'allow_skip', value } ) )
				}
				help={ __( 'If enabled, the user will be able to skip the form submission.', 'godam' ) }
				disabled={ ! isValidAPIKey }
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
						disabled={ ! isValidAPIKey }
					/>

					<label htmlFor="custom-css" className="easydam-label">{ __( 'Custom CSS', 'godam' ) }</label>

					<div className={ ! isValidAPIKey ? 'pointer-events-none opacity-50' : '' }>
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
