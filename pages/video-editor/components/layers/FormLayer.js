/**
 * External dependencies
 */

import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import Editor from '@monaco-editor/react';

/**
 * WordPress dependencies
 */
import { Button, SelectControl, ToggleControl, ComboboxControl, TextareaControl, Modal, ColorPalette } from '@wordpress/components';
import { arrowLeft, chevronRight, trash } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField, removeLayer } from '../../redux/slice/videoSlice';
import LayerControl from '../LayerControls';

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

	const [ formHTML, setFormHTML ] = useState( '' );
	const [ forms, setForms ] = useState( [] );

	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

	const changeFormID = ( formID ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'gf_id', value: formID } ) );
	};

	useEffect( () => {
		console.log( 'Form ID:', layer.gf_id );
		if ( layer.gf_id ) {
			fetchGravityForm( layer.gf_id );
		}
	}, [
		layer.gf_id,
	] );

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

	// Fetch the Gravity Form HTML
	const fetchGravityForm = ( formId ) => {
		axios.get( `/wp-json/easydam/v1/gforms/${ formId }` )
			.then( ( response ) => {
				setFormHTML( response.data );
			} )
			.catch( ( error ) => {
				console.error( error );
			} );
	};

	return (
		<>
			<div className="flex justify-between items-center pb-3 border-b mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<p className="font-semibold">{ __( 'Form layer at', 'transcoder' ) } { layer.displayTime }s</p>
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

			{
				forms.length > 0 &&
					<GravityFormSelector className="gravity-form-selector mb-4" formID={ layer.gf_id } forms={ forms } handleChange={ changeFormID } />
			}

			<SelectControl
				className="mb-4"
				label={ __( 'Select form theme', 'transcoder' ) }
				options={ templateOptions }
				value={ layer.theme }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'theme', value } ) )
				}
			/>
			<label htmlFor="custom-css" className="text-[11px] uppercase font-medium mb-2">{ __( 'Custom CSS', 'transcoder' ) }</label>
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

			{ /* Layer background color */ }
			<label htmlFor="custom-css" className="text-[11px] uppercase font-medium mb-2">{ __( 'Layer background color', 'transcoder' ) }</label>
			<ColorPalette
				value={ layer.bg_color ?? '#FFFFFFB3' }
				enableAlpha={ true }
				onChange={ ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'bg_color', value } ) ) }
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

			<LayerControl>
				<>
					<div
						style={ {
							backgroundColor: layer.bg_color,
						} }
						className="absolute inset-0 overflow-auto px-4 py-8 bg-white bg-opacity-70 my-auto"
					>
						<div>
							<div className="max-w-[400px] mx-auto" dangerouslySetInnerHTML={ { __html: formHTML } } />
						</div>
					</div>
					{
						layer.allow_skip &&
						<Button
							className="absolute bottom-6 right-0"
							variant="primary"
							icon={ chevronRight }
							iconSize="18"
							iconPosition="right"
							onClick={ () => setOpen( false ) }
						>
							{ __( 'Skip', 'transcoder' ) }
						</Button>
					}
				</>
			</LayerControl>
		</>
	);
};

function GravityFormSelector( { className, formID, forms, handleChange } ) {
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
				label={ __( 'Custom CSS', 'transcoder' ) }
				placeholder={ __( '.classname { border: 1px solid blue; }', 'transcoder' ) }
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
