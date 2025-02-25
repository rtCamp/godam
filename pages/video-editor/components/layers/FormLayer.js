/**
 * External dependencies
 */

import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import Editor from '@monaco-editor/react';

/**
 * WordPress dependencies
 */
import { Button, SelectControl, ToggleControl, ComboboxControl, TextareaControl, Modal, Panel, PanelBody, Notice, TextControl } from '@wordpress/components';
import { arrowLeft, chevronRight, trash } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField, removeLayer } from '../../redux/slice/videoSlice';
import LayerControl from '../LayerControls';
import ColorPickerButton from '../ColorPickerButton';

const templateOptions = [
	{
		value: 'orbital',
		label: 'Orbital',
	},
	{
		value: 'gravity',
		label: 'Gravity',
	},
];

const FormLayer = ( { layerID, goBack } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const gforms = useSelector( ( state ) => state.videoReducer.gforms );
	const forms = gforms.map( ( form ) => ( {
		value: form.id,
		label: form.title,
	} ) );

	const [ formHTML, setFormHTML ] = useState( '' );

	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'gf_id', value: formID } ) );
	};

	useEffect( () => {
		if ( layer.gf_id ) {
			fetchGravityForm( layer.gf_id, layer.theme );
		}
	}, [
		layer.gf_id,
		layer.theme,
	] );

	// Fetch the Gravity Form HTML
	const fetchGravityForm = ( formId, theme ) => {
		axios.get( `/wp-json/godam/v1/gform`, {
			params: { id: formId, theme },
		} ).then( ( response ) => {
			setFormHTML( response.data );
		} ).catch( ( error ) => {
			console.error( error );
		} );
	};

	const isValidLicense = window?.videoData?.valid_license;

	return (
		<>
			<div className="flex justify-between items-center pb-3 border-b mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<p className="font-semibold">{ __( 'Form layer at', 'godam' ) } { layer.displayTime }s</p>
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
				! isValidLicense &&
				<Notice
					className="mb-4"
					status="warning"
					isDismissible={ false }
				>
					{ __( 'This features is available in premium version', 'godam' ) }
				</Notice>
			}

			{
				forms.length > 0 &&
					<GravityFormSelector disabled={ ! isValidLicense } className="gravity-form-selector mb-4" formID={ layer.gf_id } forms={ forms } handleChange={ changeFormID } />
			}

			<SelectControl
				className="mb-4"
				label={ __( 'Select form theme', 'godam' ) }
				options={ templateOptions }
				value={ layer.theme }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'theme', value } ) )
				}
				disabled={ ! isValidLicense }
			/>

			<ToggleControl
				className="mb-4"
				label={ __( 'Allow user to skip', 'godam' ) }
				checked={ layer.allow_skip }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'allow_skip', value } ) )
				}
				help={ __( 'If enabled, the user will be able to skip the form submission.', 'godam' ) }
				disabled={ ! isValidLicense }
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
						disabled={ ! isValidLicense }
					/>

					<label htmlFor="custom-css" className="easydam-label">{ __( 'Custom CSS', 'godam' ) }</label>

					<div className={ ! isValidLicense ? 'pointer-events-none opacity-50' : '' }>
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

			<LayerControl>
				<>
					<div
						style={ {
							backgroundColor: layer.bg_color,
						} } className="easydam-layer">
						<div className="form-container" dangerouslySetInnerHTML={ { __html: formHTML } } />
					</div>
					{ layer.allow_skip &&
					<Button
						className="skip-button"
						variant="primary"
						icon={ chevronRight }
						iconSize="18"
						iconPosition="right"
						onClick={ () => setOpen( false ) }
					>
						{ __( 'Skip', 'godam' ) }
					</Button>
					}
				</>
			</LayerControl>
		</>
	);
};

function GravityFormSelector( { className, disabled, formID, forms, handleChange } ) {
	const [ form, setForm ] = useState( formID );
	const [ filteredOptions, setFilteredOptions ] = useState( forms );

	const setFormData = ( value ) => {
		setForm( value );
		handleChange( value );
	};

	return (
		<>
			<ComboboxControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Select gravity form', 'godam' ) }
				className={ `${ className } ${ disabled ? 'disabled' : '' }` }
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
		</>
	);
}

function CustomCssInjector( { value, handleChange } ) {
	const [ customCss, setCustomCss ] = useState( value );

	useEffect( () => {
		// Create a <style> element
		const styleElement = document.createElement( 'style' );
		styleElement.type = 'text/css';
		styleElement.id = 'custom-css';

		// Append the <style> element to the <head>
		document.head.appendChild( styleElement );

		// Cleanup: Remove <style> on component unmount
		return () => {
			const existingStyle = document.getElementById( 'custom-css' );
			if ( existingStyle ) {
				document.head.removeChild( existingStyle );
			}
		};
	}, [] );

	useEffect( () => {
		// Inject CSS whenever it changes
		const styleElement = document.getElementById( 'custom-css' );
		if ( styleElement ) {
			styleElement.innerHTML = customCss;
		}
	}, [ customCss ] );

	return (
		<>
			<TextareaControl
				className="mb-4"
				label={ __( 'Custom CSS', 'godam' ) }
				placeholder={ __( '.classname { border: 1px solid blue; }', 'godam' ) }
				value={ customCss }
				onChange={ ( val ) => {
					setCustomCss( val );
					handleChange( val );
				} }
			/>
		</>
	);
}

export default FormLayer;
