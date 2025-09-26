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
import { arrowLeft, trash, notAllowed, check } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField, removeLayer } from '../../redux/slice/videoSlice';
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
	const dispatch = useDispatch();

	useEffect( () => {
		setLayerTime( layer?.displayTime );
		setInitialTimePeriod( layer?.displayTime );
	}, [ layer?.displayTime ] );

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
	const layerName = 'form' === layer.type ? layerTypeData?.formType[ layer?.form_type ?? 'gravity' ]?.layerText : layerTypeData?.layerText;

	const handleDeleteLayer = () => {
		dispatch( removeLayer( layer ) );
		goBack();
	};

	/**
	 * Render the appropriate action button based on layer type and state.
	 */
	const renderActionButton = () => {
		if ( layer?.isGlobalLayer ) {
			if ( layer?.isDisabled ) {
				return <Button icon={ check } title={ __( 'Enable layer', 'godam' ) } onClick={ handleDeleteLayer } />;
			}
			return <Button icon={ notAllowed } isDestructive title={ __( 'Disable layer', 'godam' ) } onClick={ handleDeleteLayer } />;
		}
		return <Button icon={ trash } isDestructive onClick={ () => setOpen( true ) } title={ __( 'Delete layer', 'godam' ) } />;
	};

	return (
		<>
			<div className="flex justify-between items-center border-b mb-3">
				<Button icon={ arrowLeft } onClick={ goBack } />
				<p className="text-base flex items-center gap-1">
					{ layerName }
					{ __( ' layer at', 'godam' ) }{ isEditing ? (
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
				{ renderActionButton() }
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
