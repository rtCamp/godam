/**
 * External dependencies
 */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';

/**
 * WordPress dependencies
 */
import { Button, SelectControl, ToggleControl, ComboboxControl, TextareaControl, Modal } from '@wordpress/components';
import { arrowLeft, trash } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField, removeLayer } from '../../redux/slice/videoSlice';

const templateOptions = [
	{
		value: 'default',
		label: 'Default',
	},
	{
		value: 'variant1',
		label: 'Variant 1',
	},
	{
		value: 'variant2',
		label: 'Variant 2',
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

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'gf_id', value: formID } ) );
	};

	return (
		<>
			<div className="flex justify-between items-center pb-3 border-b mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<p className="font-semibold">{ __( 'Form layer at', 'transcoder' ) } { 5 }s</p>
				<Button icon={ trash } isDestructive onClick={ () => setOpen( true ) } />
				{ isOpen && (
					<Modal title={ __( 'Delete layer', 'transcoder' ) } onRequestClose={ () => setOpen( false ) }>
						<div className="flex justify-between items-center gap-3">
							<Button className="w-full justify-center" isDestructive variant="primary" onClick={ handleDeleteLayer }>
								{ __( 'Delete layer', 'transcoder' ) }
							</Button>
							<Button className="w-full justify-center" variant="secondary" onClick={ () => setOpen( false ) }>
								{ __( 'Cancel', 'transcoder' ) }
							</Button>
						</div>
					</Modal>
				) }
			</div>

			<GravityFormSelector className="gravity-form-selector mb-4" formID={ layer.gf_id } handleChange={ changeFormID } />

			<SelectControl
				className="mb-4"
				label={ __( 'Select template', 'transcoder' ) }
				options={ templateOptions }
				value={ layer.template }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'template', value } ) )
				}
			/>
			<TextareaControl
				className="mb-4"
				label={ __( 'Custom CSS', 'transcoder' ) }
				placeholder={ __( '.classname { border: 1px solid blue; }', 'transcoder' ) }
				value={ layer.custom_css }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'custom_css', value } ) )
				}
			/>
			<ToggleControl
				className="mb-4"
				label={ __( 'Allow user to skip', 'transcoder' ) }
				checked={ layer.allow_skip }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'allow_skip', value } ) )
				}
				help={ __( 'If enabled, the user will be able to skip the form submission.', 'transcoder' ) }
			/>
		</>
	);
};

function GravityFormSelector( { className, formID, handleChange } ) {
	const [ form, setForm ] = useState( formID );
	const [ filteredOptions, setFilteredOptions ] = useState( [] );
	const [ forms, setForms ] = useState( [] );

	const setFormData = ( value ) => {
		setForm( value );
		handleChange( value );
	};

	useEffect( () => {
		// Fetch Gravity Forms from the server
		axios.get( '/wp-json/easydam/v1/gforms?fields=id,title,description' )
			.then( ( response ) => {
				const data = response.data;
				setForms( data.map( ( _form ) => {
					return {
						value: _form.id,
						label: _form.title,
					};
				} ) );
			} )
			.catch( ( error ) => {
				if ( error.status === 404 && error.response.data.code === 'gravity_forms_not_active' ) {
					// Gravity Forms is not active.
					console.log( 'Gravity Forms is not active.' );
				}
			} )
			.finally( function() {
				// always executed
			} );
	}, [] );

	return (
		<ComboboxControl
			__next40pxDefaultSize
			__nextHasNoMarginBottom
			label={ __( 'Select gravity form', 'transcoder' ) }
			className={ className }
			value={ form }
			onChange={ setFormData }
			options={ filteredOptions }
			onFilterValueChange={ ( inputValue ) => {
				setFilteredOptions(
					forms.filter( ( _form ) =>
						_form.label
							.toLowerCase()
							.startsWith( inputValue.toLowerCase() ),
					),
				);
			} }
		/>
	);
}

export default FormLayer;
