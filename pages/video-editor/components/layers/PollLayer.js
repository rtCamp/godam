/**
 * External dependencies
 */

import { useDispatch, useSelector } from 'react-redux';
import Editor from '@monaco-editor/react';

/**
 * WordPress dependencies
 */
import { Button, ToggleControl, ComboboxControl, Modal, Panel, PanelBody, TextControl, Notice } from '@wordpress/components';
import { arrowLeft, chevronRight, trash } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { updateLayerField, removeLayer } from '../../redux/slice/videoSlice';
import LayerControl from '../LayerControls';
import ColorPickerButton from '../shared/color-picker/ColorPickerButton.jsx';

import { useGetPollsQuery, useGetPollQuery } from '../../redux/api/polls';

const PollLayer = ( { layerID, goBack, duration } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const [ isEditing, setIsEditing ] = useState( false );
	const [ initialTimePeriod, setInitialTimePeriod ] = useState( '' );
	const dispatch = useDispatch();
	const layer = useSelector( ( state ) => state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ) );
	const [ layerTime, setLayerTime ] = useState( layer?.id );

	const { data: polls } = useGetPollsQuery();
	const { data: currentPoll } = useGetPollQuery( layer.poll_id, { skip: ! layer.poll_id } );

	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

	const handlePollChange = ( value ) => {
		dispatch( updateLayerField( { id: layer.id, field: 'poll_id', value } ) );
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
					<p className="text-base flex items-center gap-1">{ __( 'Poll layer at', 'godam' ) }
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
					isDismissible={ true }
				>
					{ __( 'A layer already exists at this timestamp!', 'godam' ) }
				</Notice>
				}
				{
					isEditing && '' === layerTime && <Notice
						className="mb-4"
						status="error"
						isDismissible={ true }
					>
						{ __( 'The timestamp cannot be an empty value!', 'godam' ) }
					</Notice>
				}
			</div>

			{
				polls?.length > 0 &&
					<ComboboxControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Select poll', 'godam' ) }
						className="godam-combobox mb-4"
						value={ layer.poll_id }
						onChange={ handlePollChange }
						options={ polls.map( ( poll ) => ( { value: poll.pollq_id, label: poll.pollq_question } ) ) }
					/>
			}

			<ToggleControl
				className="mb-4 godam-toggle"
				label={ __( 'Allow user to skip', 'godam' ) }
				checked={ layer.allow_skip }
				onChange={ ( value ) =>
					dispatch( updateLayerField( { id: layer.id, field: 'allow_skip', value } ) )
				}
				help={ __( 'If enabled, the user will be able to skip the form submission.', 'godam' ) }
			/>

			<Panel
				className="-mx-4 border-x-0 godam-advance-panel">
				<PanelBody
					title={ __( 'Advance', 'godam' ) }
					initialOpen={ false }
				>

					{ /* Layer background color */ }
					<label
						htmlFor="color"
						className="text-base font-medium block mb-2"
					>
						{ __( 'Color', 'godam' ) }
					</label>
					<ColorPickerButton
						className="mb-4"
						value={ layer?.bg_color ?? '#FFFFFFB3' }
						label={ __( 'Layer background color', 'godam' ) }
						enableAlpha={ true }
						onChange={ ( value ) => dispatch( updateLayerField( { id: layer.id, field: 'bg_color', value } ) ) }
					/>

					<label htmlFor="custom-css" className="text-base font-medium block mb-2">{ __( 'Custom CSS', 'godam' ) }</label>

					<div>
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
						<div className="form-container poll-container" dangerouslySetInnerHTML={ { __html: currentPoll?.html } } />
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

export default PollLayer;
