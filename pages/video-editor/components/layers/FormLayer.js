/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import Editor from '@monaco-editor/react';

/**
 * WordPress dependencies
 */
import { Button, ToggleControl, Modal, Panel, PanelBody, Notice, TextControl } from '@wordpress/components';
import { arrowLeft, trash } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField, removeLayer } from '../../redux/slice/videoSlice';

import GravityForm from '../forms/GravityForm';
import WPForm from '../forms/WPForm';
import CF7 from '../forms/CF7';
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';

const FormLayer = ( { layerID, goBack, duration } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const [ isEditing, setIsEditing ] = useState( false );
	const [ initialTimePeriod, setInitialTimePeriod ] = useState( '' );
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const [ layerTime, setLayerTime ] = useState( layer?.id );

	function getFormPluginName( formType ) {
		switch ( formType ) {
			case 'gravity':
				return 'Gravity Forms';
			case 'wpforms':
				return 'WPForms';
			case 'cf7':
				return 'Contact Form 7';
			default:
				return 'Gravity Forms';
		}
	}

	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

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

	const layers = useSelector( ( state ) => state.videoReducer.layers );

	useEffect( () => {
		setLayerTime( layer?.displayTime );
		setInitialTimePeriod( layer?.displayTime );
	}, [] );

	const isDuplicateTime = layers?.some(
		( singleLayer ) =>
			Number( singleLayer.displayTime ) === Number( layerTime ) &&
	singleLayer?.id !== layer?.id,
	);

	return (
		<>
			<div>
				<div className="flex justify-between items-center border-b mb-3">
					<Button icon={ arrowLeft } onClick={ goBack } />
					<p className="text-base flex items-center gap-1">{ getFormPluginName( layer?.form_type ) }{ __( ' layer at', 'godam' ) }
						{ isEditing ? (
							<TextControl
								__nextHasNoMarginBottom={ true }
								__next40pxDefaultSize={ false }
								value={ layerTime }
								style={ { width: 60, height: 20 } }
								onClick={ ( e ) => e.stopPropagation() }
								type="number"
								onChange={ ( value ) => {
									// Remove leading zeros
									let normalizedValue = value.replace( /^0+(?=\d)/, '' );

									// Limit to 2 decimal places
									if ( normalizedValue.includes( '.' ) ) {
										const [ intPart, decimalPart ] = normalizedValue.split( '.' );
										normalizedValue = intPart + '.' + decimalPart.slice( 0, 2 );
									}

									// Convert to number for validation
									const floatValue = parseFloat( normalizedValue );

									if ( floatValue > duration ) {
										return;
									}

									// Reject empty or over-duration values
									if ( normalizedValue === '' || isNaN( floatValue ) ) {
										setLayerTime( normalizedValue );
										dispatch( updateLayerField( {
											id: layer.id,
											field: 'displayTime',
											value: initialTimePeriod,
										} ) );
										return;
									}

									setLayerTime( normalizedValue );

									// Check for duplicate timestamp
									const isTimestampExists = layers?.some(
										( singleLayer ) =>
											Number( singleLayer.displayTime ) === floatValue &&
																											singleLayer?.id !== layer?.id,
									);

									if ( isTimestampExists ) {
										dispatch( updateLayerField( {
											id: layer.id,
											field: 'displayTime',
											value: initialTimePeriod,
										} ) );
									} else {
										dispatch( updateLayerField( {
											id: layer.id,
											field: 'displayTime',
											value: normalizedValue,
										} ) );
									}
								} }
								min={ 0 }
								max={ duration }
								step={ 0.1 }
							/>
						) : (
							<button
								onClick={ () => setIsEditing( true ) }
								className="cursor-pointer bg-transparent text-inherit p-0"
							>
								{ layer.displayTime }s
							</button>
						) }
					</p>
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

				{ isDuplicateTime && isEditing && <Notice
					className="mb-4"
					status="error"
					isDismissible={ false }
				>
					{ __( 'A layer already exists at this timestamp!', 'godam' ) }
				</Notice>
				}
				{
					isEditing && '' === layerTime && <Notice
						className="mb-4"
						status="error"
						isDismissible={ false }
					>
						{ __( 'The timestamp cannot be an empty value!', 'godam' ) }
					</Notice>
				}
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
