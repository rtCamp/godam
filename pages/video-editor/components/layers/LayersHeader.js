/**
 * External dependencies
 */
import React from 'react';
/**
 * WordPress dependencies
 */
import { Button, Modal, TextControl, Notice } from '@wordpress/components';
import { useState, useEffect } from '@wordpress/element';
import { useDispatch, useSelector } from 'react-redux';
import { arrowLeft, trash, edit } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField, removeLayer, setCurrentLayer } from '../../redux/slice/videoSlice';
import { layerTypes } from '../SidebarLayers';

/**
 * Component that renders the header section for the selected layer.
 *
 * @param {Object}   param0          - Props passed to the LayersHeader component.
 * @param {Object}   param0.layer    - The layer object containing type and metadata.
 * @param {Function} param0.goBack   - Callback to navigate back to the previous view.
 * @param {number}   param0.duration - Total duration of the video (in seconds or milliseconds).
 *
 * @return {JSX.Element} The rendered LayersHeader component.
 */
const LayersHeader = ( { layer, goBack, duration } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const [ isEditing, setIsEditing ] = useState( false );
	const [ initialTimePeriod, setInitialTimePeriod ] = useState( '' );
	const [ layerTime, setLayerTime ] = useState( layer?.id );
	const [ layerName, setLayerName ] = useState( '' );
	const dispatch = useDispatch();

	useEffect( () => {
		setLayerTime( layer?.displayTime );
		setInitialTimePeriod( layer?.displayTime );
		setLayerName( layer?.name ?? '' );
	}, [ layer?.displayTime, layer?.name ] );

	const layers = useSelector( ( state ) => state.videoReducer.layers );

	const isDuplicateTime = layers?.some(
		( singleLayer ) =>
			Number( singleLayer.displayTime ) === Number( layerTime ) &&
		singleLayer?.id !== layer?.id,
	);

	/**
	 * Get the layer data.
	 */
	const layerTypeData = layerTypes.find( ( l ) => l.type === layer.type );

	// Base label from type/subtype.
	const baseLabel = layer?.type === 'form' ? layerTypeData?.formType?.[ layer?.form_type ?? 'gravity' ]?.layerText : layerTypeData?.layerText;

	// Prefer custom name if present; fall back to base label.
	const titlePrefix = ( layer?.name && String( layer.name ).trim() ) ? layer.name : baseLabel;

	const handleDeleteLayer = () => {
		dispatch( removeLayer( { id: layer.id } ) );
		goBack();
	};

	return (
		<>
			<div className="flex justify-between items-center border-b py-4 mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<div className="flex-1 flex items-center justify-center ml-2">
					{ ! isEditing ? (
						<p className="text-base flex items-center gap-1">
							{ titlePrefix } { __( 'layer at', 'godam' ) } { layer.displayTime }s
						</p>
					) : (
						<div className="flex items-center gap-2 flex-wrap">
							{ /* Name input */ }
							<TextControl
								__nextHasNoMarginBottom
								value={ layerName }
								placeholder={ baseLabel }
								onClick={ ( e ) => e.stopPropagation() }
								maxLength={ 40 }
								onChange={ ( val ) => {
									const v = ( val || '' ).slice( 0, 40 );
									setLayerName( v );
									dispatch( updateLayerField( {
										id: layer.id, field: 'name', value: v,
									} ) );
									dispatch( setCurrentLayer( { ...layer, name: v } ) );
								} }
								style={ { minWidth: 220, height: 28 } }
							/>
							<span>{ __( 'layer at', 'godam' ) }</span>
							{ /* Timestamp input */ }
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize={ false }
								value={ layerTime }
								style={ { width: 80, height: 28 } }
								onClick={ ( e ) => e.stopPropagation() }
								type="number"
								onChange={ ( value ) => {
									// Remove leading zeros.
									let normalizedValue = value.replace( /^0+(?=\d)/, '' );

									// Limit to 2 decimal places.
									if ( normalizedValue.includes( '.' ) ) {
										const [ intPart, decimalPart ] = normalizedValue.split( '.' );
										normalizedValue = intPart + '.' + decimalPart.slice( 0, 2 );
									}

									// Convert to number for validation
									const floatValue = parseFloat( normalizedValue );

									if ( floatValue > duration ) {
										return;
									}

									// Reject empty or over-duration values.
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

									// Check for duplicate timestamp.
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
								aria-label={ __( 'Layer timestamp', 'godam' ) }
							/>
							<span>{ __( 's', 'godam' ) }</span>
						</div>
					) }
				</div>

				<div className="flex items-center gap-2">
					<Button
						icon={ edit }
						label={ __( 'Edit layer', 'godam' ) }
						onClick={ () => {
							setIsEditing( true );
							setLayerTime( layer?.displayTime );
							setInitialTimePeriod( layer?.displayTime );
							setLayerName( layer?.name ?? '' );
						} }
					/>
					<Button icon={ trash } isDestructive onClick={ () => setOpen( true ) } />
				</div>

				{ isOpen && (
					<Modal
						title={ __( 'Delete layer', 'godam' ) }
						onRequestClose={ () => setOpen( false ) }
					>
						<div className="flex justify-between items-center gap-3">
							<Button
								isTertiary
								className="w-full justify-center godam-button"
								onClick={ () => setOpen( false ) }
							>
								{ __( 'Cancel', 'godam' ) }
							</Button>
							<Button
								className="w-full justify-center godam-button"
								isDestructive
								onClick={ handleDeleteLayer }
							>
								{ __( 'Delete layer', 'godam' ) }
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
		</>
	);
};

export default LayersHeader;
